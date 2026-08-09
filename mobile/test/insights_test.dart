import 'package:flutter_test/flutter_test.dart';
import 'package:unum/insights.dart';

DayRecord day(
  int daysAgo, {
  double calories = 2000,
  double protein = 120,
  double sugar = 20,
  double sodium = 1800,
  double veg = 5,
  double upf = 0,
  double water = 2100,
  double cost = 40000,
  int steps = 8000,
  int screen = 0,
  int score = 80,
}) =>
    DayRecord(
      date: DateTime.now().subtract(Duration(days: daysAgo)),
      calories: calories,
      protein: protein,
      sugar: sugar,
      sodium: sodium,
      vegServings: veg,
      upfCalories: upf,
      water: water,
      cost: cost,
      steps: steps,
      screenMinutes: screen,
      score: score,
      hasData: true,
    );

List<DayRecord> healthyWeek() =>
    [for (var i = 6; i >= 0; i--) day(i)];

void main() {
  group('Xavf radari', () {
    test('kam ma\'lumotda hech qanday xulosa chiqarmaydi', () {
      // Bir kunlik ovqatdan uzoq muddatli xavf haqida gapirish noto'g'ri.
      final r = analyzeRisks(
          days: [day(0, sugar: 200, veg: 0)],
          targetProtein: 126,
          targetWater: 2100);
      expect(r, isEmpty);
    });

    test('sog\'lom haftada ogohlantirish bo\'lmaydi', () {
      final r = analyzeRisks(
          days: healthyWeek(), targetProtein: 126, targetWater: 2100);
      expect(r, isEmpty);
    });

    test('yuqori shakar aniqlanadi va yuqori daraja beriladi', () {
      final days = [for (var i = 6; i >= 0; i--) day(i, sugar: 90)];
      final r = analyzeRisks(
          days: days, targetProtein: 126, targetWater: 2100);
      final sugar = r.firstWhere((x) => x.id == 'sugar');
      expect(sugar.level, RiskLevel.high);
      expect(sugar.finding, contains('90 g'));
      expect(sugar.action, isNotEmpty);
    });

    test('tuz me\'yordan oshsa natriy ogohlantirishi chiqadi', () {
      final days = [for (var i = 6; i >= 0; i--) day(i, sodium: 4000)];
      final r = analyzeRisks(
          days: days, targetProtein: 126, targetWater: 2100);
      final s = r.firstWhere((x) => x.id == 'sodium');
      expect(s.level, RiskLevel.high);
      expect(s.finding, contains('g tuz'));
    });

    test('sabzavot kamligi aniqlanadi', () {
      final days = [for (var i = 6; i >= 0; i--) day(i, veg: 0.5)];
      final r = analyzeRisks(
          days: days, targetProtein: 126, targetWater: 2100);
      expect(r.any((x) => x.id == 'veg' && x.level == RiskLevel.high), isTrue);
    });

    test('ultra-qayta ishlangan ovqat ulushi hisoblanadi', () {
      final days = [
        for (var i = 6; i >= 0; i--) day(i, calories: 2000, upf: 1200)
      ];
      final r = analyzeRisks(
          days: days, targetProtein: 126, targetWater: 2100);
      final upf = r.firstWhere((x) => x.id == 'upf');
      expect(upf.finding, contains('60%'));
    });

    test('qadam yozilmagan bo\'lsa harakat haqida ogohlantirmaydi', () {
      // Nol qadam "kam harakat" degani emas — shunchaki o'lchanmagan.
      final days = [for (var i = 6; i >= 0; i--) day(i, steps: 0)];
      final r = analyzeRisks(
          days: days, targetProtein: 126, targetWater: 2100);
      expect(r.any((x) => x.id == 'steps'), isFalse);
    });

    test('qadam o\'lchangan va kam bo\'lsa ogohlantiradi', () {
      final days = [for (var i = 6; i >= 0; i--) day(i, steps: 2000)];
      final r = analyzeRisks(
          days: days, targetProtein: 126, targetWater: 2100);
      expect(r.any((x) => x.id == 'steps'), isTrue);
    });

    test('jiddiyroq xavflar ro\'yxat boshida turadi', () {
      final days = [
        for (var i = 6; i >= 0; i--) day(i, sugar: 90, veg: 2.5)
      ];
      final r = analyzeRisks(
          days: days, targetProtein: 126, targetWater: 2100);
      expect(r.first.level, RiskLevel.high);
    });

    test('hech qachon tashxis qo\'ymaydi', () {
      final days = [
        for (var i = 13; i >= 0; i--)
          day(i, sugar: 120, sodium: 5000, veg: 0, upf: 1500, protein: 30)
      ];
      final r = analyzeRisks(
          days: days, targetProtein: 126, targetWater: 2100);
      const banned = ['diabet', 'kasallik', 'tashxis', 'gipertoniya', 'saraton'];
      for (final risk in r) {
        final text = '${risk.title} ${risk.finding} ${risk.action}'.toLowerCase();
        for (final word in banned) {
          expect(text.contains(word), isFalse,
              reason: '"${risk.id}" ichida taqiqlangan so\'z: $word');
        }
      }
    });
  });

  group('Progress va prognoz', () {
    ProgressStats stats(List<DayRecord> days,
            {double current = 80, double goal = 70}) =>
        computeProgress(
          days: days,
          mealsLogged: days.length * 3,
          startWeight: 85,
          currentWeight: current,
          goalWeight: goal,
          targetCalories: 2000,
        );

    test('ma\'lumot yo\'q bo\'lsa yiqilmaydi', () {
      final s = stats([]);
      expect(s.daysTracked, 0);
      expect(s.avgScore, 0);
      expect(s.weeksToGoal, isNull);
      expect(s.headline.toLowerCase(), contains('bir necha kun'));
    });

    test('o\'rtacha ball so\'nggi 7 kundan olinadi', () {
      final days = [
        for (var i = 13; i >= 7; i--) day(i, score: 50),
        for (var i = 6; i >= 0; i--) day(i, score: 80),
      ];
      final s = stats(days);
      expect(s.avgScore, 80);
      expect(s.avgScorePrevWeek, 50);
      expect(s.scoreDelta, 30);
      expect(s.headline, contains('o\'sdi'));
    });

    test('ball tushganda buni yashirmaydi', () {
      final days = [
        for (var i = 13; i >= 7; i--) day(i, score: 85),
        for (var i = 6; i >= 0; i--) day(i, score: 60),
      ];
      expect(stats(days).headline, contains('tushdi'));
    });

    test('taqchillik bo\'lsa maqsadga yetish muddati hisoblanadi', () {
      // Saqlash ≈ 2500, iste'mol 2000 → kuniga 500 kkal taqchillik.
      // Haftada 3500 kkal ≈ 0.45 kg. 10 kg uchun ≈ 22 hafta.
      final days = [for (var i = 6; i >= 0; i--) day(i, calories: 2000)];
      final s = stats(days, current: 80, goal: 70);
      expect(s.weeksToGoal, isNotNull);
      expect(s.weeksToGoal, inInclusiveRange(15, 30));
    });

    test('taqchillik yo\'q bo\'lsa prognoz berilmaydi', () {
      // Maqsad ozish, lekin saqlash darajasidan ko'p yeyilyapti.
      final days = [for (var i = 6; i >= 0; i--) day(i, calories: 3000)];
      expect(stats(days, current: 80, goal: 70).weeksToGoal, isNull);
    });

    test('30 kunlik xarajat yig\'iladi', () {
      final days = [for (var i = 6; i >= 0; i--) day(i, cost: 40000)];
      expect(stats(days).spent30d, 280000);
    });
  });

  group('Kunlik vazifalar', () {
    List<DailyMission> missions({
      double protein = 0,
      double veg = 0,
      double water = 0,
      double sugar = 0,
      int steps = 0,
      int meals = 0,
    }) =>
        buildMissions(
          calories: 1000,
          targetCalories: 2000,
          protein: protein,
          targetProtein: 126,
          vegServings: veg,
          sugar: sugar,
          water: water,
          targetWater: 2100,
          steps: steps,
          mealsToday: meals,
        );

    test('har doim aynan 3 ta vazifa beriladi', () {
      expect(missions().length, 3);
      expect(
          missions(protein: 126, veg: 5, water: 2100, steps: 8000, meals: 3)
              .length,
          3);
    });

    test('eng zaif tomonlar birinchi tanlanadi', () {
      // Oqsil va sabzavot to'liq, suv/qadam/taom nol → o'shalar tanlanadi.
      final m = missions(protein: 126, veg: 5, sugar: 10);
      final ids = m.map((e) => e.id).toSet();
      expect(ids.contains('protein'), isFalse);
      expect(ids.contains('veg'), isFalse);
    });

    test('bajarilgan vazifa done deb belgilanadi', () {
      final m = missions(protein: 200, veg: 8, water: 3000, steps: 12000, meals: 5);
      expect(m.every((x) => x.done), isTrue);
    });

    test('shakar me\'yorda bo\'lsa vazifa bajarilgan hisoblanadi', () {
      final m = buildMissions(
        calories: 1000, targetCalories: 2000, protein: 0, targetProtein: 126,
        vegServings: 0, sugar: 10, water: 0, targetWater: 2100,
        steps: 0, mealsToday: 0,
      );
      // Shakar to'liq, shuning uchun u 3 talikka tushmasligi kerak.
      expect(m.any((x) => x.id == 'sugar'), isFalse);
    });

    test('XP mukofoti musbat', () {
      for (final m in missions()) {
        expect(m.xp, greaterThan(0));
      }
    });
  });
}
