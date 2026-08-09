import 'package:flutter/material.dart';
import 'theme.dart';

/// UNUM'ning to'rt ustuni.
///
/// ⚠️ Eng muhim dizayn qarori: **ibodat ballanmaydi.**
///
/// Sog'liq, rivojlanish va uyquni foizli halqa bilan ko'rsatib, yoniga
/// ibodatni ham shunday qo'yish bilvosita "ibodatingiz 60%" degan hukm
/// bo'lardi. Bu ilovaning ishi emas. Shuning uchun ibodat modulida:
///   • ball, foiz, daraja va "bajarilmadi" degan til YO'Q
///   • seriya uzilgani uchun hech qanday jazo yoki ogohlantirish yo'q
///   • butun modulni o'chirib qo'yish mumkin
///   • namoz vaqtlari — hisoblangan taxmin, buni ochiq aytamiz
/// Bu yerda faqat kuzatuv va eslatma bor.

// ═══════════════════════ IBODAT (ballanmaydi) ═══════════════════════

enum PrayerName { fajr, dhuhr, asr, maghrib, isha }

extension PrayerLabel on PrayerName {
  String get uz => switch (this) {
        PrayerName.fajr => 'Bomdod',
        PrayerName.dhuhr => 'Peshin',
        PrayerName.asr => 'Asr',
        PrayerName.maghrib => 'Shom',
        PrayerName.isha => 'Xufton',
      };
  String get key => name;
}

/// Bir kunlik ibodat yozuvi. Faqat belgilangan/belgilanmagan — boshqa hech narsa.
class PrayerDay {
  final String date; // YYYY-MM-DD
  final Set<String> marked;

  const PrayerDay({required this.date, required this.marked});

  bool has(PrayerName p) => marked.contains(p.key);
  int get count => marked.length;

  PrayerDay toggle(PrayerName p) {
    final next = Set<String>.from(marked);
    if (!next.remove(p.key)) next.add(p.key);
    return PrayerDay(date: date, marked: next);
  }

  Map<String, dynamic> toJson() => {'date': date, 'marked': marked.toList()};

  factory PrayerDay.fromJson(Map<String, dynamic> j) => PrayerDay(
        date: (j['date'] ?? '').toString(),
        marked: ((j['marked'] ?? []) as List).map((e) => e.toString()).toSet(),
      );

  factory PrayerDay.empty(String date) => PrayerDay(date: date, marked: {});
}

// ═══════════════════════ RIVOJLANISH ═══════════════════════

enum FocusKind { study, work, hobby, skill }

extension FocusLabel on FocusKind {
  String get uz => switch (this) {
        FocusKind.study => "O'qish",
        FocusKind.work => 'Ish',
        FocusKind.hobby => 'Hobbi',
        FocusKind.skill => 'Mahorat',
      };
  IconData get icon => switch (this) {
        FocusKind.study => Icons.menu_book_rounded,
        FocusKind.work => Icons.work_rounded,
        FocusKind.hobby => Icons.palette_rounded,
        FocusKind.skill => Icons.psychology_alt_rounded,
      };
  Color get color => switch (this) {
        FocusKind.study => AppColors.indigo,
        FocusKind.work => AppColors.sky,
        FocusKind.hobby => AppColors.pink,
        FocusKind.skill => AppColors.violet,
      };
}

class FocusSession {
  String id;
  String timestamp; // ISO
  String kind; // FocusKind.name
  int minutes;
  String note;

  FocusSession({
    required this.id,
    required this.timestamp,
    required this.kind,
    required this.minutes,
    this.note = '',
  });

  FocusKind get kindEnum =>
      FocusKind.values.firstWhere((k) => k.name == kind,
          orElse: () => FocusKind.study);

  Map<String, dynamic> toJson() =>
      {'id': id, 'timestamp': timestamp, 'kind': kind, 'minutes': minutes, 'note': note};

