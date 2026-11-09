import { fromRecords, toRecords } from './records';
import { defaultState } from './store';
import { computeTargets, generatePlan } from './planner';
import { ensureSchedule } from './training';
import type { AppState, Profile } from './types';

it('round-trips the whole app state through sync records', () => {
  const base: Omit<Profile, 'targets'> = { name: 'A', age: 30, gender: 'male', heightCm: 180, weightKg: 80, targetWeightKg: 80, goal: 'general', experience: 'beginner', trainingDays: [1, 3, 5], preferredTime: 'evening', location: 'gym', equipment: ['machine', 'dumbbell', 'bodyweight'], diet: [], limitations: '', units: 'metric', split: 'full_body', createdAt: '2026-11-01T00:00:00Z' };
  const profile = { ...base, targets: computeTargets(base) };
  let s: AppState = { ...defaultState(), profile, plan: generatePlan(profile) };
  s = { ...s, schedule: ensureSchedule(s, '2026-11-09'), meals: [{ id: 'm1', date: '2026-11-09', slot: 'lunch', items: [], source: 'manual', estimated: false, createdAt: 1 }], soreness: [{ date: '2026-11-09', muscles: ['quads'] }], ai: { apiKey: 'secret', model: 'claude-haiku-5-5' } };
  const recs = toRecords(s);
  expect(JSON.stringify(recs)).not.toContain('secret'); // the AI key never leaves the device
  const back = fromRecords(recs, { ...defaultState(), ai: { apiKey: 'secret', model: 'x' } });
  expect(back.profile).toEqual(s.profile);
  expect(back.plan).toEqual(s.plan);
  expect(back.schedule).toEqual(s.schedule);
  expect(back.meals).toEqual(s.meals);
  expect(back.soreness).toEqual(s.soreness);
  expect(back.ai).toEqual({ apiKey: 'secret', model: 'claude-haiku-5-5' });
});
