import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models.dart';
import '../plan_models.dart';

class ApiException implements Exception {
  final String message;
  final int? status;
  ApiException(this.message, [this.status]);
  @override
  String toString() => message;
}

/// Single client for the NutriStock/UNUM backend: auth, DB-backed CRUD and AI.
class ApiClient {
  String Function() baseUrl;
  String? token;

  ApiClient(this.baseUrl, {this.token});

  Uri _u(String path) {
    var b = baseUrl().trim();
    if (b.endsWith('/')) b = b.substring(0, b.length - 1);
    return Uri.parse('$b$path');
  }

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (token != null && token!.isNotEmpty) 'Authorization': 'Bearer $token',
      };

  Never _throw(http.Response res) {
    String msg = 'Server xatosi (${res.statusCode})';
    try {
      final j = jsonDecode(res.body);
      if (j is Map && j['error'] != null) msg = j['error'].toString();
    } catch (_) {}
    throw ApiException(msg, res.statusCode);
  }

  Future<dynamic> _get(String path) async {
    final res =
        await http.get(_u(path), headers: _headers).timeout(const Duration(seconds: 30));
    if (res.statusCode >= 200 && res.statusCode < 300) return jsonDecode(res.body);
    _throw(res);
  }

  Future<dynamic> _send(String method, String path, [Object? body]) async {
    final req = http.Request(method, _u(path));
    req.headers.addAll(_headers);
    if (body != null) req.body = jsonEncode(body);
    final streamed = await req.send().timeout(const Duration(seconds: 60));
    final res = await http.Response.fromStream(streamed);
    if (res.statusCode >= 200 && res.statusCode < 300) {
      return res.body.isEmpty ? null : jsonDecode(res.body);
    }
    _throw(res);
  }

  // ---------------- Google / Apple orqali kirish ----------------

  /// Serverda qaysi kirish usullari sozlanganini so'raymiz — sozlanmagan
  /// tugmani ko'rsatib, keyin xato berish yomon tajriba.
  Future<Map<String, dynamic>> authProviders() async {
    final j = await _get('/api/auth/providers');
    return Map<String, dynamic>.from(j as Map);
  }

  /// Native Google SDK bergan `id_token` ni serverga yuboramiz. Server uni
  /// Google JWKS bilan tekshiradi va bizning JWT'imizni qaytaradi —
  /// mijoz yuborgan profilga hech qachon ishonilmaydi.
  Future<({String token, String email, String name})> loginWithGoogle(
    String idToken,
  ) async {
    final j = await _send('POST', '/api/auth/oauth/google/token', {
      'idToken': idToken,
    });
    final m = Map<String, dynamic>.from(j as Map);
    final user = Map<String, dynamic>.from(m['user'] as Map);
    return (
      token: m['token'].toString(),
      email: (user['email'] ?? '').toString(),
      name: (user['name'] ?? '').toString(),
    );
  }

  // ---------------- health ----------------
  Future<Map<String, dynamic>?> health() async {
    try {
      final res =
          await http.get(_u('/api/health')).timeout(const Duration(seconds: 10));
      if (res.statusCode == 200) {
        return jsonDecode(res.body) as Map<String, dynamic>;
      }
    } catch (_) {}
    return null;
  }

  // ---------------- auth ----------------
  Future<({String token, int id, String email, String name})> register(
      String email, String password, String name) async {
    final j = await _send('POST', '/api/auth/register',
        {'email': email, 'password': password, 'name': name});
    return _auth(j);
  }

  Future<({String token, int id, String email, String name})> login(
      String email, String password) async {
    final j = await _send('POST', '/api/auth/login',
        {'email': email, 'password': password});
    return _auth(j);
  }

  /// Returns the freshly issued token — the old one stays valid, but rotating
  /// keeps the session tied to the new password.
  Future<String> changePassword(String current, String next) async {
    final j = await _send('POST', '/api/auth/change-password',
        {'currentPassword': current, 'newPassword': next});
    return (j as Map)['token']?.toString() ?? token ?? '';
  }

  Future<void> deleteAccount(String password) async {
    await _send('DELETE', '/api/account', {'password': password});
  }

  // ---------------- telegram ----------------
  Future<({String code, String deepLink, bool hasBot})> telegramCode() async {
    final j = await _send('POST', '/api/telegram/code', {}) as Map;
    return (
      code: j['code']?.toString() ?? '',
      deepLink: j['deepLink']?.toString() ?? '',
      hasBot: (j['botUsername']?.toString() ?? '').isNotEmpty,
    );
  }

  Future<bool> telegramLinked() async {
    final j = await _get('/api/telegram/status') as Map;
    return j['linked'] == true;
  }

  Future<void> telegramUnlink() async {
    await _send('DELETE', '/api/telegram/link');
  }

  // ---------------- telefon bilan kirish ----------------

  /// SMS kod so'raydi. Xato bo'lsa `ApiException` tashlaydi — matni
  /// foydalanuvchiga ko'rsatiladi ("juda tez-tez", "chegara tugadi"...).
  Future<void> requestPhoneCode(String phone) async {
    await _send('POST', '/api/auth/phone/request', {'phone': phone});
  }

  Future<({String token, int id, String email, String name, bool isNew})>
      verifyPhoneCode(String phone, String code, String name) async {
    final j = await _send('POST', '/api/auth/phone/verify', {
      'phone': phone,
      'code': code,
      'name': name,
    }) as Map<String, dynamic>;
    final u = (j['user'] ?? {}) as Map<String, dynamic>;
    return (
      token: j['token'].toString(),
      id: (u['id'] ?? 0) as int,
      email: (u['email'] ?? '').toString(),
      name: (u['name'] ?? '').toString(),
      isNew: j['isNew'] == true,
    );
  }

  ({String token, int id, String email, String name}) _auth(dynamic j) {
    final m = j as Map<String, dynamic>;
    final u = (m['user'] ?? {}) as Map<String, dynamic>;
    return (
      token: m['token'].toString(),
      id: (u['id'] ?? 0) as int,
      email: (u['email'] ?? '').toString(),
      name: (u['name'] ?? '').toString(),
    );
  }

  // ---------------- profile ----------------
  Future<UserProfile> getProfile() async {
    final j = await _get('/api/profile');
    return UserProfile.fromJson(Map<String, dynamic>.from(j));
  }

  Future<void> putProfile(UserProfile p) async {
    await _send('PUT', '/api/profile', p.toJson());
  }

  // ---------------- generic collections ----------------
  Future<List<Map<String, dynamic>>> list(String collection) async {
    final j = await _get('/api/data/$collection');
    return (j as List).map((e) => Map<String, dynamic>.from(e)).toList();
  }

  Future<Map<String, dynamic>> create(
      String collection, Map<String, dynamic> data) async {
    final j = await _send('POST', '/api/data/$collection', data);
    return Map<String, dynamic>.from(j);
  }

  Future<void> update(
      String collection, String id, Map<String, dynamic> data) async {
    await _send('PUT', '/api/data/$collection/$id', data);
  }

  Future<void> remove(String collection, String id) async {
    await _send('DELETE', '/api/data/$collection/$id');
  }

  // ---------------- AI ----------------
  Future<ParsedMeal> parseMeal(String text, String type) async {
    final j = await _send('POST', '/api/gemini/parse-meal',
        {'text': text, 'type': type});
    return ParsedMeal.fromJson(Map<String, dynamic>.from(j));
  }

  Future<MealPlan> generateMealPlan(
      UserProfile profile, List<InventoryItem> inventory) async {
    final j = await _send('POST', '/api/gemini/generate-meal-plan', {
      'profile': profile.toJson(),
      'inventory': inventory.map((i) => i.toJson()).toList(),
    });
    return MealPlan.fromJson(Map<String, dynamic>.from(j));
  }

  Future<String> coachChat({
    required List<CoachMessage> messages,
    required UserProfile profile,
    required List<InventoryItem> inventory,
    required Map<String, dynamic> logsToday,
  }) async {
    final j = await _send('POST', '/api/gemini/coach-chat', {
      'messages':
          messages.map((m) => {'sender': m.sender, 'text': m.text}).toList(),
      'profile': profile.toJson(),
      'inventory': inventory.map((i) => i.toJson()).toList(),
      'logsToday': logsToday,
    });
    return (j as Map)['text']?.toString() ?? '';
  }

  Future<PhotoAnalysis> analyzePhoto(String base64Image) async {
    final j = await _send(
        'POST', '/api/gemini/analyze-photo', {'imageBase64': base64Image});
    return PhotoAnalysis.fromJson(Map<String, dynamic>.from(j));
  }

  // ═══════════════ Personal OS: maqsad / vazifa / odat / fokus ═══════════════
  // Barcha hisoblangan qiymatlar (progress, streak, ball) SERVERDAN keladi.

  // ---------------- maqsadlar ----------------
  Future<({List<Goal> goals, int? limit, int activeCount})> goals() async {
    final j = await _get('/api/goals') as Map;
    return (
      goals: (j['goals'] as List? ?? [])
          .whereType<Map>()
          .map(Goal.fromJson)
          .toList(),
      limit: j['limit'] == null ? null : (j['limit'] as num).toInt(),
      activeCount: (j['activeCount'] as num?)?.toInt() ?? 0,
    );
  }

  Future<Goal> createGoal(Goal g) async =>
      Goal.fromJson(await _send('POST', '/api/goals', g.toPayload()) as Map);

  Future<Goal> updateGoal(Goal g) async =>
      Goal.fromJson(await _send('PUT', '/api/goals/${g.id}', g.toPayload()) as Map);

  Future<void> deleteGoal(String id) => _send('DELETE', '/api/goals/$id');

  // ---------------- kunlik reja ----------------
  Future<DayPlan> dayPlan([String? date]) async => DayPlan.fromJson(
      await _get('/api/tasks${date == null ? '' : '?date=$date'}') as Map);

  Future<PlanTask> createTask(PlanTask t) async =>
      PlanTask.fromJson(await _send('POST', '/api/tasks', t.toPayload()) as Map);

  Future<PlanTask> updateTask(PlanTask t) async => PlanTask.fromJson(
      await _send('PUT', '/api/tasks/${t.id}', t.toPayload()) as Map);

  /// Checkbox uchun — butun vazifani qayta yubormaymiz.
  Future<PlanTask> toggleTask(String id) async =>
      PlanTask.fromJson(await _send('POST', '/api/tasks/$id/toggle') as Map);

  Future<PlanTask> moveTask(String id, String date) async => PlanTask.fromJson(
      await _send('POST', '/api/tasks/$id/move', {'date': date}) as Map);

  Future<void> deleteTask(String id) => _send('DELETE', '/api/tasks/$id');

  // ---------------- odatlar ----------------
  Future<({List<Habit> habits, int? limit, int todayDue, int todayDone})>
      habits() async {
    final j = await _get('/api/habits') as Map;
    return (
      habits: (j['habits'] as List? ?? [])
          .whereType<Map>()
          .map(Habit.fromJson)
          .toList(),
      limit: j['limit'] == null ? null : (j['limit'] as num).toInt(),
      todayDue: (j['todayDue'] as num?)?.toInt() ?? 0,
      todayDone: (j['todayDone'] as num?)?.toInt() ?? 0,
    );
  }

  Future<Habit> createHabit(Habit h) async =>
      Habit.fromJson(await _send('POST', '/api/habits', h.toPayload()) as Map);

  Future<Habit> updateHabit(Habit h) async =>
      Habit.fromJson(await _send('PUT', '/api/habits/${h.id}', h.toPayload()) as Map);

  /// Kunni belgilash. `log` PUT orqali o'zgarmaydi — faqat shu yerdan.
  Future<Habit> checkHabit(String id, [String? date]) async => Habit.fromJson(
      await _send('POST', '/api/habits/$id/check', {'date': date}) as Map);

  Future<void> deleteHabit(String id) => _send('DELETE', '/api/habits/$id');

  // ---------------- fokus ----------------
  Future<FocusDay> focusDay() async =>
      FocusDay.fromJson(await _get('/api/focus') as Map);

  /// Faqat TUGAGAN seans yoziladi; vaqtni server qo'yadi.
  Future<void> logFocus({required String kind, required int minutes, String note = ''}) =>
      _send('POST', '/api/focus', {'kind': kind, 'minutes': minutes, 'note': note});

  Future<void> deleteFocus(String id) => _send('DELETE', '/api/focus/$id');

  // ---------------- Life Score / hisobot / prognoz ----------------
  Future<LifeScore> lifeScore() async =>
      LifeScore.fromJson(await _get('/api/lifescore') as Map);

  Future<Review> review({String period = 'week'}) async =>
      Review.fromJson(await _get('/api/review?period=$period') as Map);

  Future<List<Prediction>> predictions() async {
    final j = await _get('/api/predictions') as Map;
    if (j['locked'] == true) return const [];
    return (j['predictions'] as List? ?? [])
        .whereType<Map>()
        .map(Prediction.fromJson)
        .toList();
  }

  Future<({Review review, Narrative narrative})?> reviewNarrative(
      {String period = 'week'}) async {
    final j = await _send('POST', '/api/review/narrative', {'period': period}) as Map;
    if (j['locked'] == true) return null;
    return (
      review: Review.fromJson(j['review'] as Map),
      narrative: Narrative.fromJson(j['narrative'] as Map),
    );
  }

  /// Maqsadni AI bilan bosqichlarga bo'lish. Natija SAQLANMAYDI —
  /// foydalanuvchi ko'rib, tahrirlab, o'zi saqlaydi.
  Future<List<String>> breakdown(String title, String? deadline, String note) async {
    final j = await _send('POST', '/api/goals/breakdown',
        {'title': title, 'deadline': deadline, 'note': note}) as Map;

    // Server premium bo'lmasa `{locked:true}` qaytaradi (200 bilan!).
    // Buni tekshirmasak bo'sh ro'yxat qaytib, tugma "hech narsa
    // qilmayotgandek" ko'rinardi — foydalanuvchi sababini bilmasdi.
    // Server premium bo'lmasa `{locked:true}` qaytaradi (200 bilan!).
    // 403 kodi bilan otamiz — ekran shu kodni ko'rib PAYWALL ochadi,
    // shunchaki xato matni ko'rsatmaydi.
    if (j['locked'] == true) {
      throw ApiException('premium_required', 403);
    }

    return (j['milestones'] as List? ?? [])
        .whereType<Map>()
        .map((m) => m['title'].toString())
        .where((t) => t.isNotEmpty)
        .toList();
  }

  Future<String> askCoach(String question) async {
    final j = await _send('POST', '/api/coach/ask', {'question': question}) as Map;
    return j['answer']?.toString() ?? '';
  }
}
