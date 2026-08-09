import 'package:adhan/adhan.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../pillars.dart';

/// Namoz vaqtlarini hisoblaydi.
///
/// Muhim qarorlar:
///  • Hisob **telefonda** bajariladi. Koordinatalar serverga yuborilmaydi —
///    ular faqat qurilmada saqlanadi.
///  • Natija — astronomik HISOB, ya'ni taxmin. Ilova buni yashirmaydi va
///    foydalanuvchiga mahalliy manba bilan solishtirishni maslahat beradi.
///  • Hisoblash usulini foydalanuvchi tanlaydi; biz uning nomidan diniy
///    qaror qabul qilmaymiz.
class PrayerService {
  static const _kLat = 'unum_pray_lat';
  static const _kLng = 'unum_pray_lng';
  static const _kMethod = 'unum_pray_method';
  static const _kCity = 'unum_pray_city';
  static const _kEnabled = 'unum_pray_enabled';

  /// O'zbekistondagi yirik shaharlar — foydalanuvchi GPS bermasdan tanlaydi.
  static const cities = <String, (double lat, double lng)>{
    'Toshkent': (41.2995, 69.2401),
    'Samarqand': (39.6270, 66.9750),
    'Buxoro': (39.7747, 64.4286),
    'Andijon': (40.7821, 72.3442),
    'Namangan': (40.9983, 71.6726),
    "Farg'ona": (40.3864, 71.7864),
    'Nukus': (42.4531, 59.6103),
    'Qarshi': (38.8606, 65.7891),
    'Urganch': (41.5500, 60.6333),
    'Jizzax': (40.1158, 67.8422),
    'Navoiy': (40.0844, 65.3792),
    'Termiz': (37.2242, 67.2783),
    'Guliston': (40.4897, 68.7842),
  };

  /// Qo'llab-quvvatlanadigan hisoblash usullari.
  ///
  /// Bu ro'yxat — texnik variantlar, diniy tavsiya emas. Qaysi usul to'g'ri
  /// ekanini foydalanuvchi o'zi (yoki mahalliy manbaga tayanib) hal qiladi.
  static final methods = <String, CalculationMethod>{
    'Muslim World League': CalculationMethod.muslim_world_league,
    'Umm al-Qura': CalculationMethod.umm_al_qura,
    'Karachi': CalculationMethod.karachi,
    'Misr': CalculationMethod.egyptian,
    'Turkiya': CalculationMethod.turkey,
  };

  SharedPreferences? _prefs;

  bool enabled = false;
  String city = 'Toshkent';
  String method = 'Muslim World League';
  double lat = 41.2995;
  double lng = 69.2401;

  Future<void> load() async {
    _prefs ??= await SharedPreferences.getInstance();
    final p = _prefs!;
    enabled = p.getBool(_kEnabled) ?? false;
    city = p.getString(_kCity) ?? 'Toshkent';
    method = p.getString(_kMethod) ?? 'Muslim World League';
    lat = p.getDouble(_kLat) ?? cities[city]!.$1;
    lng = p.getDouble(_kLng) ?? cities[city]!.$2;
  }

  Future<void> setEnabled(bool v) async {
    enabled = v;
    await _prefs?.setBool(_kEnabled, v);
  }

  Future<void> setCity(String name) async {
    final c = cities[name];
    if (c == null) return;
    city = name;
    lat = c.$1;
    lng = c.$2;
    await _prefs?.setString(_kCity, name);
    await _prefs?.setDouble(_kLat, lat);
    await _prefs?.setDouble(_kLng, lng);
  }

  Future<void> setMethod(String name) async {
    if (!methods.containsKey(name)) return;
    method = name;
    await _prefs?.setString(_kMethod, name);
  }

  /// Bugungi (yoki berilgan kundagi) namoz vaqtlari.
  Map<PrayerName, DateTime> timesFor([DateTime? day]) {
    final d = day ?? DateTime.now();
    final params = (methods[method] ?? CalculationMethod.muslim_world_league)
        .getParameters()
      ..madhab = Madhab.hanafi;

    final pt = PrayerTimes(
      Coordinates(lat, lng),
      DateComponents(d.year, d.month, d.day),
      params,
    );

    return {
      PrayerName.fajr: pt.fajr.toLocal(),
      PrayerName.dhuhr: pt.dhuhr.toLocal(),
      PrayerName.asr: pt.asr.toLocal(),
      PrayerName.maghrib: pt.maghrib.toLocal(),
      PrayerName.isha: pt.isha.toLocal(),
    };
  }

  /// Hozir vaqti kirgan namoz (bo'lsa) va keyingisi.
  ({PrayerName? current, PrayerName? next, DateTime? nextAt}) currentAndNext() {
    final t = timesFor();
    final now = DateTime.now();
    PrayerName? current;
    PrayerName? next;
    DateTime? nextAt;

    for (final p in PrayerName.values) {
      final at = t[p]!;
      if (!at.isAfter(now)) {
        current = p;
      } else {
        next ??= p;
        nextAt ??= at;
      }
    }
    // Xufton ham o'tgan bo'lsa — keyingisi ertangi bomdod.
    if (next == null) {
      final tomorrow = timesFor(now.add(const Duration(days: 1)));
      next = PrayerName.fajr;
      nextAt = tomorrow[PrayerName.fajr];
    }
    return (current: current, next: next, nextAt: nextAt);
  }
}
