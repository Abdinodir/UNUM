import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../insights.dart';
import '../../state/app_state.dart';
import '../metrics_view.dart';
import '../shell/top_bar.dart';
import '../tokens.dart';
import '../widgets/charts.dart';
import '../widgets/coach_avatar.dart';
import '../widgets/kit.dart';
import '../widgets/radar_pentagon.dart';
import '../widgets/score_ring.dart';
import '../widgets/segmented_control.dart';

/// AI Tahlil ekrani — dizayndagi 2-skrin.
class AnalysisScreen extends StatefulWidget {
  const AnalysisScreen({super.key});

  @override
  State<AnalysisScreen> createState() => _AnalysisScreenState();
}

class _AnalysisScreenState extends State<AnalysisScreen> {
  Period _period = Period.week;
  int _insightIndex = 0;

  static const _weekLetters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final metrics = buildMetrics(app);
    final score = app.todayScore;
    final days = app.recentDays(14);

    // O'tgan haftaning o'rtacha bali — taqqoslash uchun
    final lastWeek = days.length > 7
        ? days.sublist(0, days.length - 7)
        : const <DayRecord>[];
    final prev = lastWeek.isEmpty
        ? score.total
        : (lastWeek.fold<int>(0, (s, d) => s + d.score) / lastWeek.length).round();
    final delta = score.total - prev;

    final insights = _insights(app, metrics);

    return ListView(
      padding: const EdgeInsets.only(bottom: 120),
      children: [
        const UnumTopBar(
          title: 'AI Tahlil',
          trailing: TopBarAction(
            icon: Icons.calendar_month_outlined,
            tooltip: 'Sana tanlash',
            color: U.green,
          ),
        ),

        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: SegmentedControl<Period>(
            value: _period,
            options: [for (final e in kPeriodLabels.entries) (e.key, e.value)],
            onChanged: (p) => setState(() => _period = p),
          ),
        ),

        // Hayot balansi + Unum Score
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: UnumCard(
            padding: const EdgeInsets.all(12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: 115,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _cardTitle(context, 'Hayot balansi', _balanceInfo),
                      const SizedBox(height: 4),
                      Center(
                        child: RadarPentagon(values: radarValues(metrics), size: 180),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  flex: 100,
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0F1313),
                      borderRadius: BorderRadius.circular(U.rRow),
                      border: Border.all(color: const Color(0x0DFFFFFF)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _cardTitle(context, 'Unum Score', _scoreInfo),
                        const SizedBox(height: 8),
                        Center(
                          child: score.hasData
                              ? ScoreRing(value: score.total, size: 110, thickness: 9)
                              : const _NoScore(),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          "O'tgan hafta: $prev",
                          style: const TextStyle(fontSize: 11.5, color: U.textMuted),
                        ),
                        const SizedBox(height: 10),
                        const Divider(height: 1, color: Color(0x0FFFFFFF)),
                        const SizedBox(height: 10),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(
                              delta >= 0 ? Icons.trending_up : Icons.trending_down,
                              size: 14,
                              color: delta >= 0 ? U.greenBright : U.warn,
                            ),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                delta >= 0
                                    ? "Siz o'tgan haftaga nisbatan $delta ballga yaxshilandingiz!"
                                    : "O'tgan haftaga nisbatan ${delta.abs()} ball pastroq.",
                                style: const TextStyle(
                                  fontSize: 11,
                                  height: 1.4,
                                  color: U.textSoft,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),

        // AI tahlil karuseli
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: UnumCard(
            onTap: insights.isEmpty
                ? null
                : () => setState(() => _insightIndex = (_insightIndex + 1) % insights.length),
            child: Row(
              children: [
                const CoachAvatar(size: 54),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'AI tahlil',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: U.greenBright,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        insights.isEmpty
                            ? "Bir necha kun ma'lumot yig'ilgach, bu yerda tahlil paydo bo'ladi."
                            : insights[_insightIndex % insights.length],
                        style: const TextStyle(
                          fontSize: 12.5,
                          height: 1.45,
                          color: U.textSoft,
                        ),
                      ),
                      if (insights.length > 1) ...[
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            for (var i = 0; i < insights.length; i++)
                              Container(
                                margin: const EdgeInsets.only(right: 6),
                                width: i == _insightIndex % insights.length ? 14 : 6,
                                height: 6,
                                decoration: BoxDecoration(
                                  color: i == _insightIndex % insights.length
                                      ? U.green
                                      : const Color(0x26FFFFFF),
                                  borderRadius: BorderRadius.circular(3),
                                ),
                              ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),

        // Trend
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 20, 0, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Padding(
                padding: EdgeInsets.only(right: 16),
                child: SectionHeader(title: 'Trend'),
              ),
              SizedBox(
                height: 150,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.only(right: 16),
                  itemCount: kRadarOrder.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 10),
                  itemBuilder: (context, i) => _TrendCard(
                    metric: kRadarOrder[i],
                    days: days,
                    weekLetters: _weekLetters,
                  ),
                ),
              ),
            ],
          ),
        ),

        // Faollik haritasi
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SectionHeader(title: 'Faollik haritasi'),
              UnumCard(child: HeatmapGrid(data: _heatmap(days))),
            ],
          ),
        ),

        const Padding(
          padding: EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: Disclaimer(),
        ),
      ],
    );
  }

  Widget _cardTitle(BuildContext context, String title, String info) {
    return Row(
      children: [
        Text(
          title,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        ),
        const SizedBox(width: 5),
        GestureDetector(
          onTap: () => _showInfo(context, title, info),
          child: const Icon(Icons.info_outline, size: 13, color: U.textDim),
        ),
      ],
    );
  }

  void _showInfo(BuildContext context, String title, String body) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: U.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(U.rSheet)),
      ),
      builder: (context) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0x26FFFFFF),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              title,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              body,
              style: const TextStyle(fontSize: 13.5, height: 1.6, color: U.textSoft),
            ),
          ],
        ),
      ),
    );
  }

  static const _balanceInfo =
      "Beshta yo'nalish bo'yicha bajarilish darajasi. Har bir cho'qqi 0 dan 100 gacha "
      "foizni ko'rsatadi — maydon qanchalik keng bo'lsa, kun shunchalik muvozanatli o'tgan.";

  static const _scoreInfo =
      "Ovqatlanish, harakat, uyqu va maqsadlar asosida hisoblanadigan umumiy ball. "
      "Hisob-kitob qurilmangizda bajariladi va bir xil ma'lumot uchun har doim bir xil "
      "natija beradi. Bu tibbiy baho emas.";

  /// Deterministik kuzatuvlar — AI emas, shuning uchun oflayn ham ishlaydi
  List<String> _insights(AppState app, Map<MetricKey, MetricState> metrics) {
    final out = <String>[];

    final weakest = metrics.values
        .where((m) => m.hasData)
        .fold<MetricState?>(null, (a, b) => a == null || b.percent < a.percent ? b : a);
    if (weakest != null && weakest.percent < 70) {
      out.add(
        "So'nggi ma'lumotlarga qaraganda, ${kMetrics[weakest.key]!.label.toLowerCase()} "
        "bo'yicha ${weakest.percent}% bajarilgan. ${weakest.remainderText}.",
      );
    }

    final days = app.recentDays(7).where((d) => d.score > 0).toList();
    if (days.length >= 3) {
      final avg = days.fold<int>(0, (s, d) => s + d.score) / days.length;
      out.add(
        "So'nggi ${days.length} kunlik o'rtacha ball — ${avg.round()}. "
        "Kichik lekin muntazam qadamlar bu ko'rsatkichni barqaror ko'taradi.",
      );
    }

    if (app.waterToday > 0 && app.profile.targetWaterMl > 0) {
      final pct = (app.waterToday / app.profile.targetWaterMl * 100).round();
      out.add("Bugun suv me'yorining $pct% i bajarildi.");
    }

    return out;
  }

  /// Kunlik ballardan 7×N faollik haritasi
  List<List<double>> _heatmap(List<DayRecord> days) {
    final grid = List.generate(7, (_) => List<double>.filled(14, 0));
    for (var i = 0; i < days.length && i < 98; i++) {
      final d = days[days.length - 1 - i];
      final col = 13 - (i ~/ 7);
      final row = i % 7;
      if (col < 0) break;
      grid[row][col] = (d.score / 100).clamp(0, 1).toDouble();
    }
    return grid;
  }
}

