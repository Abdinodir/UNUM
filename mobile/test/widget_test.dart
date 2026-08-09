import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:unum/models.dart';
import 'package:unum/theme.dart';
import 'package:unum/format.dart';

void main() {
  group('som()', () {
    test('groups thousands and never converts currency', () {
      // Values are already in so'm — no exchange rate is applied anywhere.
      expect(som(65000), "65 000 so'm");
      expect(som(1500), "1 500 so'm");
      expect(som(1500000), "1 500 000 so'm");
      expect(som(0), "0 so'm");
      expect(som(999), "999 so'm");
    });

    test('somShort compacts large amounts', () {
      expect(somShort(1500000), '1.50 mln');
      expect(somShort(65000), '65 ming');
      expect(somShort(500), '500');
    });
  });

  group('UserProfile.recomputeTargets', () {
    UserProfile profileFor({
      required String gender,
      required int age,
      required double height,
      required double weight,
      String activity = 'moderate',
      String goal = 'lose',
    }) {
      final p = makeProfile();
      p.gender = gender;
      p.age = age;
      p.height = height;
      p.weight = weight;
      p.activityLevel = activity;
      p.weightGoalType = goal;
      p.recomputeTargets();
      return p;
    }

    test('Mifflin-St Jeor for a 25y 70kg 175cm man cutting', () {
      final p = profileFor(gender: 'Erkak', age: 25, height: 175, weight: 70);
      // BMR 1673.75 × 1.55 = 2594 → ×0.8 ≈ 2075
      expect(p.targetCalories, inInclusiveRange(2000, 2150));
      expect(p.targetProtein, 126); // 70 × 1.8
      expect(p.targetWaterMl, 2100); // 70 × 30
    });

    test('women get a lower target than men, all else equal', () {
      final man = profileFor(gender: 'Erkak', age: 30, height: 170, weight: 70);
      final woman = profileFor(gender: 'Ayol', age: 30, height: 170, weight: 70);
      expect(woman.targetCalories, lessThan(man.targetCalories));
    });

    test('goal direction moves the target the right way', () {
      final lose = profileFor(
          gender: 'Erkak', age: 30, height: 175, weight: 80, goal: 'lose');
      final maintain = profileFor(
          gender: 'Erkak', age: 30, height: 175, weight: 80, goal: 'maintain');
      final gain = profileFor(
          gender: 'Erkak', age: 30, height: 175, weight: 80, goal: 'gain');
      expect(lose.targetCalories, lessThan(maintain.targetCalories));
      expect(gain.targetCalories, greaterThan(maintain.targetCalories));
    });

    test('water target stays inside a sane range', () {
      final small = profileFor(gender: 'Ayol', age: 20, height: 150, weight: 40);
      final large = profileFor(gender: 'Erkak', age: 40, height: 200, weight: 150);
      expect(small.targetWaterMl, greaterThanOrEqualTo(1500));
      expect(large.targetWaterMl, lessThanOrEqualTo(4000));
    });
  });

  testWidgets('GlassCard renders its child', (tester) async {
    await tester.pumpWidget(MaterialApp(
      theme: buildTheme(),
      home: const Scaffold(body: GlassCard(child: Text('hello'))),
    ));
    expect(find.text('hello'), findsOneWidget);
  });
}

/// Local copy of the launch placeholder so the test does not depend on
/// lib/data/defaults.dart staying import-visible.
UserProfile makeProfile() => UserProfile(
      age: 25,
      gender: 'Erkak',
      height: 175,
      weight: 70,
      goalWeight: 65,
      activityLevel: 'moderate',
      targetCalories: 2200,
      targetProtein: 126,
      targetCarbs: 230,
      targetFat: 61,
      preferredDiet: 'everything',
      budgetMonthly: 1500000,
    );
