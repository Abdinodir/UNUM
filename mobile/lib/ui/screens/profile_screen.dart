import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../state/app_state.dart';
import '../shell/top_bar.dart';
import '../tokens.dart';
import '../widgets/kit.dart';
import '../widgets/score_ring.dart';
import '../widgets/sub_screen.dart';

/// Profil ekrani — dizayndagi 6-skrin.
class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final score = app.todayScore;
    final p = app.profile;

    return ListView(
      padding: const EdgeInsets.only(bottom: 120),
      children: [
        UnumTopBar(
          title: 'Profil',
          trailing: TopBarAction(
            icon: Icons.settings_outlined,
            tooltip: 'Sozlamalar',
            onPressed: () => SubScreen.push(context, const _SettingsScreen()),
          ),
        ),

        // Foydalanuvchi
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
          child: UnumCard(
            onTap: () => SubScreen.push(context, const _PersonalScreen()),
            child: Row(
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: U.surfaceAlt,
                    shape: BoxShape.circle,
                    border: Border.all(color: U.border),
                  ),
                  child: const Icon(Icons.person, size: 24, color: U.textMuted),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        p.name.isEmpty ? 'Foydalanuvchi' : p.name,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                        ),
                      ),
                      Text(
                        app.userEmail,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 12.5, color: U.textMuted),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right, size: 18, color: U.textFaint),
              ],
            ),
          ),
        ),

        // UNUM Score
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: UnumCard(
            child: Row(
              children: [
                if (score.hasData)
                  ScoreRing(value: score.total, size: 78, thickness: 7)
                else
                  const SizedBox(
                    width: 78,
                    height: 78,
                    child: Center(child: Icon(Icons.remove, color: U.textFaint)),
                  ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'UNUM Score',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(height: 8),
                      _ScoreBars(days: app.recentDays(10)),
                      const SizedBox(height: 8),
                      Text(
                        score.hasData
                            ? "${U.scoreLabel(score.total)} yo'ldasiz! 🚀"
                            : "Birinchi qayddan keyin hisoblanadi",
                        style: const TextStyle(fontSize: 11.5, color: U.greenBright),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),

        // Premium
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: GestureDetector(
            onTap: () => SubScreen.push(context, const _SubscriptionScreen()),
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(U.rCard),
                gradient: const LinearGradient(
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                  colors: [Color(0xFF1B7F4B), U.green],
                ),
              ),
              child: Row(
                children: [
                  const Icon(Icons.workspace_premium, size: 22, color: Color(0xFFFDE68A)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'UNUM Premium',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          p.premium
                              ? 'Premium obunaga egasiz'
                              : 'Cheksiz AI tahlil va hisobotlar',
                          style: const TextStyle(fontSize: 11.5, color: Color(0xCCFFFFFF)),
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right, size: 18, color: Color(0xCCFFFFFF)),
                ],
              ),
            ),
          ),
        ),

        // Menyu
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: ListGroup(
            children: [
              UnumListRow(
                icon: const Icon(Icons.person_outline, size: 18, color: U.textMuted),
                title: "Shaxsiy ma'lumotlar",
                divider: true,
                onTap: () => SubScreen.push(context, const _PersonalScreen()),
              ),
              UnumListRow(
                icon: const Icon(Icons.link, size: 18, color: U.textMuted),
                title: 'Integratsiyalar',
                divider: true,
                onTap: () => SubScreen.push(context, const _IntegrationsScreen()),
              ),
              UnumListRow(
                icon: const Icon(Icons.notifications_none, size: 18, color: U.textMuted),
                title: 'Bildirishnomalar va sozlamalar',
                divider: true,
                onTap: () => SubScreen.push(context, const _SettingsScreen()),
              ),
              UnumListRow(
                icon: const Icon(Icons.shield_outlined, size: 18, color: U.textMuted),
                title: "Maxfiylik va ma'lumotlar",
                divider: true,
                onTap: () => SubScreen.push(context, const _PrivacyScreen()),
              ),
              UnumListRow(
                icon: const Icon(Icons.logout, size: 18, color: U.dangerText),
                title: 'Akkauntdan chiqish',
                danger: true,
                chevron: false,
                onTap: () => _confirmSignOut(context),
              ),
            ],
          ),
        ),

        const Padding(
          padding: EdgeInsets.only(top: 20),
          child: Center(
            child: Text('UNUM · v1.0.0', style: TextStyle(fontSize: 11, color: U.textFaint)),
          ),
        ),
      ],
    );
  }

  void _confirmSignOut(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: U.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(U.rSheet)),
      ),
      builder: (sheetContext) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Akkauntdan chiqish',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: Colors.white),
            ),
            const SizedBox(height: 8),
            const Text(
              "Qayta kirganingizda ma'lumotlaringiz saqlanib qoladi.",
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, height: 1.5, color: U.textMuted),
            ),
            const SizedBox(height: 24),
            UnumButton(
              label: 'Chiqish',
              variant: UnumButtonVariant.dangerSolid,
              onPressed: () {
                Navigator.of(sheetContext).pop();
                context.read<AppState>().logout();
              },
            ),
            const SizedBox(height: 10),
            UnumButton(
              label: 'Bekor qilish',
              variant: UnumButtonVariant.secondary,
              onPressed: () => Navigator.of(sheetContext).pop(),
            ),
          ],
        ),
      ),
    );
  }
}

