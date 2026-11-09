import { applyProposal } from './actions';
import { weekConsistency, weeklyReport } from './analytics';
import { handleMessage } from './coach';
import { alternativesFor } from './exercises';
import { parseFoodText, detectWorkoutIntent, parseSetsText } from './nlp';
import { computeTargets, generatePlan } from './planner';
import { recommendReschedule } from './scheduler';
import { defaultState } from './store';
import { createSession, displayStatus, ensureSchedule, finalizeSession, sessionOutcome, suggestLoad } from './training';
import type { AppState, Profile } from './types';
import { addDays } from './util';

const TODAY = '2026-11-10'; // Tuesday
const MONDAY = '2026-11-09';

function profile(over: Partial<Profile> = {}): Profile {
  const base: Omit<Profile, 'targets'> = {
    name: 'Test', age: 30, gender: 'male', heightCm: 178, weightKg: 80, targetWeightKg: 78, goal: 'build_muscle', experience: 'beginner',
    trainingDays: [1, 2, 4, 5], preferredTime: 'evening', location: 'gym',
    equipment: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'bench', 'pullup_bar'], diet: [], limitations: '', units: 'imperial',
    split: 'body_part', createdAt: '2026-11-02T08:00:00.000Z', ...over,
  };
  return { ...base, targets: computeTargets(base) };
}

function setup(over: Partial<Profile> = {}): AppState {
  const p = profile(over);
  const plan = { ...generatePlan(p), createdAt: '2026-11-02T08:00:00' };
  const s: AppState = { ...defaultState(), profile: p, plan };
  return { ...s, schedule: ensureSchedule(s, TODAY) };
}

const confirmAll = (s: AppState, cards: ReturnType<typeof handleMessage>['cards'], idx = [0]) =>
  idx.reduce((st, i) => cards[i].actions.reduce((x, a) => applyProposal(x, a, TODAY), st), s);

describe('planning', () => {
  it('computes sensible targets', () => {
    const t = profile().targets;
    expect(t.calories).toBeGreaterThan(2300);
    expect(t.calories).toBeLessThan(3300);
    expect(t.protein).toBeGreaterThanOrEqual(130);
    expect(t.protein).toBeLessThanOrEqual(160);
  });

  it('builds a body-part split on the chosen days with full exercise prescriptions', () => {
    const s = setup();
    const names = [1, 2, 4, 5].map((d) => s.plan!.templates.find((t) => t.id === s.plan!.week[d])!.name);
    expect(names).toEqual(['Legs', 'Chest & Triceps', 'Back & Biceps', 'Shoulders & Core']);
    for (const t of s.plan!.templates) {
      expect(t.exercises.length).toBeGreaterThanOrEqual(5);
      t.exercises.forEach((e) => { expect(e.sets).toBeGreaterThan(0); expect(e.repsMax).toBeGreaterThanOrEqual(e.repsMin); });
    }
  });

  it('respects home equipment and injuries', () => {
    const s = setup({ location: 'home', equipment: ['dumbbell', 'bodyweight', 'bands'], limitations: 'bad knee', split: 'full_body', trainingDays: [1, 3, 5] });
    const ids = s.plan!.templates.flatMap((t) => t.exercises.map((e) => e.exerciseId));
    expect(ids).not.toContain('leg_press');
    expect(ids).not.toContain('goblet_squat'); // flagged for knees
    expect(ids).not.toContain('back_squat');
  });

  it('suggests alternatives that preserve the muscle group', () => {
    const alts = alternativesFor('bench_press').map((a) => a.id);
    expect(alts).toContain('db_bench_press');
    expect(alternativesFor('lat_pulldown').map((a) => a.id)).toContain('assisted_pull_up');
    expect(alternativesFor('cable_pushdown', ['dumbbell', 'bodyweight']).map((a) => a.id)).toContain('db_overhead_extension');
  });
});

