import 'package:flutter/material.dart';

/// UNUM dizayn tokenlari — web versiyadagi `unum/src/theme.ts` ning aynan
/// ko'chirmasi. Ikkala ilova bir xil ko'rinishi uchun qiymatlar SHU YERDAN
/// olinadi; ekranlarda "sehrli" rang yozilmaydi.
class U {
  U._();

  /// Sahifa foni — deyarli qora, yengil yashil ohangda
  static const bg = Color(0xFF0A0C0B);

  /// Kartalar foni
  static const surface = Color(0xFF131717);

  /// Karta ichidagi ikkilamchi yuza (progress track, segment fon)
  static const surfaceAlt = Color(0xFF1B2020);

  static const border = Color(0x12FFFFFF); // ~7% oq
  static const borderStrong = Color(0x1FFFFFFF); // ~12% oq

  static const text = Color(0xFFF2F5F4);
  static const textSoft = Color(0xFFC7CFCC);
  static const textMuted = Color(0xFF98A29E);
  static const textDim = Color(0xFF616B67);
  static const textFaint = Color(0xFF4B5450);

  static const green = Color(0xFF22C55E);
  static const greenBright = Color(0xFF34D77F);
  static const greenInk = Color(0xFF07130C);

  static const danger = Color(0xFFEF4444);
  static const dangerText = Color(0xFFF87171);
  static const warn = Color(0xFFF59E0B);

  /// Radiuslar
  static const rCard = 20.0;
  static const rRow = 16.0;
  static const rSheet = 28.0;

  /// Ball qiymatiga qarab rang
  static Color scoreColor(num percent) {
    if (percent >= 75) return green;
    if (percent >= 50) return const Color(0xFFEAB308);
    return danger;
  }

  /// Ball qiymatining o'zbekcha talqini (hech qachon tibbiy baho emas)
  static String scoreLabel(num percent) {
    if (percent >= 85) return "A'lo";
    if (percent >= 70) return 'Yaxshi';
    if (percent >= 50) return "O'rtacha";
    return 'Past';
  }
}

/// Beshta asosiy yo'nalish. Radar, ro'yxat va kartalar shu ro'yxatni ishlatadi.
enum MetricKey { nutrition, steps, screen, goals, sleep }

class MetricMeta {
  const MetricMeta({
    required this.key,
    required this.label,
    required this.color,
    required this.icon,
  });

  final MetricKey key;
  final String label;
  final Color color;
  final IconData icon;
}

const Map<MetricKey, MetricMeta> kMetrics = {
  MetricKey.nutrition: MetricMeta(
    key: MetricKey.nutrition,
    label: "Sog'lom ovqatlanish",
    color: Color(0xFF22C55E),
    icon: Icons.restaurant,
  ),
  MetricKey.steps: MetricMeta(
    key: MetricKey.steps,
    label: 'Qadam',
    color: Color(0xFF84CC16),
    icon: Icons.directions_walk,
  ),
  MetricKey.screen: MetricMeta(
    key: MetricKey.screen,
    label: 'Skrn time',
    color: Color(0xFFF97316),
    icon: Icons.smartphone,
  ),
  // ⚠️ Kalit tarixiy sabab bilan `goals` deb nomlangan, lekin qiymat
  // FOKUS DAQIQASI (metrics_view.dart ga qarang). Yorliq shunga moslandi:
  // haqiqiy maqsadlar endi alohida modulda (Reja → Maqsad) va ularning
  // progressi butunlay boshqa narsa.
  MetricKey.goals: MetricMeta(
    key: MetricKey.goals,
    label: 'Fokus',
    color: Color(0xFF8B5CF6),
    icon: Icons.track_changes,
  ),
  MetricKey.sleep: MetricMeta(
    key: MetricKey.sleep,
    label: 'Uyqu',
    color: Color(0xFF6366F1),
    icon: Icons.nightlight_round,
  ),
};

/// Radar cho'qqilari soat 12 dan boshlab soat yo'nalishi bo'yicha shu tartibda
const List<MetricKey> kRadarOrder = [
  MetricKey.nutrition,
  MetricKey.steps,
  MetricKey.screen,
  MetricKey.goals,
  MetricKey.sleep,
];

/// Davr tanlagichi
enum Period { day, week, month, year }

const Map<Period, String> kPeriodLabels = {
  Period.day: 'Bugun',
  Period.week: 'Hafta',
  Period.month: 'Oy',
  Period.year: 'Yil',
};

/// Ilovaning umumiy mavzusi — barcha ekranlar shu ostida quriladi
ThemeData buildUnumTheme() {
  const base = ColorScheme.dark(
    primary: U.green,
    onPrimary: U.greenInk,
    surface: U.surface,
    onSurface: U.text,
    error: U.danger,
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: base,
    scaffoldBackgroundColor: U.bg,
    fontFamily: 'PlusJakarta',
    splashFactory: NoSplash.splashFactory,
    highlightColor: Colors.transparent,
    textTheme: const TextTheme(
      // Raqamlar tekis tursin — ball va foizlar sakramaydi
      displayLarge: TextStyle(fontFeatures: [FontFeature.tabularFigures()]),
    ),
  );
}
