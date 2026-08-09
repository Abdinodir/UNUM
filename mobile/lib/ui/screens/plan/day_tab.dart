import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../plan_models.dart';
import '../../../state/app_state.dart';
import '../../tokens.dart';
import '../../widgets/kit.dart';
import '../plan_screen.dart';

/// Kunlik reja: bugungi vazifalar, kechikkanlar, kun yakuni.
class DayTab extends StatefulWidget {
  const DayTab({super.key, required this.app, this.createRequest});
  final AppState app;

  /// "+" menyusidan kelgan "yarat" so'rovi (ixtiyoriy).
  final ValueNotifier<CreateRequest?>? createRequest;

  @override
  State<DayTab> createState() => _DayTabState();
}

class _DayTabState extends State<DayTab> {
  DayPlan? _plan;
  List<Goal> _goals = const [];
  bool _loading = true;
  String? _error;

  /// Ko'rilayotgan kun. `null` = bugun (serverning kuni ishlatiladi).
  DateTime _day = DateTime.now();

  String get _key {
    String p(int n) => n.toString().padLeft(2, '0');
    return '${_day.year}-${p(_day.month)}-${p(_day.day)}';
  }

  bool get _isToday {
    final n = DateTime.now();
    return _day.year == n.year && _day.month == n.month && _day.day == n.day;
  }

  @override
  void initState() {
    super.initState();
    _load();
    widget.createRequest?.addListener(_onCreateRequest);
  }

  @override
  void dispose() {
    widget.createRequest?.removeListener(_onCreateRequest);
    super.dispose();
  }

  /// "+" dan kelgan so'rov — yaratish oynasini ochamiz.
  void _onCreateRequest() {
    if (!mounted) return;
    // So'rov BOSHQA bo'lim uchun bo'lsa tegmaymiz — aks holda bitta
    // bosishda uchala oyna ham ochilib ketardi.
    if (widget.createRequest?.value?.section != 0) return;
    // Ro'yxat hali yuklanayotgan bo'lsa ham oyna ochilaveradi:
    // foydalanuvchi kutmasin.
    _openSheet(null);
  }

  Future<void> _load() async {
    setState(() {
      _loading = _plan == null;
      _error = null;
    });
    try {
      final plan = await widget.app.api.dayPlan(_key);
      // Maqsadlar vazifani bog'lash uchun kerak; xato bo'lsa jim o'tamiz —
      // maqsadsiz ham vazifa yaratish mumkin bo'lishi kerak.
      List<Goal> goals = _goals;
      try {
        goals = (await widget.app.api.goals()).goals.where((g) => g.isActive).toList();
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        _plan = plan;
        _goals = goals;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _run(Future<void> Function() action) async {
    try {
      await action();
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  void _shift(int days) {
    setState(() => _day = _day.add(Duration(days: days)));
    _load();
  }

  String get _dayLabel {
    if (_isToday) return 'Bugun';
    final n = DateTime.now();
    final diff = DateTime(_day.year, _day.month, _day.day)
        .difference(DateTime(n.year, n.month, n.day))
        .inDays;
    if (diff == 1) return 'Ertaga';
    if (diff == -1) return 'Kecha';
    const months = ['yan', 'fev', 'mart', 'apr', 'may', 'iyun',
      'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'];
    return '${_day.day}-${months[_day.month - 1]}';
  }

  @override
  Widget build(BuildContext context) {
    final plan = _plan;

    return PlanSection(
      loading: _loading,
      error: _error,
      onRetry: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 120),
        children: [
          // Kun tanlagich
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconButton(
                onPressed: () => _shift(-1),
                icon: const Icon(Icons.chevron_left, color: U.textMuted),
                tooltip: 'Oldingi kun',
              ),
              GestureDetector(
                onTap: () {
                  setState(() => _day = DateTime.now());
                  _load();
                },
                child: Text(
                  _dayLabel,
                  style: const TextStyle(
                      fontSize: 15, fontWeight: FontWeight.w600, color: Colors.white),
                ),
              ),
              IconButton(
                onPressed: () => _shift(1),
                icon: const Icon(Icons.chevron_right, color: U.textMuted),
                tooltip: 'Keyingi kun',
              ),
            ],
          ),

          if (plan != null) ...[
            if (plan.total > 0) ...[
              UnumCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('${plan.done} / ${plan.total} bajarildi',
                            style: const TextStyle(fontSize: 13, color: U.textMuted)),
                        Text('${plan.percent ?? 0}%',
                            style: const TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.w600,
                                color: U.green)),
                      ],
                    ),
                    const SizedBox(height: 10),
                    UnumProgressBar(
                        percent: (plan.percent ?? 0).toDouble(), color: U.green),
                  ],
                ),
              ),
              const SizedBox(height: 12),
            ],