describe('Journey 1: tracked workout', () => {
  it('records actual vs planned and progresses from actual performance', () => {
    let s = setup();
    const today = s.schedule.find((x) => x.date === TODAY)!;
    const tmpl = s.plan!.templates.find((t) => t.id === today.templateId)!;
    let session = createSession(s, tmpl, s.profile!, today.id, TODAY);
    // do every set at top of range on first exercise, skip the rest partially
    session.exercises[0].sets = session.exercises[0].sets.map((x) => ({ ...x, reps: tmpl.exercises[0].repsMax, done: true }));
    session = finalizeSession(session);
    expect(sessionOutcome(session)).toBe('partial');
    expect(session.exercises[1].status).toBe('skipped');
    s = { ...s, sessions: [session] };
    const sug = suggestLoad(s, tmpl.exercises[0], s.profile!, addDays(TODAY, 7));
    expect(sug.basis).toBe('history');
    expect(sug.weightKg!).toBeGreaterThan(session.exercises[0].sets[0].weightKg!);
  });
});

describe('Journey 2: missed workout', () => {
  it('distinguishes unreported from missed', () => {
    const s = setup();
    const mon = s.schedule.find((x) => x.date === MONDAY)!;
    expect(displayStatus(mon, TODAY)).toBe('unreported');
  });

  it('recommends a recovery-aware adjustment without blindly shifting everything', () => {
    const s = setup();
    const r = handleMessage(s, "I missed yesterday's workout", TODAY);
    expect(r.handled).toBe(true);
    expect(r.cards[0].actions[0]).toMatchObject({ kind: 'set_status', status: 'missed' });
    expect(r.cards.length).toBeGreaterThanOrEqual(2);
    const s2 = confirmAll(s, r.cards, [0]);
    const mon = s2.schedule.find((x) => x.date === MONDAY)!;
    expect(mon.status).toBe('missed');
    const adv = recommendReschedule(s2, mon.id, TODAY)!;
    expect(adv.workoutName).toBe('Legs');
    // Wednesday (rest day) is free and legs haven't been trained → move legs there.
    const rec = adv.recommended.proposal;
    expect(rec?.kind).toBe('reschedule');
    const s3 = applyProposal(s2, rec!, TODAY);
    const makeUp = s3.schedule.find((x) => x.templateId === mon.templateId && x.status === 'planned' && x.date >= TODAY && x.date < addDays(MONDAY, 7))!;
    expect(makeUp).toBeTruthy();
    expect(makeUp.movedFrom).toBe(MONDAY);
    expect(adv.recommended.explanation.length).toBeGreaterThan(20);
    // History preserved and no day has two workouts
    expect(s3.schedule.find((x) => x.id === mon.id)!.status).toBe('missed');
    const byDate: Record<string, number> = {};
    s3.schedule.filter((x) => x.templateId && x.status === 'planned').forEach((x) => (byDate[x.date] = (byDate[x.date] ?? 0) + 1));
    expect(Math.max(...Object.values(byDate))).toBe(1);
  });

  it('never stacks the missed workout next to a session training the same muscles', () => {
    const s = setup({ split: 'upper_lower', trainingDays: [1, 2, 3, 4] }); // Mon U, Tue L, Wed U, Thu L
    const mon = s.schedule.find((x) => x.date === MONDAY)!;
    const s2 = applyProposal(s, { kind: 'set_status', scheduledId: mon.id, status: 'missed' }, TODAY);
    const adv = recommendReschedule(s2, mon.id, TODAY)!;
    const p = adv.recommended.proposal;
    if (p?.kind === 'reschedule') {
      // Upper must not land on Tue/Wed/Thu adjacent to another upper day
      p.moves.filter((m) => m.templateId === mon.templateId).forEach((m) => expect(['2026-11-11', '2026-11-12']).not.toContain(m.toDate));
    }
  });
});

