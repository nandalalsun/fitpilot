import { findExerciseByName, MUSCLE_GROUPS } from './exercises';
import { allFoods, makeItem, r1, type Food } from './foods';
import type { CustomFood, MealItem, MealSlot, Muscle, SetLog } from './types';
import { addDays, DAY_NAMES, KG_PER_LB, todayISO, weekday } from './util';

const NUM_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  half: 0.5, couple: 2, 'a couple of': 2, few: 3, 'a few': 3, dozen: 12, single: 1, double: 2,
};

const UNIT_ALIASES: Record<string, string> = {
  g: 'g', gm: 'g', gms: 'g', gram: 'g', grams: 'g', kg: 'kg', kgs: 'kg', ml: 'ml', l: 'l', litre: 'l', liter: 'l',
  oz: 'oz', ounce: 'oz', ounces: 'oz', lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  cup: 'cup', cups: 'cup', bowl: 'bowl', bowls: 'bowl', plate: 'plate', plates: 'plate', slice: 'slice', slices: 'slice',
  piece: 'piece', pieces: 'piece', pc: 'piece', pcs: 'piece', scoop: 'scoop', scoops: 'scoop', tbsp: 'tbsp', tablespoon: 'tbsp',
  tablespoons: 'tbsp', tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp', glass: 'glass', glasses: 'glass', can: 'can', cans: 'can',
  bar: 'bar', bars: 'bar', serving: 'serving', servings: 'serving', handful: 'handful', handfuls: 'handful', small: 'small', large: 'large',
  bottle: 'bottle', bottles: 'bottle', fillet: 'fillet', fillets: 'fillet', scoopful: 'scoop',
};
const GRAM_UNITS: Record<string, number> = { g: 1, kg: 1000, ml: 1, l: 1000, oz: 28.35, lb: 453.6 };

export function detectSlot(t: string): MealSlot | undefined {
  if (/\bbreakfast\b/.test(t)) return 'breakfast';
  if (/\blunch\b/.test(t)) return 'lunch';
  if (/\b(dinner|supper)\b/.test(t)) return 'dinner';
  if (/\bsnack\b/.test(t)) return 'snack';
  return undefined;
}

export function slotForTime(d = new Date()): MealSlot {
  const h = d.getHours();
  return h < 10.5 ? 'breakfast' : h < 15 ? 'lunch' : h >= 17.5 ? 'dinner' : 'snack';
}

function parseQty(s: string): { qty: number | null; rest: string } {
  const m = s.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+)\s*/) ;
  if (m) return { qty: Number(m[1]) / Number(m[2]), rest: s.slice(m[0].length) };
  const d = s.match(/^(\d+(?:\.\d+)?)\s*/);
  if (d) {
    let qty = Number(d[1]);
    let rest = s.slice(d[0].length);
    const half = rest.match(/^and a half\s+/);
    if (half) { qty += 0.5; rest = rest.slice(half[0].length); }
    return { qty, rest };
  }
  for (const w of Object.keys(NUM_WORDS).sort((a, b) => b.length - a.length)) {
    const r = new RegExp(`^${w}\\b\\s*(of\\s+)?`);
    const mm = s.match(r);
    if (mm) {
      let qty = NUM_WORDS[w];
      let rest = s.slice(mm[0].length);
      const half = rest.match(/^and a half\s+/);
      if (half) { qty += 0.5; rest = rest.slice(half[0].length); }
      return { qty, rest };
    }
  }
  return { qty: null, rest: s };
}