            if (plan.overdue.isNotEmpty) ...[
              const Padding(
                padding: EdgeInsets.only(bottom: 8, left: 2),
                child: Text('Kechikkan',
                    style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: U.dangerText)),
              ),
              UnumCard(
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    for (final t in plan.overdue)
                      _TaskRow(
                        task: t,
                        goalTitle: _goalTitle(t.goalId),
                        onToggle: () => _run(() => widget.app.api.toggleTask(t.id).then((_) {})),
                        onOpen: () => _openSheet(t),
                        onMoveToday: () => _run(
                            () => widget.app.api.moveTask(t.id, _todayKey()).then((_) {})),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
            ],

            if (plan.tasks.isEmpty)
              EmptyState(
                icon: Icons.checklist_rounded,
                title: _isToday ? "Bugunga reja yo'q" : "Bu kunga reja yo'q",
                subtitle:
                    "Kunni 3 ta muhim ishdan boshlang — qolgani o'z-o'zidan quyiladi.",
              )
            else ...[
              // Hech narsa bajarilmagan bo'lsa qanday belgilashni aytamiz —
              // chapdagi doira tugma ekani o'z-o'zidan ko'rinmaydi.
              if (plan.done == 0)
                const Padding(
                  padding: EdgeInsets.only(left: 4, bottom: 8),
                  child: Text(
                    'Bajarganingizni belgilash uchun chapdagi doirani bosing',
                    style: TextStyle(fontSize: 11.5, color: U.textDim),
                  ),
                ),
              UnumCard(
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    for (final t in plan.tasks)
                      _TaskRow(
                        task: t,
                        goalTitle: _goalTitle(t.goalId),
                        onToggle: () => _run(() => widget.app.api.toggleTask(t.id).then((_) {})),
                        onOpen: () => _openSheet(t),
                      ),
                  ],
                ),
              ),
            ],

            const SizedBox(height: 12),
            UnumButton(
              label: "Vazifa qo'shish",
              icon: Icons.add,
              variant: UnumButtonVariant.secondary,
              onPressed: () => _openSheet(null),
            ),
          ],
        ],
      ),
    );
  }

  String _todayKey() {
    final n = DateTime.now();
    String p(int v) => v.toString().padLeft(2, '0');
    return '${n.year}-${p(n.month)}-${p(n.day)}';
  }

  String? _goalTitle(String? id) {
    if (id == null) return null;
    for (final g in _goals) {
      if (g.id == id) return g.title;
    }
    return null;
  }

  void _openSheet(PlanTask? task) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _TaskSheet(
        task: task,
        date: _key,
        goals: _goals,
        onSave: (t) async {
          Navigator.pop(context);
          await _run(() async {
            if (task == null) {
              await widget.app.api.createTask(t);
            } else {
              await widget.app.api.updateTask(t);
            }
          });
        },
        onDelete: task == null
            ? null
            : () async {
                Navigator.pop(context);
                await _run(() => widget.app.api.deleteTask(task.id));
              },
      ),
    );
  }
}

// ══════════════════ Bitta vazifa ══════════════════

class _TaskRow extends StatelessWidget {
  const _TaskRow({
    required this.task,
    required this.onToggle,
    required this.onOpen,
    this.goalTitle,
    this.onMoveToday,
  });

  final PlanTask task;
  final VoidCallback onToggle;
  final VoidCallback onOpen;
  final String? goalTitle;
  final VoidCallback? onMoveToday;

  @override
  Widget build(BuildContext context) {
    final high = task.priority == 'high' && !task.done;

    return Container(
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: U.border)),
      ),
      padding: const EdgeInsets.fromLTRB(14, 11, 10, 11),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          GestureDetector(
            onTap: () {
              HapticFeedback.lightImpact();
              onToggle();
            },
            child: Container(
              // Kattaroq: 22px doira bilinmay qolardi va foydalanuvchi
              // vazifani "bajarildi" deb belgilashni topolmasdi.
              margin: const EdgeInsets.only(top: 1),
              width: 26,
              height: 26,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: task.done ? U.green : Colors.transparent,
                border: Border.all(
                  color: task.done
                      ? U.green
                      : high
                          ? U.dangerText
                          : U.borderStrong,
                  width: 1.6,
                ),
              ),
              child: task.done
                  ? const Icon(Icons.check, size: 15, color: U.greenInk)
                  : null,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: GestureDetector(
              onTap: onOpen,
              behavior: HitTestBehavior.opaque,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    task.title,
                    style: TextStyle(
                      fontSize: 14.5,
                      height: 1.3,
                      color: task.done ? U.textFaint : Colors.white,
                      decoration: task.done ? TextDecoration.lineThrough : null,
                      decorationColor: U.textFaint,
                    ),
                  ),
                  if (high || task.estimateMin != null || goalTitle != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Wrap(
                        spacing: 10,
                        runSpacing: 2,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          if (high)
                            const Text('Muhim',
                                style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w500,
                                    color: U.dangerText)),
                          if (task.estimateMin != null)
                            Text('${task.estimateMin} daq',
                                style: const TextStyle(fontSize: 11, color: U.textDim)),
                          if (goalTitle != null)
                            ConstrainedBox(
                              constraints: const BoxConstraints(maxWidth: 150),
                              child: Text('◎ $goalTitle',
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(fontSize: 11, color: U.textDim)),
                            ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),
          if (onMoveToday != null)
            GestureDetector(
              onTap: onMoveToday,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: U.green.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: const Text('Bugunga',
                    style: TextStyle(
                        fontSize: 11, fontWeight: FontWeight.w500, color: U.green)),
              ),
            ),
        ],
      ),
    );
  }
}

