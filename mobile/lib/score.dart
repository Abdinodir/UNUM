import 'package:flutter/material.dart';
import 'theme.dart';

/// UNUM Health Score — kunlik 0..100 ball.
///
/// Ball AI tomonidan EMAS, shu yerda deterministik hisoblanadi. Sabablari:
///   • bir xil kun har doim bir xil ball beradi (foydalanuvchi ishonadi);
///   • internetsiz ham ishlaydi;
///   • hech qanday token sarflamaydi.
/// AI faqat ballni TUSHUNTIRADI va uni qanday ko'tarishni maslahat beradi.
///
/// Komponentlar va ularning ilmiy asosi:
///   Oqsil 20      — vazn kamayganda mushak massasini saqlash (1.6-2.2 g/kg)
///   Sabzavot 20   — kuniga 5 portsiya sabzavot/meva (WHO tavsiyasi)
///   Shakar 15     — qo'shilgan shakar kunlik energiyaning 10% dan kam (WHO)
///   UPF 15        — ultra-qayta ishlangan ovqat ulushi (NOVA-4)
///   Suv 10        — taxminan 30 ml/kg
///   Harakat 20    — 8000 qadam + 30 daqiqa faollik
class ScoreComponent {
  final String id;
  final String label;
  final double earned;
  final double max;

  /// Foydalanuvchi ko'radigan qisqa izoh, masalan "126 g / 126 g".
  final String detail;

  /// Ballni ko'tarish uchun aniq maslahat (to'liq ball olinmagan bo'lsa).
  final String? advice;
  final IconData icon;
  final Color color;

  const ScoreComponent({
    required this.id,
    required this.label,
    required this.earned,
    required this.max,
    required this.detail,
    required this.icon,
    required this.color,
    this.advice,
  });

  double get ratio => max <= 0 ? 0 : (earned / max).clamp(0.0, 1.0);
  bool get isFull => earned >= max - 0.5;
}

class UnumScore {
  /// Kunlik ball, 0..100.
  final int total;

  /// Kun uchun yetarli ma'lumot bormi. Hech narsa kiritilmagan bo'lsa `false`
  /// bo'ladi va ball ko'rsatilmaydi — 0 kkal uchun yuqori ball berish
  /// foydalanuvchini ovqat yemaslikka undagan bo'lardi.
  final bool hasData;

  final List<ScoreComponent> components;

  const UnumScore({
    required this.total,
    required this.hasData,
    required this.components,
  });

  /// Ballning og'zaki bahosi.
  String get grade {
    if (!hasData) return 'Ma\'lumot yo\'q';
    if (total >= 90) return 'Ajoyib';
    if (total >= 75) return 'Yaxshi';
    if (total >= 60) return 'O\'rtacha';
    if (total >= 40) return 'Past';
    return 'Juda past';
  }

  Color get color {
    if (!hasData) return AppColors.slate400;
    if (total >= 90) return AppColors.emerald;
    if (total >= 75) return const Color(0xFF84CC16);
    if (total >= 60) return AppColors.amber;
    if (total >= 40) return AppColors.orange;
    return AppColors.red;
  }

  /// Eng ko'p ball yo'qotilgan komponent — "nimani tuzatsam bo'ladi?" javobi.
  ScoreComponent? get weakest {
    final incomplete = components.where((c) => !c.isFull).toList();
    if (incomplete.isEmpty) return null;
    incomplete.sort((a, b) => (b.max - b.earned).compareTo(a.max - a.earned));
    return incomplete.first;
  }
}

/// Oqsil kamomadiga MOS keladigan taklif.
///
/// Ilgari bu qatorda kamomad hajmidan qat'i nazar "2 ta tuxum yoki 150 g tvorog"
/// deb yozilardi — 149 g yetishmayotganda ham. Endi taklif haqiqiy miqdorga
/// qarab tanlanadi va oqsil zichligi ko'rsatiladi, shunda foydalanuvchi
/// istalgan mahsulot bilan hisoblay oladi.
String _proteinAdvice(double gap) {
  final g = gap.round();
  if (g <= 15) {
    return 'Yana $g g oqsil kerak — 2 ta tuxum (13 g) yoki '
        '100 g tvorog (17 g) yetadi.';
  }
  if (g <= 40) {
    return 'Yana $g g oqsil kerak — 150 g tovuq ko\'kragi (46 g) yoki '
        '200 g tvorog (34 g).';
  }
  if (g <= 80) {
    return 'Yana $g g oqsil kerak — 200 g tovuq (62 g) va 200 g tvorog (34 g) '
        'birga yetarli bo\'ladi.';
  }
  return 'Yana $g g oqsil kerak — bu bir taomga ko\'p, kunga taqsimlang. '
      'Tayanch: 100 g tovuq ≈ 31 g, 100 g tvorog ≈ 17 g, 1 tuxum ≈ 6 g.';
}

/// Sabzavot/meva kamomadiga mos taklif. 1 portsiya = 80 g.
String _vegAdvice(double gap) {
  final p = gap.toStringAsFixed(1);
  if (gap <= 1.5) {
    return 'Yana $p portsiya kerak — 1 ta olma yoki 1 kosa cho\'pon salat.';
  }
  if (gap <= 3) {
    return 'Yana $p portsiya kerak — cho\'pon salat (1.5) va 1 ta olma (1.25).';
  }
  return 'Yana $p portsiya kerak. 1 portsiya = 80 g: har taomga sabzavot '
      'qo\'shing va kuniga 2 ta meva yeng.';
}

