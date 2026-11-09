import { defaultState } from './store';
import type { AppState } from './types';

/**
 * The app state is split into small records so each one syncs independently:
 * one Firestore document per workout, meal, schedule day, etc. Singletons get an "s:" id.
 */
const COLLECTIONS = ['schedule', 'sessions', 'meals', 'customFoods', 'savedMeals', 'body', 'chat'] as const;
const SINGLETONS = ['profile', 'plan', 'notifications', 'dismissedInsights', 'activeSessionId', 'aiModel'] as const;

export interface Rec { c: string; json: string }
export type RecMap = Record<string, Rec>;

export function toRecords(s: AppState): RecMap {
  const out: RecMap = {};
  for (const k of SINGLETONS) {
    const v = k === 'aiModel' ? s.ai.model : s[k];
    out[`s:${k}`] = { c: k, json: JSON.stringify(v ?? null) };
  }
  for (const c of COLLECTIONS) {
    for (const item of s[c] as { id: string }[]) out[`${c}:${item.id}`] = { c, json: JSON.stringify(item) };
  }
  for (const so of s.soreness) out[`soreness:${so.date}`] = { c: 'soreness', json: JSON.stringify(so) };
  return out;
}

/** Rebuild app state from records. Device-only settings (the AI key) come from `local`. */
export function fromRecords(recs: RecMap, local: AppState): AppState {
  const base = defaultState();
  const s: AppState = { ...base, ai: { ...local.ai } };
  const lists: Record<string, unknown[]> = {};
  for (const r of Object.values(recs)) {
    let v: unknown;
    try { v = JSON.parse(r.json); } catch { continue; }
    if ((SINGLETONS as readonly string[]).includes(r.c)) {
      if (r.c === 'aiModel') { if (typeof v === 'string') s.ai = { ...s.ai, model: v }; }
      else (s as unknown as Record<string, unknown>)[r.c] = v ?? (base as unknown as Record<string, unknown>)[r.c];
    } else (lists[r.c] ??= []).push(v);
  }
  const byDate = (a: { date?: string }, b: { date?: string }) => (a.date ?? '').localeCompare(b.date ?? '');
  s.schedule = ((lists.schedule ?? []) as AppState['schedule']).sort(byDate);
  s.sessions = ((lists.sessions ?? []) as AppState['sessions']).sort(byDate);
  s.meals = ((lists.meals ?? []) as AppState['meals']).sort((a, b) => a.createdAt - b.createdAt);
  s.customFoods = (lists.customFoods ?? []) as AppState['customFoods'];
  s.savedMeals = (lists.savedMeals ?? []) as AppState['savedMeals'];
  s.body = ((lists.body ?? []) as AppState['body']).sort(byDate);
  s.chat = ((lists.chat ?? []) as AppState['chat']).sort((a, b) => a.ts - b.ts);
  s.soreness = ((lists.soreness ?? []) as AppState['soreness']).sort(byDate);
  s.notifications = { ...base.notifications, ...s.notifications };
  if (s.activeSessionId && !s.sessions.some((x) => x.id === s.activeSessionId && x.state !== 'finished')) s.activeSessionId = null;
  return s;
}

/** Small, fast string hash to detect changed records. */
export function hash(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36) + str.length.toString(36);
}
