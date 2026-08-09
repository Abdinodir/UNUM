import 'dart:math' as math;

import '../pillars.dart';
import '../state/app_state.dart';
import 'tokens.dart';

/// Bitta metrikaning ekranda ko'rsatiladigan holati.
///
/// Bu qatlam `AppState` dagi xom ma'lumotni yangi dizayndagi beshta yo'nalishga
/// aylantiradi. Hisob-kitob mantig'i shu yerda jamlangan — ekranlar faqat
/// tayyor matn va foizni ko'rsatadi.
class MetricState {
  const MetricState({
    required this.key,
    required this.percent,
    required this.valueText,
    required this.remainderText,
    this.hasData = true,
    this.inverted = false,
  });

  final MetricKey key;

  /// 0–100
  final int percent;

  /// TESKARI metrika: qiymat kattalashsa YOMON (masalan ekran vaqti).
  /// Foiz baribir "qanchalik yaxshi" ni bildiradi, bu bayroq esa
  /// ekranga qanday izohlashni aytadi.
  final bool inverted;

  /// "1 650 / 2 100 kkal" ko'rinishidagi matn
  final String valueText;

  /// "450 kkal qoldi" ko'rinishidagi qoldiq
  final String remainderText;

  /// Ma'lumot manbai ulanmagan bo'lsa `false` — foiz o'rniga izoh ko'rsatiladi
  final bool hasData;
}

/// Qadam maqsadi. `score.dart` dagi ball shu qiymatdan hisoblanadi —
/// ekranda boshqa raqam ko'rsatsak, foydalanuvchi maqsadga yetgandek
/// ko'rinib, ball esa to'lmay qolardi.
const int kStepGoal = 8000;

/// Kunlik fokus (rivojlanish) maqsadi — `pillars.dart` bilan bir xil
const int kFocusGoalMinutes = 120;

/// Uyqu maqsadi
const double kSleepGoalHours = 8;

/// Kunlik ekran vaqti me'yori. Undan oshgani ballni pasaytiradi.
const int kScreenLimitMinutes = 240;

String _n(num v) {
  // Minglarni bo'sh joy bilan ajratamiz: 6500 → "6 500"
  final s = v.round().toString();
  final buf = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) buf.write(' ');
    buf.write(s[i]);
  }
  return buf.toString();
}

String _hm(int minutes) {
  final h = minutes ~/ 60;
  final m = minutes % 60;
  if (h == 0) return '$m daqiqa';
  if (m == 0) return '$h soat';
  return '$h soat $m daqiqa';
}

int _pct(num value, num target) {
  if (target <= 0) return 0;
  return (value / target * 100).clamp(0, 100).round();
}

