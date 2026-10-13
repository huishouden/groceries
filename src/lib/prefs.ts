import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useUrlParam } from '@huishouden/pwa-kit/react/url-state';
import { setUrlParams } from '@huishouden/pwa-kit/url-state';
import { resolveView, type Mode } from './view';

/**
 * Where preferences are kept: the signed-out sample household uses its own keys, so trying it
 * never changes the signed-in app's chosen list, mode or "added by" name.
 */
export const PrefScope = createContext('');

/** Per-device preference stored in localStorage; each tablet or phone keeps its own. */
export function usePref<T>(key: string, initial: T): [T, (value: T) => void] {
  const scope = useContext(PrefScope);
  // The app's original name; kept so installed copies keep their settings across the rename.
  const storageKey = `hearthlist.${scope}${key}`;
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(value));
  }, [storageKey, value]);
  return [value, setValue];
}

/**
 * The view and list on screen: in the address (`?mode=&list=`), so a reload (an update) and Back
 * return to them, and remembered per device (scoped like every pref) for a bare address. `lists` is
 * null until they load. The rule is `resolveView`. Switching view or list pushes a history entry.
 */
export function useView(lists: readonly { id: string }[] | null): {
  mode: Mode;
  list: string;
  setMode: (mode: Mode) => void;
  setList: (id: string) => void;
} {
  const [savedMode, saveMode] = usePref<Mode>('mode', 'lists');
  const [savedList, saveList] = usePref<string>('list', 'groceries');
  const [urlMode] = useUrlParam('mode');
  const [urlList] = useUrlParam('list');
  const chosen = useRef<string | null>(null);
  const pinnedAt = useRef<string | undefined>(undefined);
  // The pin on a chosen list covers only the moment before its snapshot arrives: the next lists
  // (which carry it, Firestore applying local writes at once) end it, so a list deleted later is
  // corrected in the address like any other stale id. Decided here, before the choice below.
  const ids = lists?.map((l) => l.id);
  if (chosen.current && ids?.join('\n') !== pinnedAt.current) chosen.current = null;
  const view = resolveView({ mode: urlMode, list: urlList }, { mode: savedMode, list: savedList }, ids ?? null, chosen.current);
  const { mode: saveModeTo, list: saveListTo } = view.save;
  const addressMode = view.address?.mode;
  const addressList = view.address?.list;
  useEffect(() => {
    if (saveModeTo) saveMode(saveModeTo);
    if (saveListTo) saveList(saveListTo);
    if (addressMode && addressList) setUrlParams({ mode: addressMode, list: addressList }, { replace: true });
  }, [saveModeTo, saveListTo, addressMode, addressList, saveMode, saveList]);
  const setMode = useCallback((mode: Mode) => setUrlParams({ mode }), []);
  const setList = useCallback(
    (id: string) => {
      chosen.current = lists?.some((l) => l.id === id) ? null : id;
      pinnedAt.current = lists?.map((l) => l.id).join('\n');
      setUrlParams({ list: id });
    },
    [lists],
  );
  return { mode: view.mode, list: view.list, setMode, setList };
}

/** Keeps the screen on while the kitchen hub is showing. */
export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
      } catch {
        // Denied when the page is hidden or the battery saver is on; retried on visibility change.
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire();
    };
    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release();
    };
  }, [enabled]);
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function useInstallPrompt(): { canInstall: boolean; installed: boolean; install: () => Promise<void> } {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches);
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setEvent(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  return {
    canInstall: event !== null,
    installed,
    install: async () => {
      if (!event) return;
      await event.prompt();
      await event.userChoice;
      setEvent(null);
    },
  };
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}
