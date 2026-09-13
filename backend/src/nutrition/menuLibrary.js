// Two alternative full-day Spanish/Mediterranean home-cooking menus per day type, so the
// nutrition targets (calories/macros) turn into an actual "what do I eat" answer instead
// of just numbers. Each menu's meals sum to roughly its `kcal` reference total for a
// representative athlete; nutrition/engine.js scales that against the athlete's real
// target and returns a plain-language portion-adjustment hint (see tMenuScaleHint) rather
// than pretending gram-level precision — these are coaching suggestions, not a food log.
//
// Day types match training/nutrition classifyDayType(): rest, easy, moderate, hard, long.
// Meal slots follow the Spanish eating pattern: desayuno (breakfast), comida (the big
// midday meal — mapped to "lunch"), merienda ("snack"), cena (a lighter dinner).
function meal(nameEs, nameEn, kcal, protein_g, carbs_g, fat_g) {
  return { name: { es: nameEs, en: nameEn }, kcal, protein_g, carbs_g, fat_g };
}

function menu(id, meals) {
  const kcal = Object.values(meals).reduce((s, m) => s + m.kcal, 0);
  const protein_g = Object.values(meals).reduce((s, m) => s + m.protein_g, 0);
  const carbs_g = Object.values(meals).reduce((s, m) => s + m.carbs_g, 0);
  const fat_g = Object.values(meals).reduce((s, m) => s + m.fat_g, 0);
  return { id, kcal, protein_g, carbs_g, fat_g, meals };
}