/// `AppState` dan beshta metrikani hisoblab beradi.
Map<MetricKey, MetricState> buildMetrics(AppState app) {
  final screenMinutes = app.screenMinutes;
  // ---- Ovqatlanish: kunlik kaloriya me'yori ----
  final cal = app.caloriesToday;
  final calTarget = app.profile.targetCalories.toDouble();
  final calLeft = math.max(0, calTarget - cal);

  // ---- Qadam ----
  final steps = app.stepsToday;
  final stepsLeft = math.max(0, kStepGoal - steps);

  // ---- Uyqu: oxirgi yozuv ----
  final sleptMinutes = app.lastSleep?.minutes ?? 0;
  final sleepGoalMinutes = (kSleepGoalHours * 60).round();
  final sleepLeft = math.max(0, sleepGoalMinutes - sleptMinutes);

  // ---- Maqsadlar: kunlik fokus daqiqalari ----
  final focusMinutes = app.todayFocus.fold<int>(0, (s, f) => s + f.minutes);
  final focusLeft = math.max(0, kFocusGoalMinutes - focusMinutes);

  // Ovqatlanishda ORTIQCHA yeyish ham kamchilik. Oddiy `_pct` me'yordan
  // oshganini 100% ga qirqib tashlardi va 8 000 kkal "mukammal ovqatlanish"
  // bo'lib ko'rinardi. Endi me'yorda 100%, undan oshgan sari pasayadi:
  // ikki barobar oshsa 0 ga tushadi.
  final calOver = calTarget <= 0 ? 0.0 : (cal - calTarget) / calTarget;
  final calPercent = calTarget <= 0
      ? 0
      : cal <= calTarget
          ? _pct(cal, calTarget)
          : (100 * (1 - calOver)).clamp(0, 100).round();

  return {
    MetricKey.nutrition: MetricState(
      key: MetricKey.nutrition,
      percent: calPercent,
      valueText: '${_n(cal)} / ${_n(calTarget)} kkal',
      remainderText: cal > calTarget
          ? '${_n(cal - calTarget)} kkal ortiqcha'
          : calLeft > 0
              ? '${_n(calLeft)} kkal qoldi'
              : 'Me\'yor bajarildi',
      hasData: true,
    ),
    MetricKey.steps: MetricState(
      key: MetricKey.steps,
      percent: _pct(steps, kStepGoal),
      valueText: '${_n(steps)} / ${_n(kStepGoal)} qadam',
      remainderText: stepsLeft > 0 ? '${_n(stepsLeft)} qadam qoldi' : 'Maqsad bajarildi',
      hasData: true,
    ),
    MetricKey.sleep: MetricState(
      key: MetricKey.sleep,
      percent: _pct(sleptMinutes, sleepGoalMinutes),
      valueText: sleptMinutes > 0
          ? '${_hm(sleptMinutes)} / ${kSleepGoalHours.round()} soat'
          : 'Yozuv yo\'q',
      remainderText: sleptMinutes > 0
          ? (sleepLeft > 0 ? '${_hm(sleepLeft)} qoldi' : 'Yetarli uxladingiz')
          : 'Uyquni qayd eting',
      hasData: sleptMinutes > 0,
    ),
    // Screen Time — `UsageStatsManager` dan (native kanal). Ruxsat
    // berilmagan bo'lsa `null` keladi va biz NOL ko'rsatmaymiz: nol
    // "telefonni ishlatmadingiz" degan yolg'on bo'lardi.
    //
    // ⚠️ TESKARI metrika: ko'p ekran vaqti YOMON. Shuning uchun foiz
    // "me'yordan qancha kam" bo'yicha hisoblanadi.
    MetricKey.screen: screenMinutes == null
        ? const MetricState(
            key: MetricKey.screen,
            percent: 0,
            valueText: 'Ulanmagan',
            remainderText: 'Sozlamalardan yoqing',
            hasData: false,
          )
        : MetricState(
            key: MetricKey.screen,
            percent: (100 - _pct(screenMinutes, kScreenLimitMinutes)).clamp(0, 100),
            valueText: '${_hm(screenMinutes)} / ${_hm(kScreenLimitMinutes)}',
            remainderText: screenMinutes > kScreenLimitMinutes
                ? '${_hm(screenMinutes - kScreenLimitMinutes)} ortiqcha'
                : "Me'yor ichida",
            hasData: true,
            inverted: true,
          ),
    MetricKey.goals: MetricState(
      key: MetricKey.goals,
      percent: _pct(focusMinutes, kFocusGoalMinutes),
      valueText: '$focusMinutes / $kFocusGoalMinutes daqiqa',
      remainderText: focusLeft > 0 ? '${_hm(focusLeft)} qoldi' : 'Maqsad bajarildi',
      hasData: true,
    ),
  };
}

/// Radar uchun foizlar. Ma'lumoti yo'q metrika 0 sifatida chiziladi.
Map<MetricKey, double> radarValues(Map<MetricKey, MetricState> metrics) => {
      for (final e in metrics.entries) e.key: e.value.percent.toDouble(),
    };

/// Uyqu ballini `pillars.dart` orqali olish — ekranlarda takrorlanmasin
PillarScore sleepPillar(AppState app) => sleepScore(app.lastSleep, app.sleepLogs);