  factory FocusSession.fromJson(Map<String, dynamic> j) => FocusSession(
        id: (j['id'] ?? '').toString(),
        timestamp: (j['timestamp'] ?? '').toString(),
        kind: (j['kind'] ?? 'study').toString(),
        minutes: (j['minutes'] is num) ? (j['minutes'] as num).toInt() : 0,
        note: (j['note'] ?? '').toString(),
      );
}

// ═══════════════════════ UYQU ═══════════════════════

class SleepLog {
  String id;
  String date; // uyg'ongan kun, YYYY-MM-DD
  String bedTime; // ISO
  String wakeTime; // ISO
  int quality; // 1..5

  SleepLog({
    required this.id,
    required this.date,
    required this.bedTime,
    required this.wakeTime,
    this.quality = 3,
  });

  /// Bir marta uxlash uchun ishonarli yuqori chegara. Undan katta farq —
  /// deyarli har doim sana xatosi (masalan yotish vaqti noto'g'ri kunga
  /// yozilgan), shuning uchun uni 24 soatga "qirqib" ko'rsatish o'rniga
  /// yaroqsiz deb hisoblaymiz.
  static const _maxPlausibleMinutes = 16 * 60;

  /// Uyqu davomiyligi daqiqada. Yotish vaqti yarim tundan o'tsa ham to'g'ri
  /// hisoblanadi (masalan 23:40 → 07:10).
  /// Ishonarsiz qiymat uchun 0 qaytaradi — "ma'lumot yo'q" degani.
  int get minutes {
    final b = DateTime.tryParse(bedTime);
    final w = DateTime.tryParse(wakeTime);
    if (b == null || w == null) return 0;
    var diff = w.difference(b).inMinutes;
    if (diff < 0) diff += 24 * 60;
    if (diff <= 0 || diff > _maxPlausibleMinutes) return 0;
    return diff;
  }

  bool get isValid => minutes > 0;

  double get hours => minutes / 60;

  Map<String, dynamic> toJson() => {
        'id': id,
        'date': date,
        'bedTime': bedTime,
        'wakeTime': wakeTime,
        'quality': quality,
      };

  factory SleepLog.fromJson(Map<String, dynamic> j) => SleepLog(
        id: (j['id'] ?? '').toString(),
        date: (j['date'] ?? '').toString(),
        bedTime: (j['bedTime'] ?? '').toString(),
        wakeTime: (j['wakeTime'] ?? '').toString(),
        quality: (j['quality'] is num) ? (j['quality'] as num).toInt() : 3,
      );
}

// ═══════════════════════ BALLAR ═══════════════════════

class PillarScore {
  final int value; // 0..100
  final bool hasData;
  final String label;
  final String detail;
  final String? advice;
  final IconData icon;
  final Color color;

  const PillarScore({
    required this.value,
    required this.hasData,
    required this.label,
    required this.detail,
    required this.icon,
    required this.color,
    this.advice,
  });
}

/// Rivojlanish balli: kunlik maqsad (daqiqa) bo'yicha.
PillarScore focusScore(List<FocusSession> today, int targetMinutes) {
  final total = today.fold<int>(0, (s, f) => s + f.minutes);
  final ratio = targetMinutes <= 0 ? 0.0 : (total / targetMinutes).clamp(0.0, 1.0);
  return PillarScore(
    value: (ratio * 100).round(),
    hasData: total > 0,
    label: 'Rivojlanish',
    detail: '$total / $targetMinutes daqiqa',
    icon: Icons.auto_stories_rounded,
    color: AppColors.indigo,
    advice: total >= targetMinutes
        ? null
        : total == 0
            ? '25 daqiqalik bitta seans bilan boshlang.'
            : 'Yana ${targetMinutes - total} daqiqa qoldi.',
  );
}