export const DAY_MENUS = {
  rest: [
    menu('A', {
      breakfast: meal(
        'Tortilla francesa de 2 huevos con tomate aliñado en aceite de oliva, más una pieza de fruta',
        'Two-egg plain omelette with olive-oil tomato salad, plus a piece of fruit',
        380, 24, 28, 20
      ),
      lunch: meal(
        'Merluza al horno con pisto de verduras y una patata pequeña asada',
        'Baked hake with Spanish-style stewed vegetables (pisto) and a small roasted potato',
        700, 50, 55, 28
      ),
      snack: meal(
        'Yogur griego natural con un puñado de nueces',
        'Plain Greek yogurt with a handful of walnuts',
        220, 14, 10, 15
      ),
      dinner: meal(
        'Crema de calabacín con pechuga de pollo a la plancha y ensalada verde',
        'Zucchini cream soup with grilled chicken breast and a green salad',
        600, 52, 35, 25
      ),
    }),
    menu('B', {
      breakfast: meal(
        'Yogur natural con copos de avena, canela y arándanos',
        'Plain yogurt with oats, cinnamon and blueberries',
        350, 18, 45, 10
      ),
      lunch: meal(
        'Garbanzos estofados con espinacas y bacalao desalado',
        'Stewed chickpeas with spinach and desalted cod',
        720, 48, 60, 30
      ),
      snack: meal(
        'Una loncha de pavo con un puñado de almendras',
        'A slice of turkey breast with a handful of almonds',
        200, 18, 4, 14
      ),
      dinner: meal(
        'Revuelto de champiñones y gambas con ensalada de tomate',
        'Scrambled eggs with mushrooms and prawns, with tomato salad',
        630, 50, 25, 35
      ),
    }),
  ],
  easy: [
    menu('A', {
      breakfast: meal(
        'Tostadas integrales con tomate, aceite de oliva y jamón serrano, más una pieza de fruta',
        'Whole-grain toast with tomato, olive oil and cured ham, plus a piece of fruit',
        480, 22, 60, 16
      ),
      lunch: meal(
        'Arroz con pollo y verduras al estilo paella sencilla',
        'Simple paella-style rice with chicken and vegetables',
        850, 50, 95, 25
      ),
      snack: meal(
        'Bocadillo pequeño de atún en pan integral',
        'Small tuna sandwich on whole-grain bread',
        320, 20, 35, 10
      ),
      dinner: meal(
        'Lentejas estofadas con verduras y un huevo duro',
        'Stewed lentils with vegetables and a hard-boiled egg',
        550, 35, 55, 18
      ),
    }),
    menu('B', {
      breakfast: meal(
        'Porridge de avena con plátano, miel y nueces',
        'Oat porridge with banana, honey and walnuts',
        500, 16, 75, 16
      ),
      lunch: meal(
        'Pasta integral con atún, tomate y aceitunas',
        'Whole-grain pasta with tuna, tomato and olives',
        820, 45, 100, 22
      ),
      snack: meal(
        'Pieza de fruta con un puñado de frutos secos',
        'A piece of fruit with a handful of mixed nuts',
        250, 6, 30, 13
      ),
      dinner: meal(
        'Pechuga de pollo a la plancha con puré de patata y verduras salteadas',
        'Grilled chicken breast with mashed potato and sautéed vegetables',
        630, 55, 55, 18
      ),
    }),
  ],
  moderate: [
    menu('A', {
      breakfast: meal(
        'Tostadas integrales con aguacate y huevo, más zumo de naranja natural',
        'Whole-grain toast with avocado and egg, plus fresh orange juice',
        520, 22, 60, 20
      ),
      lunch: meal(
        'Arroz integral con pollo, garbanzos y verduras al curry suave',
        'Brown rice with chicken, chickpeas and vegetables in a mild curry',
        950, 55, 110, 25
      ),
      snack: meal(
        'Batido de plátano con leche y avena',
        'Banana smoothie with milk and oats',
        350, 15, 55, 8
      ),
      dinner: meal(
        'Salmón al horno con patata asada y ensalada',
        'Baked salmon with roasted potato and salad',
        680, 50, 60, 28
      ),
    }),
    menu('B', {
      breakfast: meal(
        'Bol de yogur con granola casera, fruta y miel',
        'Yogurt bowl with homemade granola, fruit and honey',
        500, 18, 75, 14
      ),
      lunch: meal(
        'Pasta integral con carne picada de pavo y salsa de tomate casera',
        'Whole-grain pasta with ground turkey and homemade tomato sauce',
        950, 55, 115, 26
      ),
      snack: meal(
        'Bocadillo de pavo y queso fresco',
        'Turkey and fresh cheese sandwich',
        350, 22, 40, 10
      ),
      dinner: meal(
        'Merluza a la plancha con arroz blanco y verduras salteadas',
        'Grilled hake with white rice and sautéed vegetables',
        700, 52, 65, 22
      ),
    }),
  ],
  hard: [
    menu('A', {
      breakfast: meal(
        'Porridge de avena con plátano, miel, nueces y un huevo cocido aparte',
        'Oat porridge with banana, honey, walnuts and a boiled egg on the side',
        600, 24, 90, 16
      ),
      lunch: meal(
        'Paella de pollo y verduras con ración generosa de arroz',
        'Chicken and vegetable paella with a generous rice portion',
        1050, 55, 140, 25
      ),
      snack: meal(
        'Bocadillo de pan integral con pavo, queso y tomate',
        'Whole-grain sandwich with turkey, cheese and tomato',
        420, 25, 45, 14
      ),
      dinner: meal(
        'Pasta integral con salsa boloñesa de ternera magra',
        'Whole-grain pasta with lean beef bolognese',
        730, 48, 105, 18
      ),
    }),
    menu('B', {
      breakfast: meal(
        'Tostadas con plátano, crema de cacahuete y miel',
        'Toast with banana, peanut butter and honey',
        600, 18, 85, 20
      ),
      lunch: meal(
        'Potaje de arroz con lentejas, verduras y pechuga de pollo',
        'Rice and lentil stew with vegetables and chicken breast',
        1050, 58, 135, 26
      ),
      snack: meal(
        'Batido de frutas con avena y yogur',
        'Fruit smoothie with oats and yogurt',
        400, 16, 70, 8
      ),
      dinner: meal(
        'Ensalada templada de patata asada, atún, maíz y huevo duro',
        'Warm salad of roasted potato, tuna, corn and hard-boiled egg',
        750, 50, 95, 20
      ),
    }),
  ],
  long: [
    menu('A', {
      breakfast: meal(
        'Bol grande de avena con plátano, miel, pasas y nueces',
        'Large bowl of oats with banana, honey, raisins and walnuts',
        700, 22, 115, 18
      ),
      lunch: meal(
        'Paella de pollo y verduras con ración extra de arroz, más pan',
        'Chicken and vegetable paella with extra rice, plus bread',
        1200, 55, 170, 28
      ),
      snack: meal(
        'Bocadillo grande de jamón serrano y queso, más una pieza de fruta',
        'Large cured-ham and cheese sandwich, plus a piece of fruit',
        550, 30, 60, 20
      ),
      dinner: meal(
        'Pasta integral con salsa de tomate, atún y aceitunas, más pan',
        'Whole-grain pasta with tomato sauce, tuna and olives, plus bread',
        750, 43, 135, 14
      ),
    }),
    menu('B', {
      breakfast: meal(
        'Tostadas integrales con plátano y miel, más batido de leche con cacao',
        'Whole-grain toast with banana and honey, plus a chocolate milk shake',
        700, 26, 120, 14
      ),
      lunch: meal(
        'Arroz con pollo y garbanzos, ración generosa, más una pieza de fruta',
        'Rice with chicken and chickpeas, a generous portion, plus a piece of fruit',
        1200, 58, 175, 26
      ),
      snack: meal(
        'Barrita energética casera de avena, dátiles y frutos secos, más un plátano',
        'Homemade oat, date and nut energy bar, plus a banana',
        500, 12, 90, 12
      ),
      dinner: meal(
        'Patata asada grande con pechuga de pollo, verduras y aceite de oliva',
        'Large baked potato with chicken breast, vegetables and olive oil',
        800, 54, 95, 28
      ),
    }),
  ],
};
