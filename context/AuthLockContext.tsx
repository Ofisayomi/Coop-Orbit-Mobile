import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { getStoredTokens, isExternalActivityActive } from '@/services/authService';

/** Background time after which the app locks. Per spec: 60 seconds. */
export const APP_LOCK_TIMEOUT_MS = 60 * 1000;

const LAST_BACKGROUNDED_KEY = 'app_lock_last_backgrounded_at';

interface AuthLockContextValue {
  /** True while the lock-screen overlay must cover the app. */
  isLocked: boolean;
  /** Engage the lock (e.g. after the background timeout expires). */
  lock: () => void;
  /** Release the lock after a successful biometric/PIN unlock. */
  unlock: () => void;
}

const AuthLockContext = createContext<AuthLockContextValue>({
  isLocked: false,
  lock: () => undefined,
  unlock: () => undefined,
});

export function useAppLock(): AuthLockContextValue {
  return useContext(AuthLockContext);
}

async function readLastBackgroundedAt(): Promise<number | null> {
  try {
    const raw = await SecureStore.getItemAsync(LAST_BACKGROUNDED_KEY);
    const value = raw == null ? NaN : Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

async function writeLastBackgroundedAt(now: number): Promise<void> {
  try {
    await SecureStore.setItemAsync(LAST_BACKGROUNDED_KEY, String(now));
  } catch {
    // Best effort; in-memory timestamp below still applies this session.
  }
}

async function clearLastBackgroundedAt(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(LAST_BACKGROUNDED_KEY);
  } catch {
    // Best effort.
  }
}

export function AuthLockProvider({ children }: { children: React.ReactNode }) {
  const [isLocked, setIsLocked] = useState(false);
  const lastBackgroundedAt = useRef<number | null>(null);
  const isLockedRef = useRef(false);
  isLockedRef.current = isLocked;

  const lock = useCallback(() => {
    setIsLocked(true);
  }, []);

  const unlock = useCallback(() => {
    setIsLocked(false);
    lastBackgroundedAt.current = null;
    void clearLastBackgroundedAt();
  }, []);

  // Cold start after a long time away: engage the lock if a session exists.
  useEffect(() => {
    (async () => {
      try {
        const { refreshToken } = await getStoredTokens();
        if (!refreshToken) return;
        const at = await readLastBackgroundedAt();
        lastBackgroundedAt.current = at;
        if (at != null && Date.now() - at >= APP_LOCK_TIMEOUT_MS) {
          setIsLocked(true);
        }
      } catch {
        // Never block startup on lock bookkeeping.
      }
    })();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      // Only real background transitions arm the timer. Transient 'inactive'
      // states (iOS control center, incoming call UI) must not start it, and
      // system picker/camera trips must never lock (see withExternalActivity).
      if (nextState === 'background') {
        if (isExternalActivityActive()) return;
        const now = Date.now();
        lastBackgroundedAt.current = now;
        await writeLastBackgroundedAt(now);
        return;
      }

      if (nextState !== 'active') return;

      // Foreground return during a system picker/camera flow: resume silently
      // without touching lock state, so in-progress forms survive untouched.
      if (isExternalActivityActive()) return;

      const at = lastBackgroundedAt.current ?? (await readLastBackgroundedAt());
      lastBackgroundedAt.current = at;
      if (at == null || Date.now() - at < APP_LOCK_TIMEOUT_MS) return;

      // Away longer than the timeout: engage the lock overlay (if signed in).
      try {
        const { refreshToken } = await getStoredTokens();
        if (!refreshToken || isLockedRef.current) return;
        setIsLocked(true);
      } catch {
        // Never block foregrounding on lock bookkeeping.
      }
    });

    return () => subscription.remove();
  }, []);

  const value = useMemo(() => ({ isLocked, lock, unlock }), [isLocked, lock, unlock]);

  return <AuthLockContext.Provider value={value}>{children}</AuthLockContext.Provider>;
}
