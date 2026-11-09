import { dayTotals } from './analytics';
import { entryOn, templateById } from './training';
import type { AppState } from './types';
import { todayISO } from './util';

export interface Reminder { id: string; title: string; body: string }

const PREFERRED_HOUR: Record<string, number> = { morning: 7, midday: 12, evening: 17, flexible: 9 };

const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

export function inQuietHours(s: AppState['notifications'], now = new Date()) {
  const n = now.getHours() * 60 + now.getMinutes();
  const a = toMin(s.quietStart), b = toMin(s.quietEnd);
  return a <= b ? n >= a && n < b : n >= a || n < b;
}

/** Reminders that are due right now. Respects settings and never uses guilt-based wording. */
export function dueReminders(state: AppState, now = new Date()): Reminder[] {
  const n = state.notifications;
  const p = state.profile;
  if (!n.enabled || !p || inQuietHours(n, now)) return [];
  const today = todayISO();
  const h = now.getHours();
  const out: Reminder[] = [];
  const e = entryOn(state, today);
  const t = templateById(state.plan, e?.templateId);
  const pref = PREFERRED_HOUR[p.preferredTime] ?? 9;
  if (n.workoutReminder && t && e?.status === 'planned' && h >= pref - 1 && h < pref + 3) out.push({ id: `workout-${today}`, title: `${t.name} today`, body: 'Your workout is ready with weights pre-filled. Have a good session!' });
  if (n.checkInReminder && t && e?.status === 'planned' && h >= 20) out.push({ id: `checkin-${today}`, title: 'How did today go?', body: `Let FitPilot know whether you trained ${t.name} — completed, partial or not today all count.` });
  if (n.restDay && !t && h >= 9 && h < 12) out.push({ id: `rest-${today}`, title: 'Rest day', body: 'Recovery is part of the plan. A walk or some stretching is a great idea.' });
  const tot = dayTotals(state, today);
  if (n.nutritionReminder && tot.kcal === 0 && h >= 14) out.push({ id: `meals-${today}`, title: 'Log your meals', body: 'A quick photo or one-line description is enough.' });
  if (n.proteinNudge && tot.kcal > 0 && h >= 17 && tot.protein < p.targets.protein * 0.6) out.push({ id: `protein-${today}`, title: 'Protein check', body: `${Math.round(p.targets.protein - tot.protein)} g protein to go today — a protein-rich dinner would get you close.` });
  if (n.weeklyReport && now.getDay() === 0 && h >= 18) out.push({ id: `weekly-${today}`, title: 'Your weekly report is ready', body: 'See how your training, nutrition and weight trended this week.' });
  return out;
}

const SENT_KEY = 'fitpilot.sentReminders';

export function pickToSend(state: AppState, now = new Date()): Reminder[] {
  let sent: string[] = [];
  try { sent = JSON.parse(localStorage.getItem(SENT_KEY) ?? '[]'); } catch { /* ignore */ }
  const today = todayISO();
  const sentToday = sent.filter((s) => s.endsWith(today));
  const cap = state.notifications.frequency === 'minimal' ? 2 : 4;
  const fresh = dueReminders(state, now).filter((r) => !sent.includes(r.id)).slice(0, Math.max(0, cap - sentToday.length));
  if (fresh.length) {
    try { localStorage.setItem(SENT_KEY, JSON.stringify([...sent.filter((s) => s.endsWith(today)), ...fresh.map((r) => r.id)])); } catch { /* ignore */ }
  }
  return fresh;
}

export async function requestNotificationPermission() {
  try { if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission(); } catch { /* ignore */ }
}

export async function showNotification(r: Reminder) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return false;
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(r.title, { body: r.body, icon: './icon.svg', tag: r.id });
    else new Notification(r.title, { body: r.body, icon: './icon.svg', tag: r.id });
    return true;
  } catch { return false; }
}
