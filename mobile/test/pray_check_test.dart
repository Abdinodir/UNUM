import 'package:adhan/adhan.dart';
import 'package:flutter_test/flutter_test.dart';

/// Namoz vaqtlari — regressiya tekshiruvi.
///
/// Aniq daqiqalarni tasdiqlamaymiz (ular usulga va joyga bog'liq), lekin
/// TARTIB hech qachon buzilmasligi kerak. Agar kutubxona yangilanishi yoki
/// noto'g'ri parametr tartibni buzsa, shu test darhol yiqiladi.
void main() {
  final places = {
    'Toshkent': Coordinates(41.2995, 69.2401),
    'Nukus': Coordinates(42.4531, 59.6103),
    'Termiz': Coordinates(37.2242, 67.2783),
  };

  test('barcha usullarda namoz tartibi to\'g\'ri', () {
    for (final place in places.entries) {
      for (final method in [
        CalculationMethod.muslim_world_league,
        CalculationMethod.umm_al_qura,
        CalculationMethod.karachi,
        CalculationMethod.egyptian,
        CalculationMethod.turkey,
      ]) {
        // Yil davomida turli fasllarni tekshiramiz.
        for (final month in [1, 4, 7, 10]) {
          final params = method.getParameters()..madhab = Madhab.hanafi;
          final pt = PrayerTimes(
              place.value, DateComponents(2026, month, 15), params);
          final why = '${place.key} · $method · $month-oy';
          expect(pt.fajr.isBefore(pt.sunrise), isTrue, reason: why);
          expect(pt.sunrise.isBefore(pt.dhuhr), isTrue, reason: why);
          expect(pt.dhuhr.isBefore(pt.asr), isTrue, reason: why);
          expect(pt.asr.isBefore(pt.maghrib), isTrue, reason: why);
          expect(pt.maghrib.isBefore(pt.isha), isTrue, reason: why);
        }
      }
    }
  });
}
