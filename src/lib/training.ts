import { getExercise, MUSCLE_LABEL } from './exercises';
import { roundLoad, templateMuscles } from './planner';
import type { AppState, ExerciseLog, Muscle, PlannedExercise, Plan, Profile, ScheduledWorkout, Session, SetLog, WorkoutStatus, WorkoutTemplate } from './types';
import { addDays, daysBetween, fmtWeight, todayISO, toISO, uid, weekday } from './util';

export const STATUS_LABEL: Record<WorkoutStatus | 'unreported', string> = {
  planned: 'Planned', in_progress: 'In progress', completed: 'Completed', partial: 'Partially completed',
  missed: 'Missed', skipped: 'Skipped', rest: 'Rest day', unreported: 'Not reported',
};

/** A past planned workout the user never reported on is "unreported" — never silently treated as missed. */
export function displayStatus(s: ScheduledWorkout, today = todayISO()): WorkoutStatus | 'unreported' {
  return s.status === 'planned' && s.date < today ? 'unreported' : s.status;
}

export const templateById = (plan: Plan | null, id: string | null | undefined): WorkoutTemplate | undefined =>
  plan?.templates.find((t) => t.id === id);

// ── Schedule materialisation ─────────────────────────────────────

export const HORIZON_DAYS = 13;

/** Create schedule entries from the plan start through the planning horizon. Existing entries are never touched. */
export function ensureSchedule(state: AppState, today = todayISO()): ScheduledWorkout[] {
  if (!state.plan) return state.schedule;
  const start = toISO(new Date(state.plan.createdAt));
  const byDate = new Set(state.schedule.map((s) => s.date));
  const added: ScheduledWorkout[] = [];
  for (let d = start < today ? start : today; d <= addDays(today, HORIZON_DAYS); d = addDays(d, 1)) {
    if (byDate.has(d)) continue;
    const tid = state.plan.week[weekday(d)] ?? null;
    added.push({ id: uid(), date: d, templateId: tid, status: tid ? 'planned' : 'rest' });
  }
  if (!added.length) return state.schedule;
  return [...state.schedule, ...added].sort((a, b) => a.date.localeCompare(b.date));
}

/** Replace the future (unstarted) schedule after a plan change. History is preserved untouched. */
export function rebuildFutureSchedule(state: AppState, plan: Plan, today = todayISO()): ScheduledWorkout[] {
  const keep = state.schedule.filter((s) => s.date < today || !['planned', 'rest'].includes(s.status));
  return ensureSchedule({ ...state, plan, schedule: keep }, today);
}

export const entriesOn = (state: AppState, date: string) => state.schedule.filter((s) => s.date === date);
/** The primary entry for a date: a workout if there is one, else the rest entry. */
export const entryOn = (state: AppState, date: string) => {
  const es = entriesOn(state, date);
  return es.find((e) => e.templateId) ?? es[0];
};

// ── Progression ──────────────────────────────────────────────────

export interface Performance { date: string; sets: SetLog[]; repsMin: number; repsMax: number }