function matchFood(text: string, foods: Food[]): { food: Food; alias: string } | null {
  let best: { food: Food; alias: string } | null = null;
  for (const f of foods) {
    for (const a of [f.name.toLowerCase(), ...f.aliases]) {
      if (new RegExp(`\\b${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text) && (!best || a.length > best.alias.length)) best = { food: f, alias: a };
    }
  }
  return best;
}

const singular = (u: string) => u.replace(/(es|s)$/, '');

export interface FoodParse { items: MealItem[]; unknown: string[]; slot?: MealSlot; needsReview: boolean }

/** Turn "two boiled eggs and a cup of rice" into editable, estimated meal items. */
export function parseFoodText(input: string, custom: CustomFood[] = []): FoodParse {
  const foods = allFoods(custom);
  let t = input.toLowerCase().replace(/[.!?]/g, ' ').replace(/\s+/g, ' ').trim();
  const slot = detectSlot(t);
  t = t
    .replace(/\b(for|at|during) (breakfast|lunch|dinner|supper|a snack|snack)\b/g, ' ')
    .replace(/^(today |this morning |tonight |just )?(i |we )?(just )?(ate|eaten|had|have had|drank|drink|eat|consumed|snacked on|grabbed)\b/, ' ')
    .replace(/\b(i |we )(also )?(ate|had|drank)\b/g, ' and ')
    .trim();

  const items: MealItem[] = [];
  const unknown: string[] = [];

  // "protein shake with 30 grams of protein" → use the stated protein instead of a generic estimate
  const shake = t.match(/(protein (shake|drink|smoothie)|shake)[^,]*?(\d+)\s*(g|grams?)\s*(of\s+)?protein/);
  if (shake) {
    const p = Number(shake[3]);
    const { qty } = parseQty(t.slice(0, shake.index).trim().split(/\s+/).slice(-2).join(' ') || 'one');
    const n = qty ?? 1;
    items.push({ name: `Protein shake (${p} g protein)`, qty: n, unit: 'shake', grams: 300 * n, kcal: Math.round(p * 5 * n), protein: p * n, carbs: r1(3 * n), fat: r1(1.5 * n), uncertain: false });
    t = t.replace(shake[0], ' ');
  }

  const chunks = t.split(/,|;|\band\b|\bwith\b|\bplus\b|&|\+/).map((c) => c.trim()).filter((c) => c && !/^(a|an|some|the|of)$/.test(c));
  for (const raw of chunks) {
    const c = raw.replace(/^(some|about|around|roughly|approximately|like)\s+/, '');
    const { qty, rest } = parseQty(c);
    let rest2 = rest;
    let unit: string | null = null;
    const um = rest2.match(/^([a-z]+)\b\s*(of\s+)?/);
    if (um && UNIT_ALIASES[um[1]]) { unit = UNIT_ALIASES[um[1]]; rest2 = rest2.slice(um[0].length); }
    // "150g chicken" (no space)
    const glued = c.match(/^(\d+(?:\.\d+)?)(g|kg|ml|oz|lb)s?\b\s*(of\s+)?/);
    let q = qty;
    if (glued) { q = Number(glued[1]); unit = glued[2]; rest2 = c.slice(glued[0].length); }

    const found = matchFood(rest2 || c, foods) ?? matchFood(c, foods);
    if (!found) { if (c.length > 1) unknown.push(raw); continue; }
    const { food } = found;
    if (unit && GRAM_UNITS[unit] != null) {
      const grams = (q ?? 1) * GRAM_UNITS[unit];
      items.push({ ...makeItem(food, grams, 'g'), uncertain: false });
    } else if (unit) {
      const fu = food.units.find((u) => u.name === unit || singular(u.name) === unit);
      items.push(fu ? makeItem(food, q ?? 1, fu.name, q == null) : makeItem(food, q ?? 1, undefined, true));
    } else {
      items.push(makeItem(food, q ?? 1, undefined, q == null));
    }
  }
  return { items, unknown, slot, needsReview: unknown.length > 0 || items.some((i) => i.uncertain) };
}

// ── Workout language ─────────────────────────────────────────────

export function parseDateRef(t: string, today = todayISO()): string | null {
  if (/\b(today|this morning|this evening|tonight|just now)\b/.test(t)) return today;
  if (/\byesterday\b/.test(t)) return addDays(today, -1);
  if (/\b(day before yesterday)\b/.test(t)) return addDays(today, -2);
  for (let i = 0; i < 7; i++) {
    const name = DAY_NAMES[i].toLowerCase();
    if (new RegExp(`\\b(last |on |this )?${name}('?s)?\\b`).test(t)) {
      const diff = (weekday(today) - i + 7) % 7;
      return addDays(today, -diff);
    }
  }
  return null;
}

export function parseMuscles(t: string): Muscle[] {
  const out = new Set<Muscle>();
  for (const k of Object.keys(MUSCLE_GROUPS).sort((a, b) => b.length - a.length)) {
    if (new RegExp(`\\b${k}\\b`).test(t)) MUSCLE_GROUPS[k].forEach((m) => out.add(m));
  }
  if (/\bleg day\b/.test(t)) MUSCLE_GROUPS.legs.forEach((m) => out.add(m));
  return [...out];
}

/** "3 sets of bench press at 60kg for 10 reps", "bench 3x10 @ 135 lb" → set logs. */
export function parseSetsText(t: string, units: 'metric' | 'imperial'): { exerciseId: string; sets: SetLog[] } | null {
  const ex = findExerciseByName(t);
  if (!ex) return null;
  let sets: number | null = null, reps: number | null = null, w: number | null = null;
  const sx = t.match(/(\d+)\s*x\s*(\d+)/);
  if (sx) { sets = Number(sx[1]); reps = Number(sx[2]); }
  const sm = t.match(/(\d+|two|three|four|five)\s+sets?/);
  if (sm) sets = Number(sm[1]) || NUM_WORDS[sm[1]];
  const rm = t.match(/(\d+)\s+(reps?|repetitions|times)/);
  if (rm) reps = Number(rm[1]);
  const wm = t.match(/(\d+(?:\.\d+)?)\s*(kg|kgs|kilos?|lb|lbs|pounds?)/);
  if (wm) w = /^k/.test(wm[2]) ? Number(wm[1]) : Number(wm[1]) * KG_PER_LB;
  else { const at = t.match(/(?:at|@|with)\s+(\d+(?:\.\d+)?)/); if (at) w = units === 'imperial' ? Number(at[1]) * KG_PER_LB : Number(at[1]); }
  if (!sets || !reps) return null;
  return { exerciseId: ex.id, sets: Array.from({ length: Math.min(sets, 10) }, () => ({ weightKg: w, reps: reps!, done: true })) };
}

export type WorkoutIntent = 'missed' | 'skipped' | 'completed' | 'partial' | 'different' | 'rest' | 'sets' | 'soreness' | null;

export function detectWorkoutIntent(t: string): WorkoutIntent {
  if (/\bsore\b|\bsoreness\b|\baching\b/.test(t) && parseMuscles(t).length) return 'soreness';
  if (/\b(rest day|resting today|taking (the day|today) off|day off)\b/.test(t)) return 'rest';
  if (/(\d+)\s*x\s*(\d+)|\d+\s+sets?\b/.test(t) && findExerciseByName(t)) return 'sets';
  if (/\b(missed|couldn'?t (go|make it|train|get to)|could not|didn'?t (go|train|work ?out|make it|get to)|did not|no gym|wasn'?t able|not able to (go|train))\b/.test(t)) return 'missed';
  if (/\bskip(ped|ping)?\b/.test(t)) return 'skipped';
  if (/\binstead\b|\bdifferent (workout|session)\b|\bswitched to\b/.test(t)) return 'different';
  if (/\bonly\b.*\b(trained|did|worked|finished|hit|got through)\b|\b(trained|did|hit)\s+only\b|\bpartial(ly)?\b|\bhalf (of )?(my|the) workout\b|\bpart of\b/.test(t)) return 'partial';
  if (/\b(completed|finished|done with|did|crushed|smashed)\b.*\b(workout|session|training|it)\b|\bi (trained|worked out|went to the gym)\b|\bworkout (done|complete)\b/.test(t)) return 'completed';
  if (/\b(i )?(did|trained|hit|worked)\b/.test(t) && parseMuscles(t).length) return 'different';
  return null;
}

export function looksLikeFoodLog(t: string, custom: CustomFood[] = []): boolean {
  if (!/\b(ate|eaten|had|have had|drank|eat|breakfast|lunch|dinner|snack|snacked|consumed|log)\b/.test(t)) return false;
  if (/\?$/.test(t.trim()) || /^(what|how|should|can|why|suggest|recommend)\b/.test(t.trim())) return false;
  return parseFoodText(t, custom).items.length > 0;
}
