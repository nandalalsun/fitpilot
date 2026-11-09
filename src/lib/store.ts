import { useSyncExternalStore } from 'react';
import { DEFAULT_MODEL } from './ai-config';
import { ensureSchedule } from './training';
import type { AppState } from './types';
import { todayISO } from './util';

const KEY = 'fitpilot.v1';

export const defaultState = (): AppState => ({
  version: 1, profile: null, plan: null, schedule: [], sessions: [], activeSessionId: null, meals: [], customFoods: [], savedMeals: [],
  body: [], soreness: [], chat: [], dismissedInsights: [],
  notifications: { enabled: false, workoutReminder: true, checkInReminder: true, nutritionReminder: true, proteinNudge: true, restDay: false, weeklyReport: true, frequency: 'minimal', quietStart: '22:00', quietEnd: '07:00' },
  ai: { apiKey: '', model: DEFAULT_MODEL },
});

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as AppState;
    const base = defaultState();
    return { ...base, ...parsed, notifications: { ...base.notifications, ...parsed.notifications }, ai: { ...base.ai, ...parsed.ai } };
  } catch {
    return defaultState();
  }
}

let state: AppState = typeof localStorage !== 'undefined' ? load() : defaultState();
const listeners = new Set<() => void>();

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full or blocked: keep in memory */ }
}

export const getState = () => state;

/** Subscribe to every state change (used by cloud sync). */
export function subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }

/** Every mutation is written to storage immediately so progress survives the app closing mid-workout. */
export function setState(fn: (s: AppState) => AppState) {
  const next = fn(state);
  if (next === state) return;
  state = { ...next, schedule: ensureSchedule(next, todayISO()) };
  persist();
  listeners.forEach((l) => l());
}

export function replaceState(next: AppState) {
  state = next;
  persist();
  listeners.forEach((l) => l());
}

export function useStore<T>(sel: (s: AppState) => T): T {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => sel(state));
}

/** Refresh the rolling schedule horizon when the day changes. */
export function refreshSchedule() {
  const sched = ensureSchedule(state, todayISO());
  if (sched !== state.schedule) { state = { ...state, schedule: sched }; persist(); listeners.forEach((l) => l()); }
}

export function exportData(): string {
  const { ai, ...rest } = state;
  return JSON.stringify({ ...rest, ai: { model: ai.model, apiKey: '' }, exportedAt: new Date().toISOString() }, null, 2);
}

export function importData(json: string): string | null {
  try {
    const d = JSON.parse(json);
    if (d?.version !== 1 || !Array.isArray(d.schedule)) return 'That file does not look like a FitPilot export.';
    replaceState({ ...defaultState(), ...d, ai: { ...state.ai } });
    return null;
  } catch {
    return 'Could not read that file.';
  }
}

export function deleteAllData() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  replaceState(defaultState());
}
