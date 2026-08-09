import 'package:flutter/material.dart';

import '../../../plan_models.dart';
import '../../../state/app_state.dart';
import '../../tokens.dart';
import '../../widgets/kit.dart';
import '../../widgets/premium_sheet.dart';

/// Muharrir natijasi. `deleted` bo'lsa `goal` e'tiborsiz qoldiriladi.
class GoalEditorResult {
  GoalEditorResult({this.goal, this.deleted = false});
  final Goal? goal;
  final bool deleted;
}

class GoalEditorScreen extends StatefulWidget {
  const GoalEditorScreen({super.key, required this.app, this.goal});

  final AppState app;
  final Goal? goal;

  @override
  State<GoalEditorScreen> createState() => _GoalEditorScreenState();
}

class _GoalEditorScreenState extends State<GoalEditorScreen> {
  late final _title = TextEditingController(text: widget.goal?.title ?? '');
  late final _desc = TextEditingController(text: widget.goal?.description ?? '');
  late String _category = widget.goal?.category ?? 'personal';
  late String _status = widget.goal?.status ?? 'active';
  late String? _deadline = widget.goal?.deadline;
  late List<Milestone> _milestones =
      widget.goal?.milestones.map((m) => Milestone(
            id: m.id, title: m.title, done: m.done, dueDate: m.dueDate,
          )).toList() ??
          [];

  late bool _useMetric = widget.goal?.metric != null;
  late final _unit = TextEditingController(text: widget.goal?.metric?.unit ?? '');
  late final _start =
      TextEditingController(text: _fmt(widget.goal?.metric?.start));
  late final _target =
      TextEditingController(text: _fmt(widget.goal?.metric?.target));
  late final _current =
      TextEditingController(text: _fmt(widget.goal?.metric?.current));

  bool _breaking = false;
  String _aiNote = '';

  static String _fmt(double? v) => v == null ? '' : (v == v.roundToDouble()
      ? v.toInt().toString()
      : v.toString());

  @override
  void dispose() {
    for (final c in [_title, _desc, _unit, _start, _target, _current]) {
      c.dispose();
    }
    super.dispose();
  }

