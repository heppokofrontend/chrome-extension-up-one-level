const run = (tabId: number) => {
  if (window.location.origin === window.location.href.replace(/\/$/, '')) {
    console.log('Chrome Extension Up One Level: The current directory is the top-level directory.');
    return;
  }

  const storageKey = `heppokofrontend.up-one-level-${tabId}`;
  const generateHref = (url = window.location.href) => {
    const { origin, pathname, search, hash } = new URL(url);

    if (hash) {
      return `${origin}${pathname}${search}`;
    }

    if (search) {
      return `${origin}${pathname}`;
    }

    const end = pathname.endsWith('/') ? -2 : -1;

    return `${origin}${pathname.split('/').slice(0, end).join('/') || ''}`;
  };
  const url = (() => {
    const _url = generateHref();

    try {
      const prev = sessionStorage.getItem(storageKey);

      // 今回も1つ前に遷移しようとしたページと同じなら2段階で上がってみる
      if (_url === prev) {
        const newUrl = generateHref(_url);

        if (_url === newUrl) {
          throw new Error(
            'Chrome Extension Up One Level: Current directory seems to be the root directory because it is the same as the URL attempted to navigate before.',
          );
        }

        return newUrl;
      }
    } catch {}

    return _url;
  })();

  try {
    sessionStorage.setItem(storageKey, url);
  } catch {}

  location.href = url;
};

let tabIdCache = -1;
const onkeydownHandler = (e: KeyboardEvent) => {
  if (e.altKey || e.metaKey) {
    if (e.key === 'ArrowUp') {
      run(tabIdCache);
    }
  }
};

chrome.runtime.onMessage.addListener(
  ({ tabId, taskId, state }: { tabId: number; taskId: string; state?: boolean }) => {
    tabIdCache = tabId;

    if (taskId === 'run') {
      run(tabId);

      return;
    }

    if (taskId === 'update' || taskId === 'init') {
      if (taskId === 'update') {
        console.log(
          `Chrome Extension Up One Level: The shortcut is ${state ? 'enabled' : 'disabled'}`,
        );
      }

      window.removeEventListener('keydown', onkeydownHandler);

      if (state) {
        window.addEventListener('keydown', onkeydownHandler);
      }
    }
  },
);

chrome.runtime.sendMessage({ type: 'getTabId' });

window.addEventListener('focus', () => {
  chrome.runtime.sendMessage({ type: 'getTabId' });
});
