import '../models.dart';

/// Placeholder state used only for the instant between app launch and the first
/// successful `/api/profile` fetch. Everything the user actually sees comes from
/// the server.
///
/// This file used to also carry a sample inventory, sample meals and a USD-priced
/// food list. All of it was dead code that no screen read, and the prices were
/// wrong — so it is gone.
class Defaults {
  static UserProfile profile() => UserProfile(
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
        name: '',
        weightGoalType: 'lose',
      );
}