describe('Journey 3: partial workout', () => {
  it('records only the trained part', () => {
    const s = setup();
    const r = handleMessage(s, 'I only trained chest today', TODAY);
    expect(r.cards[0].actions[0].kind).toBe('report_partial');
    const s2 = confirmAll(s, r.cards);
    const t = s2.schedule.find((x) => x.date === TODAY)!;
    expect(t.status).toBe('partial');
    const sess = s2.sessions.find((x) => x.id === t.sessionId)!;
    expect(sess.exercises.some((e) => e.status === 'done')).toBe(true);
    expect(sess.exercises.some((e) => e.status === 'skipped')).toBe(true);
    // Reported sessions never fabricate weights
    expect(sess.exercises.every((e) => e.sets.length === 0)).toBe(true);
    expect(weekConsistency(s2, MONDAY, TODAY).partial).toBe(1);
  });
});

describe('Journey 5: conversational tracking', () => {
  it('parses food descriptions into estimates', () => {
    const a = parseFoodText('I ate two boiled eggs.');
    expect(a.items[0]).toMatchObject({ foodId: 'egg', qty: 2 });
    expect(a.items[0].protein).toBeCloseTo(12.6, 0);
    const b = parseFoodText('I had one cup of rice and 150 grams of chicken');
    expect(b.items.map((i) => i.foodId)).toEqual(['white_rice', 'chicken_breast']);
    expect(b.items[1].grams).toBe(150);
    const c = parseFoodText('I drank one protein shake with 30 grams of protein');
    expect(c.items[0].protein).toBe(30);
    const d = parseFoodText('I ate chicken curry with two rotis');
    expect(d.items.map((i) => i.foodId)).toEqual(['chicken_curry', 'roti']);
    expect(d.items[0].uncertain).toBe(true); // curry quantity not given
    expect(d.needsReview).toBe(true);
  });

  it('requires confirmation before saving a meal', () => {
    const s = setup();
    const r = handleMessage(s, 'I had 2 eggs and a slice of bread for breakfast', TODAY);
    expect(s.meals).toHaveLength(0);
    const s2 = confirmAll(s, r.cards);
    expect(s2.meals).toHaveLength(1);
    expect(s2.meals[0].slot).toBe('breakfast');
    expect(s2.meals[0].estimated).toBe(true);
  });

  it('understands workout statements', () => {
    expect(detectWorkoutIntent("i couldn't go to the gym today")).toBe('missed');
    expect(detectWorkoutIntent('i skipped legs')).toBe('skipped');
    expect(detectWorkoutIntent('i did back and biceps instead')).toBe('different');
    expect(detectWorkoutIntent("i completed today's workout")).toBe('completed');
    expect(detectWorkoutIntent('today is my rest day')).toBe('rest');
    const sets = parseSetsText('3 sets of bench press at 135 lb for 8 reps', 'imperial')!;
    expect(sets.exerciseId).toBe('bench_press');
    expect(sets.sets).toHaveLength(3);
    expect(sets.sets[0].weightKg).toBeCloseTo(61.2, 1);
  });

  it('records a different workout and offers to reschedule the original', () => {
    const s = setup();
    const r = handleMessage(s, 'I did back and biceps instead', TODAY);
    expect(r.cards[0].actions[0].kind).toBe('report_different');
    const s2 = confirmAll(s, r.cards);
    expect(s2.schedule.find((x) => x.date === TODAY)!.status).toBe('skipped');
    expect(s2.sessions[0].reportedMuscles).toContain('biceps');
  });

  it('marks a completed report without inventing set data', () => {
    const s = setup();
    const r = handleMessage(s, "I completed today's workout", TODAY);
    const s2 = confirmAll(s, r.cards);
    expect(s2.schedule.find((x) => x.date === TODAY)!.status).toBe('completed');
    expect(s2.sessions).toHaveLength(0);
  });
});

describe('Journey 6/7: reports', () => {
  it('is honest about missing data', () => {
    const s = setup();
    const r = weeklyReport(s, MONDAY, TODAY);
    expect(r.improve.join(' ')).toMatch(/No meals were logged/);
    expect(r.next.join(' ')).toMatch(/unreported|Weigh in/);
  });
});
