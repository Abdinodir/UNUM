// Data models for NutriStock AI — ported from the web app's src/types.ts

double _d(dynamic v, [double def = 0]) =>
    v == null ? def : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? def);
int _i(dynamic v, [int def = 0]) =>
    v == null ? def : (v is num ? v.toInt() : int.tryParse(v.toString()) ?? def);
String _s(dynamic v, [String def = '']) => v == null ? def : v.toString();

class UserProfile {
  int age;
  String gender;
  double height;
  double weight;
  double goalWeight;
  String activityLevel; // sedentary | light | moderate | active | very_active
  int targetCalories;
  int targetProtein;
  int targetCarbs;
  int targetFat;
  String preferredDiet;

  /// So'mda.
  double budgetMonthly;
  String name;
  String dietPreference;
  String weightGoalType; // lose | gain | maintain
  int level;
  int xp;
  int streak;

  /// Kunlik suv maqsadi, ml. Vaznga qarab hisoblanadi (30 ml/kg).
  int targetWaterMl;

  /// Seriyani hisoblash uchun oxirgi faol kun (YYYY-MM-DD).
  String lastActiveDate;

  /// Sozlash oqimi tugallanganmi. `false` bo'lsa ilova onboardingni ochadi.
  bool onboarded;

  /// Premium obuna faolmi. Faqat SERVER o'rnatadi — ilova ichida
  /// o'zgartirilmaydi, aks holda uni chetlab o'tish juda oson bo'lardi.
  bool premium;

  UserProfile({
    required this.age,
    required this.gender,
    required this.height,
    required this.weight,
    required this.goalWeight,
    required this.activityLevel,
    required this.targetCalories,
    required this.targetProtein,
    required this.targetCarbs,
    required this.targetFat,
    required this.preferredDiet,
    required this.budgetMonthly,
    this.name = 'Chempion',
    this.dietPreference = 'balanced',
    this.weightGoalType = 'lose',
    this.level = 1,
    this.xp = 0,
    this.streak = 0,
    this.targetWaterMl = 2500,
    this.lastActiveDate = '',
    this.onboarded = false,
    this.premium = false,
  });

  factory UserProfile.fromJson(Map<String, dynamic> j) => UserProfile(
        age: _i(j['age'], 25),
        gender: _s(j['gender'], 'Erkak'),
        height: _d(j['height'], 175),
        weight: _d(j['weight'], 70),
        goalWeight: _d(j['goalWeight'], 65),
        activityLevel: _s(j['activityLevel'], 'moderate'),
        targetCalories: _i(j['targetCalories'], 2200),
        targetProtein: _i(j['targetProtein'], 126),
        targetCarbs: _i(j['targetCarbs'], 230),
        targetFat: _i(j['targetFat'], 61),
        preferredDiet: _s(j['preferredDiet'], 'everything'),
        budgetMonthly: _d(j['budgetMonthly'], 1500000),
        name: _s(j['name'], 'Chempion'),
        dietPreference: _s(j['dietPreference'], 'balanced'),
        weightGoalType: _s(j['weightGoalType'], 'lose'),
        level: _i(j['level'], 1),
        xp: _i(j['xp'], 0),
        streak: _i(j['streak'], 0),
        targetWaterMl: _i(j['targetWaterMl'], 2500),
        lastActiveDate: _s(j['lastActiveDate']),
        onboarded: j['onboarded'] == true,
        premium: j['premium'] == true,
      );

  Map<String, dynamic> toJson() => {
        'age': age,
        'gender': gender,
        'height': height,
        'weight': weight,
        'goalWeight': goalWeight,
        'activityLevel': activityLevel,
        'targetCalories': targetCalories,
        'targetProtein': targetProtein,
        'targetCarbs': targetCarbs,
        'targetFat': targetFat,
        'preferredDiet': preferredDiet,
        'budgetMonthly': budgetMonthly,
        'name': name,
        'dietPreference': dietPreference,
        'weightGoalType': weightGoalType,
        'level': level,
        'xp': xp,
        'streak': streak,
        'targetWaterMl': targetWaterMl,
        'lastActiveDate': lastActiveDate,
        'onboarded': onboarded,
        'premium': premium,
      };

