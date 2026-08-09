import 'package:flutter/material.dart';

import '../../state/app_state.dart';
import '../tokens.dart';
import 'onboarding_flow.dart';

/// Kirish ekrani — webdagi 1-skrin.
///
/// Parol yo'q: faqat Google (va keyinchalik Apple). SMS OTP oqimi olib
/// tashlandi — har SMS pul turardi va foydalanuvchi kod kutib o'tirardi.
class AuthFlow extends StatefulWidget {
  const AuthFlow({super.key, required this.app});

  final AppState app;

  @override
  State<AuthFlow> createState() => _AuthFlowState();
}

class _AuthFlowState extends State<AuthFlow> {
  bool _busy = false;
  String? _error;
  bool _appleAvailable = false;

  @override
  void initState() {
    super.initState();
    _loadProviders();
  }

  Future<void> _loadProviders() async {
    try {
      final p = await widget.app.api.authProviders();
      if (mounted) setState(() => _appleAvailable = p['apple'] == true);
    } catch (_) {
      // Server javob bermasa Apple tugmasi o'chiq qoladi — bu xato emas
    }
  }

  Future<void> _signInWithGoogle() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.app.signInWithGoogle();
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: U.bg,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Image.asset('assets/logo.png', width: 40, height: 40),
                  const SizedBox(width: 10),
                  const Text(
                    'UNUM',
                    style: TextStyle(
                      fontSize: 30,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                      letterSpacing: -0.8,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 40),

              const Text(
                'Kirish',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 8),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 16),
                child: Text(
                  'Hisobingizga Google orqali xavfsiz kiring. '
                  'Parol yaratish shart emas.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 13, height: 1.5, color: U.textMuted),
                ),
              ),
              const SizedBox(height: 32),

              if (_error != null) ...[
                Text(
                  _error!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 12.5, color: U.dangerText),
                ),
                const SizedBox(height: 16),
              ],

              _ProviderButton(
                label: 'Google bilan kirish',
                background: Colors.white,
                foreground: const Color(0xFF1F1F1F),
                icon: const _GoogleMark(),
                busy: _busy,
                onPressed: _busy ? null : _signInWithGoogle,
              ),
              const SizedBox(height: 12),
              _ProviderButton(
                label: 'Apple bilan kirish',
                background: Colors.black,
                foreground: Colors.white,
                border: const Color(0x26FFFFFF),
                icon: const Icon(Icons.apple, size: 20, color: Colors.white),
                onPressed: _appleAvailable ? () {} : null,
              ),

              if (!_appleAvailable)
                const Padding(
                  padding: EdgeInsets.only(top: 12),
                  child: Text(
                    "Apple orqali kirish tez orada qo'shiladi.",
                    style: TextStyle(fontSize: 11.5, color: U.textDim),
                  ),
                ),

              const SizedBox(height: 32),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 8),
                child: Text(
                  'Davom etish orqali siz Foydalanish shartlari va Maxfiylik '
                  "siyosatiga rozilik bildirasiz. UNUM sizning parolingizni "
                  "ko'rmaydi va saqlamaydi.",
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 11, height: 1.5, color: U.textDim),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ProviderButton extends StatelessWidget {
  const _ProviderButton({
    required this.label,
    required this.background,
    required this.foreground,
    required this.icon,
    this.border,
    this.busy = false,
    this.onPressed,
  });

  final String label;
  final Color background;
  final Color foreground;
  final Widget icon;
  final Color? border;
  final bool busy;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: onPressed == null ? 0.4 : 1,
      child: Material(
        color: background,
        borderRadius: BorderRadius.circular(U.rRow),
        child: InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.circular(U.rRow),
          child: Container(
            height: 54,
            width: double.infinity,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(U.rRow),
              border: border == null ? null : Border.all(color: border!),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (busy)
                  SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: foreground),
                  )
                else
                  icon,
                const SizedBox(width: 12),
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: foreground,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Google'ning rasmiy rangli "G" belgisi
class _GoogleMark extends StatelessWidget {
  const _GoogleMark();

  @override
  Widget build(BuildContext context) =>
      CustomPaint(size: const Size(19, 19), painter: _GooglePainter());
}

class _GooglePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final r = size.width / 2;
    final c = size.center(Offset.zero);
    final rect = Rect.fromCircle(center: c, radius: r * 0.86);
    final stroke = r * 0.36;

    void arc(double startDeg, double sweepDeg, Color color) {
      canvas.drawArc(
        rect,
        startDeg * 3.1415926 / 180,
        sweepDeg * 3.1415926 / 180,
        false,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = stroke
          ..color = color,
      );
    }

    arc(-35, 80, const Color(0xFF4285F4)); // ko'k
    arc(45, 90, const Color(0xFF34A853)); // yashil
    arc(135, 90, const Color(0xFFFBBC05)); // sariq
    arc(225, 100, const Color(0xFFEA4335)); // qizil

    // "G" ning gorizontal chizig'i
    canvas.drawRect(
      Rect.fromLTWH(c.dx, c.dy - stroke / 2, r * 0.86, stroke),
      Paint()..color = const Color(0xFF4285F4),
    );
  }

  @override
  bool shouldRepaint(_GooglePainter old) => false;
}

/// Kirilgandan keyin: profil hali to'ldirilmagan bo'lsa onboarding.
class AuthGate extends StatelessWidget {
  const AuthGate({super.key, required this.app, required this.child});

  final AppState app;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (!app.isLoggedIn) return AuthFlow(app: app);
    if (app.needsOnboarding) return const OnboardingFlow();
    return child;
  }
}
