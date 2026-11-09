import { getExercise } from './exercises';
import { totals } from './foods';
import { displayStatus, e1rm, performances, sessionVolume, templateById } from './training';
import type { AppState, Macros } from './types';
import { addDays, avg, fmtWeight, todayISO, weekStart, toDisplayWeight, weightUnit } from './util';

export const dayTotals = (state: AppState, date: string): Macros => totals(state.meals.filter((m) => m.date === date).flatMap((m) => m.items));
export const daysWithFood = (state: AppState, from: string, to: string) => [...new Set(state.meals.filter((m) => m.date >= from && m.date <= to).map((m) => m.date))].sort();

export interface WeekConsistency { start: string; planned: number; completed: number; partial: number; missed: number; skipped: number; unreported: number; pct: number }

export function weekConsistency(state: AppState, start: string, today = todayISO()): WeekConsistency {
  const end = addDays(start, 6);
  const es = state.schedule.filter((s) => s.date >= start && s.date <= end && s.templateId && s.date <= today);
  const c = { start, planned: es.length, completed: 0, partial: 0, missed: 0, skipped: 0, unreported: 0, pct: 0 };
  es.forEach((s) => {
    const st = displayStatus(s, today);
    if (st === 'completed') c.completed++;
    else if (st === 'partial') c.partial++;
    else if (st === 'missed') c.missed++;
    else if (st === 'skipped') c.skipped++;
    else if (st === 'unreported') c.unreported++;
  });
  // Extra unscheduled sessions (e.g. "I did back instead" on a rest day) count as completed work.
  const extra = state.sessions.filter((s) => s.date >= start && s.date <= end && s.state === 'finished' && !s.scheduledId).length;
  c.completed += extra;
  c.planned += extra;
  const denom = c.planned - (state.schedule.some((s) => s.date === today && s.status === 'planned' && s.templateId && s.date >= start && s.date <= end) ? 1 : 0);
  c.pct = denom > 0 ? Math.round(((c.completed + c.partial * 0.5) / denom) * 100) : 0;
  return c;
}

export function weightSeries(state: AppState) {
  return state.body.filter((b) => b.weightKg != null).sort((a, b) => a.date.localeCompare(b.date)).map((b) => ({ date: b.date, kg: b.weightKg! }));
}

/** 7-day trailing averages smooth out daily water-weight noise. */
export function weightTrend(state: AppState, today = todayISO()) {
  const s = weightSeries(state);
  const win = (from: string, to: string) => s.filter((x) => x.date >= from && x.date <= to).map((x) => x.kg);
  const thisWeek = win(addDays(today, -6), today);
  const lastWeek = win(addDays(today, -13), addDays(today, -7));
  const current = s.length ? s[s.length - 1].kg : null;
  const avgThis = thisWeek.length ? avg(thisWeek) : null;
  const avgLast = lastWeek.length ? avg(lastWeek) : null;
  return { current, avgThis, avgLast, delta: avgThis != null && avgLast != null ? avgThis - avgLast : null, points: s.length };
}

export function strengthSeries(state: AppState, exerciseId: string) {
  return performances(state, exerciseId).reverse().map((p) => ({
    date: p.date,
    best: Math.max(...p.sets.map((s) => e1rm(s.weightKg ?? 0, s.reps))),
    top: Math.max(...p.sets.map((s) => s.weightKg ?? 0)),
    reps: Math.max(...p.sets.map((s) => s.reps)),
  }));
}

export function trackedExercises(state: AppState): string[] {
  const counts: Record<string, number> = {};
  state.sessions.filter((s) => s.source === 'tracked' && s.state === 'finished').forEach((s) =>
    s.exercises.forEach((e) => { if (e.sets.some((x) => x.done)) counts[e.exerciseId] = (counts[e.exerciseId] ?? 0) + 1; }));
  return Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
}

export interface StrengthChange { exerciseId: string; name: string; from: number; to: number; pct: number; sessions: number }

export function strengthChanges(state: AppState, from: string, to: string): StrengthChange[] {
  return trackedExercises(state).map((id) => {
    const s = strengthSeries(state, id);
    const before = s.filter((x) => x.date < from);
    const during = s.filter((x) => x.date >= from && x.date <= to);
    if (!during.length) return null;
    const base = before.length ? before[before.length - 1].best : during[0].best;
    const now = Math.max(...during.map((x) => x.best));
    return { exerciseId: id, name: getExercise(id).name, from: base, to: now, pct: base ? ((now - base) / base) * 100 : 0, sessions: s.length };
  }).filter((x): x is StrengthChange => !!x && x.sessions > 1);
}

export interface WeeklyReport {
  start: string; end: string;
  consistency: WeekConsistency;
  sessions: number; volumeKg: number;
  strength: StrengthChange[];
  nutritionDays: number; avgKcal: number | null; avgProtein: number | null; proteinHitDays: number; calorieInRangeDays: number;
  weight: ReturnType<typeof weightTrend>;
  wins: string[]; improve: string[]; next: string[];
}

