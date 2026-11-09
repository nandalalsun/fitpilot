import { EXERCISES, getExercise, isAvailable } from './exercises';
import type { Exercise, Experience, Goal, Muscle, NutritionTargets, Pattern, Plan, PlannedExercise, Profile, SplitType, WorkoutTemplate } from './types';
import { KG_PER_LB, round, uid } from './util';

// ── Nutrition targets ────────────────────────────────────────────

export function computeTargets(p: Pick<Profile, 'age' | 'gender' | 'heightCm' | 'weightKg' | 'goal' | 'trainingDays'>): NutritionTargets {
  const s = p.gender === 'male' ? 5 : p.gender === 'female' ? -161 : -78;
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + s;
  const activity = 1.3 + 0.05 * Math.min(6, p.trainingDays.length);
  const tdee = bmr * activity;
  const adj: Record<Goal, number> = {
    build_muscle: 250,
    lose_fat: -Math.min(500, tdee * 0.2),
    recomp: -150,
    strength: 150,
    general: 0,
  };
  const calories = Math.max(Math.round(bmr * 1.1), 1400, Math.round((tdee + adj[p.goal]) / 10) * 10);
  // Protein is based on a reference weight so very high body-fat levels don't inflate the target.
  const hM = p.heightCm / 100;
  const refWeight = Math.min(p.weightKg, 27 * hM * hM);
  const perKg: Record<Goal, number> = { lose_fat: 2.0, build_muscle: 1.8, recomp: 1.9, strength: 1.8, general: 1.4 };
  const protein = round(refWeight * perKg[p.goal], 5);
  const fat = round(Math.max(0.8 * refWeight, (calories * 0.25) / 9), 5);
  const carbs = Math.max(50, round((calories - protein * 4 - fat * 9) / 4, 5));
  return { calories, protein, carbs, fat };
}

// ── Templates ────────────────────────────────────────────────────

type Slot = [Pattern, number?]; // pattern, variant index (pick the n-th best available)

const TEMPLATE_DEFS: Record<string, { name: string; focus: Muscle[]; slots: Slot[] }> = {
  fbA: { name: 'Full Body A', focus: ['quads', 'chest', 'lats', 'hamstrings', 'shoulders'], slots: [['squat'], ['horizontal_push'], ['vertical_pull'], ['hinge'], ['lateral_raise'], ['core']] },
  fbB: { name: 'Full Body B', focus: ['glutes', 'shoulders', 'back', 'hamstrings', 'biceps', 'triceps'], slots: [['squat', 1], ['vertical_push'], ['horizontal_pull'], ['knee_flexion'], ['bicep_curl'], ['tricep_extension']] },
  fbC: { name: 'Full Body C', focus: ['quads', 'glutes', 'chest', 'lats', 'rear_delts', 'calves'], slots: [['lunge'], ['horizontal_push', 1], ['vertical_pull', 1], ['hip_thrust'], ['rear_delt'], ['calf']] },
  upA: { name: 'Upper A', focus: ['chest', 'back', 'shoulders', 'biceps', 'triceps'], slots: [['horizontal_push'], ['horizontal_pull'], ['vertical_push'], ['vertical_pull'], ['bicep_curl'], ['tricep_extension']] },
  upB: { name: 'Upper B', focus: ['chest', 'lats', 'shoulders', 'rear_delts'], slots: [['horizontal_push', 1], ['vertical_pull'], ['chest_fly'], ['horizontal_pull', 1], ['lateral_raise'], ['rear_delt']] },
  loA: { name: 'Lower A', focus: ['quads', 'hamstrings', 'glutes', 'calves'], slots: [['squat'], ['hinge'], ['knee_extension'], ['knee_flexion'], ['calf'], ['core']] },
  loB: { name: 'Lower B', focus: ['quads', 'glutes', 'hamstrings', 'calves'], slots: [['squat', 1], ['hip_thrust'], ['lunge'], ['knee_flexion'], ['calf'], ['core']] },
  push: { name: 'Push', focus: ['chest', 'shoulders', 'triceps'], slots: [['horizontal_push'], ['vertical_push'], ['horizontal_push', 1], ['chest_fly'], ['lateral_raise'], ['tricep_extension']] },
  pull: { name: 'Pull', focus: ['back', 'lats', 'biceps', 'rear_delts'], slots: [['vertical_pull'], ['horizontal_pull'], ['horizontal_pull', 1], ['rear_delt'], ['bicep_curl'], ['bicep_curl', 1]] },
  legs: { name: 'Legs', focus: ['quads', 'hamstrings', 'glutes', 'calves'], slots: [['squat'], ['hinge'], ['squat', 1], ['knee_flexion'], ['knee_extension'], ['calf']] },
  chestTri: { name: 'Chest & Triceps', focus: ['chest', 'triceps'], slots: [['horizontal_push'], ['horizontal_push', 1], ['chest_fly'], ['tricep_extension'], ['tricep_extension', 1]] },
  backBi: { name: 'Back & Biceps', focus: ['back', 'lats', 'biceps'], slots: [['vertical_pull'], ['horizontal_pull'], ['horizontal_pull', 1], ['bicep_curl'], ['bicep_curl', 1]] },
  shoulderCore: { name: 'Shoulders & Core', focus: ['shoulders', 'rear_delts', 'core'], slots: [['vertical_push'], ['lateral_raise'], ['rear_delt'], ['shrug'], ['core'], ['core', 1]] },
};

export const SPLIT_LABEL: Record<SplitType, string> = {
  full_body: 'Full Body', upper_lower: 'Upper / Lower', ppl: 'Push / Pull / Legs', body_part: 'Body-part split',
};

