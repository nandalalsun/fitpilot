import type { CustomFood, Macros, MealItem } from './types';

export interface Food {
  id: string;
  name: string;
  aliases: string[];
  per100g: Macros;
  /** Household units → grams. The first unit is the default serving. */
  units: { name: string; grams: number }[];
  custom?: boolean;
}

// [id, name, aliases, kcal, protein, carbs, fat per 100 g, units "name:grams,…"]
type Row = [string, string, string, number, number, number, number, string];

const ROWS: Row[] = [
  // Protein
  ['egg', 'Egg (whole, boiled)', 'eggs,boiled egg,boiled eggs,hard boiled egg,egg', 155, 12.6, 1.1, 10.6, 'egg:50,large egg:56'],
  ['egg_fried', 'Egg (fried)', 'fried egg,fried eggs', 196, 13.6, 0.8, 15, 'egg:46'],
  ['egg_white', 'Egg white', 'egg whites', 52, 10.9, 0.7, 0.2, 'white:33,cup:243'],
  ['scrambled_eggs', 'Scrambled eggs', 'scrambled egg,scrambled', 149, 10, 1.6, 11, 'egg:61,cup:220'],
  ['omelette', 'Omelette (2 eggs)', 'omelet,omelette', 154, 10.6, 0.6, 11.7, 'omelette:120'],
  ['chicken_breast', 'Chicken breast (cooked)', 'chicken,chicken breast,grilled chicken,boiled chicken', 165, 31, 0, 3.6, 'breast:170,piece:120,cup:140'],
  ['chicken_thigh', 'Chicken thigh (cooked)', 'chicken thigh,chicken thighs', 209, 26, 0, 10.9, 'thigh:115'],
  ['chicken_curry', 'Chicken curry', 'chicken curry,butter chicken,chicken masala,chicken tikka masala', 150, 13, 5, 8.5, 'bowl:250,cup:240,serving:250'],
  ['beef_mince', 'Ground beef (90% lean, cooked)', 'ground beef,beef mince,mince,minced beef', 217, 26, 0, 12, 'patty:113,cup:140'],
  ['steak', 'Steak (sirloin, cooked)', 'steak,beef steak,sirloin', 206, 30, 0, 9, 'steak:220'],
  ['salmon', 'Salmon (cooked)', 'salmon,salmon fillet', 206, 22, 0, 12.4, 'fillet:150'],
  ['tuna', 'Tuna (canned in water)', 'tuna,canned tuna,tuna can', 116, 25.5, 0, 0.8, 'can:120'],
  ['shrimp', 'Shrimp (cooked)', 'shrimp,prawns,prawn', 99, 24, 0.2, 0.3, 'cup:145'],
  ['turkey', 'Turkey breast (cooked)', 'turkey,turkey breast', 147, 30, 0, 2, 'slice:28'],
  ['tofu', 'Tofu (firm)', 'tofu', 144, 17.3, 2.8, 8.7, 'cup:250,block:400'],
  ['paneer', 'Paneer', 'paneer,cottage cheese indian', 296, 20, 3.6, 22, 'cup:150,piece:25'],
  ['lentils', 'Lentils (cooked)', 'lentils,lentil', 116, 9, 20, 0.4, 'cup:198'],
  ['dal', 'Dal (cooked)', 'dal,daal,dhal', 105, 6, 15, 2.5, 'bowl:200,cup:200'],
  ['chickpeas', 'Chickpeas (cooked)', 'chickpeas,chana,garbanzo', 164, 8.9, 27.4, 2.6, 'cup:164'],
  ['black_beans', 'Black beans (cooked)', 'black beans,beans,kidney beans,rajma', 132, 8.9, 23.7, 0.5, 'cup:172'],
  ['greek_yogurt', 'Greek yogurt (plain, nonfat)', 'greek yogurt,greek yoghurt', 59, 10.3, 3.6, 0.4, 'cup:245,container:170'],
  ['yogurt', 'Yogurt (plain, whole)', 'yogurt,yoghurt,curd,dahi', 61, 3.5, 4.7, 3.3, 'cup:245,bowl:150'],
  ['cottage_cheese', 'Cottage cheese (low fat)', 'cottage cheese', 72, 12.4, 2.7, 1, 'cup:226'],
  ['whey', 'Whey protein powder', 'whey,protein powder,whey protein', 400, 80, 8, 6, 'scoop:30'],
  ['protein_shake', 'Protein shake (whey + water)', 'protein shake,shake,protein drink', 40, 8, 1, 0.5, 'shake:300,bottle:330'],
  ['protein_bar', 'Protein bar', 'protein bar', 360, 33, 38, 12, 'bar:60'],
  // Dairy
  ['milk', 'Milk (2%)', 'milk', 50, 3.3, 4.8, 2, 'cup:244,glass:250,ml:1'],
  ['skim_milk', 'Milk (skim)', 'skim milk,skimmed milk', 34, 3.4, 5, 0.1, 'cup:245,glass:250,ml:1'],
  ['cheese', 'Cheddar cheese', 'cheese,cheddar', 403, 25, 1.3, 33, 'slice:28,oz:28'],
  ['butter', 'Butter', 'butter', 717, 0.9, 0.1, 81, 'tbsp:14,tsp:5'],
  // Grains & starches
  ['white_rice', 'White rice (cooked)', 'rice,white rice,steamed rice', 130, 2.7, 28, 0.3, 'cup:158,bowl:200'],
  ['brown_rice', 'Brown rice (cooked)', 'brown rice', 123, 2.7, 25.6, 1, 'cup:195'],
  ['biryani', 'Chicken biryani', 'biryani', 180, 8, 22, 6.5, 'plate:350,cup:200'],
  ['roti', 'Roti / chapati', 'roti,rotis,chapati,chapatis,chapathi,phulka', 297, 9.8, 46, 7.5, 'roti:40'],
  ['naan', 'Naan', 'naan', 290, 9, 50, 5.5, 'naan:90'],
  ['paratha', 'Paratha', 'paratha,parathas', 326, 6.4, 45, 13, 'paratha:80'],
  ['bread', 'Bread (whole wheat)', 'bread,toast,wheat bread,whole wheat bread', 247, 13, 41, 3.4, 'slice:32'],
  ['white_bread', 'Bread (white)', 'white bread', 266, 8.9, 49, 3.3, 'slice:28'],
  ['bagel', 'Bagel', 'bagel', 257, 10, 50, 1.7, 'bagel:105'],
  ['oats', 'Oats (dry)', 'oats,oatmeal,porridge,rolled oats', 379, 13, 68, 6.5, 'cup:81,half cup:40,serving:40'],
  ['pasta', 'Pasta (cooked)', 'pasta,spaghetti,penne,noodles', 158, 5.8, 31, 0.9, 'cup:140,plate:250'],
  ['potato', 'Potato (boiled)', 'potato,potatoes,boiled potato', 87, 1.9, 20, 0.1, 'potato:170,cup:156'],
  ['sweet_potato', 'Sweet potato (baked)', 'sweet potato,sweet potatoes', 90, 2, 20.7, 0.2, 'potato:150'],
  ['fries', 'French fries', 'fries,french fries,chips', 312, 3.4, 41, 15, 'serving:117,small:71,large:154'],
  ['tortilla', 'Flour tortilla', 'tortilla,wrap', 304, 8.2, 50, 7.8, 'tortilla:45'],
  ['quinoa', 'Quinoa (cooked)', 'quinoa', 120, 4.4, 21.3, 1.9, 'cup:185'],
  ['cereal', 'Breakfast cereal', 'cereal,cornflakes', 379, 7, 84, 1, 'cup:30'],
  ['dosa', 'Dosa (plain)', 'dosa', 168, 3.9, 29, 3.7, 'dosa:100'],
  ['idli', 'Idli', 'idli,idlis', 132, 4.5, 26, 0.6, 'idli:40'],
  // Fruit & veg
  ['banana', 'Banana', 'banana,bananas', 89, 1.1, 22.8, 0.3, 'banana:118'],
  ['apple', 'Apple', 'apple,apples', 52, 0.3, 13.8, 0.2, 'apple:182'],
  ['orange', 'Orange', 'orange,oranges', 47, 0.9, 11.8, 0.1, 'orange:131'],
  ['berries', 'Berries (mixed)', 'berries,blueberries,strawberries', 50, 0.8, 12, 0.3, 'cup:148'],
  ['mango', 'Mango', 'mango', 60, 0.8, 15, 0.4, 'mango:200,cup:165'],
  ['grapes', 'Grapes', 'grapes', 69, 0.7, 18, 0.2, 'cup:151'],
  ['broccoli', 'Broccoli', 'broccoli', 35, 2.4, 7.2, 0.4, 'cup:156'],
  ['salad', 'Green salad (no dressing)', 'salad,green salad,lettuce', 17, 1.2, 3.3, 0.2, 'bowl:150,cup:50'],
  ['mixed_veg', 'Mixed vegetables (cooked)', 'vegetables,veggies,mixed vegetables,sabzi,sabji', 65, 2.9, 13, 0.4, 'cup:180,bowl:200'],
  ['spinach', 'Spinach (cooked)', 'spinach,palak', 23, 3, 3.8, 0.3, 'cup:180'],
  ['avocado', 'Avocado', 'avocado', 160, 2, 8.5, 14.7, 'avocado:150,half:75'],
  // Fats, nuts, extras
  ['peanut_butter', 'Peanut butter', 'peanut butter,pb', 588, 25, 20, 50, 'tbsp:16'],
  ['almonds', 'Almonds', 'almonds,nuts', 579, 21, 22, 50, 'handful:28,oz:28'],
  ['olive_oil', 'Olive oil', 'olive oil,oil,cooking oil', 884, 0, 0, 100, 'tbsp:14,tsp:4.5'],
  ['honey', 'Honey', 'honey', 304, 0.3, 82, 0, 'tbsp:21,tsp:7'],
  ['sugar', 'Sugar', 'sugar', 387, 0, 100, 0, 'tsp:4,tbsp:12'],
  ['hummus', 'Hummus', 'hummus', 166, 7.9, 14.3, 9.6, 'tbsp:15,cup:246'],
  // Meals & drinks
  ['pizza', 'Pizza (cheese)', 'pizza', 266, 11, 33, 10, 'slice:107'],
  ['burger', 'Burger (single patty)', 'burger,hamburger,cheeseburger', 254, 13, 28, 10, 'burger:200'],
  ['sandwich', 'Chicken sandwich', 'sandwich,chicken sandwich', 225, 14, 24, 8, 'sandwich:200'],
  ['burrito', 'Chicken burrito', 'burrito', 190, 10, 22, 7, 'burrito:300'],
  ['sushi', 'Sushi roll', 'sushi', 150, 6, 28, 2, 'roll:200,piece:30'],
  ['fried_rice', 'Fried rice', 'fried rice', 174, 5, 28, 5, 'cup:200,plate:300'],
  ['soup', 'Vegetable soup', 'soup', 40, 1.5, 7, 0.8, 'bowl:250,cup:240'],
  ['coffee_latte', 'Latte (whole milk)', 'latte,cappuccino,coffee with milk', 56, 3, 4.6, 2.9, 'cup:350,small:240'],
  ['coffee', 'Black coffee', 'coffee,black coffee,espresso,americano', 1, 0.1, 0, 0, 'cup:240'],
  ['orange_juice', 'Orange juice', 'orange juice,juice', 45, 0.7, 10.4, 0.2, 'glass:250,cup:248'],
  ['soda', 'Soda (regular)', 'soda,coke,cola,soft drink', 41, 0, 10.6, 0, 'can:355'],
  ['beer', 'Beer', 'beer', 43, 0.5, 3.6, 0, 'can:355,pint:473'],
  ['chocolate', 'Dark chocolate', 'chocolate', 546, 4.9, 61, 31, 'square:10,bar:100'],
  ['cookie', 'Cookie', 'cookie,cookies,biscuit,biscuits', 488, 5, 64, 24, 'cookie:15'],
];