/** All tracked performances of an exercise, newest first. Reported sessions have no set detail and are excluded. */
export function performances(state: AppState, exerciseId: string, before?: string): Performance[] {
  const out: Performance[] = [];
  for (const s of state.sessions) {
    if (s.source !== 'tracked' || s.state !== 'finished') continue;
    if (before && s.date >= before) continue;
    for (const e of s.exercises) {
      const done = e.sets.filter((x) => x.done);
      if (e.exerciseId === exerciseId && done.length) out.push({ date: s.date, sets: done, repsMin: e.repsMin, repsMax: e.repsMax });
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

export const workingWeight = (sets: SetLog[]) => Math.max(...sets.map((s) => s.weightKg ?? 0));

export interface Suggestion { weightKg: number | null; reps: number; reason: string; basis: 'history' | 'plan' }

/**
 * Suggest a load from the user's actual history. Simple double progression:
 * all planned sets at the top of the rep range → small increase; struggling below the range twice → back off.
 */
export function suggestLoad(state: AppState, pe: PlannedExercise, profile: Profile, before?: string): Suggestion {
  const ex = getExercise(pe.exerciseId);
  const hist = performances(state, pe.exerciseId, before);
  if (!hist.length || ex.startRatio === 0 && workingWeight(hist[0].sets) === 0) {
    if (hist.length) {
      const best = Math.max(...hist[0].sets.map((s) => s.reps));
      return { weightKg: null, reps: Math.min(best + 1, pe.repsMax + 5), reason: `Last time your best set was ${best} reps — try for one more.`, basis: 'history' };
    }
    return { weightKg: pe.weightKg, reps: pe.repsMax, basis: 'plan', reason: pe.weightKg == null ? 'Bodyweight — focus on clean reps.' : 'Starting suggestion — adjust if it feels too light or too heavy.' };
  }
  const last = hist[0];
  const w = workingWeight(last.sets);
  const atW = last.sets.filter((s) => (s.weightKg ?? 0) >= w);
  const allTop = last.sets.length >= pe.sets && atW.length >= pe.sets && atW.every((s) => s.reps >= pe.repsMax);
  const struggled = (p: Performance) => { const ww = workingWeight(p.sets); return p.sets.filter((s) => (s.weightKg ?? 0) >= ww).some((s) => s.reps < p.repsMin); };
  if (allTop && w > 0) {
    const next = roundLoad(w + ex.increment, ex, profile.units);
    return { weightKg: next > w ? next : roundLoad(w * 1.05, ex, profile.units), reps: pe.repsMin, basis: 'history',
      reason: `You hit ${pe.repsMax}+ reps on every set at ${fmtWeight(w, profile.units)} last time. Small increase — only if form felt solid.` };
  }
  if (hist.length >= 2 && struggled(hist[0]) && struggled(hist[1]) && w > 0) {
    return { weightKg: roundLoad(w * 0.9, ex, profile.units), reps: pe.repsMin, basis: 'history',
      reason: `Reps fell below ${pe.repsMin} for two sessions at ${fmtWeight(w, profile.units)}. Backing off ~10% to rebuild reps.` };
  }
  const bestReps = Math.max(...atW.map((s) => s.reps));
  return { weightKg: w || pe.weightKg, reps: Math.min(pe.repsMax, Math.max(pe.repsMin, bestReps + (bestReps < pe.repsMax ? 1 : 0))), basis: 'history',
    reason: `Same weight as last time (${fmtWeight(w, profile.units)}); aim to add a rep where you can.` };
}

// ── Sessions ─────────────────────────────────────────────────────

export function newExerciseLog(state: AppState, pe: PlannedExercise, profile: Profile, date: string): ExerciseLog {
  const sug = suggestLoad(state, pe, profile, date);
  return {
    uid: uid(), exerciseId: pe.exerciseId, status: 'pending', repsMin: pe.repsMin, repsMax: pe.repsMax,
    plannedWeightKg: sug.weightKg, restSec: pe.restSec,
    sets: Array.from({ length: pe.sets }, () => ({ weightKg: sug.weightKg, reps: sug.reps, done: false })),
  };
}

export function createSession(state: AppState, template: WorkoutTemplate, profile: Profile, scheduledId?: string, date = todayISO()): Session {
  return {
    id: uid(), scheduledId, date, name: template.name, startedAt: Date.now(), pausedMs: 0, state: 'active', source: 'tracked',
    exercises: template.exercises.map((pe) => newExerciseLog(state, pe, profile, date)),
  };
}

export function exerciseStatus(e: ExerciseLog): ExerciseLog['status'] {
  if (e.status === 'skipped' && !e.sets.some((s) => s.done)) return 'skipped';
  const done = e.sets.filter((s) => s.done).length;
  if (done === 0) return e.status === 'skipped' ? 'skipped' : 'pending';
  return done >= e.sets.length ? 'done' : 'partial';
}

/** Completed only if every exercise was fully done; partial if anything was done; null if nothing was done. */
export function sessionOutcome(s: Session): 'completed' | 'partial' | null {
  const st = s.exercises.map(exerciseStatus);
  if (!st.some((x) => x === 'done' || x === 'partial')) return null;
  return st.every((x) => x === 'done') ? 'completed' : 'partial';
}

export function finalizeSession(s: Session): Session {
  const now = Date.now();
  const paused = s.pausedAt ? now - s.pausedAt : 0;
  return {
    ...s, state: 'finished', endedAt: now, pausedAt: undefined, pausedMs: s.pausedMs + paused, restEndsAt: undefined,
    exercises: s.exercises.map((e) => { const st = exerciseStatus(e); return { ...e, status: st === 'pending' ? 'skipped' : st }; }),
  };
}

export const sessionDurationMin = (s: Session) =>
  s.endedAt ? Math.max(1, Math.round((s.endedAt - s.startedAt - s.pausedMs) / 60000)) : 0;

export const sessionVolume = (s: Session) =>
  s.exercises.reduce((a, e) => a + e.sets.filter((x) => x.done).reduce((b, x) => b + (x.weightKg ?? 0) * x.reps, 0), 0);

export const e1rm = (w: number, reps: number) => (reps <= 1 ? w : w * (1 + reps / 30));

export function personalRecords(state: AppState, session: Session, units: Profile['units']): string[] {
  const prs: string[] = [];
  for (const e of session.exercises) {
    const done = e.sets.filter((x) => x.done && (x.weightKg ?? 0) > 0);
    if (!done.length) continue;
    const prev = performances({ ...state, sessions: state.sessions.filter((s) => s.id !== session.id) }, e.exerciseId, session.date === todayISO() ? undefined : session.date)
      .filter((p) => p.date <= session.date);
    if (!prev.length) continue; // first time isn't a PR, it's a baseline
    const best = Math.max(...done.map((x) => e1rm(x.weightKg!, x.reps)));
    const prevBest = Math.max(...prev.flatMap((p) => p.sets.map((x) => e1rm(x.weightKg ?? 0, x.reps))));
    const top = Math.max(...done.map((x) => x.weightKg!));
    const prevTop = Math.max(...prev.flatMap((p) => p.sets.map((x) => x.weightKg ?? 0)));
    const name = getExercise(e.exerciseId).name;
    if (top > prevTop + 0.01) prs.push(`${name}: heaviest weight yet (${fmtWeight(top, units)})`);
    else if (best > prevBest * 1.01) prs.push(`${name}: best estimated strength yet`);
  }
  return prs;
}

// ── Muscle activity (for recovery-aware scheduling) ──────────────

export interface MuscleHit { date: string; muscle: Muscle; sets: number }

export function muscleHits(state: AppState, from: string, to: string): MuscleHit[] {
  const hits: MuscleHit[] = [];
  const inRange = (d: string) => d >= from && d <= to;
  const sessionIds = new Set<string>();
  for (const s of state.sessions) {
    if (!inRange(s.date) || s.state === 'active' && s.date !== todayISO()) continue;
    sessionIds.add(s.id);
    if (s.reportedMuscles?.length && !s.exercises.some((e) => e.sets.some((x) => x.done))) {
      s.reportedMuscles.forEach((m) => hits.push({ date: s.date, muscle: m, sets: 3 }));
      continue;
    }
    for (const e of s.exercises) {
      const n = e.sets.filter((x) => x.done).length || (e.status === 'done' && !e.sets.length ? 3 : 0);
      if (!n) continue;
      const ex = getExercise(e.exerciseId);
      ex.primary.forEach((m) => hits.push({ date: s.date, muscle: m, sets: n }));
      ex.secondary.forEach((m) => hits.push({ date: s.date, muscle: m, sets: n / 2 }));
    }
  }
  // Workouts reported complete without any session detail: assume the template was done.
  for (const sw of state.schedule) {
    if (!inRange(sw.date) || sw.sessionId && sessionIds.has(sw.sessionId)) continue;
    if (sw.status !== 'completed') continue;
    const t = templateById(state.plan, sw.templateId);
    t?.exercises.forEach((pe) => getExercise(pe.exerciseId).primary.forEach((m) => hits.push({ date: sw.date, muscle: m, sets: pe.sets })));
  }
  return hits;
}

export function musclesTrainedOn(state: AppState, date: string): Muscle[] {
  return [...new Set(muscleHits(state, date, date).filter((h) => h.sets >= 1).map((h) => h.muscle))];
}

export const musclesLabel = (ms: Muscle[]) => ms.map((m) => MUSCLE_LABEL[m]).join(', ');

export function weeklySetsByMuscle(state: AppState, weekStartISO: string): Partial<Record<Muscle, number>> {
  const out: Partial<Record<Muscle, number>> = {};
  muscleHits(state, weekStartISO, addDays(weekStartISO, 6)).forEach((h) => (out[h.muscle] = (out[h.muscle] ?? 0) + h.sets));
  return out;
}

export { templateMuscles, daysBetween };