export function defaultSplit(days: number): SplitType {
  if (days <= 3) return 'full_body';
  if (days === 4) return 'upper_lower';
  return 'ppl';
}

function rotation(split: SplitType, days: number): string[] {
  switch (split) {
    case 'full_body': return days <= 2 ? ['fbA', 'fbB'] : ['fbA', 'fbB', 'fbC'];
    case 'upper_lower': return ['upA', 'loA', 'upB', 'loB'];
    case 'ppl': return days === 5 ? ['push', 'pull', 'legs', 'upA', 'loB'] : ['push', 'pull', 'legs'];
    case 'body_part': return days <= 3 ? ['chestTri', 'backBi', 'legs'] : ['legs', 'chestTri', 'backBi', 'shoulderCore'];
  }
}

function preferenceScore(e: Exercise, exp: Experience, location: Profile['location']): number {
  const machine = e.equipment.some((q) => q === 'machine' || q === 'cable');
  const free = e.equipment.some((q) => q === 'barbell' || q === 'dumbbell');
  const bw = e.equipment.every((q) => q === 'bodyweight' || q === 'bench' || q === 'pullup_bar');
  let s = 0;
  if (location === 'gym') {
    if (exp === 'beginner') s += machine ? 3 : e.equipment.includes('barbell') ? 0 : free ? 2 : 0;
    else s += e.equipment.includes('barbell') ? 3 : free ? 2 : machine ? 1 : 0;
    if (bw && e.startRatio === 0 && e.pattern !== 'core') s -= 2;
  } else {
    s += free ? 3 : e.equipment.includes('bands') ? 2 : bw ? 1 : 0;
  }
  return s;
}

export function candidatesFor(pattern: Pattern, p: Pick<Profile, 'equipment' | 'limitations' | 'experience' | 'location'>): Exercise[] {
  return EXERCISES
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.pattern === pattern && isAvailable(e, p.equipment, p.limitations))
    .sort((a, b) => preferenceScore(b.e, p.experience, p.location) - preferenceScore(a.e, p.experience, p.location) || a.i - b.i)
    .map(({ e }) => e);
}

export function setScheme(goal: Goal, exp: Experience, compound: boolean) {
  if (goal === 'strength') {
    return compound
      ? { sets: exp === 'beginner' ? 3 : 4, repsMin: exp === 'beginner' ? 5 : 4, repsMax: exp === 'beginner' ? 8 : 6, restSec: 150 }
      : { sets: 3, repsMin: 8, repsMax: 12, restSec: 75 };
  }
  if (goal === 'build_muscle' || goal === 'recomp') {
    return compound
      ? { sets: exp === 'advanced' ? 4 : 3, repsMin: 8, repsMax: 12, restSec: 120 }
      : { sets: 3, repsMin: 10, repsMax: 15, restSec: 75 };
  }
  return compound ? { sets: 3, repsMin: 8, repsMax: 12, restSec: 90 } : { sets: exp === 'beginner' ? 2 : 3, repsMin: 12, repsMax: 15, restSec: 60 };
}

/** Round a load to something you can actually put on the bar/stack in the user's units. */
export function roundLoad(kg: number, e: Exercise, units: Profile['units']): number {
  if (units === 'imperial') {
    const step = e.increment <= 1.25 ? 2.5 : 5;
    return Math.max(step, round(kg / KG_PER_LB, step)) * KG_PER_LB;
  }
  const step = e.increment || 2.5;
  return Math.max(step, round(kg, step));
}

export function startingWeight(e: Exercise, p: Pick<Profile, 'weightKg' | 'experience' | 'gender' | 'age' | 'units'>): number | null {
  if (e.startRatio === 0) return null;
  const exp = { beginner: 1, intermediate: 1.35, advanced: 1.7 }[p.experience];
  const g = p.gender === 'male' ? 1 : p.gender === 'female' ? 0.7 : 0.85;
  const age = p.age >= 55 ? 0.85 : 1;
  return roundLoad(e.startRatio * p.weightKg * exp * g * age, e, p.units);
}

export function buildTemplate(key: string, p: Profile): WorkoutTemplate {
  const def = TEMPLATE_DEFS[key];
  const used = new Set<string>();
  const exercises: PlannedExercise[] = [];
  for (const [pattern, variant = 0] of def.slots) {
    const cands = candidatesFor(pattern, p).filter((e) => !used.has(e.id));
    const pick = cands[Math.min(variant, cands.length - 1)] ?? cands[0];
    if (!pick) continue;
    used.add(pick.id);
    exercises.push({ uid: uid(), exerciseId: pick.id, weightKg: startingWeight(pick, p), ...setScheme(p.goal, p.experience, pick.compound) });
  }
  return { id: key + '_' + uid(), name: def.name, focus: def.focus, exercises };
}

export function generatePlan(p: Profile, split: SplitType = p.split): Plan {
  const days = [...p.trainingDays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)); // Monday-first
  const keys = rotation(split, days.length);
  const templates = keys.map((k) => buildTemplate(k, p));
  const week: Record<number, string> = {};
  days.forEach((d, i) => (week[d] = templates[i % templates.length].id));
  // Drop templates that never get a day (e.g. 2-day full body uses A/B only)
  const usedIds = new Set(Object.values(week));
  return { id: uid(), createdAt: new Date().toISOString(), split, templates: templates.filter((t) => usedIds.has(t.id)), week };
}

/** Muscles a template trains as primary movers (derived from its exercises, not just the label). */
export function templateMuscles(t: WorkoutTemplate): Muscle[] {
  const set = new Set<Muscle>();
  t.exercises.forEach((pe) => getExercise(pe.exerciseId).primary.forEach((m) => set.add(m)));
  return [...set];
}
