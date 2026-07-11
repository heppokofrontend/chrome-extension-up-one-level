import {
  MENU_ITEM_ID,
  MENU_ITEM_ID_TOGGLE,
  STORAGE_KEY_STATE,
  type WorkerToContentMessage,
} from './constants';

const checkIsShortcutEnabled = async () => {
  const data = await chrome.storage.local.get(STORAGE_KEY_STATE);
  return data[STORAGE_KEY_STATE] === true;
};

const sendToTab = async (tab: chrome.tabs.Tab | undefined, message: WorkerToContentMessage) => {
  if (tab?.id === undefined || tab.url?.startsWith('http') !== true) {
    return;
  }
  try {
    await chrome.tabs.sendMessage(tab.id, message);
  } catch (error) {
    console.warn('[Chrome Extension Up One Level] sendMessage failed', error);
  }
};

// contextMenus API のエラーは Chrome 122 以前では Promise の reject にならず
// chrome.runtime.lastError にしか現れないため、コールバック形式でラップする。
const createMenu = (spec: chrome.contextMenus.CreateProperties) =>
  new Promise<void>((resolve) => {
    chrome.contextMenus.create(spec, () => {
      if (chrome.runtime.lastError) {
        console.warn(
          '[Chrome Extension Up One Level] contextMenus.create failed',
          chrome.runtime.lastError.message,
        );
      }
      resolve();
    });
  });

const removeAllMenus = () =>
  new Promise<void>((resolve) => {
    chrome.contextMenus.removeAll(() => {
      resolve();
    });
  });

// メニューは onInstalled では作らない。onInstalled は無効化→再有効化では発火せず、
// 無効化の時点でメニューは破棄されるため、それだけに依存すると再有効化後に
// メニューが消えたままになる（v1.1.1 で権限追加により自動無効化されて表面化）。
// 代わりに worker の起動ごとに保存状態から全メニューを作り直す。
const rebuildMenus = async (isShortcutEnabled: boolean) => {
  await removeAllMenus();
  await createMenu({
    id: MENU_ITEM_ID,
    title: `${chrome.i18n.getMessage('shortcut')}${chrome.i18n.getMessage(
      isShortcutEnabled ? 'shortcut_enabled' : 'shortcut_disabled',
    )}`,
    contexts: ['all'],
  });
  await createMenu({
    id: MENU_ITEM_ID_TOGGLE,
    parentId: MENU_ITEM_ID,
    title: chrome.i18n.getMessage(
      isShortcutEnabled ? 'shortcut_to_disabled' : 'shortcut_to_enabled',
    ),
    contexts: ['all'],
  });
};

void (async () => {
  const isShortcutEnabled = await checkIsShortcutEnabled();
  await rebuildMenus(isShortcutEnabled);
})();

const injectIntoExistingTabs = async () => {
  const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });

  for (const tab of tabs) {
    if (tab.id === undefined) {
      continue;
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content-scripts.js'],
      });
    } catch {
      // Chrome Web Store やその他の注入禁止ページは失敗するので無視する。
    }
  }
};

void injectIntoExistingTabs();

chrome.action.onClicked.addListener((tab) => {
  if (tab.id === undefined) {
    return;
  }

  void sendToTab(tab, { tabId: tab.id, taskId: 'run' });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ITEM_ID_TOGGLE) return;

  void (async () => {
    const nextIsShortcutEnabled = !(await checkIsShortcutEnabled());

    await chrome.storage.local.set({ [STORAGE_KEY_STATE]: nextIsShortcutEnabled });
    await rebuildMenus(nextIsShortcutEnabled);

    if (tab?.id !== undefined) {
      await sendToTab(tab, {
        tabId: tab.id,
        taskId: 'update',
        isShortcutEnabled: nextIsShortcutEnabled,
      });
    }
  })();
});

chrome.runtime.onMessage.addListener((message: unknown, sender) => {
  const tab = sender.tab;

  if (
    typeof message !== 'object' ||
    message === null ||
    !('type' in message) ||
    message.type !== 'getTabId' ||
    tab?.id === undefined
  ) {
    return;
  }

  const tabId = tab.id;

  void (async () => {
    const isShortcutEnabled = await checkIsShortcutEnabled();
    await sendToTab(tab, { tabId, taskId: 'init', isShortcutEnabled });
  })();
});