  /// Mifflin-St Jeor — serverdagi computeTargets bilan bir xil formula.
  /// Profil tahrirlanganda maqsadlar shu yerda qayta hisoblanadi.
  void recomputeTargets() {
    final isMale = RegExp(r'erkak|male', caseSensitive: false).hasMatch(gender);
    final bmr = 10 * weight + 6.25 * height - 5 * age + (isMale ? 5 : -161);
    const factors = {
      'sedentary': 1.2, 'light': 1.375, 'moderate': 1.55,
      'active': 1.725, 'very_active': 1.9,
    };
    final tdee = bmr * (factors[activityLevel] ?? 1.55);
    final adjusted = weightGoalType == 'lose'
        ? tdee * 0.8
        : weightGoalType == 'gain'
            ? tdee * 1.12
            : tdee;

    targetCalories = (adjusted / 10).round() * 10;
    targetProtein = (weight * 1.8).round();
    targetFat = (targetCalories * 0.25 / 9).round();
    targetCarbs =
        ((targetCalories - targetProtein * 4 - targetFat * 9) / 4).round().clamp(0, 9999);
    targetWaterMl = ((weight * 30) / 50).round() * 50;
    if (targetWaterMl < 1500) targetWaterMl = 1500;
    if (targetWaterMl > 4000) targetWaterMl = 4000;
  }
}

class InventoryItem {
  String id;
  String name;
  double currentQuantity;
  double initialQuantity;
  String unit; // kg | grams | pieces
  double purchasePrice;
  String purchaseDate; // YYYY-MM-DD
  String expirationDate; // YYYY-MM-DD
  double dailyConsumption;
  String image; // emoji

  InventoryItem({
    required this.id,
    required this.name,
    required this.currentQuantity,
    required this.initialQuantity,
    required this.unit,
    required this.purchasePrice,
    required this.purchaseDate,
    required this.expirationDate,
    required this.dailyConsumption,
    required this.image,
  });

  double get percent =>
      initialQuantity <= 0 ? 0 : (currentQuantity / initialQuantity * 100).clamp(0, 100);

  int get daysLeft {
    if (dailyConsumption <= 0) return 999;
    return (currentQuantity / dailyConsumption).floor();
  }

  factory InventoryItem.fromJson(Map<String, dynamic> j) => InventoryItem(
        id: _s(j['id']),
        name: _s(j['name']),
        currentQuantity: _d(j['currentQuantity']),
        initialQuantity: _d(j['initialQuantity'], 1),
        unit: _s(j['unit'], 'kg'),
        purchasePrice: _d(j['purchasePrice']),
        purchaseDate: _s(j['purchaseDate']),
        expirationDate: _s(j['expirationDate']),
        dailyConsumption: _d(j['dailyConsumption']),
        image: _s(j['image'], '📦'),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'currentQuantity': currentQuantity,
        'initialQuantity': initialQuantity,
        'unit': unit,
        'purchasePrice': purchasePrice,
        'purchaseDate': purchaseDate,
        'expirationDate': expirationDate,
        'dailyConsumption': dailyConsumption,
        'image': image,
      };
}

class FoodDatabaseItem {
  String id;
  String name;
  double calories;
  double protein;
  double carbs;
  double fat;
  double fiber;
  double sugar;

  /// Natriy, mg (tuz = natriy × 2.5).
  double sodium;

  /// NOVA qayta ishlanganlik guruhi: 1 = tabiiy ... 4 = ultra-qayta ishlangan.
  int nova;

  /// 100 g dagi sabzavot/meva portsiyalari (1 portsiya = 80 g).
  double veg;

  String unit;
  double servingSize;

  /// So'mda: `unit` kg bo'lsa 1 kg narxi, pieces bo'lsa 1 dona narxi.
  double pricePerUnit;
  String image;
  String category;

  FoodDatabaseItem({
    required this.id,
    required this.name,
    required this.calories,
    required this.protein,
    required this.carbs,
    required this.fat,
    required this.fiber,
    required this.sugar,
    this.sodium = 0,
    this.nova = 1,
    this.veg = 0,
    required this.unit,
    required this.servingSize,
    required this.pricePerUnit,
    required this.image,
    this.category = '',
  });

  factory FoodDatabaseItem.fromJson(Map<String, dynamic> j) => FoodDatabaseItem(
        id: _s(j['id']),
        name: _s(j['name']),
        calories: _d(j['calories']),
        protein: _d(j['protein']),
        carbs: _d(j['carbs']),
        fat: _d(j['fat']),
        fiber: _d(j['fiber']),
        sugar: _d(j['sugar']),
        sodium: _d(j['sodium']),
        nova: _i(j['nova'], 1),
        veg: _d(j['veg']),
        unit: _s(j['unit'], 'kg'),
        servingSize: _d(j['servingSize'], 100),
        pricePerUnit: _d(j['pricePerUnit']),
        image: _s(j['image'], '🍽️'),
        category: _s(j['category']),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'calories': calories,
        'protein': protein,
        'carbs': carbs,
        'fat': fat,
        'fiber': fiber,
        'sugar': sugar,
        'sodium': sodium,
        'nova': nova,
        'veg': veg,
        'unit': unit,
        'servingSize': servingSize,
        'pricePerUnit': pricePerUnit,
        'image': image,
        'category': category,
      };
}

