import 'package:flutter/material.dart';
import 'theme.dart';

/// UNUM'ning "profilaktik" qatlami.
///
/// Bu yerdagi hamma narsa DETERMINISTIK hisoblanadi — AI chaqirilmaydi.
/// Sabablari Score bilan bir xil: bir xil ma'lumot har doim bir xil natija
/// beradi, internetsiz ishlaydi va hech qanday token sarflamaydi.
/// AI faqat topilgan xulosani *tushuntiradi*.
///
/// ⚠️ Huquqiy chegara: bu yerda hech qachon tashxis qo'yilmaydi. Faqat
/// "iste'molingiz tavsiya etilgan me'yordan yuqori" tipidagi kuzatuv beriladi.

/// Bir kunning yig'ma ko'rsatkichlari.
class DayRecord {
  final DateTime date;
  final double calories;
  final double protein;
  final double sugar;
  final double sodium;
  final double vegServings;
  final double upfCalories;
  final double water;
  final double cost;
  final int steps;
  final int activeMinutes;
  final int screenMinutes;
  final int score;
  final bool hasData;

  const DayRecord({
    required this.date,
    this.calories = 0,
    this.protein = 0,
    this.sugar = 0,
    this.sodium = 0,
    this.vegServings = 0,
    this.upfCalories = 0,
    this.water = 0,
    this.cost = 0,
    this.steps = 0,
    this.activeMinutes = 0,
    this.screenMinutes = 0,
    this.score = 0,
    this.hasData = false,
  });

  double get upfShare => calories <= 0 ? 0 : (upfCalories / calories).clamp(0, 1);
}

// ─────────────────────────── XAVF RADARI ───────────────────────────

enum RiskLevel { info, watch, high }

class HealthRisk {
  final String id;
  final String title;

  /// Nima kuzatilgani — raqam bilan, ayblovsiz.
  final String finding;

  /// Nima qilish kerak — bitta aniq qadam.
  final String action;
  final RiskLevel level;
  final IconData icon;

  const HealthRisk({
    required this.id,
    required this.title,
    required this.finding,
    required this.action,
    required this.level,
    required this.icon,
  });

  Color get color => switch (level) {
        RiskLevel.high => AppColors.red,
        RiskLevel.watch => AppColors.orange,
        RiskLevel.info => AppColors.sky,
      };

  String get levelLabel => switch (level) {
        RiskLevel.high => 'Yuqori',
        RiskLevel.watch => 'E\'tibor bering',
        RiskLevel.info => 'Ma\'lumot',
      };
}