/// Uyqu balli: davomiylik (70) + muntazamlik (30).
///
/// Muntazamlik = yotish vaqtining barqarorligi. Har kuni turli vaqtda
/// uxlash, hatto yetarli uxlasangiz ham, sog'liqqa salbiy ta'sir qiladi.
PillarScore sleepScore(SleepLog? last, List<SleepLog> recent) {
  if (last != null && !last.isValid) {
    return const PillarScore(
      value: 0,
      hasData: false,
      label: 'Uyqu',
      detail: 'Yozuvda xatolik',
      icon: Icons.bedtime_rounded,
      color: AppColors.violet,
      advice: 'Yotish va turish vaqtini qayta kiriting.',
    );
  }
  if (last == null) {
    return const PillarScore(
      value: 0,
      hasData: false,
      label: 'Uyqu',
      detail: 'Yozuv yo\'q',
      icon: Icons.bedtime_rounded,
      color: AppColors.violet,
      advice: 'Kecha qachon yotib, qachon turganingizni kiriting.',
    );
  }

  final h = last.hours;
  // 7–9 soat — optimal oraliq. Undan chetga chiqqan sari ball kamayadi.
  double durationRatio;
  if (h >= 7 && h <= 9) {
    durationRatio = 1;
  } else if (h < 7) {
    durationRatio = (h / 7).clamp(0.0, 1.0);
  } else {
    durationRatio = (1 - (h - 9) / 5).clamp(0.0, 1.0);
  }

  double regularity = 1;
  final beds = recent
      .map((s) => DateTime.tryParse(s.bedTime))
      .whereType<DateTime>()
      .map((d) {
        // Yarim tundan keyingi vaqtlarni manfiy qilib olamiz, shunda
        // 23:30 va 00:30 bir-biriga yaqin hisoblanadi.
        final m = d.hour * 60 + d.minute;
        return m > 12 * 60 ? m - 24 * 60 : m;
      })
      .toList();
  if (beds.length >= 3) {
    final mean = beds.reduce((a, b) => a + b) / beds.length;
    final variance =
        beds.map((v) => (v - mean) * (v - mean)).reduce((a, b) => a + b) /
            beds.length;
    final sd = variance <= 0 ? 0.0 : _sqrt(variance);
    // 30 daqiqagacha tarqalish — mukammal; 120 daqiqadan ortiq — nol.
    regularity = (1 - ((sd - 30) / 90)).clamp(0.0, 1.0);
  }

  final value = (durationRatio * 70 + regularity * 30).round();

  String? advice;
  if (h < 6) {
    advice = 'Kecha atigi ${h.toStringAsFixed(1)} soat uxladingiz. '
        'Bugun bir soat erta yotishga harakat qiling.';
  } else if (h < 7) {
    advice = 'Yana ${((7 - h) * 60).round()} daqiqa uyqu foydali bo\'lardi.';
  } else if (h > 9.5) {
    advice = 'Uzoq uyqu ham charchoq belgisi bo\'lishi mumkin.';
  } else if (regularity < 0.6 && beds.length >= 3) {
    advice = 'Yotish vaqtingiz kundan kunga o\'zgaryapti — '
        'bir xil vaqtda yotish uyqu sifatini oshiradi.';
  }

  return PillarScore(
    value: value,
    hasData: true,
    label: 'Uyqu',
    detail: '${h.toStringAsFixed(1)} soat',
    icon: Icons.bedtime_rounded,
    color: AppColors.violet,
    advice: advice,
  );
}

double _sqrt(double v) {
  if (v <= 0) return 0;
  var x = v;
  for (var i = 0; i < 20; i++) {
    x = (x + v / x) / 2;
  }
  return x;
}

/// Uch ballanadigan ustunning o'rtachasi — "Kunlik muvozanat".
/// Ibodat bu hisobga KIRMAYDI.
int balanceOf(List<PillarScore> scored) {
  final withData = scored.where((s) => s.hasData).toList();
  if (withData.isEmpty) return 0;
  return (withData.fold<int>(0, (s, p) => s + p.value) / withData.length).round();
}
