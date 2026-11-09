import { dayTotals, lastUsed, weeklyReport, weightTrend } from './analytics';
import { alternativesFor, findExerciseByName, getExercise, MUSCLE_LABEL } from './exercises';
import { suggestMeals } from './foods';
import { computeInsights } from './insights';
import { detectSlot, detectWorkoutIntent, looksLikeFoodLog, parseDateRef, parseFoodText, parseMuscles, parseSetsText, slotForTime } from './nlp';
import { recommendReschedule } from './scheduler';
import { displayStatus, entryOn, STATUS_LABEL, suggestLoad, templateById, templateMuscles } from './training';
import type { AppState, Muscle, ProposalCard, ScheduledWorkout, WorkoutStatus } from './types';
import { addDays, fmtDate, fmtWeight, listJoin, todayISO, toDisplayWeight, weekStart, weightUnit } from './util';

export interface CoachReply { text: string; cards: ProposalCard[]; handled: boolean }

const card = (title: string, detail: string, actions: ProposalCard['actions']): ProposalCard => ({ id: Math.random().toString(36).slice(2, 10), title, detail, actions, state: 'pending' });
const lc = (f: string) => (/^(Today|Yesterday|Tomorrow)$/.test(f) ? f.toLowerCase() : f);
const onDay = (d: string, today: string) => { const f = fmtDate(d, today); return /^(Today|Yesterday|Tomorrow)$/.test(f) ? f.toLowerCase() : `on ${f}`; };
/** "2 × Egg (whole, boiled)", "1 cup White rice (cooked)", "150 g Chicken breast" */
export const itemLabel = (i: { qty: number; unit: string; name: string }) => {
  const countable = i.name.toLowerCase().startsWith(i.unit.toLowerCase()) || ['piece', 'serving'].includes(i.unit);
  return i.unit === 'g' ? `${i.qty} g ${i.name}` : countable ? `${i.qty} × ${i.name}` : `${i.qty} ${i.unit} ${i.name}`;
};
const reply = (text: string, cards: ProposalCard[] = []): CoachReply => ({ text, cards, handled: true });
const mLabel = (ms: Muscle[]) => listJoin([...new Set(ms.map((m) => MUSCLE_LABEL[m].toLowerCase()))]);

/** Find which scheduled workout a statement refers to. */
export function findTargetEntry(state: AppState, date: string | null, muscles: Muscle[], today = todayISO()): ScheduledWorkout | undefined {
  const workouts = state.schedule.filter((s) => s.templateId && s.date <= today);
  const matches = (s: ScheduledWorkout) => !muscles.length || templateMuscles(templateById(state.plan, s.templateId)!).some((m) => muscles.includes(m));
  if (date) {
    const onDay = workouts.filter((s) => s.date === date);
    return onDay.find(matches) ?? onDay[0];
  }
  const open = workouts.filter((s) => ['planned', 'in_progress'].includes(s.status) && s.date >= addDays(today, -7)).reverse();
  return open.find(matches) ?? (muscles.length ? undefined : open[0]);
}

function rescheduleCards(state: AppState, entry: ScheduledWorkout, status: WorkoutStatus, today: string): { text: string; cards: ProposalCard[] } {
  // Evaluate as if the status were already recorded.
  const sim: AppState = { ...state, schedule: state.schedule.map((s) => (s.id === entry.id ? { ...s, status } : s)) };
  const adv = recommendReschedule(sim, entry.id, today);
  if (!adv) return { text: '', cards: [] };
  const opts = [adv.recommended, ...adv.alternatives];
  const cards = opts.map((o, i) => card((i === 0 ? 'Recommended: ' : 'Option: ') + o.label, o.explanation, o.proposal ? [o.proposal] : []));
  return { text: `Here's how I'd adjust the rest of your week:`, cards };
}

