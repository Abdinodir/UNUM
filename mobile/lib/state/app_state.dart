import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models.dart';
import '../insights.dart';
import '../score.dart';
import '../data/defaults.dart';
import '../config.dart';
import '../services/api_client.dart';
import '../services/prayer_service.dart';
import '../services/health_service.dart';
import '../services/screen_time_service.dart';
import '../services/step_service.dart';
import '../pillars.dart';
import '../theme.dart';

/// Global messenger for showing toast-like SnackBars from anywhere.
final GlobalKey<ScaffoldMessengerState> messengerKey =
    GlobalKey<ScaffoldMessengerState>();

class _Keys {
  static const token = 'unum_token';
  static const email = 'unum_email';
  static const name = 'unum_name';
  static const lastCheckIn = 'unum_last_checkin';
}

String _todayStr() => DateTime.now().toIso8601String().split('T')[0];

class AppState extends ChangeNotifier {
  late SharedPreferences _prefs;
  late ApiClient api;

  // ---- auth ----
  String? token;
  String userEmail = '';
  String userName = '';
  bool get isLoggedIn => token != null && token!.isNotEmpty;

  // ---- data (in-memory cache, backed by the server DB) ----
  UserProfile profile = Defaults.profile();
  List<InventoryItem> inventory = [];
  List<FoodDatabaseItem> foodDatabase = [];
  List<MealLog> mealLogs = [];
  List<WaterLog> waterLogs = [];
  List<BodyProgressLog> bodyLogs = [];
  List<ExpenseRecord> expenses = [];
  List<AchievementBadge> achievements = [];
  List<CoachMessage> coachMessages = [];
  List<ActivityLog> activities = [];

  // ---- 4 ustun ----
  List<PrayerDay> prayerDays = [];
  List<FocusSession> focusSessions = [];
  List<SleepLog> sleepLogs = [];

  /// Namoz vaqtlari — hisob telefonda bajariladi, koordinata serverga
  /// yuborilmaydi.
  final PrayerService prayer = PrayerService();

  /// Kunlik rivojlanish maqsadi (daqiqa). Profilda saqlanadi.
  int get focusTargetMinutes => 120;

  bool ready = false; // prefs loaded
  bool loadingData = false; // fetching from server
  String? loadError;

  /// Profil serverdan HAQIQATAN o'qib olinganmi.
  ///
  /// Bunsiz `needsOnboarding` boshlanishida `Defaults.profile()` ni ko'rib
  /// (uning `onboarded` qiymati `false`) mavjud foydalanuvchiga ham
  /// onboardingni ochib yuborardi — va uni to'ldirsa, haqiqiy vazni,
  /// maqsadlari va seriyasi ustidan yozilardi.
  bool profileLoaded = false;

  // ---- qadam sensori ----
  final StepService _steps = StepService();
  final HealthService _health = HealthService();
  final ScreenTimeService _screen = ScreenTimeService();

  /// Bugungi ekran vaqti, daqiqada. `null` — ruxsat yo'q yoki bilinmaydi
  /// (NOL EMAS: nol "telefonni ishlatmadingiz" degani bo'lardi).
  int? screenMinutes;

  /// "Usage access" ruxsati berilganmi.
  bool screenTimeConnected = false;

  /// Health Connect'dan olingan bugungi qadam. `null` — ma'lumot yo'q
  /// (ruxsat berilmagan yoki HC o'rnatilmagan), NOL EMAS.
  int? healthSteps;

  /// Health Connect ulanganmi — sozlamalar ekrani shu bayroqni ko'rsatadi.
  bool healthConnected = false;

  /// Health Connect qurilmada O'RNATILGANMI.
  ///
  /// `null` — hali TEKSHIRILMAGAN. Boshida `true` deb hisoblasak,
  /// birinchi bosishda ruxsat so'raladi va o'rnatilmagan telefonda
  /// "Ruxsat berilmadi" degan chalkash xabar chiqadi — aslida ruxsat
  /// rad etilmagan, so'raydigan ilovaning o'zi yo'q.
  bool? healthInstalled;

  /// Holatni SO'ROV PAYTIDA tekshiradi — keshga tayanmaydi.
  Future<bool> checkHealthInstalled() async {
    healthInstalled = await _health.installed;
    notifyListeners();
    return healthInstalled == true;
  }
  StreamSubscription<int>? _stepSub;

  /// Sensordan o'qilgan bugungi qadam. 0 — sensor yo'q yoki ruxsat berilmagan.
  int sensorSteps = 0;

