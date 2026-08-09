import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../state/app_state.dart';
import '../tokens.dart';
import '../widgets/coach_avatar.dart';
import '../widgets/kit.dart';
import '../widgets/radar_pentagon.dart';

/// Onboarding — webdagi 3–10-skrinlar.
///
/// Foydalanuvchi HECH QACHON kaloriya yoki oqsil raqamini o'zi kiritmaydi:
/// hammasi tana ma'lumotlaridan Mifflin-St Jeor bilan hisoblanadi.
class OnboardingFlow extends StatefulWidget {
  const OnboardingFlow({super.key});

  @override
  State<OnboardingFlow> createState() => _OnboardingFlowState();
}

enum _Step { welcome, disclaimer, about, goal, target, connect, building }

class _OnboardingFlowState extends State<OnboardingFlow> {
  _Step _step = _Step.welcome;
  bool _acknowledged = false;

  String _gender = 'Erkak';
  int _age = 23;
  double _height = 175;
  double _weight = 72;
  String _activity = "O'rtacha";
  String _goalId = 'nutrition';
  String _weightIntent = 'lose';
  int _deltaKg = 8;

  static const _progressSteps = [_Step.about, _Step.goal, _Step.target, _Step.connect, _Step.building];

  /// Maqsad variantlari. `scored: false` — kuzatiladi, lekin BALLANMAYDI.
  static const _goals = <(String, String, IconData, bool)>[
    ('nutrition', "Sog'lom ovqatlanish", Icons.restaurant, true),
    ('steps', "Ko'proq yurish", Icons.directions_walk, true),
    ('sleep', 'Uyquni yaxshilash', Icons.nightlight_round, true),
    ('screen', 'Screen Timeni kamaytirish', Icons.smartphone, true),
    ('reading', "Ko'proq kitob o'qish", Icons.menu_book, true),
    ('finance', 'Xarajatlarni nazorat', Icons.savings_outlined, true),
    ('prayer', "Namozga ko'proq e'tibor", Icons.favorite_border, false),
  ];

  Future<void> _finish() async {
    setState(() => _step = _Step.building);

    final goalWeight = switch (_weightIntent) {
      'lose' => _weight - _deltaKg,
      'gain' => _weight + _deltaKg,
      _ => _weight,
    };

    await context.read<AppState>().completeOnboarding(
          gender: _gender,
          age: _age,
          height: _height,
          weight: _weight,
          goalWeight: goalWeight.clamp(30, 300),
          activityLevel: _activity,
          diet: 'balanced',
        );
  }

  void _back() {
    const order = [_Step.welcome, _Step.disclaimer, _Step.about, _Step.goal, _Step.target, _Step.connect];
    final i = order.indexOf(_step);
    if (i > 0) setState(() => _step = order[i - 1]);
  }

