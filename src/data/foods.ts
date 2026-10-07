/* ============================================================================
   Seed food database. Per-serving macros for foods someone training in India
   actually eats, plus the common staples.

   Numbers are rounded reference values suitable for daily tracking, not lab
   figures — the brief's priority is fast logging, and ±5% on a chapati does not
   change a decision. Users can edit any value by creating a custom food.

   `serving` is written the way a person would say it ("1 roti (45 g)"), because
   that is what makes one-tap logging possible.
   ========================================================================= */

import type { Food } from '../lib/types'

const f = (
  id: string,
  name: string,
  serving: string,
  calories: number,
  protein: number,
  carbs: number,
  fat: number,
  tags: string[] = [],
  servingGrams?: number,
): Food => ({ id, name, serving, calories, protein, carbs, fat, tags, servingGrams })

export const SEED_FOODS: Food[] = [
  /* ------------------------------ eggs & dairy ---------------------------- */
  f('egg-whole', 'Egg, whole boiled', '1 large egg (50 g)', 78, 6.3, 0.6, 5.3, ['egg', 'protein'], 50),
  f('egg-white', 'Egg white', '1 white (33 g)', 17, 3.6, 0.2, 0.1, ['egg', 'protein'], 33),
  f('egg-omelette', 'Omelette, 2 eggs', '1 omelette', 190, 13, 1.5, 15, ['egg']),
  f('milk-toned', 'Milk, toned', '1 glass (200 ml)', 116, 6.4, 9.8, 5.8, ['dairy'], 200),
  f('milk-full', 'Milk, full cream', '1 glass (200 ml)', 148, 6.8, 9.6, 8.6, ['dairy'], 200),
  f('milk-skim', 'Milk, skimmed', '1 glass (200 ml)', 70, 6.8, 10, 0.4, ['dairy'], 200),
  f('curd', 'Curd / plain yoghurt', '1 cup (150 g)', 90, 5.1, 6.8, 4.8, ['dairy'], 150),
  f('greek-yoghurt', 'Greek yoghurt, plain', '1 cup (170 g)', 100, 17, 6, 0.7, ['dairy', 'protein'], 170),
  f('paneer', 'Paneer', '100 g', 296, 18.3, 3.6, 23, ['dairy', 'protein', 'veg'], 100),
  f('paneer-low', 'Paneer, low fat', '100 g', 206, 24, 4, 11, ['dairy', 'protein'], 100),
  f('cheese-slice', 'Cheese slice', '1 slice (20 g)', 65, 4, 1, 5, ['dairy'], 20),
  f('butter', 'Butter', '1 tsp (5 g)', 36, 0, 0, 4, ['fat'], 5),
  f('ghee', 'Ghee', '1 tsp (5 g)', 45, 0, 0, 5, ['fat'], 5),
  f('buttermilk', 'Buttermilk / neer mor', '1 glass (200 ml)', 40, 2.6, 4.5, 1, ['dairy'], 200),

  /* --------------------------------- grains ------------------------------- */
  f('rice-white', 'Rice, white cooked', '1 cup (150 g)', 195, 4, 43, 0.4, ['grain', 'staple'], 150),
  f('rice-brown', 'Rice, brown cooked', '1 cup (150 g)', 180, 4.2, 37, 1.4, ['grain'], 150),
  f('idli', 'Idli', '1 idli (40 g)', 58, 1.6, 12, 0.2, ['south-indian', 'staple'], 40),
  f('dosa-plain', 'Dosa, plain', '1 dosa (80 g)', 133, 2.7, 22, 3.7, ['south-indian'], 80),
  f('masala-dosa', 'Masala dosa', '1 dosa', 250, 5, 38, 8, ['south-indian']),
  f('roti', 'Roti / chapati', '1 roti (45 g)', 120, 3.1, 22, 2.2, ['grain', 'staple'], 45),
  f('phulka', 'Phulka, no oil', '1 phulka (35 g)', 85, 2.6, 17, 0.4, ['grain', 'staple'], 35),
  f('paratha-plain', 'Paratha, plain', '1 paratha (70 g)', 215, 4.5, 29, 9, ['grain'], 70),
  f('naan', 'Naan', '1 naan (90 g)', 262, 7.5, 45, 5.5, ['grain'], 90),
  f('bread-brown', 'Bread, brown', '1 slice (30 g)', 75, 2.8, 13, 1, ['grain'], 30),
  f('bread-white', 'Bread, white', '1 slice (30 g)', 80, 2.4, 15, 1, ['grain'], 30),
  f('oats-dry', 'Oats, dry rolled', '40 g', 152, 5.3, 27, 2.7, ['grain', 'breakfast'], 40),
  f('oats-cooked', 'Oats cooked in water', '1 bowl (from 40 g)', 155, 5.4, 27, 2.8, ['breakfast']),
  f('upma', 'Upma', '1 cup (180 g)', 230, 5, 36, 7.5, ['south-indian', 'breakfast'], 180),
  f('poha', 'Poha', '1 cup (170 g)', 215, 4.4, 38, 5.5, ['breakfast'], 170),
  f('pongal', 'Ven pongal', '1 cup (200 g)', 290, 8, 42, 10, ['south-indian'], 200),
  f('idiyappam', 'Idiyappam', '2 pieces (100 g)', 170, 3, 38, 0.5, ['south-indian'], 100),
  f('appam', 'Appam', '1 appam (70 g)', 120, 2.2, 24, 1.8, ['south-indian'], 70),
  f('biryani-veg', 'Veg biryani', '1 plate (250 g)', 410, 9, 62, 13, ['rice'], 250),
  f('biryani-chicken', 'Chicken biryani', '1 plate (300 g)', 560, 26, 64, 22, ['rice', 'protein'], 300),
  f('quinoa', 'Quinoa, cooked', '1 cup (185 g)', 222, 8.1, 39, 3.6, ['grain'], 185),
  f('ragi-mudde', 'Ragi mudde / kali', '1 ball (150 g)', 195, 4.5, 42, 0.8, ['grain'], 150),
  f('millet-cooked', 'Millet, cooked', '1 cup (170 g)', 207, 6, 41, 1.7, ['grain'], 170),

  /* ------------------------------- dal & legumes -------------------------- */
  f('dal-toor', 'Toor dal, cooked', '1 cup (200 g)', 200, 11, 32, 2.5, ['dal', 'protein', 'veg'], 200),
  f('dal-moong', 'Moong dal, cooked', '1 cup (200 g)', 185, 12, 30, 1.2, ['dal', 'protein'], 200),
  f('dal-masoor', 'Masoor dal, cooked', '1 cup (200 g)', 190, 13, 31, 1.5, ['dal', 'protein'], 200),
  f('rajma', 'Rajma, cooked', '1 cup (180 g)', 215, 13, 37, 1.2, ['legume', 'protein'], 180),
  f('chana-kala', 'Kala chana, boiled', '1 cup (160 g)', 250, 13, 42, 4, ['legume', 'protein'], 160),
  f('chole', 'Chole / chickpea curry', '1 cup (200 g)', 280, 12, 38, 9, ['legume', 'protein'], 200),
  f('sambar', 'Sambar', '1 cup (200 g)', 140, 6.5, 19, 4.5, ['south-indian', 'dal'], 200),
  f('rasam', 'Rasam', '1 cup (200 g)', 60, 2.5, 9, 1.5, ['south-indian'], 200),
  f('soya-chunks', 'Soya chunks, dry', '30 g', 102, 15.6, 10, 0.2, ['soya', 'protein', 'veg'], 30),
  f('soya-cooked', 'Soya chunk curry', '1 cup (200 g)', 230, 22, 18, 8, ['soya', 'protein'], 200),
  f('tofu', 'Tofu, firm', '100 g', 144, 15.8, 2.8, 8.7, ['soya', 'protein'], 100),
  f('sprouts', 'Mixed sprouts', '1 cup (100 g)', 100, 8, 16, 0.6, ['protein', 'veg'], 100),
  f('peanut', 'Peanuts, roasted', '30 g', 170, 7.3, 4.8, 14.5, ['nuts', 'fat'], 30),
  f('peanut-butter', 'Peanut butter', '1 tbsp (16 g)', 95, 3.6, 3.2, 8, ['fat'], 16),

  /* ------------------------------- meat & fish ---------------------------- */
  f('chicken-breast', 'Chicken breast, cooked', '100 g', 165, 31, 0, 3.6, ['meat', 'protein'], 100),
  f('chicken-thigh', 'Chicken thigh, cooked', '100 g', 209, 26, 0, 10.9, ['meat', 'protein'], 100),
  f('chicken-curry', 'Chicken curry', '1 cup (200 g)', 320, 25, 8, 21, ['meat', 'protein'], 200),
  f('chicken-tandoori', 'Tandoori chicken', '2 pieces (150 g)', 255, 33, 3, 12, ['meat', 'protein'], 150),
  f('egg-curry', 'Egg curry, 2 eggs', '1 cup', 300, 14, 9, 23, ['egg']),
  f('fish-rohu', 'Fish, rohu cooked', '100 g', 135, 22, 0, 5, ['fish', 'protein'], 100),
  f('fish-tilapia', 'Fish, tilapia cooked', '100 g', 128, 26, 0, 2.7, ['fish', 'protein'], 100),
  f('fish-salmon', 'Salmon, cooked', '100 g', 208, 22.1, 0, 13, ['fish', 'protein', 'fat'], 100),
  f('fish-fry', 'Fish fry, shallow', '1 piece (100 g)', 210, 21, 6, 11, ['fish', 'protein'], 100),
  f('prawn', 'Prawns, cooked', '100 g', 99, 24, 0.2, 0.3, ['seafood', 'protein'], 100),
  f('mutton-curry', 'Mutton curry', '1 cup (200 g)', 400, 26, 6, 30, ['meat', 'protein'], 200),

  /* --------------------------------- veg ---------------------------------- */
  f('veg-mixed', 'Mixed vegetable curry', '1 cup (200 g)', 150, 4, 18, 7, ['veg'], 200),
  f('bhindi', 'Bhindi / okra sabzi', '1 cup (150 g)', 125, 2.5, 11, 8, ['veg'], 150),
  f('palak-paneer', 'Palak paneer', '1 cup (200 g)', 290, 14, 10, 22, ['veg', 'protein'], 200),
  f('aloo-sabzi', 'Aloo sabzi', '1 cup (180 g)', 200, 3.5, 30, 7.5, ['veg'], 180),
  f('cabbage-poriyal', 'Cabbage poriyal', '1 cup (120 g)', 85, 2.5, 9, 4.5, ['veg', 'south-indian'], 120),
  f('beans-poriyal', 'Beans poriyal', '1 cup (120 g)', 95, 3, 10, 5, ['veg', 'south-indian'], 120),
  f('salad-green', 'Green salad, undressed', '1 bowl (150 g)', 35, 2, 6, 0.3, ['veg'], 150),
  f('cucumber', 'Cucumber', '1 medium (200 g)', 30, 1.3, 7, 0.2, ['veg'], 200),
  f('tomato', 'Tomato', '1 medium (120 g)', 22, 1.1, 4.8, 0.2, ['veg'], 120),
  f('carrot', 'Carrot', '1 medium (60 g)', 25, 0.6, 6, 0.1, ['veg'], 60),
  f('broccoli', 'Broccoli, cooked', '1 cup (155 g)', 55, 3.7, 11, 0.6, ['veg'], 155),
  f('spinach', 'Spinach, cooked', '1 cup (180 g)', 41, 5.3, 6.8, 0.5, ['veg'], 180),
  f('sweet-potato', 'Sweet potato, boiled', '1 medium (150 g)', 135, 2.5, 31, 0.2, ['veg'], 150),
  f('potato-boiled', 'Potato, boiled', '1 medium (150 g)', 130, 3, 30, 0.2, ['veg'], 150),

  /* -------------------------------- fruits -------------------------------- */
  f('banana', 'Banana', '1 medium (120 g)', 105, 1.3, 27, 0.4, ['fruit'], 120),
  f('apple', 'Apple', '1 medium (180 g)', 95, 0.5, 25, 0.3, ['fruit'], 180),
  f('orange', 'Orange', '1 medium (130 g)', 62, 1.2, 15, 0.2, ['fruit'], 130),
  f('mango', 'Mango', '1 cup cubes (165 g)', 99, 1.4, 25, 0.6, ['fruit'], 165),
  f('papaya', 'Papaya', '1 cup cubes (145 g)', 62, 0.7, 16, 0.4, ['fruit'], 145),
  f('watermelon', 'Watermelon', '1 cup (152 g)', 46, 0.9, 11.5, 0.2, ['fruit'], 152),
  f('guava', 'Guava', '1 medium (100 g)', 68, 2.6, 14, 1, ['fruit'], 100),
  f('pomegranate', 'Pomegranate', '1 cup (174 g)', 144, 2.9, 33, 2, ['fruit'], 174),
  f('grapes', 'Grapes', '1 cup (150 g)', 104, 1.1, 27, 0.2, ['fruit'], 150),
  f('dates', 'Dates', '2 dates (24 g)', 66, 0.4, 18, 0.1, ['fruit'], 24),

  /* ------------------------------ supplements ----------------------------- */
  f('whey-scoop', 'Whey protein', '1 scoop (30 g)', 120, 24, 3, 1.5, ['supplement', 'protein'], 30),
  f('whey-isolate', 'Whey isolate', '1 scoop (30 g)', 110, 27, 1, 0.5, ['supplement', 'protein'], 30),
  f('mass-gainer', 'Mass gainer', '1 scoop (100 g)', 390, 20, 70, 3, ['supplement'], 100),
  f('creatine', 'Creatine monohydrate', '5 g', 0, 0, 0, 0, ['supplement'], 5),
  f('bcaa', 'BCAA', '1 scoop (7 g)', 25, 0, 0, 0, ['supplement'], 7),

  /* ------------------------------ nuts & fats ----------------------------- */
  f('almonds', 'Almonds', '10 almonds (12 g)', 70, 2.6, 2.4, 6, ['nuts', 'fat'], 12),
  f('walnuts', 'Walnuts', '4 halves (14 g)', 92, 2.1, 1.9, 9.2, ['nuts', 'fat'], 14),
  f('cashews', 'Cashews', '10 cashews (16 g)', 92, 3, 5, 7.3, ['nuts', 'fat'], 16),
  f('oil-sunflower', 'Cooking oil', '1 tsp (5 ml)', 45, 0, 0, 5, ['fat'], 5),
  f('coconut-oil', 'Coconut oil', '1 tsp (5 ml)', 45, 0, 0, 5, ['fat'], 5),
  f('coconut-grated', 'Coconut, grated', '2 tbsp (20 g)', 71, 0.7, 3, 6.7, ['fat'], 20),
  f('chia', 'Chia seeds', '1 tbsp (12 g)', 58, 2, 5, 3.7, ['seeds', 'fat'], 12),
  f('flax', 'Flax seeds, ground', '1 tbsp (10 g)', 55, 1.9, 3, 4.3, ['seeds', 'fat'], 10),

  /* -------------------------- snacks & restaurant ------------------------- */
  f('samosa', 'Samosa', '1 piece (60 g)', 190, 3.5, 22, 10, ['snack', 'fried'], 60),
  f('vada', 'Medu vada', '1 vada (45 g)', 145, 4, 15, 8, ['south-indian', 'fried'], 45),
  f('bajji', 'Bajji / pakora', '2 pieces (60 g)', 185, 4, 18, 11, ['snack', 'fried'], 60),
  f('murukku', 'Murukku', '2 pieces (30 g)', 150, 2.5, 16, 8.5, ['snack', 'fried'], 30),
  f('biscuit-marie', 'Marie biscuit', '4 biscuits (24 g)', 105, 1.8, 19, 2.5, ['snack'], 24),
  f('chips', 'Potato chips', '1 small pack (30 g)', 160, 1.8, 15, 10, ['snack', 'fried'], 30),
  f('chai-sugar', 'Tea with milk & sugar', '1 cup (150 ml)', 90, 2.2, 12, 3, ['drink'], 150),
  f('chai-nosugar', 'Tea with milk, no sugar', '1 cup (150 ml)', 45, 2.2, 3.5, 2.5, ['drink'], 150),
  f('coffee-black', 'Black coffee', '1 cup (200 ml)', 5, 0.3, 0.5, 0, ['drink'], 200),
  f('filter-coffee', 'Filter coffee with milk', '1 cup (150 ml)', 95, 2.5, 13, 3.2, ['drink'], 150),
  f('protein-bar', 'Protein bar', '1 bar (60 g)', 220, 20, 22, 7, ['snack', 'protein'], 60),
  f('idli-sambar', 'Idli with sambar, 3 idli', '1 plate', 300, 10, 55, 5, ['south-indian']),
  f('curd-rice', 'Curd rice', '1 cup (220 g)', 240, 6.5, 38, 6.5, ['south-indian'], 220),
  f('lemon-rice', 'Lemon rice', '1 cup (200 g)', 290, 5, 46, 10, ['south-indian'], 200),
  f('sugar', 'Sugar', '1 tsp (5 g)', 20, 0, 5, 0, ['sweetener'], 5),
  f('honey', 'Honey', '1 tsp (7 g)', 21, 0, 5.8, 0, ['sweetener'], 7),
]