  /// AI bilan bosqichlarga bo'lish.
  ///
  /// Natija darhol SAQLANMAYDI — muharrirga qo'yiladi, foydalanuvchi ko'rib,
  /// tahrirlab, keyin o'zi saqlaydi. AI taklifini so'ramasdan yozib qo'yish
  /// foydalanuvchining maqsadini uning ruxsatisiz o'zgartirish bo'lardi.
  Future<void> _breakdown() async {
    final title = _title.text.trim();
    if (title.isEmpty || _breaking) return;
    setState(() => _breaking = true);
    try {
      final titles = await widget.app.api
          .breakdown(title, _deadline, _desc.text.trim());
      if (!mounted) return;
      setState(() {
        _milestones = [
          ..._milestones.where((m) => m.title.trim().isNotEmpty),
          ...titles.map((t) => Milestone(id: '', title: t)),
        ];
        _aiNote = titles.isEmpty
            ? ''
            : 'Bosqichlarni tahrirlab, keyin saqlang.';
      });
    } catch (e) {
      if (!mounted) return;
      // Premium kerak bo'lsa quruq xato emas, TAKLIF ko'rsatamiz —
      // foydalanuvchi nima yo'qotayotganini bilsin.
      if (PremiumSheet.isPremiumError(e)) {
        PremiumSheet.forFeature(context, PremiumFeature.goalBreakdown);
      } else {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString())));
      }
    } finally {
      if (mounted) setState(() => _breaking = false);
    }
  }

  void _save() {
    final title = _title.text.trim();
    if (title.isEmpty) return;

    Navigator.pop(
      context,
      GoalEditorResult(
        goal: Goal(
          id: widget.goal?.id ?? '',
          title: title,
          description: _desc.text.trim(),
          category: _category,
          deadline: _deadline,
          status: _status,
          milestones: _milestones.where((m) => m.title.trim().isNotEmpty).toList(),
          metric: _useMetric
              ? GoalMetric(
                  unit: _unit.text.trim().isEmpty ? 'birlik' : _unit.text.trim(),
                  start: double.tryParse(_start.text.trim()) ?? 0,
                  target: double.tryParse(_target.text.trim()) ?? 0,
                  current: double.tryParse(_current.text.trim()) ??
                      double.tryParse(_start.text.trim()) ??
                      0,
                )
              : null,
        ),
      ),
    );
  }

  InputDecoration _dec(String hint) => InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: U.textFaint, fontSize: 15),
        filled: true,
        fillColor: const Color(0xFF0E1211),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: U.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: U.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: U.green.withValues(alpha: 0.6)),
        ),
      );

  Widget _label(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 6, left: 2),
        child: Text(text,
            style: const TextStyle(
                fontSize: 12.5, fontWeight: FontWeight.w500, color: U.textMuted)),
      );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: U.bg,
      appBar: AppBar(
        backgroundColor: U.bg,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.chevron_left, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(widget.goal == null ? 'Yangi maqsad' : 'Maqsadni tahrirlash',
            style: const TextStyle(
                fontSize: 17, fontWeight: FontWeight.w600, color: Colors.white)),
        centerTitle: true,
        actions: [
          TextButton(
            onPressed: _save,
            child: const Text('Saqlash',
                style: TextStyle(
                    fontSize: 15, fontWeight: FontWeight.w600, color: U.green)),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 40),
        children: [
          _label('Maqsad'),
          TextField(
            controller: _title,
            maxLength: 200,
            buildCounter: (_, {required currentLength, required isFocused, maxLength}) => null,
            style: const TextStyle(fontSize: 15, color: Colors.white),
            decoration: _dec('Masalan: IELTS 7.0 olish'),
          ),

          const SizedBox(height: 16),
          _label('Izoh (ixtiyoriy)'),
          TextField(
            controller: _desc,
            maxLines: 3,
            maxLength: 2000,
            buildCounter: (_, {required currentLength, required isFocused, maxLength}) => null,
            style: const TextStyle(fontSize: 15, color: Colors.white),
            decoration: _dec('Nima uchun bu maqsad muhim?'),
          ),

          const SizedBox(height: 16),
          _label('Soha'),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final e in goalCategories.entries)
                GestureDetector(
                  onTap: () => setState(() => _category = e.key),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                    decoration: BoxDecoration(
                      color: _category == e.key ? U.green : U.surfaceAlt,
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: U.border),
                    ),
                    child: Text(e.value,
                        style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                            color: _category == e.key ? U.greenInk : U.textMuted)),
                  ),
                ),
            ],
          ),

          const SizedBox(height: 16),
          _label('Muddat (ixtiyoriy)'),
          GestureDetector(
            onTap: () async {
              final now = DateTime.now();
              final picked = await showDatePicker(
                context: context,
                initialDate: _deadline != null
                    ? DateTime.tryParse(_deadline!) ?? now
                    : now.add(const Duration(days: 30)),
                firstDate: now,
                lastDate: DateTime(now.year + 10),
              );
              if (picked != null) {
                String p(int v) => v.toString().padLeft(2, '0');
                setState(() =>
                    _deadline = '${picked.year}-${p(picked.month)}-${p(picked.day)}');
              }
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 15),
              decoration: BoxDecoration(
                color: const Color(0xFF0E1211),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: U.border),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(_deadline ?? 'Tanlanmagan',
                      style: TextStyle(
                          fontSize: 15,
                          color: _deadline == null ? U.textFaint : Colors.white)),
                  if (_deadline != null)
                    GestureDetector(
                      onTap: () => setState(() => _deadline = null),
                      child: const Icon(Icons.close, size: 17, color: U.textDim),
                    )
                  else
                    const Icon(Icons.calendar_today, size: 16, color: U.textDim),
                ],
              ),
            ),
          ),

          const SizedBox(height: 16),
          _label('Bosqichlar'),
          UnumCard(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                if (_milestones.isEmpty)
                  const Padding(
                    padding: EdgeInsets.all(14),
                    child: Text(
                      "Bosqichlarga bo'lsangiz progress avtomatik hisoblanadi.",
                      style: TextStyle(fontSize: 13, color: U.textDim),
                    ),
                  ),
                for (var i = 0; i < _milestones.length; i++)
                  _MilestoneRow(
                    key: ValueKey('${_milestones[i].id}_$i'),
                    milestone: _milestones[i],
                    first: i == 0,
                    onToggle: () =>
                        setState(() => _milestones[i].done = !_milestones[i].done),
                    onChanged: (v) => _milestones[i].title = v,
                    onRemove: () => setState(() => _milestones.removeAt(i)),
                  ),
                InkWell(
                  onTap: () => setState(
                      () => _milestones.add(Milestone(id: '', title: ''))),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    decoration: const BoxDecoration(
                      border: Border(top: BorderSide(color: U.border)),
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.add, size: 16, color: U.green),
                        SizedBox(width: 6),
                        Text("Bosqich qo'shish",
                            style: TextStyle(
                                fontSize: 13.5,
                                fontWeight: FontWeight.w500,
                                color: U.green)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 10),
          GestureDetector(
            onTap: _breakdown,
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 13),
              decoration: BoxDecoration(
                color: U.green.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: U.green.withValues(alpha: 0.25)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (_breaking)
                    const SizedBox(
                      width: 15, height: 15,
                      child: CircularProgressIndicator(strokeWidth: 2, color: U.greenBright),
                    )
                  else
                    const Icon(Icons.auto_awesome, size: 15, color: U.greenBright),
                  const SizedBox(width: 8),
                  Text(
                    _breaking ? "AI o'ylayapti…" : "AI bilan bosqichlarga bo'lish",
                    style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w500,
                      color: _title.text.trim().isEmpty ? U.textFaint : U.greenBright,
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (_aiNote.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(_aiNote,
                  style: const TextStyle(fontSize: 12, height: 1.4, color: U.textMuted)),
            ),

          const SizedBox(height: 16),
          GestureDetector(
            onTap: () => setState(() => _useMetric = !_useMetric),
            child: Row(
              children: [
                Icon(_useMetric ? Icons.close : Icons.add, size: 15, color: U.green),
                const SizedBox(width: 6),
                Text(
                  _useMetric
                      ? "Raqamli o'lchov kerak emas"
                      : "Raqamli o'lchov qo'shish",
                  style: const TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w500, color: U.green),
                ),
              ],
            ),
          ),

          if (_useMetric) ...[
            const SizedBox(height: 10),
            UnumCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    "Masalan: 80 kg dan 70 kg gacha. O'lchov bo'lsa progress "
                    "bosqichlar emas, shu raqamlar bo'yicha hisoblanadi.",
                    style: TextStyle(fontSize: 12, height: 1.45, color: U.textDim),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(child: _numField(_unit, 'Birlik', 'kg', text: true)),
                      const SizedBox(width: 10),
                      Expanded(child: _numField(_current, 'Hozir', '80')),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(child: _numField(_start, "Boshlang'ich", '80')),
                      const SizedBox(width: 10),
                      Expanded(child: _numField(_target, 'Maqsad', '70')),
                    ],
                  ),
                ],
              ),
            ),
          ],

          if (widget.goal != null) ...[
            const SizedBox(height: 16),
            _label('Holat'),
            Row(
              children: [
                for (final e in const [
                  ('active', 'Faol'),
                  ('done', 'Bajarildi'),
                  ('archived', 'Arxiv'),
                ])
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: GestureDetector(
                        onTap: () => setState(() => _status = e.$1),
                        child: Container(
                          height: 42,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: _status == e.$1 ? U.green : U.surfaceAlt,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: U.border),
                          ),
                          child: Text(e.$2,
                              style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w500,
                                  color: _status == e.$1 ? U.greenInk : U.textMuted)),
                        ),
                      ),
                    ),
                  ),
              ],
            ),

            const SizedBox(height: 24),
            UnumButton(
              label: "Maqsadni o'chirish",
              variant: UnumButtonVariant.danger,
              icon: Icons.delete_outline,
              onPressed: () => _confirmDelete(),
            ),
          ],
        ],
      ),
    );
  }

  Widget _numField(TextEditingController c, String label, String hint,
      {bool text = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _label(label),
        TextField(
          controller: c,
          keyboardType: text
              ? TextInputType.text
              : const TextInputType.numberWithOptions(decimal: true),
          style: const TextStyle(fontSize: 15, color: Colors.white),
          decoration: _dec(hint),
        ),
      ],
    );
  }

  Future<void> _confirmDelete() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: U.surface,
        title: const Text('Maqsadni o\'chirish',
            style: TextStyle(fontSize: 17, color: Colors.white)),
        content: const Text('Maqsad butunlay o\'chiriladi. Davom etamizmi?',
            style: TextStyle(fontSize: 14, color: U.textMuted)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Bekor qilish', style: TextStyle(color: U.textMuted)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text("O'chirish", style: TextStyle(color: U.dangerText)),
          ),
        ],
      ),
    );
    if (ok == true && mounted) {
      Navigator.pop(context, GoalEditorResult(deleted: true));
    }
  }
}