/// So'nggi 14 kun bo'yicha xavf radari.
///
/// Kamida 3 kunlik ma'lumot bo'lmasa bo'sh qaytaradi — 1 kunlik ovqatdan
/// uzoq muddatli xulosa chiqarish noto'g'ri bo'lardi.
List<HealthRisk> analyzeRisks({
  required List<DayRecord> days,
  required double targetProtein,
  required double targetWater,
}) {
  final tracked = days.where((d) => d.hasData).toList();
  if (tracked.length < 3) return const [];

  final n = tracked.length;
  double avg(double Function(DayRecord) f) =>
      tracked.fold<double>(0, (s, d) => s + f(d)) / n;

  final risks = <HealthRisk>[];

  // ── Shakar (WHO: qo'shilgan shakar kunlik energiyaning 10% dan kam) ──
  final sugar = avg((d) => d.sugar);
  if (sugar > 75) {
    risks.add(HealthRisk(
      id: 'sugar',
      title: 'Shakar iste\'moli yuqori',
      finding: 'So\'nggi $n kunda o\'rtacha kuniga ${sugar.round()} g shakar '
          'iste\'mol qildingiz. Tavsiya etilgan me\'yor — 25 g.',
      action: 'Gazli ichimlik va paket sharbatni suvga yoki ko\'k choyga '
          'almashtiring — bu odatda kunlik shakarning yarmini olib tashlaydi.',
      level: RiskLevel.high,
      icon: Icons.icecream_rounded,
    ));
  } else if (sugar > 45) {
    risks.add(HealthRisk(
      id: 'sugar',
      title: 'Shakar me\'yordan yuqori',
      finding: 'O\'rtacha kuniga ${sugar.round()} g — me\'yor 25 g.',
      action: 'Kuniga bitta shirinlikni mevaga almashtiring.',
      level: RiskLevel.watch,
      icon: Icons.icecream_rounded,
    ));
  }

  // ── Natriy (WHO: kuniga 2000 mg dan kam, ya'ni ~5 g tuz) ──
  final sodium = avg((d) => d.sodium);
  if (sodium > 3500) {
    risks.add(HealthRisk(
      id: 'sodium',
      title: 'Tuz iste\'moli yuqori',
      finding: 'O\'rtacha kuniga ${sodium.round()} mg natriy '
          '(≈ ${(sodium * 2.5 / 1000).toStringAsFixed(1)} g tuz). '
          'WHO me\'yori — 2000 mg.',
      action: 'Tayyor taom, kolbasa va tuzlangan mahsulotlarni kamaytiring. '
          'Uyda pishirganda tuzni oxirida qo\'shing.',
      level: RiskLevel.high,
      icon: Icons.grain_rounded,
    ));
  } else if (sodium > 2400) {
    risks.add(HealthRisk(
      id: 'sodium',
      title: 'Tuz me\'yordan yuqori',
      finding: 'O\'rtacha kuniga ${sodium.round()} mg natriy — me\'yor 2000 mg.',
      action: 'Tashqarida ovqatlanishni haftada bir-ikki martaga qisqartiring.',
      level: RiskLevel.watch,
      icon: Icons.grain_rounded,
    ));
  }

  // ── Sabzavot va meva (kuniga 5 portsiya) ──
  final veg = avg((d) => d.vegServings);
  if (veg < 1.5) {
    risks.add(HealthRisk(
      id: 'veg',
      title: 'Sabzavot va meva juda kam',
      finding: 'So\'nggi $n kunda kuniga o\'rtacha atigi '
          '${veg.toStringAsFixed(1)} portsiya. Tavsiya — 5 portsiya.',
      action: 'Har taomga bitta sabzavot qo\'shing: cho\'pon salat, bodring '
          'yoki pomidor. Bu eng oson 2 portsiya.',
      level: RiskLevel.high,
      icon: Icons.eco_rounded,
    ));
  } else if (veg < 3) {
    risks.add(HealthRisk(
      id: 'veg',
      title: 'Sabzavot me\'yordan kam',
      finding: 'Kuniga o\'rtacha ${veg.toStringAsFixed(1)} / 5 portsiya.',
      action: 'Kuniga 1 ta meva qo\'shsangiz, me\'yorga yaqinlashasiz.',
      level: RiskLevel.watch,
      icon: Icons.eco_rounded,
    ));
  }

  // ── Ultra-qayta ishlangan ovqat (NOVA-4) ──
  final upf = avg((d) => d.upfShare);
  if (upf > 0.45) {
    risks.add(HealthRisk(
      id: 'upf',
      title: 'Ultra-qayta ishlangan ovqat ko\'p',
      finding: 'Kaloriyangizning ${(upf * 100).round()}% i fast food, gazli '
          'ichimlik va sanoat shirinliklaridan kelmoqda.',
      action: 'Haftada 2 kunni "uy taomi kuni" qilib belgilang.',
      level: RiskLevel.high,
      icon: Icons.fastfood_rounded,
    ));
  } else if (upf > 0.28) {
    risks.add(HealthRisk(
      id: 'upf',
      title: 'Qayta ishlangan ovqat ulushi oshgan',
      finding: 'Kaloriyangizning ${(upf * 100).round()}% i — me\'yor 20%.',
      action: 'Gazak sifatida chipsi o\'rniga yong\'oq yoki meva tanlang.',
      level: RiskLevel.watch,
      icon: Icons.fastfood_rounded,
    ));
  }

  // ── Oqsil ──
  final protein = avg((d) => d.protein);
  if (targetProtein > 0 && protein < targetProtein * 0.6) {
    risks.add(HealthRisk(
      id: 'protein',
      title: 'Oqsil yetishmayapti',
      finding: 'Kuniga o\'rtacha ${protein.round()} g — sizga kerak '
          '${targetProtein.round()} g. Bu mushak massasini yo\'qotishga '
          'olib kelishi mumkin.',
      action: 'Nonushtaga 2 ta tuxum yoki 200 g tvorog qo\'shing.',
      level: RiskLevel.watch,
      icon: Icons.egg_alt_rounded,
    ));
  }

  // ── Suv ──
  final water = avg((d) => d.water);
  if (targetWater > 0 && water < targetWater * 0.55) {
    risks.add(HealthRisk(
      id: 'water',
      title: 'Suv kam ichyapsiz',
      finding: 'Kuniga o\'rtacha ${water.round()} ml — sizga kerak '
          '${targetWater.round()} ml.',
      action: 'Stolingizga 0.5 l shisha qo\'ying va uni kuniga 4 marta '
          'to\'ldiring.',
      level: RiskLevel.watch,
      icon: Icons.water_drop_rounded,
    ));
  }

  // ── Harakat ──
  final steps = avg((d) => d.steps.toDouble());
  final anySteps = tracked.any((d) => d.steps > 0);
  if (anySteps && steps < 4000) {
    risks.add(HealthRisk(
      id: 'steps',
      title: 'Harakat juda kam',
      finding: 'Kuniga o\'rtacha ${steps.round()} qadam. '
          'Sog\'liq uchun tavsiya — 8000.',
      action: 'Kuniga 20 daqiqalik sayr ≈ 2000 qadam qo\'shadi.',
      level: RiskLevel.high,
      icon: Icons.directions_walk_rounded,
    ));
  }

  // ── Ekran vaqti ──
  final screen = avg((d) => d.screenMinutes.toDouble());
  final anyScreen = tracked.any((d) => d.screenMinutes > 0);
  if (anyScreen && screen > 300) {
    risks.add(HealthRisk(
      id: 'screen',
      title: 'Telefonda ko\'p vaqt',
      finding: 'Kuniga o\'rtacha ${(screen / 60).toStringAsFixed(1)} soat '
          'telefonda. Bu uyquga va harakatga ta\'sir qiladi.',
      action: 'Uxlashdan 1 soat oldin telefonni chetga qo\'ying.',
      level: RiskLevel.watch,
      icon: Icons.smartphone_rounded,
    ));
  }

  // Eng jiddiylari tepada tursin.
  risks.sort((a, b) => b.level.index.compareTo(a.level.index));
  return risks;
}