class MealComponent {
  String foodId;
  String name;
  double amount;
  String unit;

  MealComponent({
    this.foodId = '',
    required this.name,
    required this.amount,
    required this.unit,
  });

  factory MealComponent.fromJson(Map<String, dynamic> j) => MealComponent(
        foodId: _s(j['foodId']),
        name: _s(j['name']),
        amount: _d(j['amount']),
        unit: _s(j['unit'], 'grams'),
      );

  Map<String, dynamic> toJson() =>
      {'foodId': foodId, 'name': name, 'amount': amount, 'unit': unit};
}

class MealLog {
  String id;
  String timestamp; // ISO
  String name;
  String type; // breakfast | lunch | dinner | snack
  List<MealComponent> components;
  double calories;
  double protein;
  double carbs;
  double fat;

  /// UNUM Score bularsiz hisoblanmaydi — shakar, kletchatka va natriy
  /// ballning 30 foizini tashkil qiladi.
  double sugar;
  double fiber;
  double sodium; // mg

  /// Taomdagi sabzavot/meva portsiyalari (1 portsiya = 80 g).
  double vegServings;

  /// NOVA guruhi: 4 = ultra-qayta ishlangan, Score'ni pasaytiradi.
  int nova;

  /// So'mda.
  double cost;
  String? analysis;

  MealLog({
    required this.id,
    required this.timestamp,
    required this.name,
    required this.type,
    required this.components,
    required this.calories,
    required this.protein,
    required this.carbs,
    required this.fat,
    this.sugar = 0,
    this.fiber = 0,
    this.sodium = 0,
    this.vegServings = 0,
    this.nova = 1,
    required this.cost,
    this.analysis,
  });

  factory MealLog.fromJson(Map<String, dynamic> j) => MealLog(
        id: _s(j['id']),
        timestamp: _s(j['timestamp']),
        name: _s(j['name']),
        type: _s(j['type'], 'lunch'),
        components: ((j['components'] ?? []) as List)
            .map((e) => MealComponent.fromJson(Map<String, dynamic>.from(e)))
            .toList(),
        calories: _d(j['calories']),
        protein: _d(j['protein']),
        carbs: _d(j['carbs']),
        fat: _d(j['fat']),
        sugar: _d(j['sugar']),
        fiber: _d(j['fiber']),
        sodium: _d(j['sodium']),
        vegServings: _d(j['vegServings']),
        nova: _i(j['nova'], 1),
        cost: _d(j['cost']),
        analysis: j['analysis']?.toString(),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'timestamp': timestamp,
        'name': name,
        'type': type,
        'components': components.map((c) => c.toJson()).toList(),
        'calories': calories,
        'protein': protein,
        'carbs': carbs,
        'fat': fat,
        'sugar': sugar,
        'fiber': fiber,
        'sodium': sodium,
        'vegServings': vegServings,
        'nova': nova,
        'cost': cost,
        'analysis': analysis,
      };
}

class WaterLog {
  String id;
  String timestamp;
  double amountMl;

  WaterLog({required this.id, required this.timestamp, required this.amountMl});

  factory WaterLog.fromJson(Map<String, dynamic> j) => WaterLog(
        id: _s(j['id']),
        timestamp: _s(j['timestamp']),
        amountMl: _d(j['amountMl']),
      );

  Map<String, dynamic> toJson() =>
      {'id': id, 'timestamp': timestamp, 'amountMl': amountMl};
}

class BodyProgressLog {
  String id;
  String date; // YYYY-MM-DD
  double weight;
  double? bodyFat;
  double? muscleMass;
  double bmi;

  BodyProgressLog({
    required this.id,
    required this.date,
    required this.weight,
    this.bodyFat,
    this.muscleMass,
    required this.bmi,
  });

