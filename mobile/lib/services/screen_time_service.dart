import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Ekran vaqti — Android `UsageStatsManager` ustidagi ingichka qatlam.
///
/// Native tomoni: `android/app/src/main/kotlin/uz/unum/app/MainActivity.kt`.
///
/// ⚠️ Faqat JAMI DAQIQA olinadi. Qaysi ilovani qancha ishlatgani native
/// tomonda hisoblanadi va Dart'ga UZATILMAYDI: bu juda nozik ma'lumot va
/// bizga kerak emas.
///
/// iOS'da Screen Time API (`FamilyControls`) alohida Apple ruxsatini
/// talab qiladi va oddiy ilovaga berilmaydi — u yerda qo'llab-quvvatlanmaydi.
class ScreenTimeService {
  static const _ch = MethodChannel('uz.unum.app/screentime');

  bool get supported => Platform.isAndroid;

  /// Foydalanuvchi "Usage access" ni yoqganmi.
  Future<bool> hasPermission() async {
    if (!supported) return false;
    try {
      return await _ch.invokeMethod<bool>('hasPermission') ?? false;
    } catch (e) {
      debugPrint('[screentime] hasPermission: $e');
      return false;
    }
  }

  /// Tizim sozlamalarini ochadi — ruxsat FAQAT u yerdan beriladi,
  /// oddiy dialog bilan so'rab bo'lmaydi.
  Future<void> openSettings() async {
    if (!supported) return;
    try {
      await _ch.invokeMethod<bool>('openSettings');
    } catch (e) {
      debugPrint('[screentime] openSettings: $e');
    }
  }

  /// Bugungi jami ekran vaqti, daqiqada.
  ///
  /// `null` — "bilmaymiz" (ruxsat yo'q yoki xato). Nol qaytarsak
  /// "bugun telefonni ishlatmadingiz" degan yolg'on ko'rsatkich chiqardi.
  Future<int?> todayMinutes() async {
    if (!supported) return null;
    try {
      return await _ch.invokeMethod<int>('todayMinutes');
    } catch (e) {
      debugPrint('[screentime] todayMinutes: $e');
      return null;
    }
  }
}