// ─────────────────────────── TREND VA PROGNOZ ───────────────────────────

class ProgressStats {
  /// Kunlik ball nuqtalari (eski → yangi), faqat ma'lumot bor kunlar.
  final List<DayRecord> tracked;

  final double avgScore;
  final double avgScorePrevWeek;

  /// O'rtacha ballning oldingi haftaga nisbatan o'zgarishi.
  final double scoreDelta;

  final int daysTracked;
  final int mealsLogged;
  final int bestScore;

  /// Vazn: boshlang'ich, joriy, maqsad.
  final double startWeight;
  final double currentWeight;
  final double goalWeight;

  /// Joriy sur'atda maqsadga yetish uchun taxminiy hafta soni.
  /// `null` — ma'lumot yetarli emas yoki yo'nalish noto'g'ri.
  final int? weeksToGoal;

  /// Kunlik o'rtacha kaloriya taqchilligi (manfiy = profitsit).
  final double avgDeficit;

  /// So'nggi 30 kunda oziq-ovqatga sarflangan pul (so'm).
  final double spent30d;

  const ProgressStats({
    required this.tracked,
    required this.avgScore,
    required this.avgScorePrevWeek,
    required this.scoreDelta,
    required this.daysTracked,
    required this.mealsLogged,
    required this.bestScore,
    required this.startWeight,
    required this.currentWeight,
    required this.goalWeight,
    required this.weeksToGoal,
    required this.avgDeficit,
    required this.spent30d,
  });