// ══════════════════ Tahrir oynasi ══════════════════

class _TaskSheet extends StatefulWidget {
  const _TaskSheet({
    required this.task,
    required this.date,
    required this.goals,
    required this.onSave,
    this.onDelete,
  });

  final PlanTask? task;
  final String date;
  final List<Goal> goals;
  final ValueChanged<PlanTask> onSave;
  final VoidCallback? onDelete;

  @override
  State<_TaskSheet> createState() => _TaskSheetState();
}

class _TaskSheetState extends State<_TaskSheet> {
  late final _title = TextEditingController(text: widget.task?.title ?? '');
  late final _estimate =
      TextEditingController(text: widget.task?.estimateMin?.toString() ?? '');
  late String _priority = widget.task?.priority ?? 'normal';
  late String? _goalId = widget.task?.goalId;

  @override
  void dispose() {
    _title.dispose();
    _estimate.dispose();
    super.dispose();
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

  @override
  Widget build(BuildContext context) {
    return Padding(
      // Klaviatura ustiga chiqmasin.
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: const BoxDecoration(
          color: U.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          border: Border(top: BorderSide(color: U.border)),
        ),
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 20),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 36, height: 4,
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: U.borderStrong,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              ),

              TextField(
                controller: _title,
                autofocus: true,
                maxLength: 300,
                buildCounter: (_, {required currentLength, required isFocused, maxLength}) => null,
                style: const TextStyle(fontSize: 15, color: Colors.white),
                decoration: _dec('Nima qilish kerak?'),
              ),

              const SizedBox(height: 12),
              Row(
                children: [
                  for (final e in taskPriorities.entries)
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: GestureDetector(
                          onTap: () => setState(() => _priority = e.key),
                          child: Container(
                            height: 40,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: _priority == e.key ? U.green : U.surfaceAlt,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: U.border),
                            ),
                            child: Text(
                              e.value,
                              style: TextStyle(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w500,
                                color: _priority == e.key ? U.greenInk : U.textMuted,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),

              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _estimate,
                      keyboardType: TextInputType.number,
                      style: const TextStyle(fontSize: 15, color: Colors.white),
                      decoration: _dec('Daqiqa'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Container(
                      height: 50,
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      decoration: BoxDecoration(
                        color: const Color(0xFF0E1211),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: U.border),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String?>(
                          value: _goalId,
                          isExpanded: true,
                          dropdownColor: U.surfaceAlt,
                          icon: const Icon(Icons.expand_more, color: U.textMuted, size: 18),
                          style: const TextStyle(fontSize: 14, color: Colors.white),
                          hint: const Text('Maqsadsiz',
                              style: TextStyle(fontSize: 14, color: U.textFaint)),
                          items: [
                            const DropdownMenuItem(value: null, child: Text('Maqsadsiz')),
                            for (final g in widget.goals)
                              DropdownMenuItem(
                                value: g.id,
                                child: Text(g.title, overflow: TextOverflow.ellipsis),
                              ),
                          ],
                          onChanged: (v) => setState(() => _goalId = v),
                        ),
                      ),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 16),
              Row(
                children: [
                  if (widget.onDelete != null) ...[
                    UnumButton(
                      label: "O'chirish",
                      variant: UnumButtonVariant.danger,
                      full: false,
                      onPressed: widget.onDelete,
                    ),
                    const SizedBox(width: 10),
                  ],
                  Expanded(
                    child: UnumButton(
                      label: 'Saqlash',
                      onPressed: () {
                        final title = _title.text.trim();
                        if (title.isEmpty) return;
                        widget.onSave(PlanTask(
                          id: widget.task?.id ?? '',
                          title: title,
                          notes: widget.task?.notes ?? '',
                          date: widget.task?.date ?? widget.date,
                          done: widget.task?.done ?? false,
                          priority: _priority,
                          goalId: _goalId,
                          estimateMin: int.tryParse(_estimate.text.trim()),
                        ));
                      },
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