export const FOODS: Food[] = ROWS.map(([id, name, aliases, kcal, protein, carbs, fat, units]) => ({
  id, name,
  aliases: aliases.split(',').map((s) => s.trim()),
  per100g: { kcal, protein, carbs, fat },
  units: [...units.split(',').map((u) => { const [n, g] = u.split(':'); return { name: n, grams: Number(g) }; }), { name: 'g', grams: 1 }],
}));

export function allFoods(custom: CustomFood[] = []): Food[] {
  return [...custom.map((c) => ({ ...c, aliases: [c.name.toLowerCase()], custom: true, units: [...c.units, { name: 'g', grams: 1 }] })), ...FOODS];
}

export function searchFoods(q: string, custom: CustomFood[] = []): Food[] {
  const t = q.trim().toLowerCase();
  const list = allFoods(custom);
  if (!t) return list.slice(0, 20);
  return list
    .map((f) => {
      const n = f.name.toLowerCase();
      const score = n.startsWith(t) ? 3 : f.aliases.some((a) => a.startsWith(t)) ? 2 : n.includes(t) || f.aliases.some((a) => a.includes(t)) ? 1 : 0;
      return { f, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.f)
    .slice(0, 25);
}

export const r1 = (n: number) => Math.round(n * 10) / 10;

export function macrosFor(food: Pick<Food, 'per100g'>, grams: number): Macros {
  const k = grams / 100;
  return { kcal: Math.round(food.per100g.kcal * k), protein: r1(food.per100g.protein * k), carbs: r1(food.per100g.carbs * k), fat: r1(food.per100g.fat * k) };
}

export function makeItem(food: Food, qty: number, unitName?: string, uncertain = false): MealItem {
  const unit = food.units.find((u) => u.name === unitName) ?? food.units[0];
  const grams = Math.round(qty * unit.grams);
  return { name: food.name, foodId: food.id, qty, unit: unit.name, grams, uncertain, ...macrosFor(food, grams) };
}

/** Recompute an item's macros after the user edits quantity or unit. */
export function rescaleItem(item: MealItem, qty: number, unitName: string, custom: CustomFood[] = []): MealItem {
  const food = item.foodId ? allFoods(custom).find((f) => f.id === item.foodId) : undefined;
  if (food) return { ...makeItem(food, qty, unitName), uncertain: false };
  // No database match (e.g. AI estimate): scale linearly by quantity.
  const k = item.qty ? qty / item.qty : 1;
  return { ...item, qty, unit: unitName, grams: Math.round(item.grams * k), kcal: Math.round(item.kcal * k), protein: r1(item.protein * k), carbs: r1(item.carbs * k), fat: r1(item.fat * k), uncertain: false };
}

export function totals(items: Macros[]): Macros {
  return items.reduce(
    (a, i) => ({ kcal: a.kcal + i.kcal, protein: r1(a.protein + i.protein), carbs: r1(a.carbs + i.carbs), fat: r1(a.fat + i.fat) }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

/** Practical high-protein ideas, filtered by what fits the remaining budget. */
export const MEAL_IDEAS: { name: string; kcal: number; protein: number; tags: string[]; slot: string[] }[] = [
  { name: 'Grilled chicken breast (170 g) with 1 cup rice and vegetables', kcal: 560, protein: 57, tags: [], slot: ['lunch', 'dinner'] },
  { name: 'Greek yogurt (1 cup) with berries and a drizzle of honey', kcal: 230, protein: 26, tags: ['vegetarian'], slot: ['breakfast', 'snack'] },
  { name: 'Salmon fillet with sweet potato and broccoli', kcal: 540, protein: 39, tags: ['pescatarian'], slot: ['dinner'] },
  { name: 'Tuna wrap: 1 can tuna, tortilla, salad', kcal: 330, protein: 33, tags: ['pescatarian'], slot: ['lunch'] },
  { name: '3-egg omelette with spinach and 2 slices whole-wheat toast', kcal: 420, protein: 30, tags: ['vegetarian'], slot: ['breakfast'] },
  { name: 'Protein shake (1 scoop whey) with a banana', kcal: 225, protein: 26, tags: ['vegetarian'], slot: ['snack'] },
  { name: 'Paneer tikka (150 g) with 2 rotis and salad', kcal: 690, protein: 38, tags: ['vegetarian'], slot: ['lunch', 'dinner'] },
  { name: 'Dal (1 bowl) with tofu stir-fry and rice', kcal: 600, protein: 33, tags: ['vegetarian', 'vegan'], slot: ['lunch', 'dinner'] },
  { name: 'Cottage cheese (1 cup) with fruit', kcal: 230, protein: 28, tags: ['vegetarian'], slot: ['snack', 'breakfast'] },
  { name: 'Lean beef mince (140 g) with pasta and tomato sauce', kcal: 650, protein: 45, tags: [], slot: ['dinner'] },
  { name: 'Chicken curry (1 bowl) with 2 rotis', kcal: 610, protein: 40, tags: [], slot: ['lunch', 'dinner'] },
  { name: 'Chickpea and quinoa bowl with hummus', kcal: 520, protein: 22, tags: ['vegetarian', 'vegan'], slot: ['lunch'] },
  { name: 'Turkey slices (100 g) on whole-wheat bread', kcal: 300, protein: 36, tags: [], slot: ['lunch', 'snack'] },
  { name: 'Shrimp stir-fry with vegetables and rice', kcal: 450, protein: 40, tags: ['pescatarian'], slot: ['dinner'] },
  { name: 'Egg whites (1 cup) scrambled with veggies', kcal: 160, protein: 27, tags: ['vegetarian'], slot: ['breakfast', 'snack'] },
];

export function suggestMeals(remainingKcal: number, remainingProtein: number, diet: string[], slot?: string) {
  const d = diet.map((x) => x.toLowerCase());
  const allowed = (tags: string[]) => {
    if (d.includes('vegan')) return tags.includes('vegan');
    if (d.includes('vegetarian')) return tags.includes('vegetarian') || tags.includes('vegan');
    if (d.includes('pescatarian')) return tags.length > 0;
    return true;
  };
  return MEAL_IDEAS
    .filter((m) => allowed(m.tags) && (!slot || m.slot.includes(slot)))
    .map((m) => ({ ...m, fit: m.kcal <= Math.max(remainingKcal, 150) + 100 ? m.protein / m.kcal : -1 }))
    .filter((m) => m.fit > 0 || remainingKcal <= 0)
    .sort((a, b) => (remainingProtein > 20 ? b.fit - a.fit : a.kcal - b.kcal))
    .slice(0, 3);
}