export function handleMessage(state: AppState, input: string, today = todayISO()): CoachReply {
  const p = state.profile!;
  const t = input.toLowerCase().trim();
  const units = p.units;

  // ── Logging food ──────────────────────────────────────────────
  if (looksLikeFoodLog(t, state.customFoods)) {
    const parsed = parseFoodText(input, state.customFoods);
    const slot = parsed.slot ?? detectSlot(t) ?? slotForTime();
    const date = parseDateRef(t, today) ?? today;
    const kcal = parsed.items.reduce((a, i) => a + i.kcal, 0);
    const prot = parsed.items.reduce((a, i) => a + i.protein, 0);
    const lines = parsed.items.map((i) => `• ${itemLabel(i)} — ${i.kcal} kcal, ${i.protein} g protein${i.uncertain ? ' (quantity assumed)' : ''}`);
    let text = `Here's my estimate for ${slot}${date !== today ? ` (${fmtDate(date, today)})` : ''}:\n${lines.join('\n')}\nTotal ≈ ${kcal} kcal, ${Math.round(prot)} g protein.`;
    if (parsed.unknown.length) text += `\n\nI couldn't identify: ${parsed.unknown.map((u) => `"${u}"`).join(', ')}. You can add it manually after saving.`;
    if (parsed.items.some((i) => i.uncertain)) text += `\nSome quantities were assumed — tap Edit to correct them before saving.`;
    return reply(text, [card('Save this meal?', 'Values are estimates from a food database.', [{ kind: 'log_meal', meal: { date, slot, items: parsed.items, source: 'coach', estimated: true } }])]);
  }

  // ── Workout reports ───────────────────────────────────────────
  const intent = detectWorkoutIntent(t);
  if (intent) {
    const date = parseDateRef(t, today);
    const muscles = parseMuscles(t);

    if (intent === 'sets') {
      const s = parseSetsText(t, units);
      if (!s) return reply('I could tell you did an exercise, but not the full details. Try something like "3 sets of bench press at 60 kg for 10 reps".');
      const d = date ?? today;
      return reply(`Got it — ${s.sets.length} sets of ${getExercise(s.exerciseId).name}: ${s.sets.map((x) => `${fmtWeight(x.weightKg, units)} × ${x.reps}`).join(', ')}.`,
        [card(`Log to ${fmtDate(d, today)}?`, 'Adds these sets to your workout history.', [{ kind: 'log_sets', date: d, exerciseId: s.exerciseId, sets: s.sets }])]);
    }

    if (intent === 'soreness') {
      const tomorrow = entryOn(state, addDays(today, 1));
      const tt = templateById(state.plan, tomorrow?.templateId);
      const overlap = tt ? templateMuscles(tt).filter((m) => muscles.includes(m)) : [];
      let text = `Thanks — I'll factor ${mLabel(muscles)} soreness into scheduling over the next day or two.`;
      if (tt && overlap.length) text += ` Tomorrow's ${tt.name} hits ${mLabel(overlap)}. Mild soreness is fine to train through with lighter loads; if it's sharp pain or limits your movement, swap or skip those exercises.`;
      return reply(text, [card('Log soreness?', `Sore: ${mLabel(muscles)}`, [{ kind: 'log_soreness', muscles }])]);
    }

    if (intent === 'different') {
      const d = date ?? today;
      const planned = findTargetEntry(state, d, [], today);
      const name = muscles.length ? listJoin([...new Set(muscles.map((m) => MUSCLE_LABEL[m]))]).replace(/, /g, ', ') : 'Different workout';
      const plannedT = templateById(state.plan, planned?.templateId);
      if (!muscles.length) return reply('Which muscles did you train instead? For example: "I did back and biceps instead."');
      if (plannedT && templateMuscles(plannedT).every((m) => muscles.includes(m) || ['core', 'calves'].includes(m))) {
        return reply(`That matches your planned ${plannedT.name}.`, [card(`Mark ${plannedT.name} as completed?`, 'Recorded as reported (no set details). You can add sets in Workout history.', [{ kind: 'set_status', scheduledId: planned!.id, status: 'completed' }])]);
      }
      const cards = [card(`Record "${name}" for ${fmtDate(d, today)}?`, plannedT && planned!.status === 'planned' ? `Your planned ${plannedT.name} will be marked skipped (replaced). Your ${mLabel(muscles)} will count toward recovery.` : `Your ${mLabel(muscles)} will count toward recovery.`,
        [{ kind: 'report_different', scheduledId: plannedT && planned!.status === 'planned' ? planned!.id : null, date: d, muscles, name }])];
      let text = `Nice — training is training.`;
      if (plannedT && planned!.status === 'planned') {
        const rs = rescheduleCards(state, planned!, 'skipped', today);
        text += ` Since ${plannedT.name} didn't happen, ${rs.text.charAt(0).toLowerCase() + rs.text.slice(1)}`;
        cards.push(...rs.cards);
      }
      return reply(text, cards);
    }

    const entry = findTargetEntry(state, date, intent === 'partial' ? [] : muscles, today);
    if (!entry) return reply(date ? `I don't see a scheduled workout ${onDay(date, today)}. Did you mean another day?` : `I couldn't match that to a scheduled workout in the last week. Which day was it?`);
    const tmpl = templateById(state.plan, entry.templateId)!;
    const when = fmtDate(entry.date, today);

    if (intent === 'rest') {
      if (!entry || entry.date !== (date ?? today)) return reply('Enjoy the rest day — recovery is when you actually get stronger.');
      const rs = rescheduleCards(state, entry, 'rest', today);
      return reply(`Rest is part of training. ${rs.text}`, [card(`Make ${when} a rest day?`, `${tmpl.name} won't count as missed.`, [{ kind: 'set_status', scheduledId: entry.id, status: 'rest', note: 'Rest day (user choice)' }]), ...rs.cards]);
    }

    if (intent === 'missed' || intent === 'skipped') {
      const status: WorkoutStatus = intent;
      if (['completed', 'partial'].includes(entry.status)) return reply(`${when}'s ${tmpl.name} is already recorded as ${STATUS_LABEL[entry.status].toLowerCase()}. Should I change that? You can edit it from Workout → History.`);
      const rs = rescheduleCards(state, entry, status, today);
      return reply(`No problem — missing a session happens. I'll mark ${lc(when)}'s ${tmpl.name} as ${status} (not deleted). ${rs.text}`,
        [card(`Mark ${when}'s ${tmpl.name} as ${status}?`, 'History keeps the original plan alongside what happened.', [{ kind: 'set_status', scheduledId: entry.id, status, note: input }]), ...rs.cards]);
    }

    if (intent === 'partial') {
      if (!muscles.length) return reply(`Which part did you get through? For example: "I only trained chest" or "I did the first three exercises".`);
      const done = tmpl.exercises.filter((pe) => getExercise(pe.exerciseId).primary.some((m) => muscles.includes(m)));
      const skipped = tmpl.exercises.filter((pe) => !done.includes(pe));
      if (!done.length) return reply(`${tmpl.name} doesn't include ${mLabel(muscles)} exercises. Did you do a different workout instead?`);
      return reply(`Partial sessions still count. From ${tmpl.name} I'll record ${done.map((pe) => getExercise(pe.exerciseId).name).join(', ')} as done and ${skipped.length} exercise${skipped.length !== 1 ? 's' : ''} as skipped. I won't mark it fully completed or missed.\n\nNo need to make up the rest — the skipped muscles will be trained in your next session that includes them.`,
        [card(`Record ${when}'s ${tmpl.name} as partial?`, `Done: ${done.map((pe) => getExercise(pe.exerciseId).name).join(', ')}`, [{ kind: 'report_partial', scheduledId: entry.id, doneExerciseIds: done.map((pe) => pe.exerciseId), muscles }])]);
    }

    if (intent === 'completed') {
      if (entry.status === 'completed') return reply(`${when}'s ${tmpl.name} is already marked completed. 💪`);
      if (state.activeSessionId) return reply(`You have a workout in progress. Finish it from the Workout tab and it'll be recorded with all your sets.`);
      return reply(`Great work! I'll mark ${lc(when)}'s ${tmpl.name} as completed. Since it wasn't tracked set-by-set, I'll treat it as done for scheduling but won't invent weights or reps — use the Workout tab to log details if you'd like progress tracking.`,
        [card(`Mark ${tmpl.name} completed?`, 'Recorded as reported by you.', [{ kind: 'set_status', scheduledId: entry.id, status: 'completed', note: 'Reported via coach' }])]);
    }
  }

  // ── Questions ─────────────────────────────────────────────────
  const todayEntry = entryOn(state, today);
  const todayT = templateById(state.plan, todayEntry?.templateId);
  const totalsToday = dayTotals(state, today);

  if (/(workout|training|session|plan)\b.*\b(today|tomorrow)|what('?s| is| am i).*(today|tomorrow)|today'?s workout/.test(t)) {
    const d = /tomorrow/.test(t) ? addDays(today, 1) : today;
    const e = entryOn(state, d);
    const tt = templateById(state.plan, e?.templateId);
    if (!tt) return reply(`${fmtDate(d, today)} is a rest day. Light walking or stretching is great for recovery.`);
    const lines = tt.exercises.map((pe) => { const s = suggestLoad(state, pe, p, d); return `• ${getExercise(pe.exerciseId).name}: ${pe.sets} × ${pe.repsMin}–${pe.repsMax} @ ${fmtWeight(s.weightKg, units)}`; });
    return reply(`${fmtDate(d, today)}: ${tt.name} (${STATUS_LABEL[displayStatus(e!, today)].toLowerCase()}) — ${mLabel(templateMuscles(tt))}.\n${lines.join('\n')}`);
  }

  if (/(what|which) weight|last time|did i (use|lift)|how much did i (lift|use)/.test(t)) {
    const ex = findExerciseByName(t);
    if (ex) {
      const lu = lastUsed(state, ex.id);
      return reply(lu ? `Last time (${fmtDate(lu.date, today)}) on ${ex.name}: ${lu.text}.` : `I don't have any tracked sets for ${ex.name} yet.`);
    }
    const last = [...state.sessions].filter((s) => s.source === 'tracked' && s.state === 'finished').sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!last) return reply("You haven't tracked a workout yet, so there's no history to look up.");
    return reply(`Your last tracked workout was ${last.name} ${onDay(last.date, today)}:\n` + last.exercises.filter((e) => e.sets.some((s) => s.done)).map((e) => `• ${getExercise(e.exerciseId).name}: ${e.sets.filter((s) => s.done).map((s) => `${fmtWeight(s.weightKg, units)} × ${s.reps}`).join(', ')}`).join('\n'));
  }

  if (/protein|calorie|macro|how much.*(left|remaining)|(left|remaining).*(eat|today)/.test(t) && !/suggest|recommend|idea|what (should|can) i eat/.test(t)) {
    const remP = Math.max(0, Math.round(p.targets.protein - totalsToday.protein));
    const remK = p.targets.calories - totalsToday.kcal;
    return reply(`Today so far: ${totalsToday.kcal} kcal and ${Math.round(totalsToday.protein)} g protein.\nRemaining: ${remK >= 0 ? `${remK} kcal` : `${-remK} kcal over target`}, ${remP} g protein.` + (remP > 30 ? `\nTip: ${suggestMeals(remK, remP, p.diet)[0]?.name ?? 'a lean protein source'} would close a big part of the protein gap.` : ''));
  }

  if (/suggest|recommend|idea|what (should|can) i (eat|have)|high.?protein/.test(t) && /eat|meal|dinner|lunch|breakfast|snack|food|protein/.test(t)) {
    const slot = detectSlot(t);
    const remP = Math.max(0, p.targets.protein - totalsToday.protein);
    const remK = p.targets.calories - totalsToday.kcal;
    const ideas = suggestMeals(remK, remP, p.diet, slot);
    if (!ideas.length) return reply(`You're at ${totalsToday.kcal} of ${p.targets.calories} kcal today. If you're hungry, choose something light and protein-rich like egg whites or Greek yogurt.`);
    return reply(`You have about ${Math.max(0, remK)} kcal and ${Math.round(remP)} g protein left today. Ideas${slot ? ` for ${slot}` : ''}:\n` + ideas.map((i) => `• ${i.name} — ~${i.kcal} kcal, ${i.protein} g protein`).join('\n'));
  }

  if (/replace|alternative|swap|instead of|substitute|(not|isn'?t|is not|un)available|taken|busy|occupied|don'?t have/.test(t)) {
    const ex = findExerciseByName(t);
    if (!ex) return reply('Which exercise would you like to replace? For example: "Can I replace bench press?"');
    const machineBusy = /(not|isn'?t|un)available|taken|busy|occupied|don'?t have/.test(t);
    const alts = alternativesFor(ex.id, p.equipment, p.limitations, machineBusy && ex.equipment.includes('machine') ? 'machine' : undefined);
    if (!alts.length) return reply(`I couldn't find a good alternative for ${ex.name} with your equipment.`);
    const cards: ProposalCard[] = [];
    for (const tt of state.plan?.templates ?? []) {
      const pe = tt.exercises.find((e) => e.exerciseId === ex.id);
      if (pe) cards.push(card(`Permanently use ${alts[0].name} in ${tt.name}?`, 'Only affects future workouts. For a one-off swap, use the swap button during your workout.', [{ kind: 'replace_exercise', templateId: tt.id, uid: pe.uid, exerciseId: alts[0].id }]));
    }
    return reply(`Good alternatives to ${ex.name} that train the same muscles (${mLabel(ex.primary)}):\n` + alts.slice(0, 4).map((a) => `• ${a.name} — ${a.equipment.join(', ')}`).join('\n') + `\n\nFor today only, tap ⇄ on the exercise during your workout.`, cards.slice(0, 1));
  }

  if (/increase|go up|heavier|add weight|progress(ive)? overload/.test(t)) {
    const ready: ProposalCard[] = [];
    const lines: string[] = [];
    for (const tt of state.plan?.templates ?? []) for (const pe of tt.exercises) {
      const s = suggestLoad(state, pe, p);
      if (s.basis !== 'history') continue;
      const name = getExercise(pe.exerciseId).name;
      if (s.weightKg != null && pe.weightKg != null && s.weightKg > (pe.weightKg ?? 0) + 0.01 && s.reason.startsWith('You hit')) {
        lines.push(`• ${name}: yes → ${fmtWeight(s.weightKg, units)}`);
        ready.push(card(`${name} → ${fmtWeight(s.weightKg, units)}`, s.reason, [{ kind: 'update_weight', templateId: tt.id, uid: pe.uid, exerciseId: pe.exerciseId, weightKg: s.weightKg }]));
      } else lines.push(`• ${name}: not yet — ${s.reason}`);
    }
    if (!lines.length) return reply("I need at least one tracked session per exercise before I can recommend increases. Log your next workout set-by-set and I'll tell you.");
    return reply(`Based on your last tracked sessions:\n${lines.join('\n')}\n\nOnly increase if your form stayed solid and the last reps were hard but doable. During workouts I already pre-fill the suggested weight.`, ready.slice(0, 3));
  }

  if (/improv|progress|how (was|is|did) my (week|fitness)|weekly|this week|report/.test(t)) {
    const r = weeklyReport(state, weekStart(today), today);
    return reply(`This week (${fmtDate(r.start, today)} – ${fmtDate(r.end, today)}):\n` +
      (r.wins.length ? `What went well:\n${r.wins.map((w) => '• ' + w).join('\n')}\n` : '') +
      (r.improve.length ? `Needs attention:\n${r.improve.map((w) => '• ' + w).join('\n')}\n` : '') +
      `Next steps:\n${r.next.map((w) => '• ' + w).join('\n')}`);
  }

  if (/why.*(not|n'?t).*(gain|grow|build|los|progress|stronger)|not (gaining|losing|growing|seeing)|plateau|stuck/.test(t)) {
    const start = addDays(today, -27);
    const reasons: string[] = [];
    const sched = state.schedule.filter((s) => s.templateId && s.date >= start && s.date < today);
    const done = sched.filter((s) => s.status === 'completed' || s.status === 'partial').length;
    if (sched.length) reasons.push(`Training: ${done} of ${sched.length} planned sessions done in the last 4 weeks (${Math.round((done / sched.length) * 100)}%).${done / sched.length < 0.75 ? ' Consistency is the first lever — aim for 80%+.' : ' That\'s solid.'}`);
    const days = [...new Set(state.meals.filter((m) => m.date >= start && m.date < today).map((m) => m.date))];
    if (days.length >= 4) {
      const avgP = Math.round(days.reduce((a, d) => a + dayTotals(state, d).protein, 0) / days.length);
      const avgK = Math.round(days.reduce((a, d) => a + dayTotals(state, d).kcal, 0) / days.length);
      reasons.push(`Nutrition (${days.length} logged days): ${avgK} kcal and ${avgP} g protein on average vs targets of ${p.targets.calories} kcal / ${p.targets.protein} g.${avgP < p.targets.protein * 0.85 ? ' Protein is likely the biggest gap.' : ''}${p.goal === 'build_muscle' && avgK < p.targets.calories * 0.9 ? ' You\'re also eating below your muscle-gain target.' : ''}`);
    } else reasons.push(`Nutrition: only ${days.length} day${days.length === 1 ? '' : 's'} logged in 4 weeks, so I can't judge whether food is the issue. Logging for a week would tell us a lot.`);
    const wt = weightTrend(state, today);
    if (wt.delta != null) reasons.push(`Bodyweight: weekly average ${wt.delta >= 0 ? 'up' : 'down'} ${toDisplayWeight(Math.abs(wt.delta), units)} ${weightUnit(units)}.${p.goal === 'build_muscle' && wt.delta <= 0 ? ' Gaining muscle usually needs a slow upward trend.' : ''}`);
    else reasons.push('Bodyweight: not enough weigh-ins to see a trend.');
    reasons.push('Muscle growth is slow — realistically 0.25–1 kg per month for most people, and less after the first year. Give any change 3–4 weeks before judging it.');
    return reply(`Let me look at what's actually recorded:\n${reasons.map((r) => '• ' + r).join('\n')}`);
  }

  if (/what should i do|help|what can you do/.test(t)) {
    const ins = computeInsights(state, today);
    return reply(`I can help with things like:\n• "What's my workout today?"\n• "I missed yesterday's workout"\n• "I only trained chest today"\n• "I ate two boiled eggs and a cup of rice"\n• "How much protein do I have left?"\n• "Can I replace bench press?"\n• "Should I increase my weights?"\n• "How was my week?"` + (ins.length ? `\n\nRight now: ${ins[0].text}` : ''), ins[0]?.card ? [ins[0].card] : []);
  }

  if (todayT && /start|ready|gym now|heading to/.test(t)) return reply(`Today is ${todayT.name}. Open the Workout tab and tap Start — weights are pre-filled from your history.`);

  return { text: '', cards: [], handled: false };
}
