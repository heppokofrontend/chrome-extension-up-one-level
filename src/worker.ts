import {
  MENU_ITEM_ID,
  MENU_ITEM_ID_TOGGLE,
  STORAGE_KEY_STATE,
  type WorkerToContentMessage,
} from './constants';

const getMenuTitle = (isShortcutEnabled: boolean) =>
  `${chrome.i18n.getMessage('shortcut')}${chrome.i18n.getMessage(
    isShortcutEnabled ? 'shortcut_enabled' : 'shortcut_disabled',
  )}`;

const getToggleTitle = (isShortcutEnabled: boolean) =>
  chrome.i18n.getMessage(isShortcutEnabled ? 'shortcut_to_disabled' : 'shortcut_to_enabled');

const checkIsShortcutEnabled = async () => {
  const data = await chrome.storage.local.get(STORAGE_KEY_STATE);
  return data[STORAGE_KEY_STATE] === true;
};

const sendToTab = async (tab: chrome.tabs.Tab | undefined, message: WorkerToContentMessage) => {
  if (
    tab === undefined ||
    tab.id === undefined ||
    tab.url === undefined ||
    !tab.url.startsWith('http')
  ) {
    return;
  }
  try {
    await chrome.tabs.sendMessage(tab.id, message);
  } catch (error) {
    console.warn('[Chrome Extension Up One Level] sendMessage failed', error);
  }
};

const updateMenus = async (isShortcutEnabled: boolean) => {
  try {
    await chrome.contextMenus.update(MENU_ITEM_ID, { title: getMenuTitle(isShortcutEnabled) });
    await chrome.contextMenus.update(MENU_ITEM_ID_TOGGLE, {
      title: getToggleTitle(isShortcutEnabled),
    });
  } catch (error) {
    console.warn('[Chrome Extension Up One Level] contextMenus.update failed', error);
  }
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ITEM_ID,
    title: getMenuTitle(false),
    contexts: ['all'],
  });
  chrome.contextMenus.create({
    id: MENU_ITEM_ID_TOGGLE,
    parentId: MENU_ITEM_ID,
    title: getToggleTitle(false),
    contexts: ['all'],
  });
});

// On worker startup (cold start) sync the menu titles with the stored state.
void (async () => {
  const isShortcutEnabled = await checkIsShortcutEnabled();
  await updateMenus(isShortcutEnabled);
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
    await updateMenus(nextIsShortcutEnabled);

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
