import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../models.dart';
import '../../pillars.dart';
import '../../state/app_state.dart';
import '../tokens.dart';
import '../widgets/kit.dart';
import '../widgets/metric_badge.dart';
import '../widgets/sub_screen.dart';

/// Nima qo'shilyapti.
///
/// Metrikadan ALOHIDA turadi: bitta metrika ichida bir nechta qayd turi
/// bo'lishi mumkin (ovqatlanish → taom yoki suv). Ilgari ikkalasi bitta
/// `MetricKey.nutrition` ga bog'langan edi va "Suv ichish" bosilganda
/// kamera oqimi ochilardi.
enum AddKind { meal, water, steps, sleep, focus, screen }

const Map<AddKind, ({String title, IconData icon, Color color})> kAddMeta = {
  AddKind.meal: (title: "Ovqat qo'shish", icon: Icons.restaurant, color: Color(0xFF22C55E)),
  AddKind.water: (title: 'Suv ichish', icon: Icons.water_drop, color: Color(0xFF38BDF8)),
  AddKind.steps: (title: "Qadam qo'shish", icon: Icons.directions_walk, color: Color(0xFF84CC16)),
  AddKind.sleep: (title: 'Uyquni qayd etish', icon: Icons.nightlight_round, color: Color(0xFF6366F1)),
  AddKind.focus: (title: 'Fokus vaqti', icon: Icons.track_changes, color: Color(0xFF8B5CF6)),
  AddKind.screen: (title: 'Screen time', icon: Icons.smartphone, color: Color(0xFFF97316)),
};

/// Radar cho'qqisi yoki vazifa qatori bosilganda ochiladigan qayd turi
AddKind kindForMetric(MetricKey m) => switch (m) {
      MetricKey.nutrition => AddKind.meal,
      MetricKey.steps => AddKind.steps,
      MetricKey.sleep => AddKind.sleep,
      MetricKey.goals => AddKind.focus,
      MetricKey.screen => AddKind.screen,
    };

class AddFlow extends StatefulWidget {
  const AddFlow({super.key, required this.kind});

  final AddKind kind;

  static Future<void> open(BuildContext context, AddKind kind) =>
      SubScreen.push(context, AddFlow(kind: kind));

  @override
  State<AddFlow> createState() => _AddFlowState();
}

enum _Step { method, analyzing, result, input, done }

class _AddFlowState extends State<AddFlow> {
  late _Step _step = widget.kind == AddKind.meal ? _Step.method : _Step.input;

  final _picker = ImagePicker();
  final _valueCtrl = TextEditingController();
  final _mealNameCtrl = TextEditingController();

  String? _error;
  PhotoAnalysis? _analysis;

  /// Matn bo'yicha AI tahlili (qo'lda kiritishda "hisoblab ber" tugmasi).
  /// Bo'sh bo'lmasa — saqlashda kaloriya bilan birga oqsil/uglevod/yog'
  /// ham yoziladi, aks holda faqat kaloriya bo'lardi.
  ParsedMeal? _parsed;
  bool _parsing = false;

  /// Suv uchun tayyor miqdorlar — raqam terish shart emas
  int _waterMl = 250;

  @override
  void dispose() {
    _valueCtrl.dispose();
    _mealNameCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final meta = kAddMeta[widget.kind]!;
    return SubScreen(
      title: _step == _Step.result ? 'Tahlil natijasi' : meta.title,
      child: switch (_step) {
        _Step.method => _methodStep(),
        _Step.analyzing => _analyzingStep(),
        _Step.result => _resultStep(),
        _Step.input => _inputStep(),
        _Step.done => _doneStep(),
      },
    );
  }

  /* ---------------------------------------------------------------- */
  /* Ovqat: rasm orqali                                                */
  /* ---------------------------------------------------------------- */

