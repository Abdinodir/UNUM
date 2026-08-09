import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../state/app_state.dart';
import '../metrics_view.dart';
import 'add_flow.dart';
import '../shell/top_bar.dart';
import '../tokens.dart';
import '../widgets/coach_avatar.dart';
import '../widgets/kit.dart';
import '../widgets/life_score_card.dart';
import '../widgets/metric_badge.dart';
import '../widgets/radar_pentagon.dart';
import '../widgets/segmented_control.dart';

/// Asosiy ekran — dizayndagi 1-skrin.
class HomeScreen extends StatefulWidget {
  const HomeScreen({
    super.key,
    required this.onOpenCoach,
    required this.onAdd,
    required this.onAddKind,
  });

  final VoidCallback onOpenCoach;
  final ValueChanged<MetricKey> onAdd;
  final ValueChanged<AddKind> onAddKind;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  Period _period = Period.day;

  // Har biri O'Z oqimini ochadi. Ilgari "Suv ichish" ham `nutrition` ga
  // bog'langan edi va kamera oqimiga olib borardi — bu xato edi.
  static const _quickActions = <(String, IconData, AddKind)>[
    ('Ovqat', Icons.restaurant, AddKind.meal),
    ('Suv ichish', Icons.water_drop_outlined, AddKind.water),
    ('Qadam', Icons.directions_walk, AddKind.steps),
    ('Uyqu', Icons.nightlight_round, AddKind.sleep),
    ('Fokus', Icons.track_changes, AddKind.focus),
  ];

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final metrics = buildMetrics(app);
    final firstName = app.profile.name.split(' ').first;

    return ListView(
      padding: const EdgeInsets.only(bottom: 120),
      children: [
        UnumTopBar(
          title: 'Unum',
          chevron: true,
          subtitle: 'Assalomu alaykum, $firstName! 👋',
          trailing: const TopBarAction(
            icon: Icons.notifications_none,
            tooltip: 'Bildirishnomalar',
            dot: true,
          ),
        ),

        // Kunning yagona ko'rsatkichi — eng tepada, chunki ilovaga kirgan
        // odam birinchi navbatda "bugun qanday ketyapman" ni bilishni xohlaydi.
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          child: LifeScoreCard(app: app),
        ),

        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: SegmentedControl<Period>(
            value: _period,
            options: [for (final e in kPeriodLabels.entries) (e.key, e.value)],
            onChanged: (p) => setState(() => _period = p),
          ),
        ),

        // Hayot balansi radari
        Padding(
          padding: const EdgeInsets.only(top: 16, bottom: 8),
          child: Center(
            child: RadarPentagon(
              values: radarValues(metrics),
              size: 300,
              onSelect: widget.onAdd,
            ),
          ),
        ),

