import { dayTotals, daysWithFood, weightTrend } from './analytics';
import { getExercise, MUSCLE_LABEL } from './exercises';
import { displayStatus, muscleHits, suggestLoad, templateById } from './training';
import type { AppState, Muscle, ProposalCard } from './types';
import { addDays, DAY_NAMES, fmtDate, fmtWeight, todayISO, toDisplayWeight, weekday, weightUnit } from './util';

export interface Insight { id: string; tone: 'info' | 'warn' | 'good'; text: string; card?: ProposalCard }

const card = (title: string, detail: string, actions: ProposalCard['actions']): ProposalCard => ({ id: Math.random().toString(36).slice(2), title, detail, actions, state: 'pending' });

/** Evidence-based nudges computed only from what has actually been recorded. */
export function computeInsights(state: AppState, today = todayISO()): Insight[] {
  const p = state.profile;
  if (!p || !state.plan) return [];
  const out: Insight[] = [];

  // Unreported past workouts
  const unreported = state.schedule.filter((s) => s.templateId && displayStatus(s, today) === 'unreported' && s.date >= addDays(today, -7));
  if (unreported.length) {
    const s = unreported[unreported.length - 1];
    out.push({ id: `unreported-${s.id}`, tone: 'info', text: `${templateById(state.plan, s.templateId)?.name} ${(() => { const f = fmtDate(s.date, today); return /^(Today|Yesterday)$/.test(f) ? 'from ' + f.toLowerCase() : 'on ' + f; })()} hasn't been reported yet. Let FitPilot know what happened so your history stays accurate.` });
  }

  // Missed weekday pattern (same weekday missed/skipped ≥2 of its last 4 occurrences)
  for (const d of Object.keys(state.plan.week).map(Number)) {
    const occ = state.schedule.filter((s) => s.templateId && weekday(s.date) === d && s.date < today && !s.movedFrom).slice(-4);
    const bad = occ.filter((s) => s.status === 'missed' || s.status === 'skipped').length;
    if (occ.length >= 3 && bad >= 2) {
      const free = [0, 1, 2, 3, 4, 5, 6].filter((x) => !(x in state.plan!.week) && x !== d);
      const to = free.sort((a, b) => Math.abs(a - d) - Math.abs(b - d))[0];
      out.push({
        id: `pattern-${d}`, tone: 'warn',
        text: `You've missed ${bad} of your last ${occ.length} ${DAY_NAMES[d]} workouts. Would another day suit you better?`,
        card: to != null ? card(`Move ${DAY_NAMES[d]} training to ${DAY_NAMES[to]}?`, `Future ${DAY_NAMES[d]} sessions would happen on ${DAY_NAMES[to]} instead. Past records stay as they are.`, [{ kind: 'move_training_day', fromDay: d, toDay: to }]) : undefined,
      });
    }
  }

  // Protein adherence over the last 7 days (only days with food logged)
  const days = daysWithFood(state, addDays(today, -7), addDays(today, -1));
  if (days.length >= 3) {
    const low = days.filter((d) => dayTotals(state, d).protein < p.targets.protein * 0.8).length;
    if (low >= 3) out.push({ id: `protein-${today}`, tone: 'warn', text: `Protein was below 80% of your ${p.targets.protein} g target on ${low} of the last ${days.length} logged days. Building muscle depends on it — try adding one protein-rich snack a day.` });
    else if (low === 0) out.push({ id: `protein-good-${today}`, tone: 'good', text: `You've hit your protein target on every logged day this week. Nice work.` });
  }

  // Progression ready
  const ready: ProposalCard[] = [];
  for (const t of state.plan.templates) {
    for (const pe of t.exercises) {
      const s = suggestLoad(state, pe, p);
      if (s.basis === 'history' && s.weightKg != null && pe.weightKg != null && s.weightKg > pe.weightKg + 0.01 && s.reason.startsWith('You hit')) {
        ready.push(card(`${getExercise(pe.exerciseId).name}: try ${fmtWeight(s.weightKg, p.units)}`, s.reason, [{ kind: 'update_weight', templateId: t.id, uid: pe.uid, exerciseId: pe.exerciseId, weightKg: s.weightKg }]));
      }
    }
  }
  if (ready.length) out.push({ id: `progress-${ready.map((r) => r.title).join()}`, tone: 'good', text: `You completed all sets at the top of your rep range on ${ready.length} exercise${ready.length > 1 ? 's' : ''}. Consider a small weight increase if effort and form felt right.`, card: ready[0] });

  // Muscle frequency: same primary muscle hit hard 3+ times in 5 days
  const hits = muscleHits(state, addDays(today, -4), today);
  const byMuscle: Partial<Record<Muscle, Set<string>>> = {};
  hits.filter((h) => h.sets >= 3).forEach((h) => (byMuscle[h.muscle] ??= new Set()).add(h.date));
  const over = (Object.keys(byMuscle) as Muscle[]).filter((m) => byMuscle[m]!.size >= 3 && !['core', 'forearms', 'calves'].includes(m));
  if (over.length) out.push({ id: `freq-${over.join()}-${today}`, tone: 'warn', text: `You've trained ${over.map((m) => MUSCLE_LABEL[m].toLowerCase()).join(', ')} on ${byMuscle[over[0]]!.size} of the last 5 days. Consider giving ${over.length > 1 ? 'them' : 'it'} a recovery day before training ${over.length > 1 ? 'them' : 'it'} again.` });

  // Weight trend vs goal (needs two weeks of data)
  const wt = weightTrend(state, today);
  if (wt.delta != null && wt.points >= 6) {
    const d = toDisplayWeight(Math.abs(wt.delta), p.units);
    if (p.goal === 'build_muscle' && wt.delta < -0.2) out.push({ id: `wt-${today}`, tone: 'info', text: `Your weekly average weight dropped ${d} ${weightUnit(p.units)} while your goal is muscle gain. If this continues another week, consider eating a little more.` });
    if (p.goal === 'lose_fat' && wt.delta > 0.3) out.push({ id: `wt-${today}`, tone: 'info', text: `Your weekly average weight rose ${d} ${weightUnit(p.units)}. One week can be water — keep an eye on next week's average before changing anything.` });
  }

  return out.filter((i) => !state.dismissedInsights.includes(i.id));
}