export function weeklyReport(state: AppState, start: string, today = todayISO()): WeeklyReport {
  const p = state.profile!;
  const end = addDays(start, 6);
  const last = end < today ? end : today;
  const consistency = weekConsistency(state, start, today);
  const sessions = state.sessions.filter((s) => s.date >= start && s.date <= end && s.state === 'finished');
  const volumeKg = Math.round(sessions.reduce((a, s) => a + sessionVolume(s), 0));
  const strength = strengthChanges(state, start, end);
  const days = daysWithFood(state, start, last);
  const dayT = days.map((d) => dayTotals(state, d));
  const avgKcal = dayT.length ? Math.round(avg(dayT.map((d) => d.kcal))) : null;
  const avgProtein = dayT.length ? Math.round(avg(dayT.map((d) => d.protein))) : null;
  const proteinHitDays = dayT.filter((d) => d.protein >= p.targets.protein * 0.9).length;
  const calorieInRangeDays = dayT.filter((d) => Math.abs(d.kcal - p.targets.calories) <= p.targets.calories * 0.1).length;
  const weight = weightTrend(state, last);

  const wins: string[] = [], improve: string[] = [], next: string[] = [];
  const done = consistency.completed + consistency.partial;
  if (consistency.planned) {
    if (consistency.pct >= 90) wins.push(`Trained ${done} of ${consistency.planned} planned sessions — excellent consistency.`);
    else if (consistency.pct >= 60) wins.push(`Trained ${done} of ${consistency.planned} planned sessions.`);
    else improve.push(`Only ${done} of ${consistency.planned} planned sessions happened (${consistency.missed + consistency.skipped} missed/skipped${consistency.unreported ? `, ${consistency.unreported} not reported` : ''}).`);
  }
  if (consistency.unreported) next.push(`Report the ${consistency.unreported} unreported workout${consistency.unreported > 1 ? 's' : ''} so your stats are accurate.`);
  const up = strength.filter((s) => s.pct >= 2);
  if (up.length) wins.push(`Stronger on ${up.slice(0, 3).map((s) => `${s.name} (+${Math.round(s.pct)}%)`).join(', ')}.`);
  const flat = strength.filter((s) => Math.abs(s.pct) < 2);
  if (flat.length && !up.length) improve.push(`Strength was flat this week on ${flat.slice(0, 3).map((s) => s.name).join(', ')}. That's normal week to week — keep adding reps before weight.`);
  if (!days.length) improve.push('No meals were logged, so nutrition can\'t be assessed.');
  else {
    if (proteinHitDays >= Math.ceil(days.length * 0.7)) wins.push(`Hit your protein target on ${proteinHitDays} of ${days.length} logged days.`);
    else { improve.push(`Protein averaged ${avgProtein} g vs a ${p.targets.protein} g target (hit on ${proteinHitDays}/${days.length} logged days).`); next.push('Add one high-protein snack daily (Greek yogurt, a shake, or cottage cheese).'); }
    if (days.length < 5) next.push(`Meals were logged on ${days.length} day${days.length > 1 ? 's' : ''}. Logging most days makes calorie trends meaningful.`);
  }
  if (weight.delta != null) {
    const u = weightUnit(p.units);
    const d = toDisplayWeight(Math.abs(weight.delta), p.units);
    const dir = weight.delta > 0.05 ? 'up' : weight.delta < -0.05 ? 'down' : 'flat';
    const want = p.goal === 'lose_fat' ? 'down' : p.goal === 'build_muscle' ? 'up' : 'flat';
    const line = dir === 'flat' ? 'Weekly average weight held steady.' : `Weekly average weight is ${dir} ${d} ${u}.`;
    if (dir === want || (want === 'flat' && dir === 'flat')) wins.push(line + ' That matches your goal.');
    else improve.push(line + (want === 'up' ? ' For muscle gain, a slow upward trend (~0.25% bodyweight/week) is ideal.' : want === 'down' ? ' For fat loss, aim for a gradual downward trend.' : ''));
  } else next.push('Weigh in 3–4 mornings a week so FitPilot can show a reliable trend.');
  if (!next.length) next.push('Keep the same plan — it\'s working. Look for small weight increases where you hit the top of your rep range.');
  return { start, end, consistency, sessions: sessions.length, volumeKg, strength, nutritionDays: days.length, avgKcal, avgProtein, proteinHitDays, calorieInRangeDays, weight, wins, improve, next };
}

export const currentWeekStart = (today = todayISO()) => weekStart(today);

export function lastUsed(state: AppState, exerciseId: string) {
  const p = performances(state, exerciseId)[0];
  if (!p) return null;
  return { date: p.date, sets: p.sets, text: p.sets.map((s) => `${fmtWeight(s.weightKg, state.profile?.units ?? 'metric')} × ${s.reps}`).join(', ') };
}

export const scheduledName = (state: AppState, templateId: string | null | undefined) => templateById(state.plan, templateId)?.name ?? 'Rest';
