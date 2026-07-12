export const INJECTED_MARKER_KEY = '__heppokofrontend.up-one-level.injected__';

export const MENU_ITEM_ID = 'heppokofrontend.up-one-level';
export const MENU_ITEM_ID_TOGGLE = 'heppokofrontend.up-one-level.toggle';
export const STORAGE_KEY_STATE = 'state';
export const SESSION_KEY_PREFIX = 'heppokofrontend.up-one-level-';

export type WorkerToContentMessage =
  | {
      tabId: number;
      taskId: 'run';
    }
  | {
      tabId: number;
      taskId: 'update' | 'init';
      isShortcutEnabled: boolean;
    };

export type ContentToWorkerMessage = { type: 'getTabId' };