  factory BodyProgressLog.fromJson(Map<String, dynamic> j) => BodyProgressLog(
        id: _s(j['id']),
        date: _s(j['date']),
        weight: _d(j['weight']),
        bodyFat: j['bodyFat'] == null ? null : _d(j['bodyFat']),
        muscleMass: j['muscleMass'] == null ? null : _d(j['muscleMass']),
        bmi: _d(j['bmi']),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'date': date,
        'weight': weight,
        'bodyFat': bodyFat,
        'muscleMass': muscleMass,
        'bmi': bmi,
      };
}

class ExpenseRecord {
  String id;
  String date;
  double amount;
  String category; // inventory_purchase | meal_cost | other
  String description;

  ExpenseRecord({
    required this.id,
    required this.date,
    required this.amount,
    required this.category,
    required this.description,
  });

  factory ExpenseRecord.fromJson(Map<String, dynamic> j) => ExpenseRecord(
        id: _s(j['id']),
        date: _s(j['date']),
        amount: _d(j['amount']),
        category: _s(j['category'], 'other'),
        description: _s(j['description']),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'date': date,
        'amount': amount,
        'category': category,
        'description': description,
      };
}

class CoachMessage {
  String id;
  String sender; // user | ai
  String text;
  String timestamp;

  CoachMessage({
    required this.id,
    required this.sender,
    required this.text,
    required this.timestamp,
  });

  factory CoachMessage.fromJson(Map<String, dynamic> j) => CoachMessage(
        id: _s(j['id']),
        sender: _s(j['sender'], 'ai'),
        text: _s(j['text']),
        timestamp: _s(j['timestamp']),
      );

  Map<String, dynamic> toJson() =>
      {'id': id, 'sender': sender, 'text': text, 'timestamp': timestamp};
}

class AchievementBadge {
  String id;
  String title;
  String description;
  String icon;
  bool unlocked;
  String? unlockedAt;

  AchievementBadge({
    required this.id,
    required this.title,
    required this.description,
    required this.icon,
    required this.unlocked,
    this.unlockedAt,
  });

  factory AchievementBadge.fromJson(Map<String, dynamic> j) => AchievementBadge(
        id: _s(j['id']),
        title: _s(j['title']),
        description: _s(j['description']),
        icon: _s(j['icon'], '🏅'),
        unlocked: j['unlocked'] == true,
        unlockedAt: j['unlockedAt']?.toString(),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'description': description,
        'icon': icon,
        'unlocked': unlocked,
        'unlockedAt': unlockedAt,
      };
}

class ActivityLog {
  String id;
  String timestamp;
  String type; // walking | running | cycling | gym | football | swimming | home_workout | basketball | custom
  String? customTypeName;
  int durationMinutes;
  int caloriesBurned;
  int? steps;
  double? distanceKm;
  int? heartRate;
  String source; // manual | google_fit | apple_health

  ActivityLog({
    required this.id,
    required this.timestamp,
    required this.type,
    this.customTypeName,
    required this.durationMinutes,
    required this.caloriesBurned,
    this.steps,
    this.distanceKm,
    this.heartRate,
    this.source = 'manual',
  });

  factory ActivityLog.fromJson(Map<String, dynamic> j) => ActivityLog(
        id: _s(j['id']),
        timestamp: _s(j['timestamp']),
        type: _s(j['type'], 'custom'),
        customTypeName: j['customTypeName']?.toString(),
        durationMinutes: _i(j['durationMinutes']),
        caloriesBurned: _i(j['caloriesBurned']),
        steps: j['steps'] == null ? null : _i(j['steps']),
        distanceKm: j['distanceKm'] == null ? null : _d(j['distanceKm']),
        heartRate: j['heartRate'] == null ? null : _i(j['heartRate']),
        source: _s(j['source'], 'manual'),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'timestamp': timestamp,
        'type': type,
        'customTypeName': customTypeName,
        'durationMinutes': durationMinutes,
        'caloriesBurned': caloriesBurned,
        'steps': steps,
        'distanceKm': distanceKm,
        'heartRate': heartRate,
        'source': source,
      };
}

// AI response helper models
class ParsedMeal {
  final String name;
  final List<MealComponent> components;
  final double calories, protein, carbs, fat, cost;
  final double sugar, fiber, sodium, vegServings;
  /// Ichilgan suyuqlik (ml). Suv/choy/energetik uchun to'ladi, taomda 0.
  final double waterMl;
  final int nova;
  final String analysis;
  ParsedMeal(this.name, this.components, this.calories, this.protein, this.carbs,
      this.fat, this.cost, this.analysis,
      {this.sugar = 0,
      this.fiber = 0,
      this.sodium = 0,
      this.vegServings = 0,
      this.waterMl = 0,
      this.nova = 1});