class _NoScore extends StatelessWidget {
  const _NoScore();

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      height: 110,
      child: Center(
        child: Text(
          "Ma'lumot\nyetarli emas",
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 12, height: 1.5, color: U.textDim),
        ),
      ),
    );
  }
}

class _TrendCard extends StatelessWidget {
  const _TrendCard({
    required this.metric,
    required this.days,
    required this.weekLetters,
  });

  final MetricKey metric;
  final List<DayRecord> days;
  final List<String> weekLetters;

  @override
  Widget build(BuildContext context) {
    final meta = kMetrics[metric]!;
    final points = days.length >= 2
        ? days.sublist(days.length >= 7 ? days.length - 7 : 0).map((d) => d.score.toDouble()).toList()
        : <double>[];

    final avg = points.isEmpty
        ? 0.0
        : points.reduce((a, b) => a + b) / points.length;

    return Container(
      width: 124,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: U.surface,
        borderRadius: BorderRadius.circular(U.rRow),
        border: Border.all(color: U.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            meta.label,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 11, color: U.textMuted),
          ),
          const SizedBox(height: 2),
          Text(
            points.isEmpty ? '—' : avg.round().toString(),
            style: const TextStyle(
              fontSize: 19,
              fontWeight: FontWeight.w700,
              color: Colors.white,
            ),
          ),
          const Text("o'rtacha", style: TextStyle(fontSize: 10, color: U.textDim)),
          const SizedBox(height: 6),
          if (points.length >= 2)
            Sparkline(points: points, color: meta.color, width: 100, height: 40)
          else
            const SizedBox(height: 40),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              for (final d in weekLetters)
                Text(d, style: const TextStyle(fontSize: 8.5, color: U.textFaint)),
            ],
          ),
        ],
      ),
    );
  }
}