class _ScoreBars extends StatelessWidget {
  const _ScoreBars({required this.days});

  final List<dynamic> days;

  @override
  Widget build(BuildContext context) {
    final values = days.map((d) => (d.score as int)).toList();
    if (values.isEmpty) return const SizedBox(height: 28);

    return SizedBox(
      height: 28,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          for (var i = 0; i < values.length; i++)
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(right: 3),
                child: FractionallySizedBox(
                  heightFactor: (values[i] / 100).clamp(0.08, 1).toDouble(),
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: U.green.withValues(alpha: 0.35 + i / values.length * 0.65),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------------ */
/* Ost-ekranlar                                                        */
/* ------------------------------------------------------------------ */

/// Shaxsiy ma'lumotlar — O'QISH EMAS, TAHRIRLASH.
///
/// Bo'y/vazn onboardingda kiritiladi, lekin ular o'zgaradi. Bu yerda
/// o'zgartirilganda kunlik kaloriya/oqsil/suv me'yorlari darhol qayta
/// hisoblanadi (Mifflin-St Jeor) — foydalanuvchi raqamlarni o'zi kiritmaydi.
class _PersonalScreen extends StatefulWidget {
  const _PersonalScreen();

  @override
  State<_PersonalScreen> createState() => _PersonalScreenState();
}

class _PersonalScreenState extends State<_PersonalScreen> {
  late final AppState _app = context.read<AppState>();

  late String _gender = _app.profile.gender;
  late int _age = _app.profile.age;
  late double _height = _app.profile.height;
  late double _weight = _app.profile.weight;
  late double _goalWeight = _app.profile.goalWeight;
  late String _activity = _app.profile.activityLevel;
  late final TextEditingController _nameCtrl =
      TextEditingController(text: _app.profile.name);

  bool _saving = false;

  @override
  void dispose() {
    _nameCtrl.dispose();
    super.dispose();
  }

  bool get _dirty =>
      _nameCtrl.text.trim() != _app.profile.name ||
      _gender != _app.profile.gender ||
      _age != _app.profile.age ||
      _height != _app.profile.height ||
      _weight != _app.profile.weight ||
      _goalWeight != _app.profile.goalWeight ||
      _activity != _app.profile.activityLevel;

  Future<void> _save() async {
    setState(() => _saving = true);
    await _app.updateProfile((p) {
      p.name = _nameCtrl.text.trim().isEmpty ? p.name : _nameCtrl.text.trim();
      p.gender = _gender;
      p.age = _age;
      p.height = _height;
      p.weight = _weight;
      p.goalWeight = _goalWeight;
      p.activityLevel = _activity;
      p.weightGoalType = _goalWeight < _weight
          ? 'lose'
          : _goalWeight > _weight
              ? 'gain'
              : 'maintain';
      // Me'yorlarni qayta hisoblaymiz — aks holda eski kaloriya qolib ketardi
      p.recomputeTargets();
      return p;
    });
    if (!mounted) return;
    setState(() => _saving = false);
    Navigator.of(context).maybePop();
  }

  @override
  Widget build(BuildContext context) {
    final p = context.watch<AppState>().profile;

    return SubScreen(
      title: "Shaxsiy ma'lumotlar",
      bottomBar: UnumButton(
        label: _saving ? 'Saqlanmoqda…' : 'Saqlash',
        onPressed: _dirty && !_saving ? _save : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Ism', style: TextStyle(fontSize: 12, color: U.textDim)),
          const SizedBox(height: 6),
          Container(
            height: 52,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: U.surface,
              borderRadius: BorderRadius.circular(U.rRow),
              border: Border.all(color: U.border),
            ),
            child: TextField(
              controller: _nameCtrl,
              onChanged: (_) => setState(() {}),
              style: const TextStyle(fontSize: 15, color: Colors.white),
              decoration: const InputDecoration(border: InputBorder.none),
            ),
          ),

          const SizedBox(height: 16),
          _chips('Jins', const ['Erkak', 'Ayol'], _gender,
              (v) => setState(() => _gender = v)),

          const SizedBox(height: 16),
          _slider('Yosh', '$_age', _age.toDouble(), 12, 90,
              (v) => setState(() => _age = v.round())),
          _slider("Bo'y", '${_height.round()} sm', _height, 120, 220,
              (v) => setState(() => _height = v)),
          _slider('Vazn', '${_weight.round()} kg', _weight, 30, 200,
              (v) => setState(() => _weight = v)),
          _slider('Maqsad vazni', '${_goalWeight.round()} kg', _goalWeight, 30, 200,
              (v) => setState(() => _goalWeight = v)),

          const SizedBox(height: 8),
          _chips('Faollik darajasi', const ['Past', "O'rtacha", 'Yuqori'], _activity,
              (v) => setState(() => _activity = v)),

          const SizedBox(height: 24),
          const SectionHeader(title: "Kunlik me'yorlar"),
          ListGroup(
            children: [
              _info('Kaloriya', '${p.targetCalories} kkal', divider: true),
              _info('Oqsil', '${p.targetProtein} g', divider: true),
              _info('Suv', '${p.targetWaterMl} ml'),
            ],
          ),

          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: U.green.withValues(alpha: 0.07),
              borderRadius: BorderRadius.circular(U.rRow),
              border: Border.all(color: U.green.withValues(alpha: 0.2)),
            ),
            child: const Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.calculate_outlined, size: 16, color: U.greenBright),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    "Me'yorlar bo'y, vazn, yosh va faollikdan Mifflin-St Jeor "
                    "formulasi bilan avtomatik hisoblanadi. Yuqoridagi qiymatni "
                    "o'zgartirsangiz, saqlaganingizdan keyin ular yangilanadi.",
                    style: TextStyle(fontSize: 11.5, height: 1.5, color: Color(0xFFA7C4B4)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _info(String label, String value, {bool divider = false}) => UnumListRow(
        title: label,
        value: Text(value, style: const TextStyle(fontSize: 13, color: U.textMuted)),
        chevron: false,
        divider: divider,
      );

  Widget _chips(
    String label,
    List<String> options,
    String value,
    ValueChanged<String> onChanged,
  ) =>
      Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 12, color: U.textDim)),
          const SizedBox(height: 8),
          Row(
            children: [
              for (final o in options)
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: GestureDetector(
                      onTap: () => onChanged(o),
                      behavior: HitTestBehavior.opaque,
                      child: Container(
                        height: 40,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: value == o
                              ? U.green.withValues(alpha: 0.18)
                              : const Color(0x0DFFFFFF),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: value == o
                                ? U.green.withValues(alpha: 0.35)
                                : Colors.transparent,
                          ),
                        ),
                        child: Text(
                          o,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                            color: value == o ? U.greenBright : U.textMuted,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ],
      );

  Widget _slider(
    String label,
    String display,
    double value,
    double min,
    double max,
    ValueChanged<double> onChanged,
  ) =>
      Padding(
        padding: const EdgeInsets.only(bottom: 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(label, style: const TextStyle(fontSize: 12, color: U.textDim)),
                Text(
                  display,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Colors.white,
                  ),
                ),
              ],
            ),
            SliderTheme(
              data: SliderThemeData(
                activeTrackColor: U.green,
                inactiveTrackColor: const Color(0x14FFFFFF),
                thumbColor: U.green,
                overlayColor: U.green.withValues(alpha: 0.12),
                trackHeight: 4,
              ),
              child: Slider(
                value: value.clamp(min, max),
                min: min,
                max: max,
                onChanged: onChanged,
              ),
            ),
          ],
        ),
      );
}

