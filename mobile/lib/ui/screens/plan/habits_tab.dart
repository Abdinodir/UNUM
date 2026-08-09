import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../plan_models.dart';
import '../../../state/app_state.dart';
import '../../tokens.dart';
import '../../widgets/kit.dart';
import '../plan_screen.dart';

const _emojis = ['🎯', '🏃', '📚', '💧', '🧘', '🛏️', '🚭', '💪', '🍎', '✍️', '🕌', '🧹'];

class HabitsTab extends StatefulWidget {
  const HabitsTab({super.key, required this.app, this.createRequest});
  final AppState app;

  /// "+" menyusidan kelgan "yarat" so'rovi (ixtiyoriy).
  final ValueNotifier<CreateRequest?>? createRequest;

  @override
  State<HabitsTab> createState() => _HabitsTabState();
}

class _HabitsTabState extends State<HabitsTab> {
  List<Habit> _habits = const [];
  int? _limit;
  int _todayDue = 0, _todayDone = 0;
  bool _loading = true;
  String? _error;
  bool _showArchived = false;

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
    if (widget.createRequest?.value?.section != 1) return;
    // Ro'yxat hali yuklanayotgan bo'lsa ham oyna ochilaveradi:
    // foydalanuvchi kutmasin.
    _openSheet(null);
  }

  Future<void> _load() async {
    setState(() {
      _loading = _habits.isEmpty;
      _error = null;
    });
    try {
      final r = await widget.app.api.habits();
      if (!mounted) return;
      setState(() {
        _habits = r.habits;
        _limit = r.limit;
        _todayDue = r.todayDue;
        _todayDone = r.todayDone;
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

  @override
  Widget build(BuildContext context) {
    final active = _habits.where((h) => h.isActive).toList();
    final archived = _habits.where((h) => !h.isActive).toList();
    final atLimit = _limit != null && active.length >= _limit!;

    return PlanSection(
      loading: _loading,
      error: _error,
      onRetry: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 120),
        children: [
          if (_todayDue > 0) ...[
            UnumCard(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Bugun',
                      style: TextStyle(fontSize: 13, color: U.textMuted)),
                  Text('$_todayDone / $_todayDue',
                      style: const TextStyle(
                          fontSize: 17, fontWeight: FontWeight.w600, color: U.green)),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],

          if (active.isEmpty)
            EmptyState(
              icon: Icons.repeat_rounded,
              title: "Hali odat yo'q",
              subtitle:
                  'Kichik odatdan boshlang. Ketma-ketlik uzilmasa, natija o\'zi keladi.',
              action: UnumButton(
                label: "Odat qo'shish",
                full: false,
                onPressed: () => _openSheet(null),
              ),
            )
          else
            for (final h in active)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _HabitCard(
                  habit: h,
                  onCheck: () => _run(() => widget.app.api.checkHabit(h.id).then((_) {})),
                  onOpen: () => _openSheet(h),
                ),
              ),

          if (active.isNotEmpty)
            atLimit
                ? LimitBanner(limit: _limit!, what: 'odat')
                : UnumButton(
                    label: 'Yangi odat',
                    icon: Icons.add,
                    variant: UnumButtonVariant.secondary,
                    onPressed: () => _openSheet(null),
                  ),

          if (archived.isNotEmpty) ...[
            const SizedBox(height: 20),
            GestureDetector(
              onTap: () => setState(() => _showArchived = !_showArchived),
              child: Padding(
                padding: const EdgeInsets.only(bottom: 10, left: 2),
                child: Text(
                  'Arxiv (${archived.length}) ${_showArchived ? '▴' : '▾'}',
                  style: const TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w600, color: U.textDim),
                ),
              ),
            ),
            if (_showArchived)
              for (final h in archived)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _HabitCard(
                    habit: h,
                    onCheck: () => _run(() => widget.app.api.checkHabit(h.id).then((_) {})),
                    onOpen: () => _openSheet(h),
                  ),
                ),
          ],
        ],
      ),
    );
  }

  void _openSheet(Habit? habit) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _HabitSheet(
        habit: habit,
        onSave: (h) async {
          Navigator.pop(context);
          await _run(() async {
            if (habit == null) {
              await widget.app.api.createHabit(h);
            } else {
              await widget.app.api.updateHabit(h);
            }
          });
        },
        onDelete: habit == null
            ? null
            : () async {
                Navigator.pop(context);
                await _run(() => widget.app.api.deleteHabit(habit.id));
              },
      ),
    );
  }
}

// ══════════════════ Bitta odat ══════════════════

class _HabitCard extends StatelessWidget {
  const _HabitCard({required this.habit, required this.onCheck, required this.onOpen});

