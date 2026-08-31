// ═══════════════════════════════════════════════════════════════
//  FOOD INTELLIGENCE METADATA LAYER
//  Adds smart fields to every food item post-load
// ═══════════════════════════════════════════════════════════════

// mealRole: 'main_protein' | 'side_protein' | 'main_carb' | 'side_carb' |
//           'main_fat' | 'side_fat' | 'veggie' | 'fruit_carb' | 'quick_carb'
// pairWith: preferred pairings
// incompatibleWith: forbidden combos in same meal
// digestionSpeed: 'very_fast'|'fast'|'medium'|'slow'|'very_slow'
// insulinImpact: 'very_high'|'high'|'medium'|'low'|'very_low'
// carbQuality: 'refined'|'moderate'|'complex'|'none'
// proteinQuality: 'complete'|'good'|'partial'|'none'
// fatQuality: 'healthy'|'neutral'|'saturated'|'none'

const FOOD_INTELLIGENCE = {
  // ── PROTEINS
  chicken_breast: {
    mealRole:'main_protein', pairWith:['white_rice','brown_rice','sweet_potato','broccoli','salad'],
    incompatibleWith:['beef_lean','tuna_canned','chicken_thigh'],
    digestionSpeed:'medium', insulinImpact:'very_low',
    proteinQuality:'complete', fatQuality:'lean',
    preWorkoutScore:6, postWorkoutScore:10, breakfastScore:5,
    lunchScore:10, dinnerScore:9, snackScore:2, adherenceScore:9,
    satietyLevel:8, cookingStyle:'grilled/baked'
  },
  chicken_thigh: {
    mealRole:'main_protein', pairWith:['white_rice','brown_rice','sweet_potato','veggies'],
    incompatibleWith:['chicken_breast','beef_lean'],
    digestionSpeed:'medium', insulinImpact:'very_low',
    proteinQuality:'complete', fatQuality:'moderate',
    preWorkoutScore:4, postWorkoutScore:8, breakfastScore:3,
    lunchScore:9, dinnerScore:8, snackScore:1, adherenceScore:8,
    satietyLevel:9, cookingStyle:'grilled/baked'
  },
  eggs_whole: {
    mealRole:'main_protein', pairWith:['baladi_bread','whole_bread','spinach','mushroom'],
    incompatibleWith:['protein_shake'],
    digestionSpeed:'fast', insulinImpact:'low',
    proteinQuality:'complete', fatQuality:'moderate',
    preWorkoutScore:5, postWorkoutScore:7, breakfastScore:10,
    lunchScore:7, dinnerScore:5, snackScore:3, adherenceScore:10,
    satietyLevel:8, cookingStyle:'boiled/scrambled/fried'
  },
  egg_whites: {
    mealRole:'side_protein', pairWith:['oats','brown_rice','veggies'],
    incompatibleWith:[],
    digestionSpeed:'very_fast', insulinImpact:'very_low',
    proteinQuality:'complete', fatQuality:'none',
    preWorkoutScore:8, postWorkoutScore:9, breakfastScore:8,
    lunchScore:5, dinnerScore:4, snackScore:3, adherenceScore:7,
    satietyLevel:5, cookingStyle:'scrambled/mixed'
  },
  tuna_canned: {
    mealRole:'main_protein', pairWith:['brown_rice','whole_bread',],
    incompatibleWith:['chicken_breast','beef_lean'],
    digestionSpeed:'fast', insulinImpact:'very_low',
    proteinQuality:'complete', fatQuality:'lean',
    preWorkoutScore:7, postWorkoutScore:9, breakfastScore:4,
    lunchScore:9, dinnerScore:7, snackScore:5, adherenceScore:9,
    satietyLevel:7, cookingStyle:'raw/mixed'
  },
  tuna_fresh: {
    mealRole:'main_protein', pairWith:['brown_rice','sweet_potato','salad'],
    incompatibleWith:['chicken_breast'],
    digestionSpeed:'fast', insulinImpact:'very_low',
    proteinQuality:'complete', fatQuality:'lean',
    preWorkoutScore:6, postWorkoutScore:9, breakfastScore:3,
    lunchScore:10, dinnerScore:8, snackScore:2, adherenceScore:7,
    satietyLevel:8, cookingStyle:'grilled'
  },
  salmon: {
    mealRole:'main_protein', pairWith:['sweet_potato','brown_rice','broccoli','salad'],
    incompatibleWith:['chicken_breast'],
    digestionSpeed:'medium', insulinImpact:'very_low',
    proteinQuality:'complete', fatQuality:'healthy_omega3',
    preWorkoutScore:4, postWorkoutScore:8, breakfastScore:3,
    lunchScore:10, dinnerScore:9, snackScore:1, adherenceScore:7,
    satietyLevel:9, cookingStyle:'grilled/baked'
  },
  beef_lean: {
    mealRole:'main_protein', pairWith:['sweet_potato','brown_rice','salad'],
    incompatibleWith:['chicken_breast','tuna_canned'],
    digestionSpeed:'slow', insulinImpact:'very_low',
    proteinQuality:'complete', fatQuality:'moderate',
    preWorkoutScore:2, postWorkoutScore:6, breakfastScore:2,
    lunchScore:9, dinnerScore:7, snackScore:1, adherenceScore:7,
    satietyLevel:10, cookingStyle:'grilled/baked'
  },
  turkey_breast: {
    mealRole:'main_protein', pairWith:['brown_rice','sweet_potato','salad','broccoli'],
    incompatibleWith:['chicken_breast','beef_lean'],
    digestionSpeed:'medium', insulinImpact:'very_low',
    proteinQuality:'complete', fatQuality:'lean',
    preWorkoutScore:6, postWorkoutScore:9, breakfastScore:5,
    lunchScore:10, dinnerScore:9, snackScore:2, adherenceScore:8,
    satietyLevel:8, cookingStyle:'grilled/baked'
  },
  cottage_cheese: {
    mealRole:'side_protein', pairWith:['baladi_bread','whole_bread','eggs_whole'],
    incompatibleWith:['protein_shake'],
    digestionSpeed:'fast', insulinImpact:'low',
    proteinQuality:'good', fatQuality:'moderate',
    preWorkoutScore:4, postWorkoutScore:5, breakfastScore:9,
    lunchScore:5, dinnerScore:7, snackScore:6, adherenceScore:10,
    satietyLevel:7, cookingStyle:'raw'
  },
  greek_yogurt: {
    mealRole:'side_protein', pairWith:['banana','strawberry','oats','berries_mix'],
    incompatibleWith:[],
    digestionSpeed:'fast', insulinImpact:'medium',
    proteinQuality:'good', fatQuality:'moderate',
    preWorkoutScore:5, postWorkoutScore:7, breakfastScore:9,
    lunchScore:3, dinnerScore:4, snackScore:8, adherenceScore:10,
    satietyLevel:7, cookingStyle:'raw'
  },
  protein_shake: {
    mealRole:'side_protein', pairWith:['banana','oats','milk_skim'],
    incompatibleWith:['eggs_whole','cottage_cheese'],
    digestionSpeed:'very_fast', insulinImpact:'low',
    proteinQuality:'complete', fatQuality:'lean',
    preWorkoutScore:7, postWorkoutScore:10, breakfastScore:5,
    lunchScore:3, dinnerScore:3, snackScore:6, adherenceScore:8,
    satietyLevel:5, cookingStyle:'mixed'
  },
  shrimp: {
    mealRole:'main_protein', pairWith:['brown_rice','salad','broccoli','bell_pepper'],
    incompatibleWith:['chicken_breast','tuna_canned'],
    digestionSpeed:'fast', insulinImpact:'very_low',
    proteinQuality:'complete', fatQuality:'lean',
    preWorkoutScore:6, postWorkoutScore:8, breakfastScore:3,
    lunchScore:9, dinnerScore:8, snackScore:2, adherenceScore:7,
    satietyLevel:6, cookingStyle:'grilled'
  },
  tilapia: {
    mealRole:'main_protein', pairWith:['brown_rice','sweet_potato','salad'],
    incompatibleWith:['chicken_breast'],
    digestionSpeed:'fast', insulinImpact:'very_low',
    proteinQuality:'complete', fatQuality:'lean',
    preWorkoutScore:6, postWorkoutScore:9, breakfastScore:3,
    lunchScore:9, dinnerScore:8, snackScore:2, adherenceScore:8,
    satietyLevel:7, cookingStyle:'grilled'
  },
  chicken_liver: {
    mealRole:'main_protein', pairWith:['brown_rice','baladi_bread','salad'],
    incompatibleWith:['beef_lean','chicken_breast'],
    digestionSpeed:'medium', insulinImpact:'very_low',
    proteinQuality:'complete', fatQuality:'moderate',
    preWorkoutScore:2, postWorkoutScore:5, breakfastScore:3,
    lunchScore:7, dinnerScore:5, snackScore:1, adherenceScore:6,
    satietyLevel:7, cookingStyle:'grilled'
  },
  beef_ground: {
    mealRole:'main_protein', pairWith:['sweet_potato','brown_rice','salad'],
    incompatibleWith:['chicken_breast','tuna_canned'],
    digestionSpeed:'slow', insulinImpact:'very_low',
    proteinQuality:'complete', fatQuality:'saturated',
    preWorkoutScore:2, postWorkoutScore:5, breakfastScore:3,
    lunchScore:7, dinnerScore:6, snackScore:1, adherenceScore:7,
    satietyLevel:9, cookingStyle:'grilled/baked'
  },
  // ── CARBS
  white_rice: {
    mealRole:'main_carb', pairWith:['chicken_breast','turkey_breast','tuna_canned','veggies'],
    incompatibleWith:[],
    digestionSpeed:'fast', insulinImpact:'high',
    carbQuality:'refined', proteinQuality:'none',
    preWorkoutScore:8, postWorkoutScore:9, breakfastScore:2,
    lunchScore:9, dinnerScore:4, snackScore:2, adherenceScore:10,
    satietyLevel:5, cookingStyle:'boiled'
  },
  brown_rice: {
    mealRole:'main_carb', pairWith:['chicken_breast','turkey_breast','salmon','veggies'],
    incompatibleWith:[],
    digestionSpeed:'medium', insulinImpact:'medium',
    carbQuality:'complex', proteinQuality:'none',
    preWorkoutScore:7, postWorkoutScore:8, breakfastScore:3,
    lunchScore:9, dinnerScore:5, snackScore:2, adherenceScore:8,
    satietyLevel:6, cookingStyle:'boiled'
  },
  oats: {
    mealRole:'main_carb', pairWith:['egg_whites','greek_yogurt','banana','strawberry'],
    incompatibleWith:[],
    digestionSpeed:'slow', insulinImpact:'low',
    carbQuality:'complex', proteinQuality:'partial',
    preWorkoutScore:6, postWorkoutScore:5, breakfastScore:10,
    lunchScore:3, dinnerScore:2, snackScore:4, adherenceScore:9,
    satietyLevel:9, cookingStyle:'cooked/overnight'
  },
  sweet_potato: {
    mealRole:'main_carb', pairWith:['chicken_breast','turkey_breast','salmon','salad'],
    incompatibleWith:[],
    digestionSpeed:'medium', insulinImpact:'medium',
    carbQuality:'complex', proteinQuality:'none',
    preWorkoutScore:8, postWorkoutScore:8, breakfastScore:4,
    lunchScore:9, dinnerScore:6, snackScore:3, adherenceScore:8,
    satietyLevel:7, cookingStyle:'baked/boiled'
  },
  potato: {
    mealRole:'main_carb', pairWith:['chicken_breast','turkey_breast','salad'],
    incompatibleWith:[],
    digestionSpeed:'medium', insulinImpact:'high',
    carbQuality:'moderate', proteinQuality:'none',
    preWorkoutScore:6, postWorkoutScore:7, breakfastScore:3,
    lunchScore:8, dinnerScore:5, snackScore:2, adherenceScore:9,
    satietyLevel:8, cookingStyle:'boiled'
  },
  baladi_bread: {
    mealRole:'side_carb', pairWith:['eggs_whole','cottage_cheese','tuna_canned','foul'],
    incompatibleWith:[],
    digestionSpeed:'fast', insulinImpact:'high',
    carbQuality:'refined', proteinQuality:'none',
    preWorkoutScore:5, postWorkoutScore:5, breakfastScore:9,
    lunchScore:7, dinnerScore:3, snackScore:4, adherenceScore:10,
    satietyLevel:5, cookingStyle:'raw'
  },
  whole_bread: {
    mealRole:'side_carb', pairWith:['eggs_whole','cottage_cheese','tuna_canned','avocado'],
    incompatibleWith:[],
    digestionSpeed:'medium', insulinImpact:'medium',
    carbQuality:'complex', proteinQuality:'none',
    preWorkoutScore:5, postWorkoutScore:5, breakfastScore:9,
    lunchScore:6, dinnerScore:3, snackScore:4, adherenceScore:9,
    satietyLevel:6, cookingStyle:'raw'
  },
  banana: {
    mealRole:'quick_carb', pairWith:['protein_shake','greek_yogurt','oats'],
    incompatibleWith:['white_rice','brown_rice'],
    digestionSpeed:'fast', insulinImpact:'high',
    carbQuality:'simple_natural', proteinQuality:'none',
    preWorkoutScore:9, postWorkoutScore:7, breakfastScore:5,
    lunchScore:2, dinnerScore:1, snackScore:7, adherenceScore:10,
    satietyLevel:4, cookingStyle:'raw', note:'طاقة سريعة — ليس كوجبة مستقلة'
  },
  dates: {
    mealRole:'quick_carb', pairWith:['protein_shake','milk_skim'],
    incompatibleWith:['white_rice','brown_rice'],
    digestionSpeed:'very_fast', insulinImpact:'very_high',
    carbQuality:'simple_natural', proteinQuality:'none',
    preWorkoutScore:9, postWorkoutScore:6, breakfastScore:3,
    lunchScore:1, dinnerScore:1, snackScore:6, adherenceScore:9,
    satietyLevel:4, cookingStyle:'raw', note:'كارب سريع جدا — pre workout فقط أو سناك خفيف'
  },
  quinoa: {
    mealRole:'main_carb', pairWith:['chicken_breast','turkey_breast','salmon','salad'],
    incompatibleWith:[],
    digestionSpeed:'medium', insulinImpact:'low',
    carbQuality:'complex', proteinQuality:'partial',
    preWorkoutScore:6, postWorkoutScore:7, breakfastScore:4,
    lunchScore:9, dinnerScore:7, snackScore:2, adherenceScore:6,
    satietyLevel:8, cookingStyle:'boiled'
  },
  // ── FATS
  avocado: {
    mealRole:'main_fat', pairWith:['eggs_whole','whole_bread','chicken_breast','salad'],
    incompatibleWith:['peanut_butter','tahini'],
    digestionSpeed:'medium', insulinImpact:'very_low',
    fatQuality:'healthy_monounsat', carbQuality:'none',
    preWorkoutScore:2, postWorkoutScore:3, breakfastScore:8,
    lunchScore:7, dinnerScore:5, snackScore:6, adherenceScore:8,
    satietyLevel:8, cookingStyle:'raw'
  },
  peanut_butter: {
    mealRole:'main_fat', pairWith:['oats','banana','whole_bread','apple'],
    incompatibleWith:['avocado','tahini','almonds'],
    digestionSpeed:'medium', insulinImpact:'low',
    fatQuality:'healthy_mixed', carbQuality:'none',
    preWorkoutScore:3, postWorkoutScore:4, breakfastScore:8,
    lunchScore:3, dinnerScore:2, snackScore:7, adherenceScore:9,
    satietyLevel:8, cookingStyle:'raw'
  },
  almonds: {
    mealRole:'side_fat', pairWith:['greek_yogurt','apple','banana'],
    incompatibleWith:['peanut_butter',],
    digestionSpeed:'medium', insulinImpact:'very_low',
    fatQuality:'healthy_monounsat', carbQuality:'none',
    preWorkoutScore:2, postWorkoutScore:3, breakfastScore:5,
    lunchScore:3, dinnerScore:3, snackScore:8, adherenceScore:9,
    satietyLevel:7, cookingStyle:'raw'
  },
  olive_oil: {
    mealRole:'side_fat', pairWith:['salad','chicken_breast','turkey_breast','veggies'],
    incompatibleWith:[],
    digestionSpeed:'medium', insulinImpact:'very_low',
    fatQuality:'healthy_monounsat', carbQuality:'none',
    preWorkoutScore:1, postWorkoutScore:1, breakfastScore:4,
    lunchScore:7, dinnerScore:6, snackScore:1, adherenceScore:10,
    satietyLevel:3, cookingStyle:'dressing/cooking'
  },
  // ── VEGETABLES (always score well in combos)
  broccoli: {
    mealRole:'veggie', pairWith:['chicken_breast','turkey_breast','salmon','beef_lean'],
    incompatibleWith:[],
    digestionSpeed:'medium', insulinImpact:'very_low',
    preWorkoutScore:3, postWorkoutScore:5, breakfastScore:3,
    lunchScore:9, dinnerScore:8, snackScore:2, adherenceScore:7,
    satietyLevel:6, cookingStyle:'steamed/cooked', note:'حار الهضم نسبيا — تجنب قبل التمرين'
  },
  spinach: {
    mealRole:'veggie', pairWith:['eggs_whole','chicken_breast','turkey_breast'],
    incompatibleWith:[],
    digestionSpeed:'fast', insulinImpact:'very_low',
    preWorkoutScore:4, postWorkoutScore:5, breakfastScore:7,
    lunchScore:8, dinnerScore:7, snackScore:3, adherenceScore:8,
    satietyLevel:5, cookingStyle:'raw/cooked'
  },
  cucumber: {
    mealRole:'veggie', pairWith:['cottage_cheese','eggs_whole','chicken_breast','tuna_canned'],
    incompatibleWith:[],
    digestionSpeed:'very_fast', insulinImpact:'very_low',
    preWorkoutScore:5, postWorkoutScore:4, breakfastScore:8,
    lunchScore:7, dinnerScore:7, snackScore:7, adherenceScore:10,
    satietyLevel:3, cookingStyle:'raw'
  },
  tomato: {
    mealRole:'veggie', pairWith:['eggs_whole','chicken_breast','cottage_cheese'],
    incompatibleWith:[],
    digestionSpeed:'fast', insulinImpact:'very_low',
    preWorkoutScore:4, postWorkoutScore:4, breakfastScore:8,
    lunchScore:7, dinnerScore:6, snackScore:4, adherenceScore:10,
    satietyLevel:3, cookingStyle:'raw/cooked'
  },
  // ── FRUITS
  apple: {
    mealRole:'fruit_carb', pairWith:['almonds','greek_yogurt','peanut_butter'],
    incompatibleWith:['banana','dates'],
    digestionSpeed:'medium', insulinImpact:'medium',
    preWorkoutScore:5, postWorkoutScore:4, breakfastScore:6,
    lunchScore:2, dinnerScore:2, snackScore:9, adherenceScore:10,
    satietyLevel:5, cookingStyle:'raw'
  },
  strawberry: {
    mealRole:'fruit_carb', pairWith:['greek_yogurt','oats','protein_shake'],
    incompatibleWith:[],
    digestionSpeed:'fast', insulinImpact:'low',
    preWorkoutScore:5, postWorkoutScore:5, breakfastScore:8,
    lunchScore:2, dinnerScore:2, snackScore:8, adherenceScore:9,
    satietyLevel:4, cookingStyle:'raw'
  },
  // ── DAIRY
  milk_skim: {
    mealRole:'side_carb', pairWith:['oats','protein_shake'],
    incompatibleWith:[],
    digestionSpeed:'fast', insulinImpact:'medium',
    preWorkoutScore:4, postWorkoutScore:5, breakfastScore:7,
    lunchScore:2, dinnerScore:2, snackScore:5, adherenceScore:9,
    satietyLevel:4, cookingStyle:'raw'
  },
  yogurt_plain: {
    mealRole:'side_protein', pairWith:['banana','strawberry','oats'],
    incompatibleWith:[],
    digestionSpeed:'fast', insulinImpact:'medium',
    preWorkoutScore:4, postWorkoutScore:5, breakfastScore:8,
    lunchScore:3, dinnerScore:4, snackScore:7, adherenceScore:9,
    satietyLevel:6, cookingStyle:'raw'
  },
  // ── LEGUMES
  lentils: {
    mealRole:'main_carb', pairWith:['baladi_bread','salad','spinach'],
    incompatibleWith:[],
    digestionSpeed:'slow', insulinImpact:'low',
    carbQuality:'complex', proteinQuality:'partial',
    preWorkoutScore:3, postWorkoutScore:6, breakfastScore:6,
    lunchScore:9, dinnerScore:7, snackScore:2, adherenceScore:8,
    satietyLevel:9, cookingStyle:'cooked'
  },
  foul: {
    mealRole:'main_carb', pairWith:['baladi_bread','eggs_whole',],
    incompatibleWith:[],
    digestionSpeed:'slow', insulinImpact:'low',
    carbQuality:'complex', proteinQuality:'partial',
    preWorkoutScore:2, postWorkoutScore:4, breakfastScore:10,
    lunchScore:7, dinnerScore:4, snackScore:2, adherenceScore:10,
    satietyLevel:9, cookingStyle:'cooked'
  },
  chickpeas: {
    mealRole:'main_carb', pairWith:['salad','spinach','olive_oil'],
    incompatibleWith:[],
    digestionSpeed:'slow', insulinImpact:'low',
    carbQuality:'complex', proteinQuality:'partial',
    preWorkoutScore:3, postWorkoutScore:5, breakfastScore:4,
    lunchScore:8, dinnerScore:7, snackScore:4, adherenceScore:8,
    satietyLevel:9, cookingStyle:'cooked'
  },
  // ── New Foods Intelligence
  chicken_crispy: {
    mealRole:'main_protein', pairWith:['salad','potato_wedges','mashed_potato'],
    incompatibleWith:['chicken_breast','beef_lean'],
    digestionSpeed:'slow', insulinImpact:'low',
    proteinQuality:'complete', fatQuality:'saturated',
    preWorkoutScore:1, postWorkoutScore:4, breakfastScore:2,
    lunchScore:7, dinnerScore:6, snackScore:5, adherenceScore:9,
    satietyLevel:9, cookingStyle:'fried'
  },
  chicken_panee: {
    mealRole:'main_protein', pairWith:['salad','mashed_potato','grilled_vegetables_mix'],
    incompatibleWith:['chicken_breast'],
    digestionSpeed:'slow', insulinImpact:'low',
    proteinQuality:'complete', fatQuality:'saturated',
    preWorkoutScore:1, postWorkoutScore:4, breakfastScore:2,
    lunchScore:8, dinnerScore:7, snackScore:3, adherenceScore:9,
    satietyLevel:8, cookingStyle:'fried/baked'
  },
  homemade_burger: {
    mealRole:'main_protein', pairWith:['salad','grilled_vegetables_mix'],
    incompatibleWith:['beef_lean','chicken_breast'],
    digestionSpeed:'slow', insulinImpact:'low',
    proteinQuality:'complete', fatQuality:'saturated',
    preWorkoutScore:1, postWorkoutScore:3, breakfastScore:2,
    lunchScore:8, dinnerScore:7, snackScore:2, adherenceScore:9,
    satietyLevel:9, cookingStyle:'grilled'
  },
  chicken_burger: {
    mealRole:'main_protein', pairWith:['salad','grilled_vegetables_mix'],
    incompatibleWith:['chicken_breast','chicken_crispy'],
    digestionSpeed:'slow', insulinImpact:'low',
    proteinQuality:'complete', fatQuality:'moderate',
    preWorkoutScore:1, postWorkoutScore:4, breakfastScore:2,
    lunchScore:8, dinnerScore:7, snackScore:3, adherenceScore:9,
    satietyLevel:8, cookingStyle:'grilled'
  },
  kofta_grilled_skewer: {
    mealRole:'main_protein', pairWith:['white_rice','brown_rice','salad','grilled_vegetables_mix'],
    incompatibleWith:['chicken_breast','beef_lean'],
    digestionSpeed:'medium', insulinImpact:'very_low',
    proteinQuality:'complete', fatQuality:'moderate',
    preWorkoutScore:2, postWorkoutScore:5, breakfastScore:2,
    lunchScore:9, dinnerScore:8, snackScore:1, adherenceScore:9,
    satietyLevel:8, cookingStyle:'grilled'
  },
  kofta_oven: {
    mealRole:'main_protein', pairWith:['white_rice','brown_rice','salad'],
    incompatibleWith:['chicken_breast'],
    digestionSpeed:'medium', insulinImpact:'very_low',
    proteinQuality:'complete', fatQuality:'moderate',
    preWorkoutScore:2, postWorkoutScore:5, breakfastScore:2,
    lunchScore:8, dinnerScore:7, snackScore:1, adherenceScore:9,
    satietyLevel:8, cookingStyle:'baked'
  },
  pizza_homemade: {
    mealRole:'main_carb', pairWith:['salad'],
    incompatibleWith:['white_rice','brown_rice'],
    digestionSpeed:'medium', insulinImpact:'high',
    carbQuality:'refined', proteinQuality:'partial',
    preWorkoutScore:2, postWorkoutScore:3, breakfastScore:2,
    lunchScore:7, dinnerScore:6, snackScore:5, adherenceScore:9,
    satietyLevel:7, cookingStyle:'baked'
  },
  pizza_pepperoni: {
    mealRole:'main_carb', pairWith:['salad'],
    incompatibleWith:['white_rice'],
    digestionSpeed:'slow', insulinImpact:'high',
    carbQuality:'refined', proteinQuality:'partial',
    preWorkoutScore:1, postWorkoutScore:2, breakfastScore:1,
    lunchScore:6, dinnerScore:5, snackScore:4, adherenceScore:9,
    satietyLevel:7, cookingStyle:'baked'
  },
  french_fries: {
    mealRole:'main_carb', pairWith:['chicken_crispy','homemade_burger','chicken_burger'],
    incompatibleWith:['white_rice','brown_rice'],
    digestionSpeed:'slow', insulinImpact:'high',
    carbQuality:'refined', proteinQuality:'none',
    preWorkoutScore:2, postWorkoutScore:3, breakfastScore:1,
    lunchScore:6, dinnerScore:4, snackScore:5, adherenceScore:9,
    satietyLevel:5, cookingStyle:'fried'
  },
  mashed_potato: {
    mealRole:'main_carb', pairWith:['chicken_breast','beef_lean','grilled_vegetables_mix'],
    incompatibleWith:[],
    digestionSpeed:'medium', insulinImpact:'high',
    carbQuality:'moderate', proteinQuality:'none',
    preWorkoutScore:4, postWorkoutScore:5, breakfastScore:3,
    lunchScore:8, dinnerScore:6, snackScore:2, adherenceScore:9,
    satietyLevel:8, cookingStyle:'cooked'
  },
  potato_wedges: {
    mealRole:'main_carb', pairWith:['chicken_breast','salmon','salad'],
    incompatibleWith:[],
    digestionSpeed:'medium', insulinImpact:'high',
    carbQuality:'moderate', proteinQuality:'none',
    preWorkoutScore:5, postWorkoutScore:6, breakfastScore:2,
    lunchScore:7, dinnerScore:5, snackScore:4, adherenceScore:9,
    satietyLevel:6, cookingStyle:'baked'
  },
  baba_ghanouj: {
    mealRole:'veggie', pairWith:['baladi_bread','whole_bread','chicken_breast'],
    incompatibleWith:[],
    digestionSpeed:'medium', insulinImpact:'very_low',
    preWorkoutScore:2, postWorkoutScore:3, breakfastScore:4,
    lunchScore:7, dinnerScore:6, snackScore:7, adherenceScore:9,
    satietyLevel:5, cookingStyle:'cooked'
  },
  eggplant_grilled: {
    mealRole:'veggie', pairWith:['chicken_breast','beef_lean','salmon'],
    incompatibleWith:[],
    digestionSpeed:'medium', insulinImpact:'very_low',
    preWorkoutScore:3, postWorkoutScore:4, breakfastScore:3,
    lunchScore:8, dinnerScore:7, snackScore:3, adherenceScore:8,
    satietyLevel:4, cookingStyle:'grilled'
  },
  asparagus_veg: {
    mealRole:'veggie', pairWith:['chicken_breast','salmon','beef_lean','eggs_whole'],
    incompatibleWith:[],
    digestionSpeed:'fast', insulinImpact:'very_low',
    preWorkoutScore:4, postWorkoutScore:5, breakfastScore:4,
    lunchScore:9, dinnerScore:8, snackScore:3, adherenceScore:7,
    satietyLevel:4, cookingStyle:'grilled/steamed'
  },
  lentil_soup: {
    mealRole:'main_carb', pairWith:['baladi_bread','salad'],
    incompatibleWith:[],
    digestionSpeed:'medium', insulinImpact:'low',
    carbQuality:'complex', proteinQuality:'partial',
    preWorkoutScore:3, postWorkoutScore:5, breakfastScore:4,
    lunchScore:9, dinnerScore:8, snackScore:2, adherenceScore:10,
    satietyLevel:8, cookingStyle:'cooked'
  },
  chicken_soup: {
    mealRole:'side_protein', pairWith:['baladi_bread','white_rice'],
    incompatibleWith:[],
    digestionSpeed:'fast', insulinImpact:'very_low',
    proteinQuality:'partial', fatQuality:'lean',
    preWorkoutScore:3, postWorkoutScore:5, breakfastScore:3,
    lunchScore:7, dinnerScore:8, snackScore:2, adherenceScore:9,
    satietyLevel:5, cookingStyle:'cooked'
  },
  vegetable_soup: {
    mealRole:'veggie', pairWith:['baladi_bread','chicken_breast'],
    incompatibleWith:[],
    digestionSpeed:'fast', insulinImpact:'very_low',
    preWorkoutScore:3, postWorkoutScore:4, breakfastScore:3,
    lunchScore:7, dinnerScore:8, snackScore:2, adherenceScore:10,
    satietyLevel:5, cookingStyle:'cooked'
  },
  eggs_fried_shakshouka: {
    mealRole:'main_protein', pairWith:['baladi_bread','whole_bread'],
    incompatibleWith:['protein_shake'],
    digestionSpeed:'medium', insulinImpact:'low',
    proteinQuality:'complete', fatQuality:'moderate',
    preWorkoutScore:4, postWorkoutScore:5, breakfastScore:10,
    lunchScore:6, dinnerScore:4, snackScore:2, adherenceScore:10,
    satietyLevel:7, cookingStyle:'cooked'
  },
  feta_cheese: {
    mealRole:'side_protein', pairWith:['baladi_bread','eggs_whole'],
    incompatibleWith:[],
    digestionSpeed:'fast', insulinImpact:'low',
    proteinQuality:'good', fatQuality:'moderate',
    preWorkoutScore:3, postWorkoutScore:4, breakfastScore:9,
    lunchScore:4, dinnerScore:5, snackScore:6, adherenceScore:10,
    satietyLevel:5, cookingStyle:'raw'
  },
  avocado_half: {
    mealRole:'main_fat', pairWith:['eggs_whole','chicken_breast','whole_bread','salad'],
    incompatibleWith:['peanut_butter'],
    digestionSpeed:'medium', insulinImpact:'very_low',
    fatQuality:'healthy_monounsat', carbQuality:'none',
    preWorkoutScore:2, postWorkoutScore:3, breakfastScore:8,
    lunchScore:7, dinnerScore:5, snackScore:6, adherenceScore:8,
    satietyLevel:8, cookingStyle:'raw'
  },
  walnuts_handful: {
    mealRole:'side_fat', pairWith:['greek_yogurt','apple','banana'],
    incompatibleWith:['almonds_handful','peanut_butter'],
    digestionSpeed:'slow', insulinImpact:'very_low',
    fatQuality:'healthy_omega3', carbQuality:'none',
    preWorkoutScore:2, postWorkoutScore:3, breakfastScore:5,
    lunchScore:3, dinnerScore:3, snackScore:8, adherenceScore:8,
    satietyLevel:7, cookingStyle:'raw'
  },
  almonds_handful: {
    mealRole:'side_fat', pairWith:['greek_yogurt','apple'],
    incompatibleWith:['walnuts_handful','peanut_butter'],
    digestionSpeed:'medium', insulinImpact:'very_low',
    fatQuality:'healthy_monounsat', carbQuality:'none',
    preWorkoutScore:2, postWorkoutScore:3, breakfastScore:5,
    lunchScore:3, dinnerScore:3, snackScore:8, adherenceScore:9,
    satietyLevel:7, cookingStyle:'raw'
  },
  mixed_grill_plate: {
    mealRole:'main_protein', pairWith:['salad','grilled_vegetables_mix'],
    incompatibleWith:['chicken_breast','beef_lean'],
    digestionSpeed:'slow', insulinImpact:'very_low',
    proteinQuality:'complete', fatQuality:'moderate',
    preWorkoutScore:1, postWorkoutScore:4, breakfastScore:1,
    lunchScore:9, dinnerScore:8, snackScore:1, adherenceScore:8,
    satietyLevel:9, cookingStyle:'grilled'
  },
  grilled_fish_nile: {
    mealRole:'main_protein', pairWith:['salad','grilled_vegetables_mix','brown_rice'],
    incompatibleWith:['chicken_breast'],
    digestionSpeed:'medium', insulinImpact:'very_low',
    proteinQuality:'complete', fatQuality:'lean',
    preWorkoutScore:4, postWorkoutScore:7, breakfastScore:2,
    lunchScore:10, dinnerScore:8, snackScore:1, adherenceScore:8,
    satietyLevel:7, cookingStyle:'grilled'
  },
  mackerel_fresh: {
    mealRole:'main_protein', pairWith:['brown_rice','sweet_potato','salad','grilled_vegetables_mix'],
    incompatibleWith:['chicken_breast'],
    digestionSpeed:'medium', insulinImpact:'very_low',
    proteinQuality:'complete', fatQuality:'healthy_omega3',
    preWorkoutScore:3, postWorkoutScore:8, breakfastScore:2,
    lunchScore:9, dinnerScore:7, snackScore:1, adherenceScore:7,
    satietyLevel:8, cookingStyle:'grilled'
  },
  mackerel_canned: {
    mealRole:'main_protein', pairWith:['brown_rice','baladi_bread',],
    incompatibleWith:['chicken_breast'],
    digestionSpeed:'fast', insulinImpact:'very_low',
    proteinQuality:'complete', fatQuality:'healthy_omega3',
    preWorkoutScore:5, postWorkoutScore:8, breakfastScore:3,
    lunchScore:8, dinnerScore:7, snackScore:4, adherenceScore:8,
    satietyLevel:7, cookingStyle:'raw/mixed'
  },
  sardine_fresh: {
    mealRole:'main_protein', pairWith:['brown_rice','salad','baladi_bread'],
    incompatibleWith:['chicken_breast'],
    digestionSpeed:'medium', insulinImpact:'very_low',
    proteinQuality:'complete', fatQuality:'healthy_omega3',
    preWorkoutScore:3, postWorkoutScore:8, breakfastScore:2,
    lunchScore:9, dinnerScore:7, snackScore:1, adherenceScore:7,
    satietyLevel:8, cookingStyle:'grilled'
  },
  bouri_mullet: {
    mealRole:'main_protein', pairWith:['brown_rice','salad','grilled_vegetables_mix'],
    incompatibleWith:['chicken_breast'],
    digestionSpeed:'medium', insulinImpact:'very_low',
    proteinQuality:'complete', fatQuality:'lean',
    preWorkoutScore:4, postWorkoutScore:8, breakfastScore:2,
    lunchScore:10, dinnerScore:8, snackScore:1, adherenceScore:8,
    satietyLevel:7, cookingStyle:'grilled'
  },
  sea_bass_denise: {
    mealRole:'main_protein', pairWith:['brown_rice','sweet_potato','salad','grilled_vegetables_mix'],
    incompatibleWith:['chicken_breast'],
    digestionSpeed:'fast', insulinImpact:'very_low',
    proteinQuality:'complete', fatQuality:'lean',
    preWorkoutScore:4, postWorkoutScore:9, breakfastScore:2,
    lunchScore:10, dinnerScore:9, snackScore:1, adherenceScore:7,
    satietyLevel:7, cookingStyle:'grilled'
  },
  calamari_grilled: {
    mealRole:'main_protein', pairWith:['salad','brown_rice','grilled_vegetables_mix'],
    incompatibleWith:['chicken_breast'],
    digestionSpeed:'fast', insulinImpact:'very_low',
    proteinQuality:'complete', fatQuality:'lean',
    preWorkoutScore:5, postWorkoutScore:8, breakfastScore:2,
    lunchScore:9, dinnerScore:8, snackScore:2, adherenceScore:7,
    satietyLevel:6, cookingStyle:'grilled'
  },
  shakhora_crab: {
    mealRole:'main_protein', pairWith:['salad','brown_rice'],
    incompatibleWith:['chicken_breast'],
    digestionSpeed:'fast', insulinImpact:'very_low',
    proteinQuality:'complete', fatQuality:'lean',
    preWorkoutScore:4, postWorkoutScore:7, breakfastScore:2,
    lunchScore:8, dinnerScore:7, snackScore:2, adherenceScore:6,
    satietyLevel:6, cookingStyle:'cooked'
  },
  kofta_grilled: {
    mealRole:'main_protein', pairWith:['brown_rice','salad','baladi_bread','grilled_vegetables_mix'],
    incompatibleWith:['beef_lean','chicken_breast'],
    digestionSpeed:'medium', insulinImpact:'very_low',
    proteinQuality:'complete', fatQuality:'moderate',
    preWorkoutScore:2, postWorkoutScore:6, breakfastScore:2,
    lunchScore:9, dinnerScore:8, snackScore:1, adherenceScore:9,
    satietyLevel:8, cookingStyle:'grilled'
  },
  pasta_white_cooked: {
    mealRole:'main_carb', pairWith:['chicken_breast','turkey_breast','tuna_canned','veggies'],
    incompatibleWith:[],
    digestionSpeed:'fast', insulinImpact:'high',
    carbQuality:'refined', proteinQuality:'none',
    preWorkoutScore:7, postWorkoutScore:8, breakfastScore:1,
    lunchScore:8, dinnerScore:4, snackScore:1, adherenceScore:9,
    satietyLevel:4, cookingStyle:'boiled'
  },
  baba_ghanouj: {
    mealRole:'veggie', pairWith:['baladi_bread','whole_bread','chicken_breast'],
    incompatibleWith:[],
    digestionSpeed:'medium', insulinImpact:'very_low',
    preWorkoutScore:2, postWorkoutScore:3, breakfastScore:4,
    lunchScore:7, dinnerScore:6, snackScore:7, adherenceScore:9,
    satietyLevel:5, cookingStyle:'cooked'
  },
  grilled_vegetables_mix: {
    mealRole:'veggie', pairWith:['chicken_breast','salmon','beef_lean','kofta_grilled_skewer'],
    incompatibleWith:[],
    digestionSpeed:'medium', insulinImpact:'very_low',
    preWorkoutScore:4, postWorkoutScore:5, breakfastScore:3,
    lunchScore:9, dinnerScore:9, snackScore:3, adherenceScore:8,
    satietyLevel:5, cookingStyle:'grilled'
  }
};