  /// Sensor ishlayaptimi (profil ekranida holatni ko'rsatish uchun).
  bool get stepSensorActive => _steps.available;

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
    token = _prefs.getString(_Keys.token);
    userEmail = _prefs.getString(_Keys.email) ?? '';
    userName = _prefs.getString(_Keys.name) ?? '';
    api = ApiClient(() => AppConfig.defaultBackendUrl, token: token);
    ready = true;
    notifyListeners();
    if (isLoggedIn) {
      await loadAll();
      await startStepTracking();
      await syncHealth();
      await syncScreenTime();
    }
  }

  /// Qadam sensorini ishga tushiradi (ruxsat so'raydi).
  ///
  /// Ruxsat berilmasa jimgina qaytadi — ilova qadamsiz ham to'liq ishlaydi,
  /// foydalanuvchi uni mashg'ulot sifatida qo'lda kiritishi mumkin.
  /// Health Connect'ni ulaydi va bugungi qadam/uyquni tortadi.
  ///
  /// Ruxsat SO'RALMAYDI — faqat allaqachon berilgan bo'lsa o'qiydi.
  /// Ilova birinchi ochilishida sog'liq ruxsatini so'rash bosim bo'ladi;
  /// foydalanuvchi uni Sozlamalar → Integratsiyalar dan o'zi yoqadi.
  Future<void> syncHealth({bool ask = false}) async {
    if (!_health.supported) return;

    healthInstalled = await _health.installed;
    if (healthInstalled != true) {
      healthConnected = false;
      notifyListeners();
      return;
    }

    var granted = await _health.hasPermission();
    if (!granted && ask) granted = await _health.requestPermission();

    healthConnected = granted;
    if (!granted) {
      notifyListeners();
      return;
    }

    final steps = await _health.todaySteps();
    if (steps != null) healthSteps = steps;
    await _pushDeviceSteps();

    // Uyqu: shu kunga yozuv bo'lmasa qo'shamiz. Qo'lda kiritilganini
    // BOSIB O'TMAYMIZ — foydalanuvchi o'zi yozgan bo'lsa u ustun.
    final sleep = await _health.lastSleep();
    if (sleep != null) {
      final date = sleep.wake.toIso8601String().split('T')[0];
      final exists = sleepLogs.any((s) => s.date == date);
      if (!exists) {
        await logSleep(sleep.bed, sleep.wake, 3);
      }
    }

    notifyListeners();
  }

  /// Qurilma o'lchagan qadamni SERVERGA yozadi.
  ///
  /// Busiz qadam faqat ilova xotirasida qolardi: server ballni
  /// `activities` kolleksiyasidan hisoblaydi, demak web va bot 0 qadam
  /// ko'rib, ilovadan BOSHQA ball chiqarardi.
  ///
  /// Kuniga BITTA `source: 'device'` yozuvi yuritiladi va u yangilanadi —
  /// har o'lchovda yangi qator qo'shilsa, kunlik yig'indi bir necha
  /// barobar oshib ketardi. Qo'lda kiritilgan mashg'ulotlar alohida
  /// qoladi: ular "qo'shimcha faollik", takror emas.
  Future<void> _pushDeviceSteps() async {
    // Sensor va Health Connect ko'pincha AYNI BIR XIL qadamni beradi
    // (HC telefon sensoridan ham yozadi) — qo'shmaymiz, eng kattasini
    // olamiz.
    final hc = healthSteps ?? 0;
    final steps = sensorSteps > hc ? sensorSteps : hc;
    if (steps <= 0) return;
    final today = DateTime.now().toIso8601String().split('T')[0];

    ActivityLog? existing;
    for (final a in activities) {
      if (a.source == 'device' && a.timestamp.startsWith(today)) {
        existing = a;
        break;
      }
    }

    // O'zgarmagan bo'lsa serverga tegmaymiz.
    if (existing != null && existing.steps == steps) return;

    final log = ActivityLog(
      id: existing?.id ?? '',
      timestamp: DateTime.now().toIso8601String(),
      type: 'walking',
      durationMinutes: 0,
      caloriesBurned: 0,
      steps: steps,
      source: 'device',
    );

    try {
      if (existing != null && existing.id.isNotEmpty) {
        await api.update('activities', existing.id, log.toJson());
        log.id = existing.id;
        final i = activities.indexOf(existing);
        if (i >= 0) activities[i] = log;
      } else {
        final created = await api.create('activities', log.toJson());
        activities.insert(0, ActivityLog.fromJson(created));
      }
    } catch (e) {
      debugPrint('[health] qadamni saqlash: $e');
    }
  }

  /// Health Connect'ni o'rnatish sahifasini ochadi (Play Market).
  Future<bool> openHealthStore() => _health.openStore();

  /// Ekran vaqtini o'qiydi. Ruxsat bo'lmasa jimgina qaytadi.
  Future<void> syncScreenTime() async {
    if (!_screen.supported) return;
    screenTimeConnected = await _screen.hasPermission();
    screenMinutes = screenTimeConnected ? await _screen.todayMinutes() : null;
    notifyListeners();
  }

  /// Tizim sozlamalarini ochadi — ruxsat faqat u yerdan beriladi.
  Future<void> openScreenTimeSettings() => _screen.openSettings();

  Future<void> startStepTracking() async {
    if (_stepSub != null) return;

    sensorSteps = await _steps.restoreCached();
    if (sensorSteps > 0) notifyListeners();

    final ok = await _steps.start();
    if (!ok) return;

    _stepSub = _steps.todaySteps.listen((v) {
      if (v == sensorSteps) return;
      sensorSteps = v;
      notifyListeners();
      // Serverga ham yozamiz — aks holda qadam faqat ilova xotirasida
      // qolib, ball, web va bot 0 qadam ko'rardi.
      _pushDeviceSteps();
    });
    notifyListeners();
  }

  @override
  void dispose() {
    _stepSub?.cancel();
    _steps.dispose();
    super.dispose();
  }

  // ======================= AUTH =======================
  Future<void> _setAuth(String tk, String email, String name) async {
    token = tk;
    userEmail = email;
    userName = name;
    api.token = tk;
    await _prefs.setString(_Keys.token, tk);
    await _prefs.setString(_Keys.email, email);
    await _prefs.setString(_Keys.name, name);
  }

  /// Google orqali kirish.
  ///
  /// Telefonda native SDK hisobni tanlatadi va `id_token` beradi; uni serverga
  /// yuboramiz, server esa imzoni tekshirib o'z JWT'ini qaytaradi. Parol
  /// umuman ishtirok etmaydi.
  Future<void> signInWithGoogle() async {
    final signIn = GoogleSignIn.instance;

    // `serverClientId` — backenddagi WEB client ID. `id_token` ning `aud` i
    // shunga teng bo'ladi va server uni tanaydi.
    await signIn.initialize(serverClientId: AppConfig.googleServerClientId);

    final account = await signIn.authenticate();
    final idToken = account.authentication.idToken;
    if (idToken == null || idToken.isEmpty) {
      throw ApiException('Google javobida id_token yo\'q');
    }

    final result = await api.loginWithGoogle(idToken);
    await _setAuth(result.token, result.email, result.name);
    await loadAll();
  }

  Future<void> register(String email, String password, String name) async {
    final r = await api.register(email.trim(), password, name.trim());
    await _setAuth(r.token, r.email, r.name);
    await loadAll();
  }

  Future<void> login(String email, String password) async {
    final r = await api.login(email.trim(), password);
    await _setAuth(r.token, r.email, r.name);
    await loadAll();
    await startStepTracking();
  }

  // ---------- telefon bilan kirish ----------
  Future<void> requestPhoneCode(String phone) =>
      api.requestPhoneCode(phone);

  Future<bool> verifyPhoneCode(String phone, String code, String name) async {
    final r = await api.verifyPhoneCode(phone, code, name);
    await _setAuth(r.token, r.email, r.name);
    await loadAll();
    await startStepTracking();
    return r.isNew;
  }

  Future<void> logout() async {
    token = null;
    api.token = null;
    await _prefs.remove(_Keys.token);
    await _prefs.remove(_Keys.email);
    await _prefs.remove(_Keys.name);
    profileLoaded = false;
    profile = Defaults.profile();
    inventory = [];
    foodDatabase = [];
    mealLogs = [];
    waterLogs = [];
    bodyLogs = [];
    expenses = [];
    achievements = [];
    coachMessages = [];
    activities = [];
    prayerDays = [];
    focusSessions = [];
    sleepLogs = [];
    notifyListeners();
  }

  Future<void> loadAll() async {
    loadingData = true;
    loadError = null;
    notifyListeners();
    try {
      // Profil birinchi va alohida: uni olgach darhol UI ni yangilaymiz,
      // shunda foydalanuvchi qolgan ma'lumot kelguncha splashda o'tirmaydi.
      profile = await api.getProfile();
      profileLoaded = true;
      notifyListeners();

      // Qolgan 11 ta so'rov PARALLEL ketadi. Ketma-ket bo'lganda har biri
      // funnel orqali ~100-300 ms olib, jami bir necha soniyaga cho'zilardi.
      final results = await Future.wait([
        api.list('inventory'),
        api.list('food'),
        api.list('meals'),
        api.list('water'),
        api.list('body'),
        api.list('expenses'),
        api.list('achievements'),
        api.list('activities'),
        api.list('coach'),
        api.list('prayers'),
        api.list('focus'),
        api.list('sleep'),
      ]);

      inventory = results[0].map(InventoryItem.fromJson).toList();
      foodDatabase = results[1].map(FoodDatabaseItem.fromJson).toList();
      mealLogs = results[2].map(MealLog.fromJson).toList()
        ..sort((a, b) => b.timestamp.compareTo(a.timestamp));
      waterLogs = results[3].map(WaterLog.fromJson).toList();
      bodyLogs = results[4].map(BodyProgressLog.fromJson).toList();
      expenses = results[5].map(ExpenseRecord.fromJson).toList()
        ..sort((a, b) => b.date.compareTo(a.date));
      achievements = results[6].map(AchievementBadge.fromJson).toList();
      activities = results[7].map(ActivityLog.fromJson).toList()
        ..sort((a, b) => b.timestamp.compareTo(a.timestamp));
      coachMessages = results[8].map(CoachMessage.fromJson).toList();
      prayerDays = results[9].map(PrayerDay.fromJson).toList();
      focusSessions = results[10].map(FocusSession.fromJson).toList()
        ..sort((a, b) => b.timestamp.compareTo(a.timestamp));
      sleepLogs = results[11].map(SleepLog.fromJson).toList()
        ..sort((a, b) => a.date.compareTo(b.date));

      await prayer.load();
      loadError = null;
      await _touchStreak();
    } on ApiException catch (e) {
      if (e.status == 401) {
        await logout();
        loadError = 'Sessiya tugagan, qayta kiring';
      } else {
        loadError = e.message;
      }
    } catch (e) {
      loadError = 'Serverga ulanib bo\'lmadi. Manzilni tekshiring.';
    } finally {
      loadingData = false;
      notifyListeners();
    }
  }

  // ======================= persistence helpers =======================
  Future<void> _saveProfile() async {
    try {
      await api.putProfile(profile);
    } catch (_) {
      notify('Profil serverga saqlanmadi', type: 'warning');
    }
  }

  // ---------- notifications ----------
  void notify(String message, {String type = 'info'}) {
    final messenger = messengerKey.currentState;
    if (messenger == null) return;
    Color bg;
    IconData icon;
    switch (type) {
      case 'success':
        bg = const Color(0xFF10B981);
        icon = Icons.check_circle_rounded;
        break;
      case 'warning':
        bg = const Color(0xFFF59E0B);
        icon = Icons.warning_amber_rounded;
        break;
      case 'achievement':
        bg = const Color(0xFF8B5CF6);
        icon = Icons.emoji_events_rounded;
        break;
      default:
        bg = const Color(0xFF0EA5E9);
        icon = Icons.info_rounded;
    }
    messenger.clearSnackBars();
    messenger.showSnackBar(SnackBar(
      backgroundColor: bg,
      duration: const Duration(seconds: 3),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      content: Row(children: [
        Icon(icon, color: Colors.white, size: 20),
        const SizedBox(width: 10),
        Expanded(
            child: Text(message,
                style: const TextStyle(fontWeight: FontWeight.w600))),
      ]),
    ));
  }

  // ---------- gamification ----------
  void gainXp(int amount) {
    final prev = profile.xp;
    profile.xp = prev + amount;
    final currentLevel = (prev ~/ 100) + 1;
    final nextLevel = (profile.xp ~/ 100) + 1;
    if (nextLevel > currentLevel) {
      profile.level = nextLevel;
      notify('🎉 DARAJA OSHDI! $nextLevel-darajaga yetdingiz!', type: 'achievement');
    }
    _saveProfile();
    notifyListeners();
  }

  /// Kunlik seriyani yangilaydi. Ilova ochilganda va har bir yozuv
  /// kiritilganda chaqiriladi.
  ///
  /// Ilgari `streak` hech qachon o'zgarmagan — ekranda turgan 🔥 raqami
  /// shunchaki bezak edi.
  Future<void> _touchStreak() async {
    final today = _todayStr();
    final last = profile.lastActiveDate;
    if (last == today) return; // bugun allaqachon hisoblangan

    final lastDate = DateTime.tryParse(last);
    if (lastDate == null) {
      profile.streak = 1;
    } else {
      final gap = DateTime.parse(today).difference(lastDate).inDays;
      // 1 kun = davomi, undan ko'p = uzilish.
      profile.streak = gap == 1 ? profile.streak + 1 : 1;
    }
    profile.lastActiveDate = today;

    if (profile.streak >= 7) _unlock('ach_5', "Sog'lom Hafta");
    notifyListeners();
    await _saveProfile();
  }

  /// Yutuqni ochadi (allaqachon ochilgan bo'lsa hech narsa qilmaydi).
  void _unlock(String id, String title) {
    for (final a in achievements) {
      if (a.id == id && !a.unlocked) {
        a.unlocked = true;
        a.unlockedAt = _todayStr();
        _persistAchievement(a);
        notify('🏆 YUTUQ: $title!', type: 'achievement');
        notifyListeners();
      }
    }
  }

  /// Har bir yozuvdan keyin ballga bog'liq yutuqlarni tekshiradi.
  void _checkScoreAchievements() {
    final sc = todayScore;
    if (sc.hasData && sc.total >= 90) _unlock('ach_3', 'Toza Kun');

    // Oqsil Qiroli: ketma-ket 3 kun oqsil me'yori bajarilgan.
    if (_proteinStreakDays() >= 3) _unlock('ach_1', 'Oqsil Qiroli');
  }

  int _proteinStreakDays() {
    var days = 0;
    for (var i = 0; i < 7; i++) {
      final day = DateTime.now().subtract(Duration(days: i));
      final key = day.toIso8601String().split('T')[0];
      final protein = mealLogs
          .where((m) => m.timestamp.split('T')[0] == key)
          .fold<double>(0, (s, m) => s + m.protein);
      if (protein >= profile.targetProtein) {
        days++;
      } else {
        break;
      }
    }
    return days;
  }

  // ---------- profile ----------
  Future<void> updateProfile(UserProfile Function(UserProfile) mutate) async {
    profile = mutate(profile);
    notifyListeners();
    try {
      await api.putProfile(profile);
      notify('Profil muvaffaqiyatli yangilandi!', type: 'success');
    } catch (_) {
      notify('Profil serverga saqlanmadi', type: 'warning');
    }
  }

  // ---------- inventory ----------
  Future<void> addInventoryItem(InventoryItem item) async {
    try {
      final created = await api.create('inventory', item.toJson());
      final saved = InventoryItem.fromJson(created);
      inventory.insert(0, saved);
      notify('${saved.name} zaxiraga qo\'shildi!', type: 'success');
      gainXp(15);
      notifyListeners();
    } catch (e) {
      notify('Saqlanmadi: ${_short(e)}', type: 'warning');
    }
  }

  Future<void> updateInventoryItem(String id, void Function(InventoryItem) mutate,
      {bool silent = false}) async {
    final item = inventory.where((e) => e.id == id).firstOrNull;
    if (item == null) return;
    final wasAbove = item.currentQuantity > item.initialQuantity * 0.25;
    mutate(item);
    if (!silent &&
        item.currentQuantity <= item.initialQuantity * 0.25 &&
        wasAbove) {
      notify(
          '⚠️ ${item.name} kam qoldi (${_fmtQty(item.currentQuantity)} ${item.unit})',
          type: 'warning');
    }
    notifyListeners();
    try {
      await api.update('inventory', id, item.toJson());
    } catch (_) {}
  }

  Future<void> deleteInventoryItem(String id) async {
    final item = inventory.where((e) => e.id == id).firstOrNull;
    inventory.removeWhere((e) => e.id == id);
    notifyListeners();
    try {
      await api.remove('inventory', id);
      if (item != null) notify('${item.name} o\'chirildi.');
    } catch (e) {
      notify('O\'chirilmadi: ${_short(e)}', type: 'warning');
    }
  }

  Future<void> purchaseInventoryItem(String id, double buyAmount) async {
    final item = inventory.where((e) => e.id == id).firstOrNull;
    if (item == null) return;
    final newQty = item.currentQuantity + buyAmount;
    final priceForAmount =
        (buyAmount / (item.initialQuantity <= 0 ? 1 : item.initialQuantity)) *
            item.purchasePrice;
    final addedCost = (priceForAmount * 100).round() / 100;
    item.currentQuantity = newQty;
    item.initialQuantity = max(item.initialQuantity, newQty);
    item.purchaseDate = _todayStr();
    notifyListeners();
    try {
      await api.update('inventory', id, item.toJson());
    } catch (_) {}

    await addExpense(ExpenseRecord(
      id: '',
      date: _todayStr(),
      amount: addedCost <= 0 ? 5.0 : addedCost,
      category: 'inventory_purchase',
      description: '${_fmtQty(buyAmount)} ${item.unit} ${item.name} sotib olindi',
    ), silent: true);
    notify(
        '${_fmtQty(buyAmount)} ${item.unit} ${item.name} sotib olindi!',
        type: 'success');
    gainXp(20);
  }

  // ---------- food database ----------
  Future<FoodDatabaseItem?> addFoodToDatabase(FoodDatabaseItem food) async {
    try {
      final created = await api.create('food', food.toJson());
      final saved = FoodDatabaseItem.fromJson(created);
      foodDatabase.add(saved);
      notify('${saved.name} bazaga qo\'shildi!', type: 'success');
      _unlock('ach_4', 'Oshpazlik Ustasi');
      gainXp(30);
      notifyListeners();
      return saved;
    } catch (e) {
      notify('Saqlanmadi: ${_short(e)}', type: 'warning');
      return null;
    }
  }

  void _persistAchievement(AchievementBadge a) {
    api.update('achievements', a.id, a.toJson()).catchError((_) {});
  }

  // ---------- meals ----------
  Future<void> logMeal(MealLog meal) async {
    meal.timestamp = DateTime.now().toIso8601String();
    try {
      final created = await api.create('meals', meal.toJson());
      final saved = MealLog.fromJson(created);
      mealLogs.insert(0, saved);
      notify('Taom kiritildi: ${saved.name}', type: 'success');
      gainXp(15);
      await _touchStreak();
      _checkScoreAchievements();
      notifyListeners();
    } catch (e) {
      notify('Saqlanmadi: ${_short(e)}', type: 'warning');
      return;
    }

    // deduct from inventory
    for (final comp in meal.components) {
      final match = inventory.where((inv) {
        final a = inv.name.toLowerCase();
        final b = comp.name.toLowerCase();
        return a == b || a.contains(b) || b.contains(a);
      }).firstOrNull;
      if (match != null) {
        var deduct = comp.amount;
        if (comp.unit == 'grams' && match.unit == 'kg') {
          deduct = comp.amount / 1000;
        } else if (comp.unit == 'kg' && match.unit == 'grams') {
          deduct = comp.amount * 1000;
        }
        final next = max(0.0, match.currentQuantity - deduct);
        await updateInventoryItem(match.id, (it) {
          it.currentQuantity = (next * 100).round() / 100;
        }, silent: true);
      }
    }

    final today = meal.timestamp.split('T')[0];
    final proteinToday = mealLogs
        .where((m) => m.timestamp.split('T')[0] == today)
        .fold<double>(0, (s, m) => s + m.protein);
    if (proteinToday >= profile.targetProtein) {
      notify('💪 Kunlik ${profile.targetProtein}g oqsil me\'yoriga yetdingiz!',
          type: 'success');
    }
  }

  Future<void> deleteMealLog(String id) async {
    final meal = mealLogs.where((e) => e.id == id).firstOrNull;
    mealLogs.removeWhere((e) => e.id == id);
    notifyListeners();
    try {
      await api.remove('meals', id);
    } catch (_) {
      return;
    }

    // logMeal() zaxiradan mahsulot ayirgan edi — o'chirilganda qaytaramiz,
    // aks holda zaxira asta-sekin noto'g'ri bo'lib qoladi.
    if (meal != null) {
      for (final comp in meal.components) {
        final match = _matchInventory(comp.name);
        if (match == null) continue;
        final restore = _convertAmount(comp.amount, comp.unit, match.unit);
        await updateInventoryItem(match.id, (it) {
          it.currentQuantity =
              ((it.currentQuantity + restore) * 100).round() / 100;
        }, silent: true);
      }
    }
    notify('Taom logi o\'chirildi');
  }

  InventoryItem? _matchInventory(String componentName) {
    final b = componentName.toLowerCase();
    return inventory.where((inv) {
      final a = inv.name.toLowerCase();
      return a == b || a.contains(b) || b.contains(a);
    }).firstOrNull;
  }

  double _convertAmount(double amount, String from, String to) {
    if (from == 'grams' && to == 'kg') return amount / 1000;
    if (from == 'kg' && to == 'grams') return amount * 1000;
    return amount;
  }

  // ---------- water ----------
  Future<void> addWater(double amountMl) async {
    final log = WaterLog(
        id: '', timestamp: DateTime.now().toIso8601String(), amountMl: amountMl);
    try {
      final created = await api.create('water', log.toJson());
      waterLogs.add(WaterLog.fromJson(created));
      notify('Suv qo\'shildi: +${amountMl.toInt()} ml 💧', type: 'success');
      gainXp(10);
      await _touchStreak();
      notifyListeners();
    } catch (e) {
      notify('Saqlanmadi: ${_short(e)}', type: 'warning');
      return;
    }

    if (waterToday >= 3000) _unlock('ach_2', 'Gidratsiya Qahramoni');
    _checkScoreAchievements();
  }

  // ---------- body ----------
  Future<void> logBodyProgress(BodyProgressLog log) async {
    try {
      final created = await api.create('body', log.toJson());
      bodyLogs.add(BodyProgressLog.fromJson(created));
      profile.weight = log.weight;
      notify('Tana progressi kiritildi: ${log.weight} kg', type: 'success');
      gainXp(25);
      _saveProfile();
      notifyListeners();
    } catch (e) {
      notify('Saqlanmadi: ${_short(e)}', type: 'warning');
    }
  }

  // ---------- expenses ----------
  Future<void> addExpense(ExpenseRecord e, {bool silent = false}) async {
    try {
      final created = await api.create('expenses', e.toJson());
      expenses.insert(0, ExpenseRecord.fromJson(created));
      if (!silent) notify('Xarajat kiritildi: \$${e.amount.toStringAsFixed(2)}');
      notifyListeners();
    } catch (err) {
      if (!silent) notify('Saqlanmadi: ${_short(err)}', type: 'warning');
    }
  }

  // ---------- coach ----------
  Future<void> addCoachMessage(String text, String sender) async {
    final msg = CoachMessage(
        id: '',
        sender: sender,
        text: text,
        timestamp: DateTime.now().toIso8601String());
    // optimistic local add
    coachMessages.add(msg);
    notifyListeners();
    try {
      final created = await api.create('coach', msg.toJson());
      // replace last with server copy (to get id)
      final saved = CoachMessage.fromJson(created);
      final idx = coachMessages.indexOf(msg);
      if (idx >= 0) coachMessages[idx] = saved;
    } catch (_) {}
  }

  Future<void> clearCoachMessages() async {
    // delete all on server
    final ids = coachMessages.map((m) => m.id).toList();
    coachMessages = [];
    notifyListeners();
    for (final id in ids) {
      if (id.isNotEmpty) {
        try {
          await api.remove('coach', id);
        } catch (_) {}
      }
    }
    await addCoachMessage(
        'Yangidan boshlaymiz! Oziqlanish, zaxira yoki ovqat bo\'yicha savolingizni bering.',
        'ai');
  }

  // ---------- activities ----------
  Future<void> addActivity(ActivityLog a) async {
    a.timestamp = DateTime.now().toIso8601String();
    try {
      final created = await api.create('activities', a.toJson());
      activities.insert(0, ActivityLog.fromJson(created));
      final label = a.type == 'custom' ? (a.customTypeName ?? 'Maxsus') : a.type;
      notify('Yangi mashg\'ulot: $label ⚡', type: 'success');
      gainXp(20);
      await _touchStreak();
      _checkScoreAchievements();
      notifyListeners();
    } catch (e) {
      notify('Saqlanmadi: ${_short(e)}', type: 'warning');
    }
  }

  Future<void> deleteActivity(String id) async {
    activities.removeWhere((e) => e.id == id);
    notifyListeners();
    try {
      await api.remove('activities', id);
      notify('Mashg\'ulot o\'chirildi');
    } catch (_) {}
  }

  /// Onboarding tugallanganmi. Profil hali sozlanmagan bo'lsa, ilova
  /// to'g'ridan-to'g'ri sozlash oqimini ochadi.
  bool get needsOnboarding =>
      isLoggedIn && profileLoaded && !profile.onboarded;

  /// Onboarding javoblarini saqlaydi va me'yorlarni hisoblaydi.
  /// Foydalanuvchi kaloriya/oqsil raqamlarini o'zi kiritmaydi.
  Future<void> completeOnboarding({
    required String gender,
    required int age,
    required double height,
    required double weight,
    required double goalWeight,
    required String activityLevel,
    required String diet,
  }) async {
    profile.gender = gender;
    profile.age = age;
    profile.height = height;
    profile.weight = weight;
    profile.goalWeight = goalWeight;
    profile.activityLevel = activityLevel;
    profile.preferredDiet = diet;
    profile.weightGoalType = goalWeight < weight
        ? 'lose'
        : goalWeight > weight
            ? 'gain'
            : 'maintain';
    profile.recomputeTargets();
    profile.onboarded = true;

    notifyListeners();
    await _saveProfile();

    // Boshlang'ich vazn nuqtasi — progress grafigi shu yerdan boshlanadi.
    if (bodyLogs.isEmpty) {
      final bmi = height > 0 ? weight / ((height / 100) * (height / 100)) : 0.0;
      await logBodyProgress(BodyProgressLog(
        id: '',
        date: _todayStr(),
        weight: weight,
        bmi: (bmi * 10).round() / 10,
      ));
    }
  }

  // ======================= 4 USTUN =======================

  // ---------- ibodat (ballanmaydi) ----------

  PrayerDay get todayPrayers => prayerDays.firstWhere(
        (d) => d.date == _todayStr(),
        orElse: () => PrayerDay.empty(_todayStr()),
      );

  /// Namozni belgilaydi yoki belgini olib tashlaydi.
  ///
  /// Bu yerda ataylab XP berilmaydi va yutuq ochilmaydi — ibodatni
  /// o'yinlashtirish noto'g'ri bo'lardi.
  Future<void> togglePrayer(PrayerName p) async {
    final today = _todayStr();
    final idx = prayerDays.indexWhere((d) => d.date == today);
    final updated = (idx >= 0 ? prayerDays[idx] : PrayerDay.empty(today)).toggle(p);

    if (idx >= 0) {
      prayerDays[idx] = updated;
    } else {
      prayerDays.add(updated);
    }
    notifyListeners();

    try {
      if (idx >= 0) {
        // Server id ni saqlab qolish uchun mavjud yozuvni yangilaymiz.
        final raw = await api.list('prayers');
        final existing = raw.firstWhere(
          (e) => e['date'] == today,
          orElse: () => <String, dynamic>{},
        );
        final id = existing['id']?.toString();
        if (id != null && id.isNotEmpty) {
          await api.update('prayers', id, updated.toJson());
          return;
        }
      }
      await api.create('prayers', updated.toJson());
    } catch (_) {
      notify('Saqlanmadi — internetni tekshiring', type: 'warning');
    }
  }

  // ---------- rivojlanish ----------

  List<FocusSession> get todayFocus =>
      focusSessions.where((f) => _isToday(f.timestamp)).toList();

  int get focusMinutesToday =>
      todayFocus.fold<int>(0, (s, f) => s + f.minutes);

  Future<void> addFocus(FocusKind kind, int minutes, {String note = ''}) async {
    if (minutes <= 0) return;
    final s = FocusSession(
      id: '',
      timestamp: DateTime.now().toIso8601String(),
      kind: kind.name,
      minutes: minutes,
      note: note,
    );
    try {
      final created = await api.create('focus', s.toJson());
      focusSessions.insert(0, FocusSession.fromJson(created));
      notify('${kind.uz}: +$minutes daqiqa', type: 'success');
      gainXp(minutes >= 60 ? 25 : 15);
      await _touchStreak();
      notifyListeners();
    } catch (e) {
      notify('Saqlanmadi: ${_short(e)}', type: 'warning');
    }
  }

  Future<void> deleteFocus(String id) async {
    focusSessions.removeWhere((f) => f.id == id);
    notifyListeners();
    try {
      await api.remove('focus', id);
    } catch (_) {}
  }

  // ---------- uyqu ----------

  SleepLog? get lastSleep => sleepLogs.isEmpty ? null : sleepLogs.last;

  Future<void> logSleep(DateTime bed, DateTime wake, int quality) async {
    final date = wake.toIso8601String().split('T')[0];
    final log = SleepLog(
      id: '',
      date: date,
      bedTime: bed.toIso8601String(),
      wakeTime: wake.toIso8601String(),
      quality: quality,
    );

    // Shu kunga yozuv bo'lsa — yangilaymiz, ikkitasi bo'lib qolmasin.
    final existingIdx = sleepLogs.indexWhere((s) => s.date == date);
    try {
      if (existingIdx >= 0 && sleepLogs[existingIdx].id.isNotEmpty) {
        await api.update('sleep', sleepLogs[existingIdx].id, log.toJson());
        log.id = sleepLogs[existingIdx].id;
        sleepLogs[existingIdx] = log;
      } else {
        final created = await api.create('sleep', log.toJson());
        sleepLogs.add(SleepLog.fromJson(created));
        sleepLogs.sort((a, b) => a.date.compareTo(b.date));
      }
      notify('Uyqu kiritildi: ${log.hours.toStringAsFixed(1)} soat',
          type: 'success');
      gainXp(15);
      await _touchStreak();
      notifyListeners();
    } catch (e) {
      notify('Saqlanmadi: ${_short(e)}', type: 'warning');
    }
  }

  // ---------- ballar ----------

  PillarScore get healthPillar {
    final s = todayScore;
    return PillarScore(
      value: s.hasData ? s.total : 0,
      hasData: s.hasData,
      label: "Sog'liq",
      detail: s.hasData ? '${s.total}/100' : 'Yozuv yo\'q',
      icon: Icons.favorite_rounded,
      color: AppColors.emerald,
      advice: s.weakest?.advice,
    );
  }

  PillarScore get growthPillar => focusScore(todayFocus, focusTargetMinutes);

  PillarScore get sleepPillar => sleepScore(
        lastSleep,
        sleepLogs.length <= 7
            ? sleepLogs
            : sleepLogs.sublist(sleepLogs.length - 7),
      );

  /// Ballanadigan uchta ustun. Ibodat bu ro'yxatda YO'Q — ataylab.
  List<PillarScore> get scoredPillars =>
      [healthPillar, growthPillar, sleepPillar];

  int get dailyBalance => balanceOf(scoredPillars);

  // ---------- account management ----------
  Future<bool> changePassword(String current, String next) async {
    try {
      final token = await api.changePassword(current, next);
      this.token = token;
      api.token = token;
      await _prefs.setString(_Keys.token, token);
      notify('Parol muvaffaqiyatli almashtirildi', type: 'success');
      return true;
    } on ApiException catch (e) {
      notify(e.message, type: 'warning');
      return false;
    } catch (_) {
      notify('Serverga ulanib bo\'lmadi', type: 'warning');
      return false;
    }
  }

  Future<bool> deleteAccount(String password) async {
    try {
      await api.deleteAccount(password);
      await logout();
      notify('Hisobingiz va barcha ma\'lumotlaringiz o\'chirildi');
      return true;
    } on ApiException catch (e) {
      notify(e.message, type: 'warning');
      return false;
    } catch (_) {
      notify('Serverga ulanib bo\'lmadi', type: 'warning');
      return false;
    }
  }

  // ======================= DERIVED / SELECTORS =======================
  bool _isToday(String iso) {
    try {
      return iso.split('T')[0] == _todayStr();
    } catch (_) {
      return false;
    }
  }

  List<MealLog> get todayMeals =>
      mealLogs.where((m) => _isToday(m.timestamp)).toList();

  double get caloriesToday => todayMeals.fold(0.0, (s, m) => s + m.calories);
  double get proteinToday => todayMeals.fold(0.0, (s, m) => s + m.protein);
  double get carbsToday => todayMeals.fold(0.0, (s, m) => s + m.carbs);
  double get fatToday => todayMeals.fold(0.0, (s, m) => s + m.fat);
  double get costToday => todayMeals.fold(0.0, (s, m) => s + m.cost);

  double get sugarToday => todayMeals.fold(0.0, (s, m) => s + m.sugar);
  double get fiberToday => todayMeals.fold(0.0, (s, m) => s + m.fiber);
  double get sodiumToday => todayMeals.fold(0.0, (s, m) => s + m.sodium);
  double get vegServingsToday =>
      todayMeals.fold(0.0, (s, m) => s + m.vegServings);

  /// NOVA-4 deb belgilangan taomlardan kelgan kaloriyalar.
  double get upfCaloriesToday =>
      todayMeals.where((m) => m.nova >= 4).fold(0.0, (s, m) => s + m.calories);

  double get waterToday => waterLogs
      .where((w) => _isToday(w.timestamp))
      .fold(0.0, (s, w) => s + w.amountMl);

  double get caloriesBurnedToday => activities
      .where((a) => _isToday(a.timestamp))
      .fold(0.0, (s, a) => s + a.caloriesBurned);

  /// Qo'lda kiritilgan mashg'ulotlardagi qadamlar.
  int get manualStepsToday => activities
      .where((a) => _isToday(a.timestamp))
      .fold(0, (s, a) => s + (a.steps ?? 0));

  /// Bugungi qadam.
  ///
  /// Sensor ishlayotgan bo'lsa u ustunlik qiladi — qo'shib yubormaymiz, aks
  /// holda sayr qilib, keyin uni "mashg'ulot" sifatida ham kiritgan
  /// foydalanuvchining qadami ikki marta hisoblanardi.
  /// Bugungi qadam.
  ///
  /// Uchta manba bo'lishi mumkin va ular QO'SHILMAYDI — eng kattasi
  /// olinadi. Sensor va Health Connect ko'pincha AYNAN BIR XIL qadamni
  /// beradi (HC telefon sensoridan ham yozadi); qo'shsak ikki barobar
  /// ko'rsatib yuborardik.
  int get stepsToday {
    var best = manualStepsToday;
    if (sensorSteps > best) best = sensorSteps;
    final hc = healthSteps;
    if (hc != null && hc > best) best = hc;
    return best;
  }

  List<InventoryItem> get lowStockItems => inventory
      .where((i) => i.currentQuantity <= i.initialQuantity * 0.3)
      .toList();

  List<InventoryItem> get expiringItems {
    final now = DateTime.now();
    return inventory.where((i) {
      final exp = DateTime.tryParse(i.expirationDate);
      if (exp == null) return false;
      return exp.difference(now).inDays <= 3;
    }).toList();
  }

  double get monthlySpent {
    final now = DateTime.now();
    return expenses.where((e) {
      final d = DateTime.tryParse(e.date);
      return d != null && d.year == now.year && d.month == now.month;
    }).fold(0.0, (s, e) => s + e.amount);
  }

  double get inventoryValue => inventory.fold(
      0.0,
      (s, i) =>
          s +
          (i.initialQuantity <= 0
              ? 0
              : (i.currentQuantity / i.initialQuantity) * i.purchasePrice));

  /// Bugungi UNUM Score. Har chaqiruvda qayta hisoblanadi — arzon va
  /// deterministik, shuning uchun keshlash shart emas.
  UnumScore get todayScore => computeUnumScore(
        calories: caloriesToday,
        targetCalories: profile.targetCalories.toDouble(),
        protein: proteinToday,
        targetProtein: profile.targetProtein.toDouble(),
        vegServings: vegServingsToday,
        sugar: sugarToday,
        upfCalories: upfCaloriesToday,
        waterMl: waterToday,
        targetWaterMl: profile.targetWaterMl.toDouble(),
        steps: stepsToday,
        activeMinutes: activeMinutesToday,
      );

  int get activeMinutesToday => activities
      .where((a) => _isToday(a.timestamp))
      .fold(0, (s, a) => s + a.durationMinutes);

  Map<String, dynamic> get logsTodaySummary {
    final sc = todayScore;
    return {
      'calories': caloriesToday.round(),
      'protein': proteinToday.round(),
      'carbs': carbsToday.round(),
      'fat': fatToday.round(),
      'sugar': sugarToday.round(),
      'fiber': fiberToday.round(),
      'sodium': sodiumToday.round(),
      'vegServings': vegServingsToday.toStringAsFixed(1),
      'water': waterToday.round(),
      'steps': stepsToday,
      'unumScore': sc.hasData ? sc.total : null,
      'scoreWeakest': sc.weakest?.label,
    };
  }

  /// Har daraja 100 XP. gainXp() bilan bir xil formula bo'lishi SHART —
  /// avval bu yerda (level+1)*300 turgan va progress bar noto'g'ri ko'rsatgan.
  int get nextLevelXp => profile.level * 100;

  // ======================= KUNLIK YOZUVLAR VA INSIGHTS =======================

  String _key(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-'
      '${d.month.toString().padLeft(2, '0')}-'
      '${d.day.toString().padLeft(2, '0')}';

  /// So'nggi [days] kunning yig'ma yozuvlari (eski → yangi).
  ///
  /// Bir marta guruhlab, keyin har kun uchun Score'ni qayta hisoblaydi.
  /// Ro'yxatlar bo'ylab kun boshiga qayta-qayta yugurmaslik uchun avval
  /// hamma narsa sanaga ko'ra map'ga yig'iladi.
  List<DayRecord> recentDays([int days = 30]) {
    final mealsBy = <String, List<MealLog>>{};
    for (final m in mealLogs) {
      (mealsBy[m.timestamp.split('T')[0]] ??= []).add(m);
    }
    final waterBy = <String, double>{};
    for (final w in waterLogs) {
      final k = w.timestamp.split('T')[0];
      waterBy[k] = (waterBy[k] ?? 0) + w.amountMl;
    }
    final stepsBy = <String, int>{};
    final activeBy = <String, int>{};
    for (final a in activities) {
      final k = a.timestamp.split('T')[0];
      stepsBy[k] = (stepsBy[k] ?? 0) + (a.steps ?? 0);
      activeBy[k] = (activeBy[k] ?? 0) + a.durationMinutes;
    }

    final today = DateTime.now();
    final out = <DayRecord>[];
    for (var i = days - 1; i >= 0; i--) {
      final day = DateTime(today.year, today.month, today.day)
          .subtract(Duration(days: i));
      final k = _key(day);
      final meals = mealsBy[k] ?? const <MealLog>[];
      final water = waterBy[k] ?? 0;
      final steps = stepsBy[k] ?? 0;
      final active = activeBy[k] ?? 0;

      double sum(double Function(MealLog) f) =>
          meals.fold<double>(0, (s, m) => s + f(m));

      final calories = sum((m) => m.calories);
      final upf = meals
          .where((m) => m.nova >= 4)
          .fold<double>(0, (s, m) => s + m.calories);

      final hasData =
          meals.isNotEmpty || water > 0 || steps > 0 || active > 0;

      final score = computeUnumScore(
        calories: calories,
        targetCalories: profile.targetCalories.toDouble(),
        protein: sum((m) => m.protein),
        targetProtein: profile.targetProtein.toDouble(),
        vegServings: sum((m) => m.vegServings),
        sugar: sum((m) => m.sugar),
        upfCalories: upf,
        waterMl: water,
        targetWaterMl: profile.targetWaterMl.toDouble(),
        steps: steps,
        activeMinutes: active,
      );

      out.add(DayRecord(
        date: day,
        calories: calories,
        protein: sum((m) => m.protein),
        sugar: sum((m) => m.sugar),
        sodium: sum((m) => m.sodium),
        vegServings: sum((m) => m.vegServings),
        upfCalories: upf,
        water: water,
        cost: sum((m) => m.cost),
        steps: steps,
        activeMinutes: active,
        score: score.hasData ? score.total : 0,
        hasData: hasData,
      ));
    }
    return out;
  }

  /// So'nggi 14 kun bo'yicha profilaktik ogohlantirishlar.
  List<HealthRisk> get risks => analyzeRisks(
        days: recentDays(14),
        targetProtein: profile.targetProtein.toDouble(),
        targetWater: profile.targetWaterMl.toDouble(),
      );

  ProgressStats get progress {
    final days = recentDays(30);
    final firstWeight = bodyLogs.isNotEmpty ? bodyLogs.first.weight : profile.weight;
    final lastWeight = bodyLogs.isNotEmpty ? bodyLogs.last.weight : profile.weight;
    return computeProgress(
      days: days,
      mealsLogged: mealLogs.length,
      startWeight: firstWeight,
      currentWeight: lastWeight,
      goalWeight: profile.goalWeight,
      targetCalories: profile.targetCalories.toDouble(),
    );
  }

  List<DailyMission> get missions => buildMissions(
        calories: caloriesToday,
        targetCalories: profile.targetCalories.toDouble(),
        protein: proteinToday,
        targetProtein: profile.targetProtein.toDouble(),
        vegServings: vegServingsToday,
        sugar: sugarToday,
        water: waterToday,
        targetWater: profile.targetWaterMl.toDouble(),
        steps: stepsToday,
        mealsToday: todayMeals.length,
      );

  /// Kechagi ball — check-in oynasida "kecha qanday o'tdi" uchun.
  int get yesterdayScore {
    final days = recentDays(2);
    return days.length >= 2 ? days.first.score : 0;
  }

  /// Kunlik salomlashuv bugun ko'rsatilganmi.
  ///
  /// Qurilmada saqlanadi (serverda emas): bu UI hodisasi, va bir kunda ikki
  /// qurilmadan kirgan foydalanuvchini ikki marta bezovta qilish yomon emas,
  /// lekin server so'roviga arzimaydi.
  bool get shouldShowCheckIn {
    if (!isLoggedIn || !profile.onboarded) return false;
    return _prefs.getString(_Keys.lastCheckIn) != _todayStr();
  }

  Future<void> markCheckInShown() =>
      _prefs.setString(_Keys.lastCheckIn, _todayStr());

  String _short(Object e) {
    final s = e.toString().replaceFirst('Exception: ', '').replaceFirst('ApiException: ', '');
    return s.length > 70 ? '${s.substring(0, 70)}…' : s;
  }

  static String _fmtQty(double v) {
    if (v == v.roundToDouble()) return v.toInt().toString();
    return v.toStringAsFixed(2);
  }
}

extension _FirstOrNull<E> on Iterable<E> {
  E? get firstOrNull {
    final it = iterator;
    return it.moveNext() ? it.current : null;
  }
}
