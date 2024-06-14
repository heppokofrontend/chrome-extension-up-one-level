{
  chrome.action.onClicked.addListener(() => {
    new Promise(async () => {
      const [tab] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
      });

      if (tab.url?.startsWith('http') && typeof tab.id === 'number') {
        chrome.tabs.sendMessage(tab.id, { tabId: tab.id, taskId: 'run' }).catch(console.log);
      }
    });

    return true;
  });
}

{
  const contextMenuId = 'heppokofrontend-up-one-level';
  const contextMenuIdForToggle = 'heppokofrontend-up-one-level-toggle';
  const sendEnabled = (tab: chrome.tabs.Tab | undefined, state: boolean, init?: boolean) => {
    if (tab) {
      if (tab.url?.startsWith('http') && typeof tab.id === 'number') {
        chrome.tabs
          .sendMessage(tab.id, { tabId: tab.id, taskId: init ? 'init' : 'update', state })
          .catch(console.log);
      }
    }
  };

  const parentId = chrome.contextMenus.create({
    id: contextMenuId,
    title: `${chrome.i18n.getMessage('shortcut')}${chrome.i18n.getMessage('shortcut_disabled')}`,
    contexts: ['all'],
  });

  chrome.contextMenus.create({
    id: contextMenuIdForToggle,
    title: chrome.i18n.getMessage('shortcut_to_enabled'),
    contexts: ['all'],
    parentId,
  });

  chrome.storage.local.get('state', function (data) {
    const state = Boolean(data.state);

    new Promise(async () => {
      const [tab] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
      });

      if (tab.url?.startsWith('http') && typeof tab.id === 'number') {
        chrome.contextMenus.update(contextMenuId, {
          title: `${chrome.i18n.getMessage('shortcut')}${chrome.i18n.getMessage(
            state ? 'shortcut_enabled' : 'shortcut_disabled',
          )}`,
          contexts: ['all'],
        });
        chrome.contextMenus.update(contextMenuIdForToggle, {
          title: chrome.i18n.getMessage(state ? 'shortcut_to_disabled' : 'shortcut_to_enabled'),
          contexts: ['all'],
        });

        sendEnabled(tab, state, true);
      }
    });

    return true;
  });

  chrome.contextMenus.onClicked.addListener((_, tab) => {
    chrome.storage.local.get('state', (data) => {
      const state = !Boolean(data.state);

      chrome.storage.local.set({ state });
      chrome.contextMenus.update(contextMenuId, {
        title: `${chrome.i18n.getMessage('shortcut')}${chrome.i18n.getMessage(
          state ? 'shortcut_enabled' : 'shortcut_disabled',
        )}`,
        contexts: ['all'],
      });
      chrome.contextMenus.update(contextMenuIdForToggle, {
        title: chrome.i18n.getMessage(state ? 'shortcut_to_disabled' : 'shortcut_to_enabled'),
        contexts: ['all'],
      });

      sendEnabled(tab, state);
    });
  });

  chrome.runtime.onMessage.addListener((message, sender) => {
    if (message.type === 'getTabId' && sender?.tab) {
      chrome.storage.local.get('state', function (data) {
        const state = Boolean(data.state);
        sendEnabled(sender.tab, state, true);
      });
    }
  });
}
