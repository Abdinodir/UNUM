import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:health/health.dart';

/// Health Connect (Android) / Apple Health (iOS) dan qadam va uyquni o'qiydi.
///
/// NIMA UCHUN KERAK BO'LDI. Ilgari ilova faqat telefonning STEP_COUNTER
/// sensoriga tayanardi: u telefon o'chib-yonganda nolga tushadi, soatdagi
/// yoki boshqa ilovadagi qadamni umuman ko'rmaydi, uyquni esa hech qachon
/// bermaydi. Natijada foydalanuvchi hamma narsani QO'LDA kiritishga majbur
/// bo'lardi — bu "integratsiya" emas edi.
///
/// ⚠️ FAQAT O'QIYMIZ. Health Connect'ga hech narsa yozilmaydi: bizga
/// kerak emas, va yozish ruxsati Play tekshiruvida qo'shimcha asoslash
/// talab qiladi.
class HealthService {
  HealthService() : _health = Health();

  final Health _health;

  /// So'raladigan turlar. Ro'yxat manifestdagi ruxsatlar bilan MOS
  /// bo'lishi shart — aks holda so'rov jimgina rad etiladi.
  static final _types = <HealthDataType>[
    HealthDataType.STEPS,
    HealthDataType.SLEEP_SESSION,
  ];

  static final _access =
      List<HealthDataAccess>.filled(_types.length, HealthDataAccess.READ);

  bool _configured = false;

  /// Qurilma umuman qo'llab-quvvatlaydimi.
  bool get supported => Platform.isAndroid || Platform.isIOS;

  /// Health Connect o'rnatilganmi.
  ///
  /// Android 14 dan boshlab u tizim ichida; 12–13 da esa Play Market'dan
  /// o'rnatiladigan ALOHIDA ilova. O'rnatilmagan qurilmada ruxsat oynasi
  /// umuman ochilmaydi — shuning uchun avval shuni tekshiramiz.
  Future<bool> get installed async {
    if (!Platform.isAndroid) return supported;
    try {
      final s = await _health.getHealthConnectSdkStatus();
      return s == HealthConnectSdkStatus.sdkAvailable;
    } catch (_) {
      return false;
    }
  }

  /// Health Connect'ni o'rnatish/yangilash sahifasini ochadi.
  ///
  /// Android'da Play Market, iOS'da Apple Health tizim ichida bo'lgani
  /// uchun u yerda hech narsa ochilmaydi (`false` qaytadi).
  Future<bool> openStore() async {
    if (!Platform.isAndroid) return false;
    try {
      await _health.installHealthConnect();
      return true;
    } catch (e) {
      debugPrint('[health] openStore: $e');
      return false;
    }
  }

  Future<void> _configure() async {
    if (_configured) return;
    await _health.configure();
    _configured = true;
  }

  /// Ruxsat allaqachon berilganmi (so'ramasdan tekshiradi).
  Future<bool> hasPermission() async {
    if (!supported) return false;
    try {
      await _configure();
      return await _health.hasPermissions(_types, permissions: _access) ?? false;
    } catch (e) {
      debugPrint('[health] hasPermission: $e');
      return false;
    }
  }

  /// Ruxsat so'raydi. Foydalanuvchi rad etsa `false`.
  Future<bool> requestPermission() async {
    if (!supported) return false;
    try {
      await _configure();
      if (await hasPermission()) return true;
      return await _health.requestAuthorization(_types, permissions: _access);
    } catch (e) {
      debugPrint('[health] requestPermission: $e');
      return false;
    }
  }

  /// Bugungi qadam. Ruxsat yo'q yoki xato bo'lsa `null` — NOL EMAS.
  ///
  /// Farq muhim: `0` "bugun yurmadingiz" degani, `null` esa "bilmaymiz".
  /// Nol qaytarsak sensor qadamini ham bosib qo'yardik.
  Future<int?> todaySteps() async {
    if (!supported) return null;
    try {
      await _configure();
      final now = DateTime.now();
      final start = DateTime(now.year, now.month, now.day);
      final n = await _health.getTotalStepsInInterval(start, now);
      return n;
    } catch (e) {
      debugPrint('[health] todaySteps: $e');
      return null;
    }
  }

  /// Oxirgi uyqu seansi. Topilmasa `null`.
  ///
  /// Kecha kechqurundan bugun tushgacha bo'lgan oraliqni ko'ramiz: uyqu
  /// yarim tundan o'tib ketadi, faqat "bugun" ni olsak yotish vaqti
  /// tushib qolardi.
  Future<({DateTime bed, DateTime wake})?> lastSleep() async {
    if (!supported) return null;
    try {
      await _configure();
      final now = DateTime.now();
      final from = DateTime(now.year, now.month, now.day).subtract(
        const Duration(hours: 18),
      );

      final data = await _health.getHealthDataFromTypes(
        startTime: from,
        endTime: now,
        types: [HealthDataType.SLEEP_SESSION],
      );
      if (data.isEmpty) return null;

      // Eng oxirgi tugagan seans.
      data.sort((a, b) => a.dateTo.compareTo(b.dateTo));
      final last = data.last;
      if (!last.dateTo.isAfter(last.dateFrom)) return null;

      // 16 soatdan uzun "uyqu" — deyarli har doim ma'lumot xatosi
      // (server ham shu chegarani qo'yadi, sanitize.ts).
      if (last.dateTo.difference(last.dateFrom).inHours > 16) return null;

      return (bed: last.dateFrom, wake: last.dateTo);
    } catch (e) {
      debugPrint('[health] lastSleep: $e');
      return null;
    }
  }
}
