import { useSyncExternalStore } from 'react';

export type Tab = 'home' | 'workout' | 'nutrition' | 'coach' | 'progress' | 'settings';
export interface NavState { tab: Tab; params?: Record<string, string> }

let nav: NavState = { tab: 'home' };
try { const t = sessionStorage.getItem('fitpilot.tab') as Tab | null; if (t) nav = { tab: t }; } catch { /* ignore */ }
const ls = new Set<() => void>();

export function go(tab: Tab, params?: Record<string, string>) {
  nav = { tab, params };
  try { sessionStorage.setItem('fitpilot.tab', tab); } catch { /* ignore */ }
  window.scrollTo({ top: 0 });
  ls.forEach((l) => l());
}
export const useNav = () => useSyncExternalStore((cb) => { ls.add(cb); return () => ls.delete(cb); }, () => nav);
