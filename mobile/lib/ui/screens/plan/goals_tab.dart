import 'package:flutter/material.dart';

import '../../../plan_models.dart';
import '../../../state/app_state.dart';
import '../../tokens.dart';
import '../../widgets/kit.dart';
import '../../widgets/premium_sheet.dart';
import '../plan_screen.dart';
import 'goal_editor.dart';

class GoalsTab extends StatefulWidget {
  const GoalsTab({super.key, required this.app, this.createRequest});
  final AppState app;

  /// "+" menyusidan kelgan "yarat" so'rovi (ixtiyoriy).
  final ValueNotifier<CreateRequest?>? createRequest;

  @override
  State<GoalsTab> createState() => _GoalsTabState();
}

class _GoalsTabState extends State<GoalsTab> {
  List<Goal> _goals = const [];
  Map<String, Prediction> _predictions = const {};
  int? _limit;
  bool _loading = true;
  String? _error;
  bool _showArchived = false;

  /// Prognoz premium bo'lgani uchun kelmadimi — shunda taklif ko'rsatamiz.
  bool _predictionLocked = false;

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
    if (widget.createRequest?.value?.section != 3) return;
    // Ro'yxat hali yuklanayotgan bo'lsa ham oyna ochilaveradi:
    // foydalanuvchi kutmasin.
    _openEditor(null);
  }

  Future<void> _load() async {
    setState(() {
      _loading = _goals.isEmpty;
      _error = null;
    });
    try {
      final r = await widget.app.api.goals();
      // Prognoz premium funksiya — qulflangan bo'lsa bo'sh ro'yxat keladi.
      // Maqsadlar baribir ko'rinishi kerak, shuning uchun xato yutiladi.
      var preds = _predictions;
      var locked = false;
      try {
        final list = await widget.app.api.predictions();
        preds = {for (final p in list) p.goalId: p};
        locked = list.isEmpty;
      } catch (_) {
        locked = true;
      }

      if (!mounted) return;
      setState(() {
        _goals = r.goals;
        _limit = r.limit;
        _predictions = preds;
        _predictionLocked = locked && r.goals.any((g) => g.isActive);
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

  Future<void> _openEditor(Goal? goal) async {
    final result = await Navigator.of(context).push<GoalEditorResult>(
      MaterialPageRoute(
        builder: (_) => GoalEditorScreen(app: widget.app, goal: goal),
        fullscreenDialog: true,
      ),
    );
    if (result == null) return;

    if (result.deleted && goal != null) {
      await _run(() => widget.app.api.deleteGoal(goal.id));
    } else if (result.goal != null) {
      await _run(() async {
        if (goal == null) {
          await widget.app.api.createGoal(result.goal!);
        } else {
          await widget.app.api.updateGoal(result.goal!);
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final active = _goals.where((g) => g.status == 'active').toList();
    final done = _goals.where((g) => g.status == 'done').toList();
    final archived = _goals.where((g) => g.status == 'archived').toList();
    final atLimit = _limit != null && active.length >= _limit!;

    return PlanSection(
      loading: _loading,
      error: _error,
      onRetry: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 120),
        children: [
          if (active.isEmpty && done.isEmpty)
            EmptyState(
              icon: Icons.adjust_rounded,
              title: "Hali maqsad yo'q",
              subtitle:
                  "Birinchi maqsadingizni qo'shing — UNUM uni bosqichlarga bo'lib, "
                  'har kuni nima qilish kerakligini ko\'rsatadi.',
              action: UnumButton(
                label: "Maqsad qo'shish",
                full: false,
                onPressed: () => _openEditor(null),
              ),
            ),

          for (final g in active)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _GoalCard(
                goal: g,
                prediction: _predictions[g.id],
                onTap: () => _openEditor(g),
              ),
            ),

          // Prognoz qulflangan bo'lsa — nima yo'qotayotganini aytamiz.
          if (_predictionLocked && active.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: GestureDetector(
                onTap: () =>
                    PremiumSheet.forFeature(context, PremiumFeature.prediction),
                child: Container(
                  padding: const EdgeInsets.all(13),
                  decoration: BoxDecoration(
                    color: U.green.withValues(alpha: 0.06),
                    border: Border.all(color: U.green.withValues(alpha: 0.25)),
                    borderRadius: BorderRadius.circular(U.rCard),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.trending_up, size: 18, color: U.green),
                      SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          "Maqsadga qachon yetishingizni bilmoqchimisiz? "
                          "Prognozni ko'rish →",
                          style: TextStyle(
                              fontSize: 12.5, height: 1.4, color: U.textSoft),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

          if (active.isNotEmpty)
            atLimit
                ? LimitBanner(limit: _limit!, what: 'maqsad')
                : UnumButton(
                    label: 'Yangi maqsad',
                    icon: Icons.add,
                    variant: UnumButtonVariant.secondary,
                    onPressed: () => _openEditor(null),
                  ),

          if (done.isNotEmpty) ...[
            const SizedBox(height: 20),
            Padding(
              padding: const EdgeInsets.only(bottom: 10, left: 2),
              child: Text('Bajarilgan (${done.length})',
                  style: const TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w600, color: U.textDim)),
            ),
            for (final g in done)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _GoalCard(goal: g, onTap: () => _openEditor(g)),
              ),
          ],

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
              for (final g in archived)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _GoalCard(goal: g, onTap: () => _openEditor(g)),
                ),
          ],
        ],
      ),
    );
  }
}

// ══════════════════ Maqsad kartasi ══════════════════

class _GoalCard extends StatelessWidget {
  const _GoalCard({required this.goal, required this.onTap, this.prediction});

  final Goal goal;
  final VoidCallback onTap;
  final Prediction? prediction;

  /// Muddat matni. Bitta joyda hisoblanadi — aks holda ro'yxat va tahrir
  /// ekrani har xil kun ko'rsatishi mumkin edi.
  ({String text, bool danger})? get _deadline {
    final left = goal.daysLeft;
    if (left == null) return null;
    if (goal.status == 'done') return (text: 'Bajarildi', danger: false);
    if (left < 0) return (text: '${left.abs()} kun kechikdi', danger: true);
    if (left == 0) return (text: 'Bugun tugaydi', danger: true);
    return (text: '$left kun qoldi', danger: left <= 7);
  }

  @override
  Widget build(BuildContext context) {
    final dl = _deadline;
    final sub = <String>[
      goal.categoryLabel,
      if (goal.milestonesTotal > 0)
        '${goal.milestonesDone}/${goal.milestonesTotal} bosqich',
      if (goal.metric != null)
        '${_n(goal.metric!.current)}/${_n(goal.metric!.target)} ${goal.metric!.unit}',
    ];

    return UnumCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(goal.title,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: Colors.white)),
                    const SizedBox(height: 2),
                    Text(sub.join(' · '),
                        style: const TextStyle(fontSize: 11.5, color: U.textDim)),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Text('${goal.progressPercent}%',
                  style: const TextStyle(
                      fontSize: 15, fontWeight: FontWeight.w600, color: U.green)),
            ],
          ),
          const SizedBox(height: 12),
          UnumProgressBar(percent: goal.progressPercent, color: U.green),

          if (dl != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(dl.text,
                  style: TextStyle(
                      fontSize: 11.5,
                      color: dl.danger ? U.dangerText : U.textMuted)),
            ),

          // Prognoz — faqat aytadigan gap bo'lganda. Ma'lumot yetarli
          // bo'lmaganda satr ko'rsatilsa, u shovqinga aylanadi.
          if (prediction?.onTrack != null && goal.isActive)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                prediction!.message,
                style: TextStyle(
                    fontSize: 11.5,
                    height: 1.35,
                    color: prediction!.onTrack! ? U.greenBright : const Color(0xFFF0A868)),
              ),
            ),
        ],
      ),
    );
  }

  static String _n(double v) =>
      v == v.roundToDouble() ? v.toInt().toString() : v.toStringAsFixed(1);
}
