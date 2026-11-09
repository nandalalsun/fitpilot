import { MUSCLE_LABEL, RECOVERY_HOURS } from './exercises';
import { templateMuscles } from './planner';
import { entriesOn, muscleHits, templateById } from './training';
import type { AppState, Muscle, Proposal, ScheduledWorkout } from './types';
import { addDays, DAY_NAMES, daysBetween, fmtDate, listJoin, todayISO, uid, weekday, weekStart } from './util';

export interface RescheduleOption {
  id: string;
  label: string;
  explanation: string;
  proposal: Proposal | null; // null = keep the plan as is
  score: number;
}

export interface RescheduleAdvice {
  missed: ScheduledWorkout;
  workoutName: string;
  recommended: RescheduleOption;
  alternatives: RescheduleOption[];
}

const isTraining = (s: ScheduledWorkout) => !!s.templateId && ['planned', 'in_progress', 'completed', 'partial'].includes(s.status);
const dayName = (iso: string, today: string) => { const f = fmtDate(iso, today); return f.includes(' ') ? DAY_NAMES[weekday(iso)] : f.toLowerCase(); };
const label = (ms: Muscle[]) => listJoin([...new Set(ms.map((m) => MUSCLE_LABEL[m].toLowerCase()))]);

/**
 * Muscles that would be trained before they have recovered if `muscles` were trained on `date`.
 * Looks at recorded training, planned workouts (excluding ones being moved) and reported soreness.
 */
export function recoveryConflicts(state: AppState, date: string, muscles: Muscle[], ignoreIds: string[] = []): Muscle[] {
  const bad = new Set<Muscle>();
  const near = (d: string) => Math.abs(daysBetween(d, date));
  muscleHits(state, addDays(date, -3), addDays(date, 3)).forEach((h) => {
    if (h.sets >= 2 && muscles.includes(h.muscle) && h.date !== date && near(h.date) * 24 < RECOVERY_HOURS[h.muscle]) bad.add(h.muscle);
  });
  state.schedule.forEach((s) => {
    if (ignoreIds.includes(s.id) || s.status !== 'planned' || !s.templateId || s.date === date || near(s.date) > 3) return;
    const t = templateById(state.plan, s.templateId);
    t && templateMuscles(t).forEach((m) => { if (muscles.includes(m) && near(s.date) * 24 < RECOVERY_HOURS[m]) bad.add(m); });
  });
  state.soreness.forEach((s) => {
    if (daysBetween(s.date, date) >= 0 && daysBetween(s.date, date) <= 1) s.muscles.forEach((m) => muscles.includes(m) && bad.add(m));
  });
  return [...bad];
}

/** Length of the run of consecutive training days that `date` would sit in. */
function streakIfTraining(state: AppState, date: string, ignoreIds: string[]): number {
  const trains = (d: string) => entriesOn(state, d).some((s) => !ignoreIds.includes(s.id) && isTraining(s));
  let n = 1;
  for (let d = addDays(date, -1); trains(d); d = addDays(d, -1)) n++;
  for (let d = addDays(date, 1); trains(d); d = addDays(d, 1)) n++;
  return n;
}

const isFree = (state: AppState, d: string, ignoreIds: string[] = []) =>
  !entriesOn(state, d).some((s) => !ignoreIds.includes(s.id) && (isTraining(s) || s.status === 'in_progress'));