// ══════════════════ Bitta bosqich ══════════════════

class _MilestoneRow extends StatefulWidget {
  const _MilestoneRow({
    super.key,
    required this.milestone,
    required this.first,
    required this.onToggle,
    required this.onChanged,
    required this.onRemove,
  });

  final Milestone milestone;
  final bool first;
  final VoidCallback onToggle;
  final ValueChanged<String> onChanged;
  final VoidCallback onRemove;

  @override
  State<_MilestoneRow> createState() => _MilestoneRowState();
}

class _MilestoneRowState extends State<_MilestoneRow> {
  late final _c = TextEditingController(text: widget.milestone.title);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final done = widget.milestone.done;
    return Container(
      decoration: BoxDecoration(
        border: widget.first
            ? null
            : const Border(top: BorderSide(color: U.border)),
      ),
      padding: const EdgeInsets.fromLTRB(12, 4, 6, 4),
      child: Row(
        children: [
          GestureDetector(
            onTap: widget.onToggle,
            child: Container(
              width: 22, height: 22,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: done ? U.green : Colors.transparent,
                border: Border.all(
                    color: done ? U.green : U.borderStrong, width: 1.6),
              ),
              child: done
                  ? const Icon(Icons.check, size: 13, color: U.greenInk)
                  : null,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: TextField(
              controller: _c,
              onChanged: widget.onChanged,
              maxLength: 200,
              buildCounter: (_, {required currentLength, required isFocused, maxLength}) => null,
              style: TextStyle(
                fontSize: 14,
                color: done ? U.textDim : Colors.white,
                decoration: done ? TextDecoration.lineThrough : null,
                decorationColor: U.textDim,
              ),
              decoration: const InputDecoration(
                hintText: 'Bosqich nomi',
                hintStyle: TextStyle(color: U.textFaint, fontSize: 14),
                border: InputBorder.none,
                isDense: true,
                contentPadding: EdgeInsets.symmetric(vertical: 10),
              ),
            ),
          ),
          IconButton(
            onPressed: widget.onRemove,
            icon: const Icon(Icons.close, size: 16, color: U.textFaint),
            tooltip: "O'chirish",
          ),
        ],
      ),
    );
  }
}
