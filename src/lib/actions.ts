import { getExercise, MUSCLE_LABEL } from './exercises';
import { applyReschedule, moveTrainingDay } from './scheduler';
import { rebuildFutureSchedule, templateById } from './training';
import type { AppState, ExerciseLog, Proposal, Session } from './types';
import { DAY_NAMES, fmtWeight, todayISO, uid } from './util';

/** Apply a user-confirmed proposal. This is the only path by which coach suggestions change data. */
export function applyProposal(state: AppState, p: Proposal, today = todayISO()): AppState {
  switch (p.kind) {
    case 'set_status':
      return { ...state, schedule: state.schedule.map((s) => (s.id === p.scheduledId ? { ...s, status: p.status, note: p.note ?? s.note, reported: true } : s)) };

    case 'report_partial': {
      const sw = state.schedule.find((s) => s.id === p.scheduledId);
      const t = templateById(state.plan, sw?.templateId);
      if (!sw || !t) return state;
      const exercises: ExerciseLog[] = t.exercises.map((pe) => ({
        uid: uid(), exerciseId: pe.exerciseId, status: p.doneExerciseIds.includes(pe.exerciseId) ? 'done' : 'skipped',
        repsMin: pe.repsMin, repsMax: pe.repsMax, plannedWeightKg: pe.weightKg, restSec: pe.restSec, sets: [],
      }));
      const session: Session = { id: uid(), scheduledId: sw.id, date: sw.date, name: t.name, startedAt: Date.now(), endedAt: Date.now(), pausedMs: 0, state: 'finished', source: 'reported', reportedMuscles: p.muscles, exercises };
      return {
        ...state, sessions: [...state.sessions, session],
        schedule: state.schedule.map((s) => (s.id === sw.id ? { ...s, status: 'partial', sessionId: session.id, reported: true, note: `Reported: ${p.muscles.map((m) => MUSCLE_LABEL[m]).join(', ')} only` } : s)),
      };
    }

    case 'report_different': {
      const session: Session = { id: uid(), date: p.date, name: p.name, startedAt: Date.now(), endedAt: Date.now(), pausedMs: 0, state: 'finished', source: 'reported', reportedMuscles: p.muscles, exercises: [] };
      return {
        ...state, sessions: [...state.sessions, session],
        schedule: state.schedule.map((s) => (s.id === p.scheduledId ? { ...s, status: 'skipped', reported: true, note: `Did ${p.name} instead` } : s)),
      };
    }

    case 'log_meal':
      return { ...state, meals: [...state.meals, { ...p.meal, id: uid(), createdAt: Date.now() }] };

    case 'log_sets': {
      const ex = getExercise(p.exerciseId);
      const log: ExerciseLog = { uid: uid(), exerciseId: p.exerciseId, status: 'done', repsMin: p.sets[0]?.reps ?? 8, repsMax: p.sets[0]?.reps ?? 12, plannedWeightKg: p.sets[0]?.weightKg ?? null, restSec: 90, sets: p.sets };
      // Attach to an existing session that day if there is one, otherwise create a standalone tracked entry.
      const existing = state.sessions.find((s) => s.date === p.date && s.state === 'finished' && s.source === 'tracked');
      if (existing) return { ...state, sessions: state.sessions.map((s) => (s.id === existing.id ? { ...s, exercises: [...s.exercises, log] } : s)) };
      const session: Session = { id: uid(), date: p.date, name: ex.name, startedAt: Date.now(), endedAt: Date.now(), pausedMs: 0, state: 'finished', source: 'tracked', exercises: [log] };
      return { ...state, sessions: [...state.sessions, session] };
    }

    case 'reschedule':
      return { ...state, schedule: applyReschedule(state.schedule, p) };

    case 'update_weight':
      return { ...state, plan: state.plan && { ...state.plan, templates: state.plan.templates.map((t) => t.id !== p.templateId ? t : { ...t, exercises: t.exercises.map((e) => (e.uid === p.uid ? { ...e, weightKg: p.weightKg } : e)) }) } };

    case 'replace_exercise':
      return { ...state, plan: state.plan && { ...state.plan, templates: state.plan.templates.map((t) => t.id !== p.templateId ? t : { ...t, exercises: t.exercises.map((e) => (e.uid === p.uid ? { ...e, exerciseId: p.exerciseId } : e)) }) } };

    case 'move_training_day': {
      const plan = moveTrainingDay(state, p.fromDay, p.toDay);
      if (!plan || !state.profile) return state;
      const profile = { ...state.profile, trainingDays: Object.keys(plan.week).map(Number) };
      return { ...state, plan, profile, schedule: rebuildFutureSchedule(state, plan, today) };
    }

    case 'log_soreness':
      return { ...state, soreness: [...state.soreness.filter((s) => s.date !== today), { date: today, muscles: p.muscles }] };

    case 'set_targets':
      return state.profile ? { ...state, profile: { ...state.profile, targets: p.targets } } : state;
  }
}

export function describeProposal(state: AppState, p: Proposal): string {
  const units = state.profile?.units ?? 'metric';
  switch (p.kind) {
    case 'set_status': return `Mark workout as ${p.status.replace('_', ' ')}`;
    case 'report_partial': return 'Record a partial workout';
    case 'report_different': return `Record "${p.name}"`;
    case 'log_meal': return 'Save meal';
    case 'log_sets': return `Log ${p.sets.length} sets of ${getExercise(p.exerciseId).name}`;
    case 'reschedule': return 'Update schedule';
    case 'update_weight': return `Set ${getExercise(p.exerciseId).name} to ${fmtWeight(p.weightKg, units)}`;
    case 'replace_exercise': return `Use ${getExercise(p.exerciseId).name} in the plan`;
    case 'move_training_day': return `Move ${DAY_NAMES[p.fromDay]} training to ${DAY_NAMES[p.toDay]}`;
    case 'log_soreness': return 'Log soreness';
    case 'set_targets': return 'Update nutrition targets';
  }
}