/// Daqiqani "2 soat 15 daq" ko'rinishiga o'giradi.
String _hm(int minutes) {
  final h = minutes ~/ 60;
  final m = minutes % 60;
  if (h == 0) return '$m daqiqa';
  return m == 0 ? '$h soat' : '$h soat $m daq';
}

class _IntegrationsScreen extends StatelessWidget {
  const _IntegrationsScreen();

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();

    return SubScreen(
      title: 'Integratsiyalar',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.only(bottom: 16),
            child: Text(
              "Ma'lumotlaringizni aniqroq tahlil qilish uchun manbalarni ulang.",
              style: TextStyle(fontSize: 12.5, height: 1.5, color: U.textMuted),
            ),
          ),
          ListGroup(
            children: [
              UnumListRow(
                icon: const Icon(Icons.directions_walk, size: 18, color: U.textMuted),
                title: 'Qadam sensori',
                subtitle: 'Telefondagi qadam hisoblagich',
                chevron: false,
                divider: true,
                value: Text(
                  app.stepSensorActive ? 'Ulangan' : 'Ulanmagan',
                  style: TextStyle(
                    fontSize: 13,
                    color: app.stepSensorActive ? U.greenBright : U.warn,
                  ),
                ),
              ),
              // Health Connect — bosilganda ruxsat so'raladi va darhol
              // sinxronlanadi. Holat HAQIQIY: `healthConnected` faqat
              // ruxsat berilganda `true` bo'ladi.
              UnumListRow(
                icon: const Icon(Icons.favorite_border, size: 18, color: U.textMuted),
                title: 'Health Connect',
                subtitle: app.healthConnected
                    ? 'Qadam va uyqu avtomatik tortiladi'
                    : app.healthInstalled == false
                        ? "Telefoningizda o'rnatilmagan — bosing, Play Market ochiladi"
                        : 'Qadam va uyquni avtomatik olish uchun ulang',
                chevron: !app.healthConnected,
                divider: true,
                onTap: app.healthConnected
                    ? null
                    : () async {
                        // Holatni AYNI PAYTDA tekshiramiz: foydalanuvchi
                        // Play Market'dan o'rnatib qaytgan bo'lishi mumkin,
                        // eski keshga tayansak yana do'konga yuborardik.
                        final installed = await app.checkHealthInstalled();
                        if (!context.mounted) return;

                        // O'rnatilmagan bo'lsa ruxsat so'ramaymiz —
                        // so'raydigan ilovaning o'zi yo'q, va "Ruxsat
                        // berilmadi" degan chalkash xabar chiqardi.
                        if (!installed) {
                          // Uch qadamni oldindan aytamiz: foydalanuvchi
                          // Play Market'dan qaytgach nima qilishni bilsin.
                          // Aks holda "o'rnatdim, nega ishlamayapti?" degan
                          // holat paydo bo'ladi.
                          final go = await showDialog<bool>(
                            context: context,
                            builder: (ctx) => AlertDialog(
                              backgroundColor: U.surface,
                              title: const Text('Health Connect kerak',
                                  style: TextStyle(fontSize: 17, color: Colors.white)),
                              content: const Text(
                                'Qadam va uyquni avtomatik olish uchun:\n\n'
                                "1. Play Market'dan Health Connect'ni o'rnating\n"
                                '2. Shu ekranga qayting\n'
                                "3. Health Connect'ni yana bosing — ruxsat oynasi ochiladi",
                                style: TextStyle(
                                    fontSize: 13.5, height: 1.6, color: U.textMuted),
                              ),
                              actions: [
                                TextButton(
                                  onPressed: () => Navigator.pop(ctx, false),
                                  child: const Text('Keyinroq',
                                      style: TextStyle(color: U.textMuted)),
                                ),
                                TextButton(
                                  onPressed: () => Navigator.pop(ctx, true),
                                  child: const Text('Play Market',
                                      style: TextStyle(
                                          color: U.green,
                                          fontWeight: FontWeight.w600)),
                                ),
                              ],
                            ),
                          );
                          if (go != true) return;

                          final ok = await app.openHealthStore();
                          if (!context.mounted) return;
                          if (!ok) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text(
                                    "Play Market ochilmadi. Health Connect'ni qo'lda o'rnating."),
                              ),
                            );
                          }
                          return;
                        }

                        await app.syncHealth(ask: true);
                        if (!context.mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(app.healthConnected
                                ? 'Health Connect ulandi'
                                : 'Ruxsat berilmadi'),
                          ),
                        );
                      },
                value: Text(
                  app.healthConnected
                      ? 'Ulangan'
                      : app.healthInstalled == false
                          ? "O'rnatilmagan"
                          : 'Ulanmagan',
                  style: TextStyle(
                    fontSize: 13,
                    color: app.healthConnected ? U.greenBright : U.warn,
                  ),
                ),
              ),
              // Screen Time — `PACKAGE_USAGE_STATS` oddiy dialog bilan
              // so'ralmaydi, foydalanuvchi tizim sozlamalaridan yoqadi.
              // Shuning uchun tugma to'g'ridan-to'g'ri o'sha ekranni ochadi.
              UnumListRow(
                icon: const Icon(Icons.smartphone, size: 18, color: U.textMuted),
                title: 'Screen Time',
                subtitle: app.screenTimeConnected
                    ? (app.screenMinutes == null
                        ? "Hisoblanmoqda…"
                        : 'Bugun: ${_hm(app.screenMinutes!)}')
                    : "Yoqish uchun bosing — tizim sozlamalari ochiladi",
                // Ulangan bo'lsa ham bosiladi — foydalanuvchi qiymatni
                // yangilamoqchi bo'lishi mumkin.
                chevron: false,
                onTap: app.screenTimeConnected
                    ? () async {
                        await app.syncScreenTime();
                        if (!context.mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(app.screenMinutes == null
                                ? "Ma'lumot olinmadi"
                                : 'Bugun ekranda: ${_hm(app.screenMinutes!)}'),
                          ),
                        );
                      }
                    : () async {
                        await app.openScreenTimeSettings();
                        if (!context.mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text(
                              "Ro'yxatdan UNUM'ni toping va yoqing, "
                              "so'ng shu yerga qayting",
                            ),
                          ),
                        );
                      },
                value: Text(
                  app.screenTimeConnected ? 'Ulangan' : 'Ulanmagan',
                  style: TextStyle(
                    fontSize: 13,
                    color: app.screenTimeConnected ? U.greenBright : U.warn,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          const Text(
            "Google Fit ulanmaydi: Google uni 2026-yil oxirida to'xtatadi. "
            "Qadam va uyqu ma'lumoti telefon sensori va Health Connect orqali olinadi.",
            style: TextStyle(fontSize: 11, height: 1.5, color: U.textDim),
          ),
        ],
      ),
    );
  }
}

