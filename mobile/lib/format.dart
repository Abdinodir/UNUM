/// Pul va miqdorni formatlash.
///
/// ⚠️ VALYUTA KONVERTATSIYASI YO'Q VA BO'LMAYDI.
/// Ilovadagi har bir pul qiymati — taom narxi, ovqat tannarxi, xarajat,
/// byudjet — bazada ALLAQACHON SO'MDA saqlanadi. Eski versiyada
/// `som(usd) = usd * 1000` degan hisob bor edi va u ishonarli ko'rinadigan,
/// lekin butunlay noto'g'ri narxlar chiqarardi.
///
/// `test/widget_test.dart` shu qoidani tekshiradi — testni o'chirmang.
///
/// Bu funksiyalar ilgari `widgets/common.dart` ichida edi; o'sha fayl
/// ochilmaydigan eski ekranlar bilan birga arxivga ko'chirildi, formatlash
/// esa mustaqil qism sifatida shu yerda qoldi.
library;

/// `65000` → `"65 000 so'm"`. Ajratgich — ingichka bo'shliq (U+2009).
String som(num amount) {
  final n = amount.round();
  final s = n.abs().toString();
  final b = StringBuffer(n < 0 ? '-' : '');
  for (int i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) b.write(' ');
    b.write(s[i]);
  }
  return "${b.toString()} so'm";
}

/// Tor joylar uchun qisqa shakl: `1 250 000` → `"1.25 mln"`.
String somShort(num amount) {
  final n = amount.round();
  if (n.abs() >= 1000000) {
    final m = n / 1000000;
    return '${m.toStringAsFixed(m.abs() >= 10 ? 0 : 2)} mln';
  }
  if (n.abs() >= 1000) return '${(n / 1000).toStringAsFixed(0)} ming';
  return '$n';
}

/// Butun bo'lsa butun, aks holda kasr bilan: `2.0` → `"2"`, `1.25` → `"1.25"`.
String qty(num v) =>
    v == v.roundToDouble() ? v.toInt().toString() : v.toStringAsFixed(v < 10 ? 2 : 1);
