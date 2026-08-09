import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import 'state/app_state.dart';
import 'theme.dart';
import 'ui/shell/app_shell.dart';
import 'ui/tokens.dart';
import 'ui/screens/auth_flow.dart';
import 'ui/screens/onboarding_flow.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
  ));
  runApp(const NutriStockApp());
}

class NutriStockApp extends StatelessWidget {
  const NutriStockApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AppState()..init(),
      child: MaterialApp(
        title: 'UNUM',
        debugShowCheckedModeBanner: false,
        scaffoldMessengerKey: messengerKey,
        theme: buildUnumTheme(),
        home: const _Root(),
      ),
    );
  }
}

class _Root extends StatelessWidget {
  const _Root();

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();

    if (!app.ready) {
      return const _Splash();
    }
    if (!app.isLoggedIn) {
      return AuthFlow(app: app);
    }
    // Nothing may be decided from the placeholder profile. Until the real one
    // has arrived we either wait or show the error — never guess that the user
    // is new, because onboarding would then overwrite their real data.
    if (!app.profileLoaded) {
      return app.loadError == null
          ? const _Splash(label: 'Ma\'lumotlar yuklanmoqda...')
          : const _LoadFailed();
    }
    // A brand-new account has no body data yet: ask for it once, then compute
    // every target from it. The user never types a calorie number.
    if (app.needsOnboarding) {
      return const OnboardingFlow();
    }
    return const AppShell();
  }
}

class _Splash extends StatelessWidget {
  final String? label;
  const _Splash({this.label});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.ink,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Image.asset('assets/logo.png', width: 96, height: 96),
            const SizedBox(height: 8),
            const Text('UNUM',
                style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 3,
                    color: Colors.white)),
            const SizedBox(height: 24),
            const SizedBox(
              width: 26,
              height: 26,
              child: CircularProgressIndicator(
                  color: AppColors.lime, strokeWidth: 2.6),
            ),
            if (label != null) ...[
              const SizedBox(height: 16),
              Text(label!,
                  style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.6), fontSize: 13)),
            ],
          ],
        ),
      ),
    );
  }
}

/// Profilni yuklab bo'lmadi. Bu ekran onboarding o'rniga ko'rsatiladi —
/// aks holda tarmoq uzilishi foydalanuvchini "yangi" deb ko'rsatib,
/// haqiqiy ma'lumotlarini yo'qotish xavfini tug'dirardi.
class _LoadFailed extends StatelessWidget {
  const _LoadFailed();

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    return Scaffold(
      backgroundColor: AppColors.ink,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Image.asset('assets/logo.png', width: 72, height: 72),
                const SizedBox(height: 22),
                const Text('Ma\'lumotlarni yuklab bo\'lmadi',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                        fontSize: 19,
                        fontWeight: FontWeight.w800,
                        color: Colors.white)),
                const SizedBox(height: 8),
                Text(
                    app.loadError ??
                        'Internet aloqasini tekshirib, qayta urinib ko\'ring.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                        fontSize: 13.5,
                        height: 1.5,
                        color: Colors.white.withValues(alpha: 0.6))),
                const SizedBox(height: 26),
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: FilledButton.icon(
                    onPressed: app.loadingData ? null : () => app.loadAll(),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.lime,
                      foregroundColor: AppColors.ink,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14)),
                    ),
                    icon: app.loadingData
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: AppColors.ink))
                        : const Icon(Icons.refresh_rounded),
                    label: Text(app.loadingData ? 'Urinilmoqda…' : 'Qayta urinish',
                        style: const TextStyle(fontWeight: FontWeight.w800)),
                  ),
                ),
                TextButton(
                  onPressed: () => app.logout(),
                  child: Text('Boshqa hisobga kirish',
                      style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.55))),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
