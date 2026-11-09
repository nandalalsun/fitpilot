// Lightweight facade so the Firebase SDK only loads when cloud sync is used.
import { useSyncExternalStore } from 'react';
import { SYNC_AVAILABLE } from './firebase-config';
import type { SyncStatus } from './sync';

type Mod = typeof import('./sync');
let mod: Promise<Mod> | null = null;
let status: SyncStatus = { phase: 'signed_out' };
const ls = new Set<() => void>();

function ensure(): Promise<Mod> {
  if (!mod) {
    mod = import('./sync').then((m) => {
      m.onStatus(() => { status = m.getStatus(); ls.forEach((l) => l()); });
      m.startSync();
      return m;
    });
  }
  return mod;
}

export const useCloud = () => useSyncExternalStore((cb) => { ls.add(cb); return () => ls.delete(cb); }, () => status);

/** Start syncing on launch if this device was signed in before. */
export function autoStartCloud() {
  if (!SYNC_AVAILABLE) return;
  try { if (localStorage.getItem('fitpilot.cloud') === '1') ensure(); } catch { /* ignore */ }
}

export const cloudSignIn = () => ensure().then((m) => m.signIn());
export const cloudSignOut = () => ensure().then((m) => m.signOut());
export const cloudSyncNow = () => ensure().then((m) => m.syncNow());
export const cloudResolve = (c: 'cloud' | 'device') => ensure().then((m) => m.resolveChoice(c));