  final Habit habit;
  final VoidCallback onCheck;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    return UnumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: onOpen,
                  behavior: HitTestBehavior.opaque,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(habit.emoji, style: const TextStyle(fontSize: 18)),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              habit.title,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.white),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Text(habit.scheduleLabel,
                              style: const TextStyle(fontSize: 11.5, color: U.textDim)),
                          if (habit.streak > 0) ...[
                            const SizedBox(width: 10),
                            const Icon(Icons.local_fire_department,
                                size: 13, color: U.warn),
                            const SizedBox(width: 3),
                            Text('${habit.streak} kun',
                                style: const TextStyle(
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w500,
                                    color: U.warn)),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 10),
              // Talab qilinmaydigan kunda ham belgilash mumkin — rejadan
              // tashqari bajargan odamni to'sib qo'yish noto'g'ri.
              GestureDetector(
                onTap: () {
                  HapticFeedback.mediumImpact();
                  onCheck();
                },
                child: Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: habit.doneToday ? U.green : Colors.transparent,
                    border: Border.all(
                      color: habit.doneToday
                          ? U.green
                          : habit.dueToday
                              ? U.borderStrong
                              : U.border,
                      width: 2,
                    ),
                  ),
                  child: habit.doneToday
                      ? const Icon(Icons.check, size: 19, color: U.greenInk)
                      : null,
                ),
              ),
            ],
          ),

          if (habit.recent.isNotEmpty) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                for (final d in habit.recent)
                  Expanded(
                    child: Container(
                      height: 18,
                      margin: const EdgeInsets.only(right: 3),
                      decoration: BoxDecoration(
                        color: d.done
                            ? U.green
                            : d.due
                                ? const Color(0x17FFFFFF)
                                : const Color(0x0AFFFFFF),
                        borderRadius: BorderRadius.circular(3),
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

// ══════════════════ Tahrir oynasi ══════════════════

class _HabitSheet extends StatefulWidget {
  const _HabitSheet({required this.habit, required this.onSave, this.onDelete});

  final Habit? habit;
  final ValueChanged<Habit> onSave;
  final VoidCallback? onDelete;

  @override
  State<_HabitSheet> createState() => _HabitSheetState();
}

class _HabitSheetState extends State<_HabitSheet> {
  late final _title = TextEditingController(text: widget.habit?.title ?? '');
  late String _emoji = widget.habit?.emoji ?? '🎯';
  late String _schedule = widget.habit?.schedule ?? 'daily';
  late final List<int> _days = List.of(widget.habit?.days ?? const [1, 2, 3, 4, 5]);
  late bool _archived = widget.habit?.status == 'archived';

  @override
  void dispose() {
    _title.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        constraints: BoxConstraints(
            maxHeight: MediaQuery.of(context).size.height * 0.88),
        decoration: const BoxDecoration(
          color: U.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          border: Border(top: BorderSide(color: U.border)),
        ),
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 20),
        child: SafeArea(
          top: false,
          child: SingleChildScrollView(
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
                  maxLength: 200,
                  buildCounter: (_, {required currentLength, required isFocused, maxLength}) => null,
                  style: const TextStyle(fontSize: 15, color: Colors.white),
                  decoration: InputDecoration(
                    hintText: 'Masalan: Ertalab yugurish',
                    hintStyle: const TextStyle(color: U.textFaint, fontSize: 15),
                    filled: true,
                    fillColor: const Color(0xFF0E1211),
                    contentPadding:
                        const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
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
                  ),
                ),

                const SizedBox(height: 12),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    for (final e in _emojis)
                      GestureDetector(
                        onTap: () => setState(() => _emoji = e),
                        child: Container(
                          width: 38, height: 38,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: _emoji == e
                                ? U.green.withValues(alpha: 0.2)
                                : U.surfaceAlt,
                            borderRadius: BorderRadius.circular(12),
                            border: _emoji == e
                                ? Border.all(color: U.green)
                                : null,
                          ),
                          child: Text(e, style: const TextStyle(fontSize: 18)),
                        ),
                      ),
                  ],
                ),

                const SizedBox(height: 16),
                Row(
                  children: [
                    for (final e in habitSchedules.entries)
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: GestureDetector(
                            onTap: () => setState(() => _schedule = e.key),
                            child: Container(
                              height: 42,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: _schedule == e.key ? U.green : U.surfaceAlt,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: U.border),
                              ),
                              child: Text(
                                e.value,
                                style: TextStyle(
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w500,
                                  color: _schedule == e.key ? U.greenInk : U.textMuted,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),

                if (_schedule == 'custom') ...[
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      for (var i = 0; i < 7; i++)
                        Expanded(
                          child: Padding(
                            padding: const EdgeInsets.only(right: 6),
                            child: GestureDetector(
                              onTap: () => setState(() {
                                _days.contains(i) ? _days.remove(i) : _days.add(i);
                                _days.sort();
                              }),
                              child: Container(
                                height: 40,
                                alignment: Alignment.center,
                                decoration: BoxDecoration(
                                  color: _days.contains(i) ? U.green : U.surfaceAlt,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: U.border),
                                ),
                                child: Text(
                                  weekdayShort[i],
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w500,
                                    color: _days.contains(i) ? U.greenInk : U.textMuted,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ],

                if (widget.habit != null) ...[
                  const SizedBox(height: 16),
                  GestureDetector(
                    onTap: () => setState(() => _archived = !_archived),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
                      decoration: BoxDecoration(
                        color: U.surfaceAlt,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Arxivlangan',
                              style: TextStyle(fontSize: 14, color: Colors.white)),
                          Text(_archived ? 'Ha' : "Yo'q",
                              style: TextStyle(
                                  fontSize: 13,
                                  color: _archived ? U.green : U.textDim)),
                        ],
                      ),
                    ),
                  ),
                ],

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
                          widget.onSave(Habit(
                            id: widget.habit?.id ?? '',
                            title: title,
                            emoji: _emoji,
                            schedule: _schedule,
                            days: _days,
                            status: _archived ? 'archived' : 'active',
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
      ),
    );
  }
}
