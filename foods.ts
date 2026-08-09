/**
 * UNUM oziq-ovqat bazasi — O'zbekiston uchun.
 *
 * Har bir yozuv 100 g (yoki 1 dona) uchun berilgan:
 *   calories  kkal
 *   protein   g
 *   carbs     g
 *   fat       g
 *   fiber     g   — kletchatka
 *   sugar     g   — umumiy shakar
 *   sodium    mg  — natriy (tuz = natriy × 2.5)
 *   nova      1-4 — NOVA tasnifi (qayta ishlanganlik darajasi):
 *                   1 = tabiiy/minimal, 2 = oshxona ingredienti (yog', shakar),
 *                   3 = qayta ishlangan (non, pishloq), 4 = ULTRA-qayta ishlangan
 *   veg       100 g dagi sabzavot/meva "portsiya" ulushi (1 portsiya = 80 g)
 *   price     so'mda: `unit` kg bo'lsa 1 kg narxi, pieces bo'lsa 1 dona narxi
 *
 * ⚠️ Narxlar 2026-yil o'rtasidagi Toshkent bozori bo'yicha TAXMINIY.
 *    Ular faqat byudjet tahlili uchun mo'ljallangan — davriy yangilab turing.
 */

export interface FoodSeed {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  nova: 1 | 2 | 3 | 4;
  veg: number;
  unit: 'kg' | 'grams' | 'pieces';
  servingSize: number;
  pricePerUnit: number;
  image: string;
  category: string;
}

const f = (
  id: string, name: string, category: string, image: string,
  calories: number, protein: number, carbs: number, fat: number,
  fiber: number, sugar: number, sodium: number,
  nova: 1 | 2 | 3 | 4, veg: number,
  unit: 'kg' | 'pieces', servingSize: number, pricePerUnit: number,
): FoodSeed => ({
  id, name, category, image, calories, protein, carbs, fat,
  fiber, sugar, sodium, nova, veg, unit, servingSize, pricePerUnit,
});

