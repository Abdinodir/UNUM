import 'package:flutter/material.dart';

import '../../plan_models.dart';
import '../../state/app_state.dart';
import '../tokens.dart';
import 'kit.dart';
import 'premium_sheet.dart';
import 'score_ring.dart';

/// Life Score kartasi — bosh ekranning eng tepasida.
///
/// Bepul rejada server raqamni UMUMAN yubormaydi (`locked: true`), shuning
/// uchun bu yerda soxta yoki namunaviy qiymat ko'rsatilmaydi.
///
/// ⚠️ Play siyosati: bu yerda narx ham, "sotib olish" tugmasi ham yo'q —
/// faqat funksiya nima berishi tushuntiriladi.
class LifeScoreCard extends StatefulWidget {
  const LifeScoreCard({super.key, required this.app});
  final AppState app;

  @override
  State<LifeScoreCard> createState() => _LifeScoreCardState();
}

class _LifeScoreCardState extends State<LifeScoreCard> {
  LifeScore? _score;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final s = await widget.app.api.lifeScore();
      if (mounted) setState(() => _score = s);
    } catch (_) {
      // Tarmoq xatosi bosh ekranni buzmasin — kartani umuman
      // ko'rsatmaymiz, qolgan ekran ishlayveradi.
      if (mounted) setState(() => _failed = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_failed) return const SizedBox.shrink();

    final s = _score;
    if (s == null) {
      return const UnumCard(
        child: SizedBox(
          height: 96,
          child: Center(
            child: SizedBox(
              width: 20, height: 20,
              child: CircularProgressIndicator(strokeWidth: 2.2, color: U.green),
            ),
          ),
        ),
      );
    }

    if (s.locked) {
      return GestureDetector(
        onTap: () => PremiumSheet.forFeature(context, PremiumFeature.lifeScore),
        child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: U.green.withValues(alpha: 0.06),
          border: Border.all(color: U.green.withValues(alpha: 0.25)),
          borderRadius: BorderRadius.circular(U.rCard),
        ),
        child: const Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.workspace_premium, size: 22, color: U.green),
            SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Life Score',
                      style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: Colors.white)),
                  SizedBox(height: 3),
                  Text(
                    "Kuningizning yagona ko'rsatkichi — reja, odat, fokus, uyqu "
                    "va sog'liq bir ballda.",
                    style: TextStyle(fontSize: 12, height: 1.4, color: U.textMuted),
                  ),
                  SizedBox(height: 6),
                  Text('Batafsil ko\'rish →',
                      style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          color: U.greenBright)),
                ],
              ),
            ),
          ],
        ),
        ),
      );
    }

    final usable = s.usable;

    return UnumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              ScoreRing(value: s.total, size: 92, thickness: 8, showDenominator: false),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Life Score',
                        style: TextStyle(fontSize: 13, color: U.textMuted)),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Text(s.hasData ? '${s.total}' : '—',
                            style: const TextStyle(
                                fontSize: 26,
                                fontWeight: FontWeight.bold,
                                color: Colors.white)),
                        const SizedBox(width: 4),
                        const Text('/100',
                            style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                                color: U.textDim)),
                      ],
                    ),
                    Text(s.grade,
                        style: const TextStyle(fontSize: 12.5, color: U.greenBright)),
                  ],
                ),
              ),
            ],
          ),

          if (usable.isNotEmpty) ...[
            const SizedBox(height: 14),
            for (final c in usable)
              Padding(
                padding: const EdgeInsets.only(bottom: 9),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(c.label,
                            style: const TextStyle(fontSize: 12.5, color: U.textSoft)),
                        Text(c.detail,
                            style: const TextStyle(fontSize: 11.5, color: U.textDim)),
                      ],
                    ),
                    const SizedBox(height: 4),
                    UnumProgressBar(
                        percent: c.ratio * 100, color: U.green, height: 3),
                  ],
                ),
              ),
          ],

          if (!s.hasData)
            const Padding(
              padding: EdgeInsets.only(top: 10),
              child: Text(
                "Bugun hali ma'lumot yo'q. Vazifa qo'shing yoki odatni "
                'belgilang — ball shu zahoti paydo bo\'ladi.',
                style: TextStyle(fontSize: 12.5, height: 1.45, color: U.textDim),
              ),
            ),

          if (s.weakest != null)
            Container(
              margin: const EdgeInsets.only(top: 10),
              padding: const EdgeInsets.only(top: 10),
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: U.border)),
              ),
              child: Text(
                "Eng ko'p ball «${s.weakest!.label}» dan yo'qolyapti — ${s.weakest!.detail}.",
                style: const TextStyle(fontSize: 12.5, height: 1.45, color: U.textMuted),
              ),
            ),
        ],
      ),
    );
  }
}