/// Ikki nuqta orasida chiziqli pasayuvchi ball: `good` da to'liq, `bad` da nol.
double _decline(double value, {required double good, required double bad}) {
  if (value <= good) return 1;
  if (value >= bad) return 0;
  return (bad - value) / (bad - good);
}

UnumScore computeUnumScore({
  required double calories,
  required double targetCalories,
  required double protein,
  required double targetProtein,
  required double vegServings,
  required double sugar,
  required double upfCalories,
  required double waterMl,
  required double targetWaterMl,
  required int steps,
  required int activeMinutes,
}) {
  final hasData = calories > 0 || waterMl > 0 || steps > 0 || activeMinutes > 0;

  // ── Oqsil (20) ──
  final proteinRatio =
      targetProtein <= 0 ? 0.0 : (protein / targetProtein).clamp(0.0, 1.0);
  final proteinPts = proteinRatio * 20;

  // ── Sabzavot va meva (20) ── 5 portsiya = to'liq ball
  final vegRatio = (vegServings / 5).clamp(0.0, 1.0);
  final vegPts = vegRatio * 20;

  // "Ovqat yemasam ball yuqori bo'ladi" holatining oldini olish: toza
  // ovqatlanish komponentlari (shakar va UPF) kaloriya maqsadining kamida
  // yarmi kiritilgandagina to'liq ball beradi.
  final adequacy = targetCalories <= 0
      ? 1.0
      : (calories / (targetCalories * 0.5)).clamp(0.0, 1.0);

  // ── Qo'shilgan shakar (15) ── 25 g gacha to'liq, 75 g da nol
  final sugarPts = _decline(sugar, good: 25, bad: 75) * 15 * adequacy;

  // ── Ultra-qayta ishlangan ovqat ulushi (15) ── 20% gacha to'liq, 50% da nol
  final upfShare = calories <= 0 ? 0.0 : (upfCalories / calories).clamp(0.0, 1.0);
  final upfPts = _decline(upfShare, good: 0.20, bad: 0.50) * 15 * adequacy;

  // ── Suv (10) ──
  final waterRatio =
      targetWaterMl <= 0 ? 0.0 : (waterMl / targetWaterMl).clamp(0.0, 1.0);
  final waterPts = waterRatio * 10;

  // ── Harakat (20) ── qadam 12 + faol daqiqa 8
  final stepRatio = (steps / 8000).clamp(0.0, 1.0);
  final activeRatio = (activeMinutes / 30).clamp(0.0, 1.0);
  final movePts = stepRatio * 12 + activeRatio * 8;

  final components = <ScoreComponent>[
    ScoreComponent(
      id: 'protein',
      label: 'Oqsil',
      earned: proteinPts,
      max: 20,
      detail: '${protein.round()} g / ${targetProtein.round()} g',
      icon: Icons.egg_alt_rounded,
      color: AppColors.sky,
      advice: proteinRatio >= 1 ? null : _proteinAdvice(targetProtein - protein),
    ),
    ScoreComponent(
      id: 'veg',
      label: 'Sabzavot va meva',
      earned: vegPts,
      max: 20,
      detail: '${vegServings.toStringAsFixed(1)} / 5 portsiya',
      icon: Icons.eco_rounded,
      color: AppColors.emerald,
      advice: vegRatio >= 1 ? null : _vegAdvice(5 - vegServings),
    ),
    ScoreComponent(
      id: 'sugar',
      label: 'Shakar',
      earned: sugarPts,
      max: 15,
      detail: '${sugar.round()} g (me\'yor 25 g)',
      icon: Icons.icecream_rounded,
      color: AppColors.pink,
      advice: sugar <= 25
          ? null
          : 'Bugun ${(sugar - 25).round()} g ortiqcha shakar. Gazli ichimlik '
              'va shirinlikni suv yoki mevaga almashtiring.',
    ),
    ScoreComponent(
      id: 'upf',
      label: 'Tabiiy ovqat',
      earned: upfPts,
      max: 15,
      detail:
          'Qayta ishlangan ovqat: ${(upfShare * 100).round()}% (me\'yor 20%)',
      icon: Icons.restaurant_rounded,
      color: AppColors.amber,
      advice: upfShare <= 0.20
          ? null
          : 'Kaloriyangizning ${(upfShare * 100).round()}% i ultra-qayta '
              'ishlangan ovqatdan. Uyda pishirilgan taomga o\'ting.',
    ),
    ScoreComponent(
      id: 'water',
      label: 'Suv',
      earned: waterPts,
      max: 10,
      detail: '${waterMl.round()} / ${targetWaterMl.round()} ml',
      icon: Icons.water_drop_rounded,
      color: AppColors.sky,
      advice: waterRatio >= 1
          ? null
          : 'Yana ${((targetWaterMl - waterMl) / 250).ceil()} stakan suv iching.',
    ),
    ScoreComponent(
      id: 'move',
      label: 'Harakat',
      earned: movePts,
      max: 20,
      detail: '$steps qadam · $activeMinutes daqiqa',
      icon: Icons.directions_walk_rounded,
      color: AppColors.violet,
      advice: (stepRatio >= 1 && activeRatio >= 1)
          ? null
          : steps < 8000
              ? '${8000 - steps} qadam qoldi — 20 daqiqalik sayr yetarli.'
              : 'Yana ${30 - activeMinutes} daqiqa faol harakat qiling.',
    ),
  ];

  final total = components.fold<double>(0, (s, c) => s + c.earned).round();

  return UnumScore(
    total: hasData ? total.clamp(0, 100) : 0,
    hasData: hasData,
    components: components,
  );
}