  Future<void> _pickPhoto(ImageSource source) async {
    // `context` ni HAR QANDAY await'dan oldin o'qiymiz
    final app = context.read<AppState>();
    setState(() => _error = null);
    try {
      final file = await _picker.pickImage(
        source: source,
        maxWidth: 1280,
        imageQuality: 82,
      );
      if (file == null) return;

      setState(() => _step = _Step.analyzing);
      final bytes = await file.readAsBytes();
      final result = await app.api.analyzePhoto(base64Encode(bytes));

      if (!mounted) return;
      setState(() {
        _analysis = result;
        _step = _Step.result;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = "Rasmni tahlil qilib bo'lmadi. Internetni tekshirib, qayta urining.";
        _step = _Step.method;
      });
    }
  }

  Widget _methodStep() => Column(
        children: [
          const SizedBox(height: 16),
          const Text(
            "Yegan taomingizni qanday qo'shmoqchisiz?",
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 15, height: 1.5, color: U.textSoft),
          ),
          const SizedBox(height: 24),
          _MethodCard(
            icon: Icons.photo_camera_outlined,
            color: U.green,
            title: 'Rasm orqali',
            subtitle: 'Taomni suratga oling, AI tahlil qiladi',
            onTap: () => _pickPhoto(ImageSource.camera),
          ),
          const SizedBox(height: 12),
          _MethodCard(
            icon: Icons.photo_library_outlined,
            color: const Color(0xFF8B5CF6),
            title: 'Galereyadan',
            subtitle: 'Oldin olingan rasmni tanlang',
            onTap: () => _pickPhoto(ImageSource.gallery),
          ),
          const SizedBox(height: 12),
          _MethodCard(
            icon: Icons.edit_outlined,
            color: const Color(0xFF94A3B8),
            title: "Qo'lda kiritish",
            subtitle: "Taom nomi va kaloriyasini o'zingiz yozing",
            onTap: () => setState(() => _step = _Step.input),
          ),
          if (_error != null) ...[
            const SizedBox(height: 16),
            Text(
              _error!,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 12.5, color: U.dangerText),
            ),
          ],
        ],
      );

  Widget _analyzingStep() => const Padding(
        padding: EdgeInsets.only(top: 60),
        child: Column(
          children: [
            CircularProgressIndicator(color: U.green, strokeWidth: 3),
            SizedBox(height: 20),
            Text(
              'AI taomni tahlil qilmoqda…',
              style: TextStyle(fontSize: 14, color: U.textMuted),
            ),
          ],
        ),
      );

  Widget _resultStep() {
    final a = _analysis;
    if (a == null) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          a.name,
          style: const TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: 16),
        UnumCard(
          child: Column(
            children: [
              if (!a.isDrinkOnly) ...[
                _row('Kaloriya', '${a.calories.round()} kkal', bold: true),
                _row('Oqsil', '${a.protein.round()} g'),
                _row('Uglevod', '${a.carbs.round()} g'),
                _row("Yog'", '${a.fat.round()} g'),
              ],
              if (a.waterMl > 0) _row('Suyuqlik', '${a.waterMl.round()} ml'),
            ],
          ),
        ),
        const SizedBox(height: 16),
        const Disclaimer(
          text: "Qiymatlar AI tomonidan taxminiy hisoblangan, aniq o'lchov emas.",
        ),
        const SizedBox(height: 16),
        UnumButton(label: "Bugungi rejaga qo'shish", onPressed: () => _saveMeal(a)),
      ],
    );
  }

  /* ---------------------------------------------------------------- */
  /* Qiymat kiritish                                                   */
  /* ---------------------------------------------------------------- */

  Widget _inputStep() => switch (widget.kind) {
        AddKind.water => _waterInput(),
        AddKind.screen => _screenNotice(),
        AddKind.steps => _stepsNotice(),
        AddKind.meal => _manualMeal(),
        _ => _numberInput(),
      };

  /// Suv — raqam terilmaydi, tayyor miqdorlar bosiladi
  Widget _waterInput() {
    final app = context.watch<AppState>();
    final today = app.waterToday.round();
    final target = app.profile.targetWaterMl;

    return Column(
      children: [
        const SizedBox(height: 12),
        Container(
          width: 72,
          height: 72,
          decoration: BoxDecoration(
            color: const Color(0xFF38BDF8).withValues(alpha: 0.13),
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.water_drop, size: 32, color: Color(0xFF38BDF8)),
        ),
        const SizedBox(height: 16),
        Text(
          '$today / $target ml',
          style: const TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w700,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          today >= target ? "Kunlik me'yor bajarildi 👏" : '${target - today} ml qoldi',
          style: const TextStyle(fontSize: 13, color: U.textMuted),
        ),
        const SizedBox(height: 24),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          alignment: WrapAlignment.center,
          children: [
            for (final ml in const [150, 250, 330, 500, 750])
              GestureDetector(
                onTap: () => setState(() => _waterMl = ml),
                child: Container(
                  width: 92,
                  height: 56,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: _waterMl == ml
                        ? const Color(0xFF38BDF8).withValues(alpha: 0.16)
                        : U.surface,
                    borderRadius: BorderRadius.circular(U.rRow),
                    border: Border.all(
                      color: _waterMl == ml
                          ? const Color(0xFF38BDF8).withValues(alpha: 0.45)
                          : U.border,
                    ),
                  ),
                  child: Text(
                    '$ml ml',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: _waterMl == ml ? const Color(0xFF7DD3FC) : U.textSoft,
                    ),
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 28),
        UnumButton(
          label: "$_waterMl ml qo'shish",
          icon: Icons.add,
          onPressed: () async {
            await app.addWater(_waterMl.toDouble());
            if (!mounted) return;
            HapticFeedback.mediumImpact();
            setState(() => _step = _Step.done);
          },
        ),
      ],
    );
  }

  /// Screen Time uchun hali saqlash joyi yo'q — o'lik kiritish maydoni
  /// o'rniga rostini aytamiz.
  /// Qadam — QO'LDA KIRITILMAYDI.
  ///
  /// Ilgari bu yerda "Bugun necha qadam yurdingiz?" degan maydon bor edi.
  /// Qo'lda kiritilgan qadam o'lchov emas, taxmin: uni ball hisobiga
  /// qo'shish butun ko'rsatkichni ma'nosiz qiladi. Endi qadam faqat
  /// telefon sensori yoki Health Connect'dan olinadi.
  Widget _stepsNotice() {
    final app = context.watch<AppState>();
    final steps = app.stepsToday;
    final sensor = app.stepSensorActive;
    final hc = app.healthConnected;
    final connected = sensor || hc;

    final source = hc && sensor
        ? 'Telefon sensori va Health Connect'
        : hc
            ? 'Health Connect'
            : sensor
                ? 'Telefon sensori'
                : null;

    return Column(
      children: [
        const SizedBox(height: 24),
        const MetricBadge(metric: MetricKey.steps, size: 64),
        const SizedBox(height: 20),
        Text(
          connected ? '$steps qadam' : 'Qadam hisoblanmayapti',
          style: const TextStyle(
              fontSize: 26, fontWeight: FontWeight.w700, color: Colors.white),
        ),
        const SizedBox(height: 8),
        if (source != null)
          Text('Manba: $source',
              style: const TextStyle(fontSize: 12.5, color: U.greenBright)),
        const SizedBox(height: 12),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8),
          child: Text(
            connected
                ? "Qadam avtomatik hisoblanadi — qo'lda kiritish shart emas. "
                    "Telefonni yoningizda olib yursangiz kifoya."
                : "Qadamni avtomatik hisoblash uchun telefon sensoriga yoki "
                    "Health Connect'ga ruxsat kerak. Profil → Integratsiyalar "
                    "bo'limidan ulang.",
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 13, height: 1.6, color: U.textMuted),
          ),
        ),
        const SizedBox(height: 28),
        UnumButton(
          label: connected ? 'Yangilash' : 'Integratsiyalarni ochish',
          icon: connected ? Icons.refresh : Icons.link,
          onPressed: () async {
            final nav = Navigator.of(context);
            await app.syncHealth();
            if (mounted) nav.maybePop();
          },
        ),
      ],
    );
  }

  /// Ekran vaqti — endi HAQIQATAN o'qiladi (`UsageStatsManager`).
  /// Bu ekran qiymatni ko'rsatadi yoki ruxsat berishga yo'naltiradi;
  /// qo'lda kiritish yo'q — u noaniq bo'lardi.
  Widget _screenNotice() {
    final app = context.watch<AppState>();
    final on = app.screenTimeConnected;
    final minutes = app.screenMinutes;

    String hm(int m) {
      final h = m ~/ 60;
      final r = m % 60;
      if (h == 0) return '$r daqiqa';
      return r == 0 ? '$h soat' : '$h soat $r daq';
    }

    return Column(
      children: [
        const SizedBox(height: 24),
        const MetricBadge(metric: MetricKey.screen, size: 64),
        const SizedBox(height: 20),
        Text(
          on
              ? (minutes == null ? 'Hisoblanmoqda…' : hm(minutes))
              : 'Ekran vaqti ulanmagan',
          style: const TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w700,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: 10),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8),
          child: Text(
            on
                ? "Bugungi jami ekran vaqti. Qaysi ilovani qancha "
                    "ishlatganingiz o'qilmaydi — bizga faqat jami kerak."
                : "Ekran vaqtini o'qish uchun Android'ning maxsus ruxsati "
                    "kerak (Usage access). U oddiy oyna bilan so'ralmaydi — "
                    "tizim sozlamalaridan yoqiladi.",
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 13, height: 1.6, color: U.textMuted),
          ),
        ),
        const SizedBox(height: 28),
        UnumButton(
          label: on ? 'Yangilash' : 'Sozlamalarni ochish',
          icon: on ? Icons.refresh : Icons.settings,
          onPressed: () async {
            final nav = Navigator.of(context);
            if (on) {
              await app.syncScreenTime();
            } else {
              await app.openScreenTimeSettings();
            }
            if (mounted) nav.maybePop();
          },
        ),
      ],
    );
  }

  Widget _manualMeal() => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 8),
          const Text('Taom nomi', style: TextStyle(fontSize: 12, color: U.textDim)),
          const SizedBox(height: 6),
          _field(_mealNameCtrl, 'Masalan: Osh, 1 porsiya',
              keyboard: TextInputType.text),
          const SizedBox(height: 10),

          // Kaloriyani QO'LDA yozish shart emas: taom nomini AI (va undagi
          // 132 ta o'zbek taomi bazasi) tahlil qilib, hamma raqamni o'zi
          // to'ldiradi. Foydalanuvchi xohlasa keyin tuzatishi mumkin.
          GestureDetector(
            onTap: _mealNameCtrl.text.trim().isEmpty || _parsing ? null : _parseByText,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                color: U.green.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: U.green.withValues(alpha: 0.25)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (_parsing)
                    const SizedBox(
                      width: 15, height: 15,
                      child: CircularProgressIndicator(strokeWidth: 2, color: U.greenBright),
                    )
                  else
                    const Icon(Icons.auto_awesome, size: 15, color: U.greenBright),
                  const SizedBox(width: 8),
                  Text(
                    _parsing ? "AI hisoblayapti…" : 'AI o\'zi hisoblab bersin',
                    style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w500,
                      color: _mealNameCtrl.text.trim().isEmpty
                          ? U.textFaint
                          : U.greenBright,
                    ),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 16),
          const Text('Kaloriya (kkal)', style: TextStyle(fontSize: 12, color: U.textDim)),
          const SizedBox(height: 6),
          _field(_valueCtrl, '450'),
          const SizedBox(height: 12),

          if (_parsed != null)
            Text(
              'AI: ${_parsed!.protein.round()} g oqsil · '
              '${_parsed!.carbs.round()} g uglevod · ${_parsed!.fat.round()} g yog\'. '
              'Raqamni o\'zgartirsangiz ham bo\'ladi.',
              style: const TextStyle(fontSize: 11.5, height: 1.5, color: U.greenBright),
            )
          else
            const Text(
              "Kaloriyani o'zingiz yozsangiz ball to'liq hisoblanmaydi — oqsil va "
              "sabzavot ma'lumoti bo'lmaydi. Yuqoridagi tugmani bosing yoki "
              "rasm orqali qo'shing.",
              style: TextStyle(fontSize: 11.5, height: 1.5, color: U.textDim),
            ),
          const SizedBox(height: 24),
          UnumButton(
            label: 'Saqlash',
            onPressed:
                (double.tryParse(_valueCtrl.text) ?? 0) > 0 ? _saveManualMeal : null,
          ),
        ],
      );

  Widget _numberInput() {
    final (label, unit, hint) = switch (widget.kind) {
      AddKind.steps => ('Bugun necha qadam yurdingiz?', 'qadam', '6500'),
      AddKind.sleep => ('Necha soat uxladingiz?', 'soat', '7.5'),
      AddKind.focus => ('Necha daqiqa fokus qildingiz?', 'daqiqa', '30'),
      _ => ('Qiymat', '', ''),
    };
    final meta = kAddMeta[widget.kind]!;

    return Column(
      children: [
        const SizedBox(height: 16),
        Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(
            color: meta.color.withValues(alpha: 0.13),
            shape: BoxShape.circle,
          ),
          child: Icon(meta.icon, size: 28, color: meta.color),
        ),
        const SizedBox(height: 16),
        Text(
          label,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 15, color: U.textSoft),
        ),
        const SizedBox(height: 20),
        _field(_valueCtrl, hint, suffix: unit),
        const SizedBox(height: 12),
        if (widget.kind == AddKind.steps)
          const Text(
            "Telefon sensori yoqilgan bo'lsa qadam avtomatik hisoblanadi — "
            "bu yerdan faqat qo'shimcha mashg'ulot kiritiladi.",
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 11.5, height: 1.5, color: U.textDim),
          ),
        const SizedBox(height: 24),
        UnumButton(
          label: 'Saqlash',
          onPressed: (double.tryParse(_valueCtrl.text) ?? 0) > 0 ? _saveNumber : null,
        ),
      ],
    );
  }

  Widget _field(
    TextEditingController ctrl,
    String hint, {
    String? suffix,
    TextInputType keyboard = const TextInputType.numberWithOptions(decimal: true),
  }) =>
      Container(
        height: 56,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        decoration: BoxDecoration(
          color: U.surface,
          borderRadius: BorderRadius.circular(U.rRow),
          border: Border.all(color: U.border),
        ),
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: ctrl,
                keyboardType: keyboard,
                onChanged: (_) => setState(() {}),
                style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                ),
                decoration: InputDecoration(
                  border: InputBorder.none,
                  hintText: hint,
                  hintStyle: const TextStyle(color: U.textFaint),
                ),
              ),
            ),
            if (suffix != null && suffix.isNotEmpty)
              Text(suffix, style: const TextStyle(fontSize: 14, color: U.textMuted)),
          ],
        ),
      );

  /* ---------------------------------------------------------------- */
  /* Saqlash                                                           */
  /* ---------------------------------------------------------------- */

  String _mealTypeForNow() {
    final h = DateTime.now().hour;
    if (h < 11) return 'breakfast';
    if (h < 16) return 'lunch';
    if (h < 22) return 'dinner';
    return 'snack';
  }

  Future<void> _saveMeal(PhotoAnalysis a) async {
    final app = context.read<AppState>();
    if (a.waterMl > 0) await app.addWater(a.waterMl);

    // Faqat ichimlik bo'lsa taom yozuvi YARATILMAYDI — aks holda kunlik
    // ro'yxat 0 kkal qatorlar bilan to'lib ketardi.
    if (!a.isDrinkOnly) {
      await app.logMeal(MealLog(
        id: '',
        timestamp: DateTime.now().toIso8601String(),
        name: a.name,
        type: _mealTypeForNow(),
        components: a.detectedComponents,
        calories: a.calories,
        protein: a.protein,
        carbs: a.carbs,
        fat: a.fat,
        sugar: a.sugar,
        fiber: a.fiber,
        sodium: a.sodium,
        vegServings: a.vegServings,
        nova: a.nova,
        cost: a.cost,
      ));
    }

    if (!mounted) return;
    HapticFeedback.mediumImpact();
    setState(() => _step = _Step.done);
  }

  /// Taom nomini AI ga yuborib, barcha raqamni to'ldiradi.
  Future<void> _parseByText() async {
    final name = _mealNameCtrl.text.trim();
    if (name.isEmpty) return;

    setState(() {
      _parsing = true;
      _error = null;
    });
    try {
      final p = await context.read<AppState>().api.parseMeal(name, _mealTypeForNow());
      if (!mounted) return;
      setState(() {
        _parsed = p;
        _valueCtrl.text = p.calories.round().toString();
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _parsing = false);
    }
  }

  Future<void> _saveManualMeal() async {
    final app = context.read<AppState>();
    final kcal = double.tryParse(_valueCtrl.text) ?? 0;
    final name = _mealNameCtrl.text.trim();
    final p = _parsed;

    await app.logMeal(MealLog(
      id: '',
      timestamp: DateTime.now().toIso8601String(),
      name: name.isEmpty ? 'Taom' : name,
      type: _mealTypeForNow(),
      components: const [],
      calories: kcal,
      // AI tahlil qilgan bo'lsa to'liq tarkib yoziladi. Aks holda nollar —
      // Score buni "ma'lumot yo'q" deb hisoblaydi, soxta qiymat qo'ymaydi.
      protein: p?.protein ?? 0,
      carbs: p?.carbs ?? 0,
      fat: p?.fat ?? 0,
      cost: p?.cost ?? 0,
      nova: p?.nova ?? 3,
    ));

    if (!mounted) return;
    HapticFeedback.mediumImpact();
    setState(() => _step = _Step.done);
  }

  Future<void> _saveNumber() async {
    final app = context.read<AppState>();
    final value = double.tryParse(_valueCtrl.text) ?? 0;

    switch (widget.kind) {
      case AddKind.steps:
        await app.addActivity(ActivityLog(
          id: '',
          timestamp: DateTime.now().toIso8601String(),
          type: 'walking',
          durationMinutes: (value / 100).round(),
          caloriesBurned: (value * 0.04).round(),
          steps: value.round(),
        ));
      case AddKind.sleep:
        final wake = DateTime.now();
        await app.logSleep(
          wake.subtract(Duration(minutes: (value * 60).round())),
          wake,
          3,
        );
      case AddKind.focus:
        await app.addFocus(FocusKind.study, value.round());
      case AddKind.meal:
      case AddKind.water:
      case AddKind.screen:
        break;
    }

    if (!mounted) return;
    HapticFeedback.mediumImpact();
    setState(() => _step = _Step.done);
  }

  Widget _row(String label, String value, {bool bold = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: const TextStyle(fontSize: 14, color: U.textSoft)),
            Text(
              value,
              style: TextStyle(
                fontSize: 14,
                fontWeight: bold ? FontWeight.w700 : FontWeight.w500,
                color: bold ? U.greenBright : Colors.white,
              ),
            ),
          ],
        ),
      );

  Widget _doneStep() => Padding(
        padding: const EdgeInsets.only(top: 60),
        child: Column(
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: const BoxDecoration(color: U.green, shape: BoxShape.circle),
              child: const Icon(Icons.check, size: 32, color: U.greenInk),
            ),
            const SizedBox(height: 20),
            const Text(
              "Qo'shildi",
              style: TextStyle(
                fontSize: 19,
                fontWeight: FontWeight.w700,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              "Natija asosiy ekranda ko'rinadi va bugungi reja yangilanadi.",
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13.5, height: 1.5, color: U.textMuted),
            ),
            const SizedBox(height: 32),
            UnumButton(
              label: 'Yopish',
              onPressed: () => Navigator.of(context).maybePop(),
            ),
          ],
        ),
      );
}

class _MethodCard extends StatelessWidget {
  const _MethodCard({
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return UnumCard(
      onTap: onTap,
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, size: 22, color: color),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 2),
                Text(subtitle, style: const TextStyle(fontSize: 12.5, color: U.textMuted)),
              ],
            ),
          ),
          const Icon(Icons.chevron_right, size: 18, color: U.textFaint),
        ],
      ),
    );
  }
}