  double get weightChange => currentWeight - startWeight;
  bool get hasEnoughForTrend => daysTracked >= 3;

  /// Foydalanuvchi ko'radigan bitta jumla: "UNUM menga nima berdi?".
  String get headline {
    if (daysTracked < 2) {
      return 'Bir necha kun kuzatuvdan keyin bu yerda progressingiz ko\'rinadi.';
    }
    if (scoreDelta >= 5) {
      return 'Ballingiz o\'tgan haftaga nisbatan ${scoreDelta.round()} punktga '
          'o\'sdi — sog\'lom odat shakllanmoqda.';
    }
    if (scoreDelta <= -5) {
      return 'Ballingiz ${scoreDelta.abs().round()} punktga tushdi. '
          'Bu tuzatiladigan narsa — quyida nimadan boshlashni ko\'rsatdik.';
    }
    if (avgScore >= 75) {
      return 'O\'rtacha ballingiz ${avgScore.round()} — barqaror yaxshi daraja.';
    }
    return 'O\'rtacha ballingiz ${avgScore.round()}. Kichik o\'zgarishlar '
        'bilan buni 80 dan yuqoriga chiqarish mumkin.';
  }
}

ProgressStats computeProgress({
  required List<DayRecord> days, // eski → yangi
  required int mealsLogged,
  required double startWeight,
  required double currentWeight,
  required double goalWeight,
  required double targetCalories,
}) {
  final tracked = days.where((d) => d.hasData).toList();

  double mean(Iterable<DayRecord> xs) => xs.isEmpty
      ? 0
      : xs.fold<double>(0, (s, d) => s + d.score) / xs.length;

  // So'nggi 7 kun va undan oldingi 7 kun.
  final last7 = tracked.length <= 7
      ? tracked
      : tracked.sublist(tracked.length - 7);
  final prev7 = tracked.length <= 7
      ? <DayRecord>[]
      : tracked.sublist(
          (tracked.length - 14).clamp(0, tracked.length), tracked.length - 7);

  final avgScore = mean(last7);
  final avgPrev = mean(prev7);

  // Kaloriya taqchilligi → vazn prognozi. 1 kg yog' ≈ 7700 kkal.
  final withFood = tracked.where((d) => d.calories > 0).toList();
  final avgIntake = withFood.isEmpty
      ? 0.0
      : withFood.fold<double>(0, (s, d) => s + d.calories) / withFood.length;
  // targetCalories allaqachon maqsadga moslangan (taqchillik ichida).
  // Saqlash darajasini taxminan tiklaymiz.
  final maintenance = goalWeight < currentWeight
      ? targetCalories / 0.8
      : goalWeight > currentWeight
          ? targetCalories / 1.12
          : targetCalories;
  final avgDeficit = withFood.isEmpty ? 0.0 : maintenance - avgIntake;

  int? weeks;
  final kgToGo = (currentWeight - goalWeight).abs();
  if (withFood.length >= 3 && kgToGo > 0.3) {
    final needLoss = goalWeight < currentWeight;
    final movingRightWay = needLoss ? avgDeficit > 100 : avgDeficit < -100;
    if (movingRightWay) {
      final kcalPerWeek = avgDeficit.abs() * 7;
      final kgPerWeek = kcalPerWeek / 7700;
      if (kgPerWeek > 0.02) {
        weeks = (kgToGo / kgPerWeek).ceil().clamp(1, 260);
      }
    }
  }

  final last30 = tracked.length <= 30
      ? tracked
      : tracked.sublist(tracked.length - 30);

  return ProgressStats(
    tracked: tracked,
    avgScore: avgScore,
    avgScorePrevWeek: avgPrev,
    scoreDelta: prev7.isEmpty ? 0 : avgScore - avgPrev,
    daysTracked: tracked.length,
    mealsLogged: mealsLogged,
    bestScore: tracked.isEmpty
        ? 0
        : tracked.map((d) => d.score).reduce((a, b) => a > b ? a : b),
    startWeight: startWeight,
    currentWeight: currentWeight,
    goalWeight: goalWeight,
    weeksToGoal: weeks,
    avgDeficit: avgDeficit,
    spent30d: last30.fold<double>(0, (s, d) => s + d.cost),
  );
}