  /// Sof suv yoki choy: hisoblanadigan kaloriyasi yo'q, faqat suv sifatida
  /// yoziladi — aks holda kunlik ro'yxat 0 kkal yozuvlar bilan to'lib ketadi.
  bool get isDrinkOnly => waterMl > 0 && calories < 25;

  factory ParsedMeal.fromJson(Map<String, dynamic> j) => ParsedMeal(
        _s(j['name'], 'Taom'),
        ((j['components'] ?? []) as List)
            .map((e) => MealComponent.fromJson(Map<String, dynamic>.from(e)))
            .toList(),
        _d(j['calories']),
        _d(j['protein']),
        _d(j['carbs']),
        _d(j['fat']),
        _d(j['cost']),
        _s(j['analysis']),
        sugar: _d(j['sugar']),
        fiber: _d(j['fiber']),
        sodium: _d(j['sodium']),
        vegServings: _d(j['vegServings']),
        waterMl: _d(j['waterMl']),
        nova: _i(j['novaScore'] ?? j['nova'], 1).clamp(1, 4),
      );
}

class PlannedMeal {
  final String name, description;
  final double calories, protein, carbs, fat;
  final List<MealComponent> ingredients;
  PlannedMeal(this.name, this.description, this.calories, this.protein,
      this.carbs, this.fat, this.ingredients);

  factory PlannedMeal.fromJson(Map<String, dynamic> j) => PlannedMeal(
        _s(j['name'], 'Taom'),
        _s(j['description']),
        _d(j['calories']),
        _d(j['protein']),
        _d(j['carbs']),
        _d(j['fat']),
        ((j['ingredients'] ?? []) as List)
            .map((e) => MealComponent.fromJson(Map<String, dynamic>.from(e)))
            .toList(),
      );
}

class MealPlan {
  final Map<String, PlannedMeal> meals;
  final double calories, protein, carbs, fat, estimatedCost;
  MealPlan(this.meals, this.calories, this.protein, this.carbs, this.fat,
      this.estimatedCost);

  factory MealPlan.fromJson(Map<String, dynamic> j) {
    final m = Map<String, dynamic>.from(j['meals'] ?? {});
    final n = Map<String, dynamic>.from(j['totalNutrients'] ?? {});
    return MealPlan(
      {
        for (final k in ['breakfast', 'lunch', 'dinner', 'snack'])
          if (m[k] != null) k: PlannedMeal.fromJson(Map<String, dynamic>.from(m[k])),
      },
      _d(n['calories']),
      _d(n['protein']),
      _d(n['carbs']),
      _d(n['fat']),
      _d(j['estimatedCost']),
    );
  }
}

class PhotoAnalysis {
  final String name;
  final double estimatedWeightGrams, calories, protein, carbs, fat, confidenceScore;
  final double sugar, fiber, sodium, vegServings, cost;
  /// Ichilgan suyuqlik (ml) — rasmda suv shishasi/banka bo'lsa to'ladi.
  final double waterMl;
  final int nova;
  final List<MealComponent> detectedComponents;
  final String feedback;
  PhotoAnalysis(this.name, this.estimatedWeightGrams, this.calories, this.protein,
      this.carbs, this.fat, this.confidenceScore, this.detectedComponents, this.feedback,
      {this.sugar = 0,
      this.fiber = 0,
      this.sodium = 0,
      this.vegServings = 0,
      this.cost = 0,
      this.waterMl = 0,
      this.nova = 1});

  bool get isDrinkOnly => waterMl > 0 && calories < 25;

  factory PhotoAnalysis.fromJson(Map<String, dynamic> j) => PhotoAnalysis(
        _s(j['name'], 'Taom'),
        _d(j['estimatedWeightGrams']),
        _d(j['calories']),
        _d(j['protein']),
        _d(j['carbs']),
        _d(j['fat']),
        _d(j['confidenceScore'], 0.9),
        ((j['detectedComponents'] ?? []) as List)
            .map((e) => MealComponent.fromJson(Map<String, dynamic>.from(e)))
            .toList(),
        _s(j['feedback']),
        sugar: _d(j['sugar']),
        fiber: _d(j['fiber']),
        sodium: _d(j['sodium']),
        vegServings: _d(j['vegServings']),
        cost: _d(j['cost']),
        waterMl: _d(j['waterMl']),
        nova: _i(j['novaScore'] ?? j['nova'], 1).clamp(1, 4),
      );
}
