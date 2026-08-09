import 'package:flutter_test/flutter_test.dart';
import 'package:unum/score.dart';

/// Bir kunlik ma'lumot uchun qulay yordamchi. Standart qiymatlar —
/// 70 kg li foydalanuvchining "mukammal kuni".
UnumScore score({
  double calories = 2000,
  double targetCalories = 2000,
  double protein = 126,
  double targetProtein = 126,
  double vegServings = 5,
  double sugar = 20,
  double upfCalories = 0,
  double waterMl = 2100,
  double targetWaterMl = 2100,
  int steps = 8000,
  int activeMinutes = 30,
}) =>
    computeUnumScore(
      calories: calories,
      targetCalories: targetCalories,
      protein: protein,
      targetProtein: targetProtein,
      vegServings: vegServings,
      sugar: sugar,
      upfCalories: upfCalories,
      waterMl: waterMl,
      targetWaterMl: targetWaterMl,
      steps: steps,
      activeMinutes: activeMinutes,
    );

void main() {
  group('UNUM Score', () {
    test('mukammal kun 100 ball beradi', () {
      expect(score().total, 100);
      expect(score().grade, 'Ajoyib');
    });

    test('hech narsa kiritilmagan kun ball ko\'rsatmaydi', () {
      final s = score(
        calories: 0, protein: 0, vegServings: 0, sugar: 0,
        upfCalories: 0, waterMl: 0, steps: 0, activeMinutes: 0,
      );
      expect(s.hasData, isFalse);
      expect(s.total, 0);
    });

    test('OCH QOLISH ballni oshirmaydi — eng muhim himoya', () {
      // Kun bo'yi faqat 200 kkal. Shakar ham, UPF ham nol, ya'ni sodda
      // formulada 30 ball "tekinga" tushardi. Adequacy koeffitsienti
      // buni to'sib turadi.
      final ochlik = score(
        calories: 200, protein: 10, vegServings: 0, sugar: 0,
        upfCalories: 0, waterMl: 0, steps: 0, activeMinutes: 0,
      );
      final normal = score(
        calories: 2000, protein: 126, vegServings: 5, sugar: 20,
        upfCalories: 0, waterMl: 2100, steps: 8000, activeMinutes: 30,
      );
      expect(ochlik.total, lessThan(20));
      expect(ochlik.total, lessThan(normal.total));
    });

    test('shakar oshgani sari shakar balli kamayadi', () {
      final past = score(sugar: 20).components.firstWhere((c) => c.id == 'sugar');
      final orta = score(sugar: 50).components.firstWhere((c) => c.id == 'sugar');
      final baland = score(sugar: 90).components.firstWhere((c) => c.id == 'sugar');
      expect(past.earned, 15);
      expect(orta.earned, greaterThan(0));
      expect(orta.earned, lessThan(15));
      expect(baland.earned, 0);
    });

    test('ultra-qayta ishlangan ovqat ulushi ballni pasaytiradi', () {
      final toza = score(upfCalories: 0).components.firstWhere((c) => c.id == 'upf');
      final yarim =
          score(upfCalories: 1400).components.firstWhere((c) => c.id == 'upf');
      expect(toza.earned, 15);
      expect(yarim.earned, 0); // 70% ulush → nol
    });

    test('komponentlar yig\'indisi umumiy balga teng', () {
      final s = score(sugar: 40, upfCalories: 500, steps: 4000, waterMl: 1000);
      final sum = s.components.fold<double>(0, (a, c) => a + c.earned);
      expect(s.total, sum.round());
      expect(s.total, inInclusiveRange(0, 100));
    });

    test('har bir komponent o\'z maksimumidan oshmaydi', () {
      // Maqsaddan ancha ko'p qilingan kun ham 100 dan oshmasin.
      final s = score(
        protein: 400, vegServings: 20, waterMl: 9000,
        steps: 50000, activeMinutes: 300,
      );
      for (final c in s.components) {
        expect(c.earned, lessThanOrEqualTo(c.max + 0.001), reason: c.id);
      }
      expect(s.total, 100);
    });

    test('weakest eng ko\'p ball yo\'qotilgan komponentni topadi', () {
      // Sabzavot butunlay yo'q (−20), suv yarmi (−5).
      final s = score(vegServings: 0, waterMl: 1050);
      expect(s.weakest?.id, 'veg');
    });

    test('to\'liq ball olingan komponentda maslahat bo\'lmaydi', () {
      final s = score();
      for (final c in s.components) {
        expect(c.isFull, isTrue, reason: c.id);
        expect(c.advice, isNull, reason: c.id);
      }
      expect(s.weakest, isNull);
    });

    test('yetishmayotgan komponentda aniq maslahat bo\'ladi', () {
      final s = score(protein: 60, vegServings: 1, sugar: 60, steps: 1000);
      for (final c in s.components.where((c) => !c.isFull)) {
        expect(c.advice, isNotNull, reason: c.id);
        expect(c.advice!.isNotEmpty, isTrue, reason: c.id);
      }
    });

    test('baholash chegaralari mos keladi', () {
      expect(score().grade, 'Ajoyib');
      expect(score(vegServings: 0).total, 80);
      expect(score(vegServings: 0).grade, 'Yaxshi');
      expect(score(vegServings: 0, protein: 0, steps: 0).grade, 'Past');
    });

    test('nol maqsadlar bilan ham yiqilmaydi', () {
      final s = score(targetProtein: 0, targetWaterMl: 0, targetCalories: 0);
      expect(s.total, inInclusiveRange(0, 100));
    });
  });

  adviceTests();
}

void adviceTests() {
  group('Maslahat matnlari', () {
    String proteinAdvice(double consumed, double target) =>
        computeUnumScore(
          calories: 2000, targetCalories: 2000,
          protein: consumed, targetProtein: target,
          vegServings: 5, sugar: 20, upfCalories: 0,
          waterMl: 2100, targetWaterMl: 2100, steps: 8000, activeMinutes: 30,
        ).components.firstWhere((c) => c.id == 'protein').advice!;

    test('kichik kamomadda kichik taklif beriladi', () {
      final a = proteinAdvice(140, 149);
      expect(a, contains('9 g'));
      expect(a, contains('tuxum'));
    });

    test('katta kamomadda "2 ta tuxum yetadi" DEYILMAYDI', () {
      // Aynan shu xato edi: 149 g yetishmayotganda ham 2 ta tuxum taklif qilinardi.
      final a = proteinAdvice(0, 149);
      expect(a, contains('149 g'));
      expect(a, isNot(contains('2 ta tuxum (13 g) yetadi')));
      expect(a, contains('kunga taqsimlang'));
    });

    test('sabzavot maslahati ham kamomadga mos', () {
      final full = computeUnumScore(
        calories: 2000, targetCalories: 2000, protein: 126, targetProtein: 126,
        vegServings: 0, sugar: 20, upfCalories: 0,
        waterMl: 2100, targetWaterMl: 2100, steps: 8000, activeMinutes: 30,
      ).components.firstWhere((c) => c.id == 'veg').advice!;
      expect(full, contains('5.0 portsiya'));
      expect(full, contains('80 g'));
    });
  });
}