export function recommendReschedule(state: AppState, missedId: string, today = todayISO()): RescheduleAdvice | null {
  const missed = state.schedule.find((s) => s.id === missedId);
  const t = templateById(state.plan, missed?.templateId);
  if (!missed || !t) return null;
  const M = templateMuscles(t);
  const name = t.name;

  // Window: from today (or tomorrow if today's is the one missed) up to the end of the week,
  // but never on/after the next time this same workout comes round.
  const start = missed.date >= today ? addDays(missed.date, 1) : today;
  let end = addDays(weekStart(today), 6);
  if (daysBetween(start, end) < 2) end = addDays(start, 4);
  const nextSame = state.schedule.find((s) => s.templateId === missed.templateId && s.date > missed.date && s.status === 'planned' && s.id !== missed.id);
  if (nextSame && nextSame.date <= end) end = addDays(nextSame.date, -1);

  const options: RescheduleOption[] = [];
  const legDay = M.some((m) => ['quads', 'hamstrings', 'glutes'].includes(m));

  // Option A: move onto the earliest free day that respects recovery
  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (!isFree(state, d)) continue;
    const conflicts = recoveryConflicts(state, d, M);
    if (conflicts.length) continue;
    const streak = streakIfTraining(state, d, []);
    if (streak > 4) continue;
    const delay = daysBetween(start, d);
    options.push({
      id: 'free', label: `Do ${name} ${dayName(d, today)}`,
      explanation: `${fmtDate(d, today)} is currently a rest day, and your ${label(M)} have had enough recovery time by then. Nothing else in your week has to move.` +
        (streak > 3 ? ` It does make ${streak} training days in a row, so keep effort moderate.` : ''),
      proposal: { kind: 'reschedule', moves: [{ scheduledId: null, templateId: t.id, toDate: d, fromDate: missed.date }] },
      score: 10 - delay - (streak > 3 ? 2 : 0) + (legDay ? 1 : 0),
    });
    break;
  }

  // Option B: swap with the next planned workout, if that workout can itself land somewhere sensible
  const nextPlanned = state.schedule.find((s) => s.date >= start && s.date <= end && s.status === 'planned' && !!s.templateId && s.id !== missed.id);
  if (nextPlanned) {
    const W = templateById(state.plan, nextPlanned.templateId)!;
    const WM = templateMuscles(W);
    const conflictsHere = recoveryConflicts(state, nextPlanned.date, M, [nextPlanned.id]);
    if (!conflictsHere.length) {
      for (let d = addDays(nextPlanned.date, 1); d <= addDays(end, 1); d = addDays(d, 1)) {
        if (!isFree(state, d, [nextPlanned.id])) continue;
        const simulated: AppState = { ...state, schedule: [...state.schedule.filter((s) => s.id !== nextPlanned.id), { id: 'sim', date: nextPlanned.date, templateId: t.id, status: 'planned' }] };
        if (recoveryConflicts(simulated, d, WM, [nextPlanned.id]).length) continue;
        const streak = streakIfTraining(simulated, d, [nextPlanned.id]);
        if (streak > 4) continue;
        const shared = M.filter((m) => WM.includes(m));
        options.push({
          id: 'swap', label: `Do ${name} ${dayName(nextPlanned.date, today)}, move ${W.name} to ${dayName(d, today)}`,
          explanation: `${name} takes ${W.name}'s slot ${dayName(nextPlanned.date, today).match(/day$/) && !/^(today|yesterday|tomorrow)$/.test(dayName(nextPlanned.date, today)) ? 'on ' : ''}${dayName(nextPlanned.date, today)}` +
            (shared.length ? '' : ` — they train different muscles (${label(M)} vs ${label(WM)}), so recovery isn't an issue`) +
            `. ${W.name} shifts to ${fmtDate(d, today)}, which is free and gives it enough recovery.`,
          proposal: { kind: 'reschedule', moves: [
            { scheduledId: null, templateId: t.id, toDate: nextPlanned.date, fromDate: missed.date },
            { scheduledId: nextPlanned.id, templateId: W.id, toDate: d, fromDate: nextPlanned.date },
          ] },
          score: 8.5 - daysBetween(start, nextPlanned.date) - (streak > 3 ? 2 : 0) + (legDay ? 1 : 0),
        });
        break;
      }
    }
  }

  // Option C: keep the plan. Score it higher when the muscles are covered elsewhere this week or the week is nearly over.
  const wkEnd = addDays(weekStart(today), 6);
  const coveredBy = state.schedule
    .filter((s) => s.date >= today && s.date <= wkEnd && s.status === 'planned' && s.templateId && s.id !== missed.id)
    .map((s) => templateById(state.plan, s.templateId)!)
    .filter((w) => templateMuscles(w).some((m) => M.includes(m)));
  const covered = M.filter((m) => coveredBy.some((w) => templateMuscles(w).includes(m)));
  const coverage = covered.length / M.length;
  options.push({
    id: 'keep', label: 'Keep the plan as is',
    explanation: (coverage >= 0.5
      ? `You'll still train ${label(covered)} in ${listJoin([...new Set(coveredBy.map((w) => w.name))])} later this week, so little is lost. `
      : `${name} will come round again ${nextSame ? 'on ' + fmtDate(nextSame.date, today) : 'next week'}. `) +
      'One missed session has very little effect on long-term progress — consistency over weeks matters far more. Don\'t try to cram extra volume in to make up for it.',
    proposal: null,
    score: (coverage >= 0.5 ? 7 : 4) + (options.length ? 0 : 3),
  });

  options.sort((a, b) => b.score - a.score);
  return { missed, workoutName: name, recommended: options[0], alternatives: options.slice(1) };
}

/** Apply a confirmed reschedule. The missed entry keeps its status on its original date — history is never rewritten. */
export function applyReschedule(schedule: ScheduledWorkout[], p: Extract<Proposal, { kind: 'reschedule' }>): ScheduledWorkout[] {
  let out = [...schedule];
  for (const mv of p.moves) {
    out = out.filter((s) => !(s.date === mv.toDate && s.status === 'rest'));
    if (mv.scheduledId) {
      const src = out.find((s) => s.id === mv.scheduledId);
      if (!src) continue;
      out = out.map((s) => (s.id === mv.scheduledId ? { ...s, date: mv.toDate, movedFrom: s.movedFrom ?? mv.fromDate } : s));
      if (mv.fromDate && !out.some((s) => s.date === mv.fromDate && s.id !== mv.scheduledId) && !p.moves.some((m) => m.toDate === mv.fromDate)) {
        out.push({ id: uid(), date: mv.fromDate, templateId: null, status: 'rest' });
      }
    } else {
      out.push({ id: uid(), date: mv.toDate, templateId: mv.templateId, status: 'planned', movedFrom: mv.fromDate, note: mv.fromDate ? `Make-up for ${mv.fromDate}` : undefined });
    }
  }
  for (const id of p.drop ?? []) out = out.map((s) => (s.id === id ? { ...s, status: 'skipped', note: 'Dropped this week' } : s));
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Move a recurring training day (e.g. Thursday → Friday) for the future plan. */
export function moveTrainingDay(state: AppState, fromDay: number, toDay: number) {
  if (!state.plan) return state.plan;
  const week = { ...state.plan.week };
  const tid = week[fromDay];
  if (!tid || week[toDay]) return state.plan;
  delete week[fromDay];
  week[toDay] = tid;
  return { ...state.plan, week };
}