  @override
  Widget build(BuildContext context) {
    final progressIndex = _progressSteps.indexOf(_step);

    return Scaffold(
      backgroundColor: U.bg,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
          child: Column(
            children: [
              if (_step != _Step.welcome && _step != _Step.building)
                Row(
                  children: [
                    IconButton(
                      onPressed: _back,
                      icon: const Icon(Icons.chevron_left, color: Colors.white),
                    ),
                    if (progressIndex >= 0)
                      Expanded(
                        child: UnumProgressBar(
                          percent: (progressIndex + 1) / _progressSteps.length * 100,
                          color: U.green,
                        ),
                      ),
                  ],
                ),

              Expanded(
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 220),
                  child: switch (_step) {
                    _Step.welcome => _welcome(),
                    _Step.disclaimer => _disclaimer(),
                    _Step.about => _about(),
                    _Step.goal => _goal(),
                    _Step.target => _target(),
                    _Step.connect => _connect(),
                    _Step.building => _building(),
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /* ---------------------------------------------------------------- */

  Widget _welcome() => Column(
        key: const ValueKey('welcome'),
        children: [
          const SizedBox(height: 20),
          const Text('🎉', style: TextStyle(fontSize: 34)),
          const SizedBox(height: 8),
          const Text(
            'UNUMga\nxush kelibsiz!',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w700,
              color: Colors.white,
              height: 1.2,
            ),
          ),
          const SizedBox(height: 12),
          const Text(
            'Biz sizning maqsadlaringizni kuzatib boramiz, tahlil qilamiz va '
            'AI yordamida ularga erishishingizga yordam beramiz.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, height: 1.55, color: U.textMuted),
          ),
          Expanded(
            child: Center(
              child: RadarPentagon(
                values: {for (final k in kRadarOrder) k: 62},
                size: 240,
                showScale: false,
              ),
            ),
          ),
          UnumButton(
            label: 'Boshlash',
            onPressed: () => setState(() => _step = _Step.disclaimer),
          ),
        ],
      );

  Widget _disclaimer() => Column(
        key: const ValueKey('disclaimer'),
        children: [
          const SizedBox(height: 20),
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: U.danger.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.warning_amber_rounded, size: 30, color: U.dangerText),
          ),
          const SizedBox(height: 12),
          const Text(
            'Muhim',
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w700,
              color: U.dangerText,
            ),
          ),
          const SizedBox(height: 24),
          const UnumCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'UNUM tavsiyalari AI tomonidan yaratiladi va ular tibbiy, '
                  "moliyaviy yoki professional maslahat o'rnini bosmaydi.",
                  style: TextStyle(fontSize: 13.5, height: 1.6, color: U.textSoft),
                ),
                SizedBox(height: 14),
                Text(
                  'Muhim qarorlar qabul qilishdan oldin mutaxassis (shifokor yoki '
                  'boshqa mutaxassis) bilan maslahatlashing.',
                  style: TextStyle(fontSize: 13.5, height: 1.6, color: U.textSoft),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          GestureDetector(
            onTap: () => setState(() => _acknowledged = !_acknowledged),
            behavior: HitTestBehavior.opaque,
            child: Row(
              children: [
                Container(
                  width: 22,
                  height: 22,
                  decoration: BoxDecoration(
                    color: _acknowledged ? U.green : Colors.transparent,
                    borderRadius: BorderRadius.circular(7),
                    border: Border.all(
                      color: _acknowledged ? U.green : const Color(0x33FFFFFF),
                    ),
                  ),
                  child: _acknowledged
                      ? const Icon(Icons.check, size: 14, color: U.greenInk)
                      : null,
                ),
                const SizedBox(width: 12),
                const Text(
                  'Tushundim',
                  style: TextStyle(fontSize: 14, color: Colors.white),
                ),
              ],
            ),
          ),
          const Spacer(),
          UnumButton(
            label: 'Davom etish',
            onPressed: _acknowledged ? () => setState(() => _step = _Step.about) : null,
          ),
        ],
      );

  Widget _about() => ListView(
        key: const ValueKey('about'),
        children: [
          const Text(
            'Siz haqingizda',
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w700,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            "To'g'ri ma'lumotlar AI tahlilini aniqroq qilishga yordam beradi.",
            style: TextStyle(fontSize: 13, height: 1.5, color: U.textMuted),
          ),
          const SizedBox(height: 20),

          _chips(
            'Jins',
            const ['Erkak', 'Ayol'],
            _gender,
            (v) => setState(() => _gender = v),
          ),
          const SizedBox(height: 12),
          _slider('Yosh', '$_age', _age.toDouble(), 12, 90,
              (v) => setState(() => _age = v.round())),
          _slider('Bo\'y', '${_height.round()} sm', _height, 120, 220,
              (v) => setState(() => _height = v)),
          _slider('Vazn', '${_weight.round()} kg', _weight, 30, 200,
              (v) => setState(() => _weight = v)),
          const SizedBox(height: 12),
          _chips(
            'Faollik darajasi',
            const ['Past', "O'rtacha", 'Yuqori'],
            _activity,
            (v) => setState(() => _activity = v),
          ),

          const SizedBox(height: 16),
          const Text(
            "Kunlik kaloriya va oqsil me'yori shu ma'lumotlardan avtomatik "
            "hisoblanadi — raqamlarni o'zingiz kiritishingiz shart emas.",
            style: TextStyle(fontSize: 11, height: 1.5, color: U.textDim),
          ),
          const SizedBox(height: 24),
          UnumButton(
            label: 'Davom etish',
            onPressed: () => setState(() => _step = _Step.goal),
          ),
        ],
      );

  Widget _goal() => Column(
        key: const ValueKey('goal'),
        children: [
          const Text(
            'Asosiy maqsadingiz nima?',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w700,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            "Hozir siz uchun eng muhim bo'lgan maqsadni tanlang.",
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, height: 1.5, color: U.textMuted),
          ),
          const SizedBox(height: 20),

          Expanded(
            child: GridView.count(
              crossAxisCount: 3,
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              children: [
                for (final (id, label, icon, _) in _goals)
                  GestureDetector(
                    onTap: () => setState(() => _goalId = id),
                    child: Container(
                      decoration: BoxDecoration(
                        color: _goalId == id
                            ? U.green.withValues(alpha: 0.15)
                            : U.surface,
                        borderRadius: BorderRadius.circular(U.rRow),
                        border: Border.all(
                          color: _goalId == id
                              ? U.green.withValues(alpha: 0.45)
                              : U.border,
                        ),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            icon,
                            size: 22,
                            color: _goalId == id ? U.greenBright : U.textSoft,
                          ),
                          const SizedBox(height: 8),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 6),
                            child: Text(
                              label,
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 10.5,
                                height: 1.25,
                                color: _goalId == id ? U.greenBright : U.textMuted,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),

          if (_goals.firstWhere((g) => g.$1 == _goalId).$4 == false)
            const Padding(
              padding: EdgeInsets.only(bottom: 8),
              child: Text(
                'Bu maqsad kuzatiladi, lekin ballanmaydi — UNUM ibodatga baho qo\'ymaydi.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 11.5, height: 1.5, color: U.textMuted),
              ),
            ),

          UnumButton(
            label: 'Davom etish',
            onPressed: () => setState(() => _step = _Step.target),
          ),
        ],
      );

  Widget _target() => Column(
        key: const ValueKey('target'),
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Maqsadingiz nima?',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 16),

          for (final (key, label) in const [
            ('lose', 'Vazn tashlash'),
            ('keep', 'Vaznni ushlab turish'),
            ('gain', 'Vazn olish'),
          ])
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: GestureDetector(
                onTap: () => setState(() => _weightIntent = key),
                behavior: HitTestBehavior.opaque,
                child: Container(
                  height: 50,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  decoration: BoxDecoration(
                    color: U.surface,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: U.border),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 19,
                        height: 19,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: _weightIntent == key ? U.green : const Color(0x33FFFFFF),
                            width: 2,
                          ),
                        ),
                        child: _weightIntent == key
                            ? Center(
                                child: Container(
                                  width: 9,
                                  height: 9,
                                  decoration: const BoxDecoration(
                                    color: U.green,
                                    shape: BoxShape.circle,
                                  ),
                                ),
                              )
                            : null,
                      ),
                      const SizedBox(width: 12),
                      Text(
                        label,
                        style: const TextStyle(fontSize: 14.5, color: Colors.white),
                      ),
                    ],
                  ),
                ),
              ),
            ),

          if (_weightIntent != 'keep') ...[
            const SizedBox(height: 16),
            Text(
              'Qancha kg ${_weightIntent == 'lose' ? 'tashlamoqchisiz' : 'olmoqchisiz'}?',
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 10),
            Container(
              height: 56,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                color: U.surface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: U.border),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _stepper(Icons.remove, () {
                    if (_deltaKg > 1) setState(() => _deltaKg--);
                  }),
                  Text(
                    '$_deltaKg kg',
                    style: const TextStyle(
                      fontSize: 19,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                  _stepper(Icons.add, () {
                    if (_deltaKg < 40) setState(() => _deltaKg++);
                  }),
                ],
              ),
            ),
            const SizedBox(height: 8),
            const Center(
              child: Text(
                'Tavsiya: 4 – 10 kg',
                style: TextStyle(fontSize: 11.5, color: U.textDim),
              ),
            ),
          ],

          const Spacer(),
          UnumButton(
            label: 'Davom etish',
            onPressed: () => setState(() => _step = _Step.connect),
          ),
        ],
      );

  /// Sog'liq manbalarini ulash taklifi.
  ///
  /// Bu qadam ATAYLAB oxirida turadi va O'TKAZIB YUBORISH mumkin: birinchi
  /// ekranda sog'liq ruxsatini so'rash bosim bo'ladi va foydalanuvchi
  /// ilovadan umuman voz kechishi mumkin. Bu yerda esa u nima uchun
  /// kerakligini allaqachon biladi.
  Widget _connect() {
    final app = context.watch<AppState>();
    final done = app.healthConnected;

    return Column(
      key: const ValueKey('connect'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 8),
        const Text('Qadam va uyquni avtomatik oling',
            style: TextStyle(
                fontSize: 24, fontWeight: FontWeight.w700, color: Colors.white)),
        const SizedBox(height: 10),
        const Text(
          "Health Connect ulansa, qadam va uyqu o'z-o'zidan hisoblanadi — "
          "har kuni qo'lda kiritib o'tirmaysiz.",
          style: TextStyle(fontSize: 14, height: 1.55, color: U.textMuted),
        ),
        const SizedBox(height: 20),

        UnumCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final row in const [
                (Icons.directions_walk, 'Kunlik qadam'),
                (Icons.nightlight_round, 'Uyqu davomiyligi'),
                (Icons.local_fire_department_outlined, 'Sarflangan kaloriya'),
              ])
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(
                    children: [
                      Icon(row.$1, size: 18, color: U.green),
                      const SizedBox(width: 10),
                      Text(row.$2,
                          style: const TextStyle(fontSize: 14, color: U.textSoft)),
                    ],
                  ),
                ),
              const SizedBox(height: 8),
              const Text(
                "UNUM faqat O'QIYDI — Health Connect'ga hech narsa yozmaydi "
                "va ma'lumot uchinchi tomonga uzatilmaydi.",
                style: TextStyle(fontSize: 11.5, height: 1.45, color: U.textDim),
              ),
            ],
          ),
        ),

        const Spacer(),
        if (done)
          const Padding(
            padding: EdgeInsets.only(bottom: 10),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.check_circle, size: 17, color: U.greenBright),
                SizedBox(width: 8),
                Text('Ulandi',
                    style: TextStyle(fontSize: 14, color: U.greenBright)),
              ],
            ),
          )
        else
          UnumButton(
            label: 'Health Connect’ni ulash',
            icon: Icons.favorite_border,
            onPressed: () async {
              final installed = await app.checkHealthInstalled();
              if (!installed) {
                await app.openHealthStore();
                return;
              }
              await app.syncHealth(ask: true);
            },
          ),

        const SizedBox(height: 10),
        UnumButton(
          label: done ? 'Rejani tuzish' : "Hozir emas — keyinroq ulayman",
          variant: done ? UnumButtonVariant.primary : UnumButtonVariant.ghost,
          onPressed: _finish,
        ),
      ],
    );
  }

  Widget _building() => Column(
        key: const ValueKey('building'),
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Text(
            'AI siz uchun shaxsiy reja tuzyapti…',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 21,
              fontWeight: FontWeight.w700,
              color: Colors.white,
              height: 1.25,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Bu bir necha soniya davom etadi.',
            style: TextStyle(fontSize: 13, color: U.textMuted),
          ),
          const SizedBox(height: 40),
          Container(
            width: 150,
            height: 150,
            decoration: BoxDecoration(
              color: U.green.withValues(alpha: 0.07),
              shape: BoxShape.circle,
              border: Border.all(color: U.green.withValues(alpha: 0.25)),
            ),
            child: const Center(child: CoachAvatar(size: 86)),
          ),
          const SizedBox(height: 40),
          const CircularProgressIndicator(color: U.green, strokeWidth: 3),
        ],
      );

  /* ---------------------------------------------------------------- */

  Widget _stepper(IconData icon, VoidCallback onTap) => GestureDetector(
        onTap: onTap,
        child: Container(
          width: 40,
          height: 40,
          decoration: const BoxDecoration(
            color: Color(0x0FFFFFFF),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, size: 18, color: Colors.white),
        ),
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
          Text(label, style: const TextStyle(fontSize: 11, color: Color(0xFF7B8481))),
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
                        height: 38,
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
                            fontSize: 12.5,
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

  /// Slayder — klaviatura emas. Dizayn qoidasi: raqam terilmaydi, suriladi.
  Widget _slider(
    String label,
    String display,
    double value,
    double min,
    double max,
    ValueChanged<double> onChanged,
  ) =>
      Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(label,
                    style: const TextStyle(fontSize: 11, color: Color(0xFF7B8481))),
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
              child: Slider(value: value, min: min, max: max, onChanged: onChanged),
            ),
          ],
        ),
      );
}