/**
 * Case- and order-insensitive search across name and tags. Scored so an exact
 * prefix beats a mid-word hit — typing "pan" should surface paneer, not "spinach".
 */
export function searchFoods(all: Food[], query: string, limit = 40): Food[] {
  const q = query.trim().toLowerCase()
  if (!q) return all.slice(0, limit)
  const words = q.split(/\s+/)

  const scored: Array<{ food: Food; score: number }> = []
  for (const food of all) {
    const name = food.name.toLowerCase()
    const hay = `${name} ${(food.tags ?? []).join(' ')}`
    let score = 0
    let matchedAll = true

    for (const w of words) {
      if (name.startsWith(w)) score += 100
      else if (name.includes(` ${w}`)) score += 60
      else if (name.includes(w)) score += 30
      else if (hay.includes(w)) score += 10
      else matchedAll = false
    }
    if (!matchedAll) continue
    if (food.custom) score += 25 // the user's own foods outrank the seed list
    scored.push({ food, score })
  }

  return scored
    .sort((a, b) => b.score - a.score || a.food.name.localeCompare(b.food.name))
    .slice(0, limit)
    .map((s) => s.food)
}

/** Highest-protein-per-calorie foods, for the "protein is low" nudge. */
export function proteinDense(all: Food[], limit = 8): Food[] {
  return all
    .filter((x) => x.calories > 40 && x.protein / x.calories > 0.08)
    .sort((a, b) => b.protein / b.calories - a.protein / a.calories)
    .slice(0, limit)
}