class _SubscriptionScreen extends StatelessWidget {
  const _SubscriptionScreen();

  /// Jadval katagi: `null` — funksiya yo'q (chiziqcha), aks holda matn.
  static Widget _cell(String? value, {bool muted = false}) {
    if (value == null) {
      return const Center(
        child: Text('—', style: TextStyle(fontSize: 13, color: U.textFaint)),
      );
    }
    return Center(
      child: Text(
        value,
        textAlign: TextAlign.center,
        style: TextStyle(
          fontSize: 12.5,
          fontWeight: muted ? FontWeight.w400 : FontWeight.w600,
          color: muted ? U.textMuted : U.greenBright,
        ),
      ),
    );
  }

  /// Bepul va Premium taqqoslash. `null` = yo'q, matn = bor/chegara.
  static const _compare = <(String, String?, String)>[
    ('Maqsadlar', '3 ta', 'Cheksiz'),
    ('Odatlar', '5 ta', 'Cheksiz'),
    ('Kunlik reja', 'Bor', 'Bor'),
    ('Pomodoro', 'Bor', 'Bor'),
    ('AI tahlil (kunlik)', '12 ta', '120 ta'),
    ('Life Score', null, 'Bor'),
    ('Haftalik hisobot', null, 'Bor'),
    ('Oylik hisobot', null, 'Bor'),
    ('Maqsad prognozi', null, 'Bor'),
    ('AI Goal Coach', null, 'Bor'),
    ('AI bosqichlarga bo\'lish', null, 'Bor'),
    ('Kengaytirilgan statistika', null, 'Bor'),
  ];