        // AI Coach kartasi
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          child: UnumCard(
            onTap: widget.onOpenCoach,
            child: Row(
              children: [
                const CoachAvatar(size: 54),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Text(
                            'AI Coach',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: U.greenBright,
                            ),
                          ),
                          const SizedBox(width: 5),
                          Icon(Icons.auto_awesome, size: 13, color: U.greenBright),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        _coachLine(app, metrics),
                        style: const TextStyle(
                          fontSize: 12.5,
                          height: 1.45,
                          color: U.textSoft,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  width: 32,
                  height: 32,
                  decoration: const BoxDecoration(
                    color: U.surfaceAlt,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.chevron_right, size: 17, color: U.textMuted),
                ),
              ],
            ),
          ),
        ),

        // Yangi foydalanuvchi uchun boshlash kartasi.
        // Hech narsa kiritilmagan kun 0% ko'rinadi — nima qilishni aytmasak,
        // foydalanuvchi ilovadan nima kutishni bilmaydi.
        if (_isEmptyDay(app))
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
            child: UnumCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Boshlaymizmi?',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    "Bugun hali qayd yo'q. Bitta taom yoki bir stakan suv "
                    "kiriting — ball va tahlil shundan boshlanadi.",
                    style: TextStyle(fontSize: 12.5, height: 1.5, color: U.textMuted),
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: UnumButton(
                          label: 'Ovqat',
                          icon: Icons.photo_camera_outlined,
                          onPressed: () => widget.onAddKind(AddKind.meal),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: UnumButton(
                          label: 'Suv',
                          icon: Icons.water_drop_outlined,
                          variant: UnumButtonVariant.secondary,
                          onPressed: () => widget.onAddKind(AddKind.water),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

        // Bugungi vazifalar
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SectionHeader(title: 'Bugungi vazifalar'),
              UnumCard(
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    for (var i = 0; i < kRadarOrder.length; i++)
                      _MetricRow(
                        state: metrics[kRadarOrder[i]]!,
                        divider: i < kRadarOrder.length - 1,
                        onTap: () => widget.onAdd(kRadarOrder[i]),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),

        // Tezkor qo'shish
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 20, 0, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Padding(
                padding: EdgeInsets.only(right: 16),
                child: SectionHeader(title: "Tezkor qo'shish"),
              ),
              SizedBox(
                height: 74,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.only(right: 16),
                  itemCount: _quickActions.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 10),
                  itemBuilder: (context, i) {
                    final (label, icon, kind) = _quickActions[i];
                    return GestureDetector(
                      onTap: () => widget.onAddKind(kind),
                      child: Container(
                        width: 88,
                        decoration: BoxDecoration(
                          color: U.surface,
                          borderRadius: BorderRadius.circular(U.rRow),
                          border: Border.all(color: U.border),
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(icon, size: 19, color: U.textSoft),
                            const SizedBox(height: 6),
                            Text(
                              label,
                              textAlign: TextAlign.center,
                              style: const TextStyle(fontSize: 11, color: U.textMuted),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  /// Bugun umuman qayd bo'lmaganmi
  bool _isEmptyDay(AppState app) =>
      app.todayMeals.isEmpty &&
      app.waterToday == 0 &&
      app.stepsToday == 0 &&
      app.todayFocus.isEmpty;

  /// AI kartasidagi qatorni ma'lumotdan kelib chiqib tanlaymiz.
  /// Hech narsa kiritilmagan bo'lsa umumiy jumla — soxta tahlil emas.
  String _coachLine(AppState app, Map<MetricKey, MetricState> metrics) {
    final weakest = metrics.values
        .where((m) => m.hasData)
        .fold<MetricState?>(null, (a, b) => a == null || b.percent < a.percent ? b : a);

    if (weakest == null || app.todayMeals.isEmpty) {
      return "Bugungi birinchi qaydni kiriting — tahlil shundan boshlanadi.";
    }
    final meta = kMetrics[weakest.key]!;
    return "Bugun eng orqada qolgani — ${meta.label.toLowerCase()} (${weakest.percent}%). "
        "${weakest.remainderText}.";
  }
}

class _MetricRow extends StatelessWidget {
  const _MetricRow({required this.state, required this.divider, required this.onTap});

  final MetricState state;
  final bool divider;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final meta = kMetrics[state.key]!;

    final row = InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            MetricBadge(metric: state.key, size: 38),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          meta.label,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w500,
                            color: Colors.white,
                          ),
                        ),
                      ),
                      Text(
                        state.hasData ? '${state.percent}%' : '—',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: state.hasData ? meta.color : U.textFaint,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          state.valueText,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 11.5, color: Color(0xFF7B8481)),
                        ),
                      ),
                      Text(
                        state.remainderText,
                        style: const TextStyle(fontSize: 11.5, color: Color(0xFF7B8481)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  UnumProgressBar(percent: state.percent, color: meta.color),
                ],
              ),
            ),
            const SizedBox(width: 8),
            const Icon(Icons.chevron_right, size: 17, color: U.textFaint),
          ],
        ),
      ),
    );

    if (!divider) return row;
    return Column(
      children: [row, const Divider(height: 1, thickness: 1, color: Color(0x0DFFFFFF))],
    );
  }
}
