import {
  SESSION_KEY_PREFIX,
  type ContentToWorkerMessage,
  type WorkerToContentMessage,
} from './constants';

const generateHref = (url: string) => {
  const { origin, pathname, search, hash } = new URL(url);

  if (hash) {
    return `${origin}${pathname}${search}`;
  }
  if (search) {
    return `${origin}${pathname}`;
  }

  const end = pathname.endsWith('/') ? -2 : -1;

  return `${origin}${pathname.split('/').slice(0, end).join('/')}`;
};

const checkIsAtRoot = () => window.location.origin === window.location.href.replace(/\/$/, '');

const navigateToParentDir = (tabId: number) => {
  if (checkIsAtRoot()) {
    console.log('[Chrome Extension Up One Level] Already at the top-level directory.');
    return;
  }

  const storageKey = `${SESSION_KEY_PREFIX}${String(tabId)}`;
  let nextUrl = generateHref(window.location.href);

  try {
    const prevUrl = sessionStorage.getItem(storageKey);
    // 今回も1つ前に遷移しようとしたページと同じなら2段階で上がってみる
    if (nextUrl === prevUrl) {
      const parentUrl = generateHref(nextUrl);
      if (nextUrl === parentUrl) {
        console.warn('[Chrome Extension Up One Level] Already at the root after retrying.');
        return;
      }
      nextUrl = parentUrl;
    }
  } catch {
    // do nothing
  }

  try {
    sessionStorage.setItem(storageKey, nextUrl);
  } catch {
    // do nothing
  }

  window.location.href = nextUrl;
};

let currentTabId: number | null = null;

const checkIsEditableTarget = (target: EventTarget | null) => {
  const { activeElement } = document;
  if (activeElement === null || target !== activeElement) return false;
  if (
    activeElement instanceof HTMLInputElement ||
    activeElement instanceof HTMLTextAreaElement ||
    activeElement instanceof HTMLSelectElement
  ) {
    return true;
  }
  return activeElement instanceof HTMLElement && activeElement.isContentEditable;
};

const onKeyDown = (event: KeyboardEvent) => {
  if (
    currentTabId === null ||
    checkIsEditableTarget(event.target) ||
    !(event.altKey || event.metaKey) ||
    event.key !== 'ArrowUp'
  ) {
    return;
  }
  event.preventDefault();
  navigateToParentDir(currentTabId);
};

const checkIsWorkerMessage = (message: unknown): message is WorkerToContentMessage => {
  if (
    typeof message !== 'object' ||
    message === null ||
    !('tabId' in message) ||
    typeof message.tabId !== 'number' ||
    !('taskId' in message)
  ) {
    return false;
  }

  if (message.taskId === 'run') {
    return true;
  }

  if (message.taskId !== 'update' && message.taskId !== 'init') {
    return false;
  }

  return 'isShortcutEnabled' in message && typeof message.isShortcutEnabled === 'boolean';
};

chrome.runtime.onMessage.addListener((message: unknown) => {
  if (!checkIsWorkerMessage(message)) return;
  currentTabId = message.tabId;

  if (message.taskId === 'run') {
    navigateToParentDir(message.tabId);
    return;
  }

  if (message.taskId === 'update') {
    console.log(
      `[Chrome Extension Up One Level] Shortcut is ${message.isShortcutEnabled ? 'enabled' : 'disabled'}`,
    );
  }

  window.removeEventListener('keydown', onKeyDown);

  if (message.isShortcutEnabled) {
    window.addEventListener('keydown', onKeyDown);
  }
});

const requestTabId = () => {
  // 拡張機能のリロード対策
  try {
    const message: ContentToWorkerMessage = {
      type: 'getTabId',
    };
    void chrome.runtime.sendMessage(message).catch(() => undefined);
  } catch {
    // do nothing
  }
};

requestTabId();
window.addEventListener('focus', requestTabId);