export const FOODS: FoodSeed[] = [
  // ─────────────── GO'SHT VA PARRANDA ───────────────
  f('f_meat_01', "Tovuq go'shti (ko'krak)", 'gosht', '🍗', 165, 31, 0, 3.6, 0, 0, 74, 1, 0, 'kg', 100, 65000),
  f('f_meat_02', "Tovuq go'shti (son)", 'gosht', '🍗', 209, 26, 0, 11, 0, 0, 84, 1, 0, 'kg', 100, 48000),
  f('f_meat_03', 'Tovuq qanoti', 'gosht', '🍗', 203, 30, 0, 8.1, 0, 0, 82, 1, 0, 'kg', 100, 42000),
  f('f_meat_04', "Mol go'shti (qiyma)", 'gosht', '🥩', 250, 26, 0, 15, 0, 0, 72, 1, 0, 'kg', 100, 115000),
  f('f_meat_05', "Mol go'shti (bifshteks)", 'gosht', '🥩', 217, 27, 0, 11, 0, 0, 55, 1, 0, 'kg', 100, 130000),
  f('f_meat_06', "Qo'y go'shti", 'gosht', '🍖', 294, 25, 0, 21, 0, 0, 72, 1, 0, 'kg', 100, 140000),
  f('f_meat_07', "Qo'y dumbasi", 'gosht', '🍖', 640, 5, 0, 68, 0, 0, 40, 1, 0, 'kg', 100, 90000),
  f('f_meat_08', 'Jigar (mol)', 'gosht', '🍖', 135, 20, 3.9, 3.6, 0, 0, 69, 1, 0, 'kg', 100, 60000),
  f('f_meat_09', 'Kolbasa (doktorskaya)', 'gosht', '🌭', 257, 13, 1.5, 22, 0, 0, 828, 4, 0, 'kg', 100, 70000),
  f('f_meat_10', 'Sosiska', 'gosht', '🌭', 266, 11, 2.2, 24, 0, 1, 900, 4, 0, 'kg', 100, 55000),

  // ─────────────── BALIQ ───────────────
  f('f_fish_01', 'Sazan (baliq)', 'baliq', '🐟', 127, 18, 0, 5.6, 0, 0, 49, 1, 0, 'kg', 100, 55000),
  f('f_fish_02', 'Losos (qizil baliq)', 'baliq', '🐟', 208, 20, 0, 13, 0, 0, 59, 1, 0, 'kg', 100, 190000),
  f('f_fish_03', 'Skumbriya', 'baliq', '🐟', 205, 19, 0, 14, 0, 0, 90, 1, 0, 'kg', 100, 60000),
  f('f_fish_04', 'Tunes (konserva)', 'baliq', '🐟', 116, 26, 0, 1, 0, 0, 320, 3, 0, 'kg', 100, 120000),

  // ─────────────── TUXUM VA SUT ───────────────
  f('f_dairy_01', 'Tuxum (tovuq)', 'sut', '🥚', 155, 13, 1.1, 11, 0, 1.1, 124, 1, 0, 'pieces', 1, 1500),
  f('f_dairy_02', 'Sut (3.2%)', 'sut', '🥛', 60, 3.2, 4.8, 3.2, 0, 4.8, 43, 1, 0, 'kg', 100, 14000),
  f('f_dairy_03', 'Tvorog (5%)', 'sut', '🧀', 121, 17, 3, 5, 0, 3, 41, 1, 0, 'kg', 100, 40000),
  f('f_dairy_04', 'Qatiq', 'sut', '🥛', 58, 3.2, 4.1, 3.2, 0, 4.1, 50, 1, 0, 'kg', 100, 18000),
  f('f_dairy_05', 'Suzma', 'sut', '🥛', 155, 12, 4, 10, 0, 4, 60, 1, 0, 'kg', 100, 35000),
  f('f_dairy_06', 'Qaymoq (smetana 20%)', 'sut', '🥛', 206, 2.8, 3.2, 20, 0, 3.2, 35, 1, 0, 'kg', 100, 45000),
  f('f_dairy_07', 'Pishloq (rus)', 'sut', '🧀', 363, 23, 0, 30, 0, 0, 810, 3, 0, 'kg', 100, 95000),
  f('f_dairy_08', 'Sariyog\'', 'sut', '🧈', 717, 0.9, 0.1, 81, 0, 0.1, 11, 2, 0, 'kg', 100, 90000),
  f('f_dairy_09', 'Yogurt (shakarli)', 'sut', '🥛', 97, 3.5, 15, 2.5, 0, 14, 45, 4, 0, 'kg', 100, 30000),
  f('f_dairy_10', 'Ayron', 'sut', '🥛', 30, 1.7, 2.5, 1.5, 0, 2.5, 210, 3, 0, 'kg', 100, 12000),

  // ─────────────── NON VA YORMALAR ───────────────
  f('f_grain_01', 'Patir non', 'non', '🫓', 266, 8, 52, 3, 2.2, 2, 490, 3, 0, 'pieces', 200, 4000),
  f('f_grain_02', 'Oddiy non (bulka)', 'non', '🍞', 265, 9, 49, 3.2, 2.7, 5, 490, 3, 0, 'pieces', 400, 4500),
  f('f_grain_03', 'Bug\'doy noni (to\'liq donli)', 'non', '🍞', 247, 13, 41, 3.4, 7, 6, 450, 3, 0, 'pieces', 400, 9000),
  f('f_grain_04', 'Oq guruch', 'non', '🍚', 130, 2.7, 28, 0.3, 0.4, 0.1, 1, 1, 0, 'kg', 100, 22000),
  f('f_grain_05', 'Devzira guruch', 'non', '🍚', 135, 3, 29, 0.4, 1.2, 0.2, 2, 1, 0, 'kg', 100, 45000),
  f('f_grain_06', 'Grechka', 'non', '🌾', 343, 13, 71, 3.4, 10, 2, 1, 1, 0, 'kg', 100, 25000),
  f('f_grain_07', 'Suli yormasi (ovsyanka)', 'non', '🥣', 389, 17, 66, 7, 11, 1, 2, 1, 0, 'kg', 100, 28000),
  f('f_grain_08', 'Makaron', 'non', '🍝', 371, 13, 75, 1.5, 3.2, 2.7, 6, 3, 0, 'kg', 100, 15000),
  f('f_grain_09', 'Un (oliy nav)', 'non', '🌾', 364, 10, 76, 1, 2.7, 0.3, 2, 2, 0, 'kg', 100, 8000),
  f('f_grain_10', 'Perlovka (arpa yormasi)', 'non', '🌾', 352, 10, 77, 1.2, 15, 0.8, 9, 1, 0, 'kg', 100, 12000),
  f('f_grain_11', 'Mosh', 'non', '🫘', 347, 24, 63, 1.2, 16, 6.6, 15, 1, 0, 'kg', 100, 30000),
  f('f_grain_12', 'Zog\'ora (makkajo\'xori uni)', 'non', '🌽', 361, 7, 76, 3.6, 7, 0.6, 5, 1, 0, 'kg', 100, 12000),

  // ─────────────── SABZAVOTLAR ───────────────
  f('f_veg_01', 'Pomidor', 'sabzavot', '🍅', 18, 0.9, 3.9, 0.2, 1.2, 2.6, 5, 1, 1.25, 'kg', 100, 15000),
  f('f_veg_02', 'Bodring', 'sabzavot', '🥒', 15, 0.6, 3.6, 0.1, 0.5, 1.7, 2, 1, 1.25, 'kg', 100, 12000),
  f('f_veg_03', 'Piyoz', 'sabzavot', '🧅', 40, 1.1, 9.3, 0.1, 1.7, 4.2, 4, 1, 1.25, 'kg', 100, 5000),
  f('f_veg_04', 'Sabzi', 'sabzavot', '🥕', 41, 0.9, 9.6, 0.2, 2.8, 4.7, 69, 1, 1.25, 'kg', 100, 6000),
  f('f_veg_05', 'Kartoshka', 'sabzavot', '🥔', 77, 2, 17, 0.1, 2.2, 0.8, 6, 1, 0, 'kg', 100, 7000),
  f('f_veg_06', 'Karam (oq)', 'sabzavot', '🥬', 25, 1.3, 5.8, 0.1, 2.5, 3.2, 18, 1, 1.25, 'kg', 100, 5000),
  f('f_veg_07', 'Bolgar qalampiri', 'sabzavot', '🫑', 31, 1, 6, 0.3, 2.1, 4.2, 4, 1, 1.25, 'kg', 100, 18000),
  f('f_veg_08', 'Baqlajon', 'sabzavot', '🍆', 25, 1, 5.9, 0.2, 3, 3.5, 2, 1, 1.25, 'kg', 100, 12000),
  f('f_veg_09', 'Qovoq', 'sabzavot', '🎃', 26, 1, 6.5, 0.1, 0.5, 2.8, 1, 1, 1.25, 'kg', 100, 6000),
  f('f_veg_10', 'Brokkoli', 'sabzavot', '🥦', 34, 2.8, 7, 0.4, 2.6, 1.7, 33, 1, 1.25, 'kg', 100, 35000),
  f('f_veg_11', 'Turp', 'sabzavot', '🥗', 16, 0.7, 3.4, 0.1, 1.6, 1.9, 39, 1, 1.25, 'kg', 100, 7000),
  f('f_veg_12', 'Ismaloq (shpinat)', 'sabzavot', '🥬', 23, 2.9, 3.6, 0.4, 2.2, 0.4, 79, 1, 1.25, 'kg', 100, 25000),
  f('f_veg_13', 'Ko\'katlar (jambil, ukrop)', 'sabzavot', '🌿', 36, 3.5, 7, 0.6, 2.8, 0.5, 61, 1, 1.25, 'kg', 100, 20000),
  f('f_veg_14', 'Sarimsoq', 'sabzavot', '🧄', 149, 6.4, 33, 0.5, 2.1, 1, 17, 1, 0.3, 'kg', 100, 30000),
  f('f_veg_15', 'Rediska', 'sabzavot', '🥗', 16, 0.7, 3.4, 0.1, 1.6, 1.9, 39, 1, 1.25, 'kg', 100, 10000),
  f('f_veg_16', 'Loviya (yashil)', 'sabzavot', '🫛', 31, 1.8, 7, 0.2, 3.4, 3.3, 6, 1, 1.25, 'kg', 100, 18000),
  f('f_veg_17', 'Makkajo\'xori (donli)', 'sabzavot', '🌽', 86, 3.3, 19, 1.2, 2, 3.2, 15, 1, 1.25, 'kg', 100, 12000),
  f('f_veg_18', 'Tuzlangan bodring', 'sabzavot', '🥒', 11, 0.3, 2.3, 0.2, 1.2, 1.1, 1208, 3, 0.6, 'kg', 100, 15000),

  // ─────────────── MEVALAR ───────────────
  f('f_fruit_01', 'Olma', 'meva', '🍎', 52, 0.3, 14, 0.2, 2.4, 10, 1, 1, 1.25, 'kg', 100, 15000),
  f('f_fruit_02', 'Banan', 'meva', '🍌', 89, 1.1, 23, 0.3, 2.6, 12, 1, 1, 1.25, 'kg', 100, 25000),
  f('f_fruit_03', 'Uzum', 'meva', '🍇', 69, 0.7, 18, 0.2, 0.9, 16, 2, 1, 1.25, 'kg', 100, 20000),
  f('f_fruit_04', 'Anor', 'meva', '🍎', 83, 1.7, 19, 1.2, 4, 14, 3, 1, 1.25, 'kg', 100, 25000),
  f('f_fruit_05', 'Qovun', 'meva', '🍈', 34, 0.8, 8.2, 0.2, 0.9, 7.9, 16, 1, 1.25, 'kg', 100, 8000),
  f('f_fruit_06', 'Tarvuz', 'meva', '🍉', 30, 0.6, 7.6, 0.2, 0.4, 6.2, 1, 1, 1.25, 'kg', 100, 5000),
  f('f_fruit_07', 'O\'rik', 'meva', '🍑', 48, 1.4, 11, 0.4, 2, 9.2, 1, 1, 1.25, 'kg', 100, 18000),
  f('f_fruit_08', 'Shaftoli', 'meva', '🍑', 39, 0.9, 10, 0.3, 1.5, 8.4, 0, 1, 1.25, 'kg', 100, 18000),
  f('f_fruit_09', 'Nok', 'meva', '🍐', 57, 0.4, 15, 0.1, 3.1, 10, 1, 1, 1.25, 'kg', 100, 20000),
  f('f_fruit_10', 'Xurmo (quritilgan)', 'meva', '🌴', 282, 2.5, 75, 0.4, 8, 63, 2, 1, 0.6, 'kg', 100, 60000),
  f('f_fruit_11', 'Mayiz', 'meva', '🍇', 299, 3.1, 79, 0.5, 3.7, 59, 11, 1, 0.6, 'kg', 100, 45000),
  f('f_fruit_12', 'Limon', 'meva', '🍋', 29, 1.1, 9.3, 0.3, 2.8, 2.5, 2, 1, 1.25, 'kg', 100, 25000),
  f('f_fruit_13', 'Apelsin', 'meva', '🍊', 47, 0.9, 12, 0.1, 2.4, 9.4, 0, 1, 1.25, 'kg', 100, 22000),
  f('f_fruit_14', 'Qulupnay', 'meva', '🍓', 32, 0.7, 7.7, 0.3, 2, 4.9, 1, 1, 1.25, 'kg', 100, 40000),

  // ─────────────── DUKKAKLI VA YONG'OQ ───────────────
  f('f_nut_01', 'Yong\'oq (grek)', 'yongoq', '🌰', 654, 15, 14, 65, 6.7, 2.6, 2, 1, 0, 'kg', 100, 90000),
  f('f_nut_02', 'Bodom', 'yongoq', '🌰', 579, 21, 22, 50, 12, 4.4, 1, 1, 0, 'kg', 100, 130000),
  f('f_nut_03', "Yeryong'oq (araxis)", 'yongoq', '🥜', 567, 26, 16, 49, 8.5, 4.7, 18, 1, 0, 'kg', 100, 40000),
  f('f_nut_04', 'Kungaboqar urug\'i', 'yongoq', '🌻', 584, 21, 20, 51, 8.6, 2.6, 9, 1, 0, 'kg', 100, 35000),
  f('f_nut_05', 'No\'xat', 'yongoq', '🫘', 364, 19, 61, 6, 17, 11, 24, 1, 0, 'kg', 100, 22000),
  f('f_nut_06', 'Loviya (quruq)', 'yongoq', '🫘', 333, 24, 60, 0.8, 25, 2.1, 16, 1, 0, 'kg', 100, 25000),
  f('f_nut_07', 'Yasmiq', 'yongoq', '🫘', 353, 26, 60, 1.1, 31, 2, 6, 1, 0, 'kg', 100, 28000),
  f('f_nut_08', 'Pista', 'yongoq', '🥜', 560, 20, 28, 45, 10, 7.7, 1, 1, 0, 'kg', 100, 150000),

  // ─────────────── YOG'LAR VA ZIRAVORLAR ───────────────
  f('f_oil_01', 'Paxta yog\'i', 'yog', '🫗', 884, 0, 0, 100, 0, 0, 0, 2, 0, 'kg', 100, 25000),
  f('f_oil_02', 'Kungaboqar yog\'i', 'yog', '🫗', 884, 0, 0, 100, 0, 0, 0, 2, 0, 'kg', 100, 22000),
  f('f_oil_03', 'Zaytun yog\'i', 'yog', '🫒', 884, 0, 0, 100, 0, 0, 2, 2, 0, 'kg', 100, 120000),
  f('f_oil_04', 'Shakar', 'yog', '🍬', 387, 0, 100, 0, 0, 100, 1, 2, 0, 'kg', 100, 12000),
  f('f_oil_05', 'Tuz', 'yog', '🧂', 0, 0, 0, 0, 0, 0, 38758, 2, 0, 'kg', 100, 3000),
  f('f_oil_06', 'Asal', 'yog', '🍯', 304, 0.3, 82, 0, 0.2, 82, 4, 2, 0, 'kg', 100, 90000),
  f('f_oil_07', 'Mayonez', 'yog', '🥫', 680, 1, 2.6, 75, 0, 1.5, 635, 4, 0, 'kg', 100, 35000),
  f('f_oil_08', 'Ketchup', 'yog', '🥫', 112, 1.3, 26, 0.2, 0.3, 22, 907, 4, 0, 'kg', 100, 30000),

  // ─────────────── MILLIY TAOMLAR (tayyor, 100 g) ───────────────
  f('f_dish_01', 'Osh (palov)', 'taom', '🍛', 210, 7, 24, 10, 1.4, 1.5, 320, 3, 0.25, 'kg', 250, 35000),
  f('f_dish_02', 'Somsa (go\'shtli)', 'taom', '🥟', 275, 10, 27, 14, 1.5, 1.2, 450, 3, 0.1, 'pieces', 150, 10000),
  f('f_dish_03', 'Somsa (kartoshkali)', 'taom', '🥟', 250, 6, 32, 11, 1.8, 1, 420, 3, 0.1, 'pieces', 150, 7000),
  f('f_dish_04', 'Manti', 'taom', '🥟', 195, 9, 22, 8, 1.2, 1, 380, 3, 0.15, 'pieces', 90, 5000),
  f('f_dish_05', 'Chuchvara', 'taom', '🥟', 180, 8, 21, 7, 1, 0.9, 400, 3, 0.15, 'kg', 250, 30000),
  f('f_dish_06', 'Lag\'mon', 'taom', '🍜', 135, 7, 16, 5, 1.6, 2, 480, 3, 0.5, 'kg', 350, 35000),
  f('f_dish_07', 'Norin', 'taom', '🍝', 175, 11, 19, 6, 1, 0.8, 420, 3, 0.1, 'kg', 300, 35000),
  f('f_dish_08', 'Mastava', 'taom', '🍲', 85, 4, 11, 3, 1, 1.2, 380, 3, 0.4, 'kg', 350, 25000),
  f('f_dish_09', 'Shurva', 'taom', '🍲', 75, 4.5, 6, 4, 0.9, 1.4, 400, 3, 0.5, 'kg', 350, 30000),
  f('f_dish_10', 'Shashlik (mol)', 'taom', '🍢', 240, 22, 2, 16, 0.2, 0.8, 520, 3, 0, 'pieces', 100, 25000),
  f('f_dish_11', 'Shashlik (tovuq)', 'taom', '🍢', 190, 24, 2, 9, 0.2, 0.8, 480, 3, 0, 'pieces', 100, 20000),
  f('f_dish_12', 'Kabob (lo\'la)', 'taom', '🍢', 270, 18, 3, 21, 0.3, 0.9, 550, 3, 0, 'pieces', 120, 25000),
  f('f_dish_13', 'Dimlama', 'taom', '🍲', 120, 7, 9, 6, 1.8, 2.5, 350, 3, 0.7, 'kg', 300, 30000),
  f('f_dish_14', 'Qovurma lag\'mon', 'taom', '🍜', 180, 8, 21, 7, 1.5, 2, 520, 3, 0.4, 'kg', 350, 38000),
  f('f_dish_15', 'Cho\'pon salat (achichuk)', 'taom', '🥗', 32, 0.9, 4.5, 1.3, 1.1, 2.8, 190, 1, 1.1, 'kg', 150, 12000),
  f('f_dish_16', 'Olivye salat', 'taom', '🥗', 198, 4.5, 9, 16, 1.3, 2.2, 420, 3, 0.3, 'kg', 150, 25000),
  f('f_dish_17', 'Non ushoq (barak)', 'taom', '🥟', 210, 8, 25, 9, 1.2, 1, 400, 3, 0.1, 'pieces', 100, 6000),
  f('f_dish_18', 'Tuxum qovurdoq', 'taom', '🍳', 196, 13, 1.5, 15, 0.2, 1, 210, 2, 0.05, 'kg', 150, 12000),
  f('f_dish_19', 'Qozon kabob', 'taom', '🍖', 285, 15, 12, 21, 1.2, 1, 480, 3, 0.2, 'kg', 300, 45000),
  f('f_dish_20', 'Sho\'rva (mosh)', 'taom', '🍲', 95, 5.5, 13, 2.5, 3.2, 1.5, 340, 3, 0.4, 'kg', 350, 22000),

  // ─────────────── FAST FOOD ───────────────
  f('f_fast_01', 'Lavash (tovuqli)', 'fastfud', '🌯', 215, 11, 22, 9, 1.5, 2.5, 620, 4, 0.25, 'pieces', 350, 30000),
  f('f_fast_02', 'Gamburger', 'fastfud', '🍔', 265, 12, 27, 12, 1.4, 5, 490, 4, 0.15, 'pieces', 220, 30000),
  f('f_fast_03', 'Xot-dog', 'fastfud', '🌭', 290, 10, 28, 16, 1.2, 5, 720, 4, 0.05, 'pieces', 150, 18000),
  f('f_fast_04', 'Pitsa (pepperoni)', 'fastfud', '🍕', 266, 11, 33, 10, 2.3, 3.6, 598, 4, 0.15, 'kg', 150, 45000),
  f('f_fast_05', 'Fri kartoshka', 'fastfud', '🍟', 312, 3.4, 41, 15, 3.8, 0.3, 210, 4, 0, 'kg', 150, 20000),
  f('f_fast_06', 'Naggets (tovuq)', 'fastfud', '🍗', 296, 15, 18, 19, 1, 0.5, 557, 4, 0, 'kg', 150, 40000),
  f('f_fast_07', 'Shaurma', 'fastfud', '🌯', 230, 12, 20, 11, 1.4, 2.2, 650, 4, 0.25, 'pieces', 300, 28000),
  f('f_fast_08', 'Instant lag\'mon (doshirak)', 'fastfud', '🍜', 448, 9, 60, 19, 2.6, 3, 1650, 4, 0, 'pieces', 90, 6000),
  f('f_fast_09', 'Chipsi', 'fastfud', '🥔', 536, 6.6, 53, 35, 4.4, 0.3, 525, 4, 0, 'kg', 100, 60000),
  f('f_fast_10', 'Krekker/sushka', 'fastfud', '🍘', 421, 9, 71, 11, 2.5, 5, 700, 4, 0, 'kg', 100, 35000),

  // ─────────────── ICHIMLIKLAR ───────────────
  f('f_drink_01', 'Suv', 'ichimlik', '💧', 0, 0, 0, 0, 0, 0, 2, 1, 0, 'kg', 250, 3000),
  f('f_drink_02', 'Ko\'k choy (shakarsiz)', 'ichimlik', '🍵', 1, 0, 0.2, 0, 0, 0, 3, 1, 0, 'kg', 250, 1000),
  f('f_drink_03', 'Cola / gazli ichimlik', 'ichimlik', '🥤', 42, 0, 11, 0, 0, 10.6, 4, 4, 0, 'kg', 500, 12000),
  f('f_drink_04', 'Energetik ichimlik', 'ichimlik', '⚡', 45, 0, 11, 0, 0, 11, 105, 4, 0, 'kg', 250, 20000),
  f('f_drink_05', 'Paket sharbat', 'ichimlik', '🧃', 46, 0.2, 11, 0.1, 0.2, 10, 5, 4, 0, 'kg', 200, 15000),
  f('f_drink_06', 'Kofe (sutsiz)', 'ichimlik', '☕', 2, 0.3, 0, 0, 0, 0, 5, 1, 0, 'kg', 200, 8000),
  f('f_drink_07', 'Kompot', 'ichimlik', '🥤', 60, 0.2, 15, 0, 0.2, 14, 3, 3, 0, 'kg', 250, 5000),
  f('f_drink_08', 'Pivo', 'ichimlik', '🍺', 43, 0.5, 3.6, 0, 0, 0, 4, 3, 0, 'kg', 500, 18000),

  // ─────────────── SHIRINLIKLAR ───────────────
  f('f_sweet_01', 'Shokolad (sutli)', 'shirinlik', '🍫', 535, 7.6, 59, 30, 3.4, 52, 79, 4, 0, 'kg', 100, 120000),
  f('f_sweet_02', 'Pechenye', 'shirinlik', '🍪', 470, 6, 65, 20, 2, 28, 320, 4, 0, 'kg', 100, 45000),
  f('f_sweet_03', 'Tort (kremli)', 'shirinlik', '🍰', 380, 4.5, 48, 19, 1, 32, 280, 4, 0, 'kg', 120, 80000),
  f('f_sweet_04', 'Muzqaymoq', 'shirinlik', '🍦', 207, 3.5, 24, 11, 0.7, 21, 80, 4, 0, 'kg', 100, 45000),
  f('f_sweet_05', 'Halva', 'shirinlik', '🍬', 516, 12, 54, 30, 4, 43, 195, 3, 0, 'kg', 100, 55000),
  f('f_sweet_06', 'Konfet (karamel)', 'shirinlik', '🍬', 385, 0.4, 95, 0.5, 0, 78, 45, 4, 0, 'kg', 100, 50000),
  f('f_sweet_07', 'Navat', 'shirinlik', '🍬', 387, 0, 100, 0, 0, 100, 1, 2, 0, 'kg', 100, 25000),
  f('f_sweet_08', 'Chak-chak / bog\'irsoq', 'shirinlik', '🍩', 420, 6, 60, 18, 1.2, 30, 210, 3, 0, 'kg', 100, 40000),
  f('f_sweet_09', 'Varenye (murabbo)', 'shirinlik', '🍯', 265, 0.3, 68, 0.1, 0.6, 65, 8, 3, 0, 'kg', 100, 35000),
  f('f_sweet_10', 'Sambusa (shirin)', 'shirinlik', '🥮', 380, 6, 52, 16, 1.5, 22, 250, 3, 0, 'pieces', 100, 8000),
];

/** Nomi bo'yicha qidirish uchun normalizatsiya. */
export function normalizeFoodName(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’`]/g, "'")
    .replace(/[^a-zа-я0-9' ]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** AI promptlariga qo'shiladigan qisqa narx tayanchi (eng ko'p ishlatiladigan mahsulotlar). */
export const PRICE_ANCHORS = FOODS.filter((x) =>
  [
    'f_meat_01', 'f_meat_04', 'f_meat_06', 'f_dairy_01', 'f_dairy_02', 'f_dairy_03',
    'f_grain_01', 'f_grain_04', 'f_grain_08', 'f_veg_01', 'f_veg_02', 'f_veg_05',
    'f_fruit_01', 'f_oil_02', 'f_dish_01', 'f_dish_02', 'f_fast_01', 'f_drink_03',
  ].includes(x.id)
)
  .map((x) => `${x.name}: ${x.pricePerUnit.toLocaleString('ru-RU')} so'm/${x.unit === 'pieces' ? 'dona' : 'kg'}`)
  .join('; ');
