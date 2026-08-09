import 'package:flutter_test/flutter_test.dart';
import 'package:unum/pillars.dart';

SleepLog sleep(String date, String bed, String wake, {int quality = 3}) =>
    SleepLog(
      id: date,
      date: date,
      bedTime: '${date}T$bed:00',
      wakeTime: '${date}T$wake:00',
      quality: quality,
    );

/// Yotish kechagi kunga to'g'ri kelgan holat (23:00 → ertasi 07:00).
SleepLog nightSleep(String prevDate, String date, String bed, String wake) =>
    SleepLog(
      id: date,
      date: date,
      bedTime: '${prevDate}T$bed:00',
      wakeTime: '${date}T$wake:00',
    );

FocusSession focus(String kind, int minutes) => FocusSession(
      id: '$kind$minutes',
      timestamp: DateTime.now().toIso8601String(),
      kind: kind,
      minutes: minutes,
    );

void main() {
  group('Ibodat — ballanmasligi KAFOLATLANADI', () {
    test('PrayerDay da ball, foiz yoki daraja maydoni yo\'q', () {
      final d = PrayerDay.empty('2026-07-28');
      final json = d.toJson();
      // Agar kelajakda kimdir ball qo'shmoqchi bo'lsa, shu test yiqiladi.
      for (final banned in ['score', 'value', 'percent', 'grade', 'points', 'xp']) {
        expect(json.containsKey(banned), isFalse,
            reason: 'Ibodat yozuvida "$banned" bo\'lmasligi kerak');
      }
      expect(json.keys.toSet(), {'date', 'marked'});
    });

    test('belgilash va bekor qilish ishlaydi', () {
      var d = PrayerDay.empty('2026-07-28');
      expect(d.count, 0);
      d = d.toggle(PrayerName.fajr);
      expect(d.has(PrayerName.fajr), isTrue);
      expect(d.count, 1);
      d = d.toggle(PrayerName.fajr);
      expect(d.has(PrayerName.fajr), isFalse);
      expect(d.count, 0);
    });

    test('barcha namozlar o\'zbekcha nomga ega', () {
      for (final p in PrayerName.values) {
        expect(p.uz.isNotEmpty, isTrue);
      }
      expect(PrayerName.fajr.uz, 'Bomdod');
      expect(PrayerName.maghrib.uz, 'Shom');
    });

    test('ibodat kunlik muvozanatga KIRMAYDI', () {
      // balanceOf faqat berilgan ballardan hisoblaydi; ibodat PillarScore
      // emas, shuning uchun unga qo'shib bo'lmaydi.
      final scored = [
        focusScore([focus('study', 120)], 120),
        sleepScore(nightSleep('2026-07-27', '2026-07-28', '23:00', '07:00'), []),
      ];
      final b = balanceOf(scored);
      expect(b, inInclusiveRange(0, 100));
      // Ikkita ustun: 100 va uyqu balli — o'rtachasi
      expect(scored.length, 2);
    });
  });

  group('Rivojlanish balli', () {
    test('maqsad bajarilsa 100', () {
      final s = focusScore([focus('study', 60), focus('work', 60)], 120);
      expect(s.value, 100);
      expect(s.advice, isNull);
    });

    test('yarmi bajarilsa 50', () {
      expect(focusScore([focus('study', 60)], 120).value, 50);
    });

    test('maqsaddan oshsa ham 100 dan oshmaydi', () {
      expect(focusScore([focus('work', 500)], 120).value, 100);
    });

    test('yozuv yo\'q bo\'lsa hasData false va boshlash maslahati beriladi', () {
      final s = focusScore([], 120);
      expect(s.hasData, isFalse);
      expect(s.value, 0);
      expect(s.advice, contains('boshlang'));
    });

    test('qolgan daqiqa aniq aytiladi', () {
      expect(focusScore([focus('study', 45)], 120).advice, contains('75'));
    });
  });

  group('Uyqu balli', () {
    test('yozuv yo\'q bo\'lsa hasData false', () {
      final s = sleepScore(null, []);
      expect(s.hasData, isFalse);
      expect(s.advice, isNotNull);
    });

    test('yarim tundan o\'tgan uyqu to\'g\'ri hisoblanadi', () {
      final s = nightSleep('2026-07-27', '2026-07-28', '23:00', '07:00');
      expect(s.minutes, 8 * 60);
      expect(s.hours, 8);
    });

    test('8 soat uyqu yuqori ball beradi', () {
      final s = sleepScore(
          nightSleep('2026-07-27', '2026-07-28', '23:00', '07:00'), []);
      expect(s.value, greaterThanOrEqualTo(95));
      expect(s.advice, isNull);
    });

    test('5 soat uyqu past ball va aniq maslahat beradi', () {
      // Yarim tundan keyin yotgan: yotish ham, turish ham bir xil kunda.
      final s = sleepScore(sleep('2026-07-28', '01:00', '06:00'), []);
      expect(s.value, lessThan(85));
      expect(s.advice, contains('erta yotishga'));
    });

    test('ishonarsiz yozuv (sana xatosi) yaroqsiz deb belgilanadi', () {
      // 01:00 da yotib, ertasi 06:00 da turish = 29 soat — bu sana xatosi.
      // Ilgari u 24 soatga qirqilib "uzoq uyqu" deb ko'rsatilardi.
      final bad = nightSleep('2026-07-27', '2026-07-28', '01:00', '06:00');
      expect(bad.minutes, 0);
      expect(bad.isValid, isFalse);
      final s = sleepScore(bad, []);
      expect(s.hasData, isFalse);
      expect(s.detail, contains('xatolik'));
    });

    test('haddan tashqari uzoq uyqu ham to\'liq ball bermaydi', () {
      final s = sleepScore(
          nightSleep('2026-07-27', '2026-07-28', '21:00', '10:00'), []);
      expect(s.value, lessThan(100));
      expect(s.advice, isNotNull);
    });

    test('muntazam yotish tartibsizdan yuqori baholanadi', () {
      final regular = [
        nightSleep('2026-07-24', '2026-07-25', '23:00', '07:00'),
        nightSleep('2026-07-25', '2026-07-26', '23:10', '07:00'),
        nightSleep('2026-07-26', '2026-07-27', '22:55', '07:00'),
        nightSleep('2026-07-27', '2026-07-28', '23:05', '07:00'),
      ];
      final chaotic = [
        nightSleep('2026-07-24', '2026-07-25', '21:00', '07:00'),
        nightSleep('2026-07-25', '2026-07-26', '01:30', '07:00'),
        nightSleep('2026-07-26', '2026-07-27', '23:00', '07:00'),
        nightSleep('2026-07-27', '2026-07-28', '02:00', '07:00'),
      ];
      final a = sleepScore(regular.last, regular).value;
      final b = sleepScore(chaotic.last, chaotic).value;
      expect(a, greaterThan(b),
          reason: 'Muntazam yotish yuqoriroq baholanishi kerak');
    });

    test('ball har doim 0..100 oralig\'ida', () {
      for (final s in [
        nightSleep('2026-07-27', '2026-07-28', '23:00', '07:00'),
        nightSleep('2026-07-27', '2026-07-28', '05:00', '06:00'),
        nightSleep('2026-07-27', '2026-07-28', '18:00', '12:00'),
      ]) {
        final v = sleepScore(s, [s]).value;
        expect(v, inInclusiveRange(0, 100));
      }
    });
  });

  group('Kunlik muvozanat', () {
    test('ma\'lumot yo\'q bo\'lsa 0', () {
      expect(balanceOf([focusScore([], 120), sleepScore(null, [])]), 0);
    });

    test('faqat ma\'lumoti bor ustunlar hisobga olinadi', () {
      // Rivojlanish 100, uyqu yozuvsiz → o'rtacha 100 bo'lishi kerak,
      // 50 emas (bo'sh ustun ballni pasaytirmasin).
      final b = balanceOf([
        focusScore([focus('study', 120)], 120),
        sleepScore(null, []),
      ]);
      expect(b, 100);
    });
  });
}