// ─────────────────────────── KUNLIK VAZIFALAR ───────────────────────────

class DailyMission {
  final String id;
  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;
  final int xp;

  /// 0..1 — bugungi bajarilish darajasi.
  final double progress;

  const DailyMission({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.color,
    required this.xp,
    required this.progress,
  });

  bool get done => progress >= 1;
}

/// Bugungi 3 ta vazifa.
///
/// Vazifalar tasodifiy emas — foydalanuvchining eng zaif tomonidan tanlanadi,
/// shuning uchun ularni bajarish haqiqatan ballni ko'taradi.
List<DailyMission> buildMissions({
  required double calories,
  required double targetCalories,
  required double protein,
  required double targetProtein,
  required double vegServings,
  required double sugar,
  required double water,
  required double targetWater,
  required int steps,
  required int mealsToday,
}) {
  final all = <DailyMission>[
    DailyMission(
      id: 'log',
      title: '3 ta taom kiriting',
      subtitle: 'Kunni to\'liq ko\'rish uchun',
      icon: Icons.restaurant_rounded,
      color: AppColors.sky,
      xp: 20,
      progress: (mealsToday / 3).clamp(0.0, 1.0),
    ),
    DailyMission(
      id: 'protein',
      title: 'Oqsil me\'yorini bajaring',
      subtitle: '${protein.round()} / ${targetProtein.round()} g',
      icon: Icons.egg_alt_rounded,
      color: AppColors.protein,
      xp: 25,
      progress:
          targetProtein <= 0 ? 0 : (protein / targetProtein).clamp(0.0, 1.0),
    ),
    DailyMission(
      id: 'veg',
      title: '5 portsiya sabzavot va meva',
      subtitle: '${vegServings.toStringAsFixed(1)} / 5 portsiya',
      icon: Icons.eco_rounded,
      color: AppColors.emerald,
      xp: 25,
      progress: (vegServings / 5).clamp(0.0, 1.0),
    ),
    DailyMission(
      id: 'water',
      title: 'Suv me\'yorini iching',
      subtitle: '${water.round()} / ${targetWater.round()} ml',
      icon: Icons.water_drop_rounded,
      color: AppColors.sky,
      xp: 15,
      progress: targetWater <= 0 ? 0 : (water / targetWater).clamp(0.0, 1.0),
    ),
    DailyMission(
      id: 'steps',
      title: '8 000 qadam yuring',
      subtitle: '$steps / 8 000 qadam',
      icon: Icons.directions_walk_rounded,
      color: AppColors.violet,
      xp: 25,
      progress: (steps / 8000).clamp(0.0, 1.0),
    ),
    DailyMission(
      id: 'sugar',
      title: 'Shakarni 25 g dan past ushlang',
      subtitle: 'Hozir ${sugar.round()} g',
      icon: Icons.icecream_rounded,
      color: AppColors.pink,
      xp: 20,
      // Kun oxirigacha me'yordan oshmagan bo'lsa bajarilgan hisoblanadi.
      progress: sugar <= 25 ? 1 : (25 / sugar).clamp(0.0, 0.99),
    ),
  ];

  // Bajarilmaganlari oldinga — foydalanuvchi nima qilishi kerakligini ko'radi.
  all.sort((a, b) => a.progress.compareTo(b.progress));
  return all.take(3).toList();
}
