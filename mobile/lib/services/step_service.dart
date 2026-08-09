import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:pedometer/pedometer.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Telefonning qadam sensoridan haqiqiy qadamlarni o'qiydi.
///
/// Android'ning STEP_COUNTER sensori telefon **oxirgi yoqilgandan beri**
/// jami qadamni beradi — kunlik emas. Shuning uchun har kunning boshida
/// "tayanch" (baseline) qiymatini saqlab qo'yamiz va bugungi qadam =
/// joriy hisob − tayanch.
///
/// Telefon o'chirib yoqilsa hisob nolga tushadi. Bunday holatda joriy hisob
/// tayanchdan kichik bo'ladi — buni aniqlab, tayanchni qayta o'rnatamiz va
/// shu kungacha yig'ilgan qadamni yo'qotmaslik uchun uni alohida saqlaymiz.
class StepService {
  static const _kBaseline = 'unum_step_baseline';
  static const _kBaselineDate = 'unum_step_baseline_date';
  static const _kCarried = 'unum_step_carried';

  final _controller = StreamController<int>.broadcast();

  /// Bugungi qadamlar oqimi.
  Stream<int> get todaySteps => _controller.stream;

  int _current = 0;
  bool get isRunning => _sub != null;

  StreamSubscription<StepCount>? _sub;
  SharedPreferences? _prefs;

  /// Qurilma sensorni qo'llab-quvvatlaydimi va ruxsat berilganmi.
  bool available = false;

  int get currentSteps => _current;

  static String _today() {
    final d = DateTime.now();
    return '${d.year}-${d.month.toString().padLeft(2, '0')}-'
        '${d.day.toString().padLeft(2, '0')}';
  }

  /// Ruxsat so'rab, sensorga ulanadi.
  /// `false` qaytsa — foydalanuvchi rad etdi yoki qurilmada sensor yo'q.
  Future<bool> start() async {
    if (_sub != null) return available;

    // iOS'da bu ruxsat yo'q; Android'da ACTIVITY_RECOGNITION talab qilinadi.
    if (defaultTargetPlatform == TargetPlatform.android) {
      final status = await Permission.activityRecognition.request();
      if (!status.isGranted) {
        available = false;
        return false;
      }
    }

    _prefs ??= await SharedPreferences.getInstance();

    try {
      _sub = Pedometer.stepCountStream.listen(
        _onStepCount,
        onError: (Object e) {
          // Sensor yo'q yoki o'chirilgan — ilova ishlashda davom etadi,
          // qadam shunchaki qo'lda kiritiladi.
          available = false;
          _controller.add(0);
        },
        cancelOnError: false,
      );
      available = true;
      return true;
    } catch (_) {
      available = false;
      return false;
    }
  }

  void _onStepCount(StepCount event) {
    final prefs = _prefs;
    if (prefs == null) return;

    final total = event.steps;
    final today = _today();
    final storedDate = prefs.getString(_kBaselineDate);

    var baseline = prefs.getInt(_kBaseline) ?? total;
    var carried = prefs.getInt(_kCarried) ?? 0;

    if (storedDate != today) {
      // Yangi kun boshlandi — tayanchni bugungi hisobdan boshlaymiz.
      baseline = total;
      carried = 0;
      prefs.setString(_kBaselineDate, today);
      prefs.setInt(_kBaseline, baseline);
      prefs.setInt(_kCarried, carried);
    } else if (total < baseline) {
      // Telefon qayta yuklangan: sensor noldan boshladi. Shu paytgacha
      // yig'ilgan qadamni saqlab qolamiz va yangi tayanch o'rnatamiz.
      carried += baseline == 0 ? 0 : (_current - carried).clamp(0, 1 << 30);
      baseline = total;
      prefs.setInt(_kBaseline, baseline);
      prefs.setInt(_kCarried, carried);
    }

    _current = (total - baseline) + carried;
    if (_current < 0) _current = 0;
    _controller.add(_current);
  }

  /// Ilova qayta ochilganda saqlangan qiymatni tiklaydi (sensor birinchi
  /// hodisani yuborgunicha ekran bo'sh turmasin).
  Future<int> restoreCached() async {
    _prefs ??= await SharedPreferences.getInstance();
    final prefs = _prefs!;
    if (prefs.getString(_kBaselineDate) != _today()) return 0;
    return prefs.getInt(_kCarried) ?? 0;
  }

  Future<void> dispose() async {
    await _sub?.cancel();
    _sub = null;
    await _controller.close();
  }
}
