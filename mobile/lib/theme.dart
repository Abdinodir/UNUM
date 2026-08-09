import 'package:flutter/material.dart';

/// UNUM design tokens.
///
/// 2026-08: ilova TO'Q (dark) dizaynga o'tdi — `ui/tokens.dart` dagi `U` sinfi
/// yagona manba. Bu fayl eski ekranlar uchun **moslashtiruvchi qatlam**:
/// nomlar o'zgarmagan, lekin qiymatlar yangi palitraga bog'langan. Shu tufayli
/// 13 000 satr eski kodni qayta yozmasdan hammasi bir xil ko'rinadi.
///
/// ⚠️ `slate*` shkalasi AG'DARILGAN: ilgari `slate50` eng och (sahifa foni),
/// `slate900` eng to'q (matn) edi. Endi `slate50` eng to'q fon, `slate900` esa
/// eng och matn. Nomlar semantik ishlatilgani uchun (fon → slate50,
/// sarlavha → slate800/900) bu almashtirish to'g'ri natija beradi.
class AppColors {
  // ---- brand (logo) ----
  static const lime = Color(0xFF9AE6A0); // eng yorqin nuqta (to'q fonda)
  static const limeSoft = Color(0xFF7FDD8F);
  static const mint = Color(0xFF34D77F);
  static const teal = Color(0xFF16833F);
  static const tealDeep = Color(0xFF0E5B2C);

  /// Yorqin yuzalar ustidagi to'q rang (masalan yashil tugma ichidagi matn)
  static const ink = Color(0xFF07130C);

  /// Asosiy brend rangi — tugmalar, faol holatlar.
  static const sky = Color(0xFF22C55E);
  static const skyDark = Color(0xFF16833F);

  /// Yashil aksentning to'q fondagi yumshoq varianti (ilgari och yashil fon edi)
  static const skyBg = Color(0xFF12251B);

  /// Logo gradienti — splash, bosh kartochka, Score halqasi.
  static const brandGradient = [mint, sky, teal];

  // ---- neytral shkala (AG'DARILGAN: 50 = fon, 900 = eng och matn) ----
  static const slate50 = Color(0xFF0A0C0B); // sahifa foni
  static const slate100 = Color(0xFF131717); // karta foni
  static const slate200 = Color(0xFF1F2423); // chegara
  static const slate300 = Color(0xFF2C3231); // ajratuvchi, o'chiq holat
  static const slate400 = Color(0xFF7B8481); // xira matn
  static const slate500 = Color(0xFF98A29E); // ikkilamchi matn
  static const slate600 = Color(0xFFC7CFCC); // asosiy matn
  static const slate700 = Color(0xFFE2E8E6);
  static const slate800 = Color(0xFFF2F5F4); // sarlavha
  static const slate900 = Color(0xFFFFFFFF);

  static const emerald = Color(0xFF10B981);
  static const amber = Color(0xFFF59E0B);
  static const rose = Color(0xFFF43F5E);
  static const pink = Color(0xFFEC4899);
  static const indigo = Color(0xFF6366F1);
  static const orange = Color(0xFFF97316);
  static const red = Color(0xFFEF4444);
  static const violet = Color(0xFF8B5CF6);

  // macro colors
  static const protein = Color(0xFF6366F1);
  static const carbs = Color(0xFFF59E0B);
  static const fat = Color(0xFFF43F5E);
  static const calories = Color(0xFF12A97B);
}

ThemeData buildTheme() {
  final base = ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    scaffoldBackgroundColor: AppColors.slate50,
    colorScheme: const ColorScheme.dark(
      primary: AppColors.sky,
      onPrimary: AppColors.ink,
      surface: AppColors.slate100,
      onSurface: AppColors.slate800,
      error: AppColors.red,
    ),
    fontFamily: 'Roboto',
    splashFactory: NoSplash.splashFactory,
    highlightColor: Colors.transparent,
  );
  return base.copyWith(
    textTheme: base.textTheme.apply(
      bodyColor: AppColors.slate600,
      displayColor: AppColors.slate800,
    ),
    cardTheme: const CardThemeData(
      color: AppColors.slate100,
      elevation: 0,
      surfaceTintColor: Colors.transparent,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.slate50,
      foregroundColor: AppColors.slate800,
      elevation: 0,
      surfaceTintColor: Colors.transparent,
    ),
    dividerTheme: const DividerThemeData(color: AppColors.slate200, thickness: 1),
    snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating),
  );
}

// Reusable card container matching the web's rounded white panels.
class GlassCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color? color;
  final VoidCallback? onTap;
  final BorderRadius? radius;
  const GlassCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(18),
    this.color,
    this.onTap,
    this.radius,
  });

  @override
  Widget build(BuildContext context) {
    final r = radius ?? BorderRadius.circular(24);
    return Material(
      color: color ?? AppColors.slate100,
      borderRadius: r,
      child: InkWell(
        onTap: onTap,
        borderRadius: r,
        child: Container(
          padding: padding,
          decoration: BoxDecoration(
            borderRadius: r,
            // To'q fonda soya ko'rinmaydi — chuqurlikni chegara beradi
            border: Border.all(color: AppColors.slate200),
          ),
          child: child,
        ),
      ),
    );
  }
}

class SectionTitle extends StatelessWidget {
  final String title;
  final String? subtitle;
  final Widget? trailing;
  const SectionTitle(this.title, {super.key, this.subtitle, this.trailing});

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title,
                  style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: AppColors.slate900)),
              if (subtitle != null) ...[
                const SizedBox(height: 2),
                Text(subtitle!,
                    style: const TextStyle(
                        fontSize: 13,
                        color: AppColors.slate500,
                        fontWeight: FontWeight.w500)),
              ],
            ],
          ),
        ),
        if (trailing != null) trailing!,
      ],
    );
  }
}
