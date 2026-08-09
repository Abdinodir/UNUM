import 'package:flutter/material.dart';

import '../tokens.dart';

/// O'ngdan siljib chiqadigan to'liq ekranli ost-sahifa.
/// Dizayndagi "‹ Shaxsiy ma'lumotlar" ko'rinishidagi barcha ekranlar shu qobiqda.
class SubScreen extends StatelessWidget {
  const SubScreen({
    super.key,
    required this.title,
    required this.child,
    this.action,
    this.bottomBar,
  });

  final String title;
  final Widget child;

  /// Sarlavha o'ngidagi harakat (masalan "+" tugmasi)
  final Widget? action;

  /// Pastda qotib turadigan panel (masalan yozish qatori)
  final Widget? bottomBar;

  /// Ost-ekranni ochish uchun qulaylik — barcha joyda bir xil animatsiya
  static Future<T?> push<T>(BuildContext context, Widget page) {
    return Navigator.of(context).push<T>(
      PageRouteBuilder(
        transitionDuration: const Duration(milliseconds: 260),
        reverseTransitionDuration: const Duration(milliseconds: 220),
        pageBuilder: (_, __, ___) => page,
        transitionsBuilder: (_, animation, __, child) => SlideTransition(
          position: Tween(begin: const Offset(1, 0), end: Offset.zero)
              .chain(CurveTween(curve: Curves.easeOutCubic))
              .animate(animation),
          child: child,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: U.bg,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 8, 4, 10),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => Navigator.of(context).maybePop(),
                    icon: const Icon(Icons.chevron_left, color: Colors.white),
                    tooltip: 'Orqaga',
                  ),
                  Expanded(
                    child: Text(
                      title,
                      textAlign: TextAlign.center,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w600,
                        color: Colors.white,
                      ),
                    ),
                  ),
                  SizedBox(width: 48, child: action),
                ],
              ),
            ),
            const Divider(height: 1, thickness: 1, color: Color(0x0DFFFFFF)),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                child: child,
              ),
            ),
            if (bottomBar != null)
              SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                  child: bottomBar!,
                ),
              ),
          ],
        ),
      ),
    );
  }
}