  @override
  Widget build(BuildContext context) {
    final premium = context.watch<AppState>().profile.premium;

    return SubScreen(
      title: 'Obuna',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          UnumCard(
            child: Row(
              children: [
                const Icon(Icons.workspace_premium, size: 20, color: Color(0xFFFDE68A)),
                const SizedBox(width: 10),
                const Expanded(
                  child: Text(
                    'UNUM Premium',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: premium
                        ? U.green.withValues(alpha: 0.15)
                        : const Color(0x12FFFFFF),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    premium ? 'Faol' : 'Faol emas',
                    style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w600,
                      color: premium ? U.greenBright : U.textMuted,
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),
          const SectionHeader(title: 'Bepul va Premium'),
          UnumCard(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                // Sarlavha qatori
                Container(
                  padding: const EdgeInsets.fromLTRB(14, 11, 14, 11),
                  decoration: const BoxDecoration(
                    border: Border(bottom: BorderSide(color: U.border)),
                  ),
                  child: const Row(
                    children: [
                      Expanded(flex: 5, child: SizedBox()),
                      Expanded(
                        flex: 3,
                        child: Text('Bepul',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w600,
                                color: U.textMuted)),
                      ),
                      Expanded(
                        flex: 3,
                        child: Text('Premium',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w600,
                                color: U.greenBright)),
                      ),
                    ],
                  ),
                ),

                for (var i = 0; i < _compare.length; i++)
                  Container(
                    padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
                    decoration: BoxDecoration(
                      border: i == _compare.length - 1
                          ? null
                          : const Border(bottom: BorderSide(color: U.border)),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          flex: 5,
                          child: Text(_compare[i].$1,
                              style: const TextStyle(
                                  fontSize: 13, color: U.textSoft)),
                        ),
                        Expanded(
                          flex: 3,
                          child: _cell(_compare[i].$2, muted: true),
                        ),
                        Expanded(
                          flex: 3,
                          child: _cell(_compare[i].$3),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),

          const SizedBox(height: 16),
          // ⚠️ Bu ekranda NARX ham, SOTIB OLISH TUGMASI ham BO'LMASIN.
          // Google Play ilova ichidagi raqamli obunani tashqi to'lov tizimi
          // bilan sotishni taqiqlaydi (Play Billing majburiy) — narx yoki
          // to'lov havolasi qo'yilsa ilova olib tashlanishi mumkin.
          // Taqqoslash jadvalining o'zi (funksiyalar ro'yxati) taqiqlanmagan.
          const Text(
            "Premium obuna hisobingizga bog'lanadi va shu yerda avtomatik "
            "faollashadi. Yuqoridagi holat serverdan o'qiladi.",
            style: TextStyle(fontSize: 11.5, height: 1.5, color: U.textDim),
          ),
        ],
      ),
    );
  }
}

class _SettingsScreen extends StatelessWidget {
  const _SettingsScreen();

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();

    return SubScreen(
      title: 'Bildirishnomalar va sozlamalar',
      child: ListGroup(
        children: [
          UnumListRow(
            icon: const Icon(Icons.directions_walk, size: 18, color: U.textMuted),
            title: 'Qadam kuzatuvi',
            subtitle: 'Telefon sensoridan foydalanish',
            chevron: false,
            divider: true,
            value: UnumToggle(
              value: app.stepSensorActive,
              onChanged: (v) {
                if (v) app.startStepTracking();
              },
            ),
          ),
          const UnumListRow(
            icon: Icon(Icons.language, size: 18, color: U.textMuted),
            title: 'Til',
            chevron: false,
            value: Text("O'zbekcha", style: TextStyle(fontSize: 13, color: U.textMuted)),
          ),
        ],
      ),
    );
  }
}

class _PrivacyScreen extends StatelessWidget {
  const _PrivacyScreen();

  @override
  Widget build(BuildContext context) {
    return SubScreen(
      title: "Maxfiylik va ma'lumotlar",
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ListGroup(
            children: [
              UnumListRow(
                icon: const Icon(Icons.description_outlined, size: 18, color: U.textMuted),
                title: 'Maxfiylik siyosati',
                divider: true,
                onTap: () {},
              ),
              UnumListRow(
                icon: const Icon(Icons.delete_outline, size: 18, color: U.dangerText),
                title: "Akkauntni o'chirish",
                subtitle: "Barcha ma'lumotlar butunlay o'chadi",
                danger: true,
                onTap: () {},
              ),
            ],
          ),
          const SizedBox(height: 16),
          const Text(
            "Sog'liq ma'lumotlaringiz reklama uchun ishlatilmaydi va uchinchi tomonga "
            "berilmaydi.",
            style: TextStyle(fontSize: 11.5, height: 1.5, color: U.textDim),
          ),
        ],
      ),
    );
  }
}
