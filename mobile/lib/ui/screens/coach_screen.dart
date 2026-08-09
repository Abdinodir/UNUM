import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../insights.dart';
import '../../state/app_state.dart';
import '../shell/top_bar.dart';
import '../tokens.dart';
import '../widgets/coach_avatar.dart';
import '../widgets/kit.dart';
import '../widgets/score_ring.dart';
import '../widgets/sub_screen.dart';

/// AI Coach ekrani — dizayndagi 4-skrin.
class CoachScreen extends StatelessWidget {
  const CoachScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final score = app.todayScore;

    final risks = analyzeRisks(
      days: app.recentDays(14),
      targetProtein: app.profile.targetProtein.toDouble(),
      targetWater: app.profile.targetWaterMl.toDouble(),
    );

    return ListView(
      padding: const EdgeInsets.only(bottom: 120),
      children: [
        const UnumTopBar(title: 'AI Coach', titleIcon: Icons.auto_awesome),

        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 16),
          child: Disclaimer(),
        ),

        // Bugungi holat
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: UnumCard(
            child: Row(
              children: [
                if (score.hasData)
                  ScoreRing(value: score.total, size: 86, thickness: 7)
                else
                  const SizedBox(
                    width: 86,
                    height: 86,
                    child: Center(
                      child: Icon(Icons.remove, size: 28, color: U.textFaint),
                    ),
                  ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Bugungi holat',
                        style: TextStyle(fontSize: 13, color: U.textMuted),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        score.hasData
                            ? "Natija: ${U.scoreLabel(score.total)}"
                            : "Ma'lumot yetarli emas",
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        score.hasData
                            ? _nextStep(score)
                            : 'Birinchi taomni kiriting — tahlil shundan boshlanadi.',
                        style: const TextStyle(
                          fontSize: 12,
                          height: 1.4,
                          color: U.textMuted,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),

        // Tavsiyalar
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SectionHeader(title: 'Tavsiyalar'),
              if (risks.isEmpty)
                UnumCard(
                  child: Row(
                    children: [
                      const Icon(Icons.check_circle_outline, size: 20, color: U.greenBright),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          app.recentDays(14).where((d) => d.hasData).length < 3
                              ? "Tavsiyalar uchun kamida 3 kunlik ma'lumot kerak."
                              : "Hozircha e'tibor talab qiladigan nuqta yo'q. Shu ruhda davom eting.",
                          style: const TextStyle(
                            fontSize: 13,
                            height: 1.45,
                            color: U.textSoft,
                          ),
                        ),
                      ),
                    ],
                  ),
                )
              else
                UnumCard(
                  padding: EdgeInsets.zero,
                  child: Column(
                    children: [
                      for (var i = 0; i < risks.length; i++)
                        _RiskRow(
                          risk: risks[i],
                          divider: i < risks.length - 1,
                        ),
                    ],
                  ),
                ),
            ],
          ),
        ),

        // AI chat kirish qatori
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SectionHeader(title: 'AI chat'),
              GestureDetector(
                onTap: () => SubScreen.push(context, const _ChatScreen()),
                child: Row(
                  children: [
                    const CoachAvatar(size: 40, pulse: false),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Container(
                        height: 46,
                        padding: const EdgeInsets.symmetric(horizontal: 14),
                        decoration: BoxDecoration(
                          color: U.surface,
                          borderRadius: BorderRadius.circular(U.rRow),
                          border: Border.all(color: U.border),
                        ),
                        child: const Row(
                          children: [
                            Expanded(
                              child: Text(
                                'Savolingizni yozing…',
                                style: TextStyle(fontSize: 13.5, color: U.textDim),
                              ),
                            ),
                            Icon(Icons.send, size: 16, color: U.textMuted),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  /// Ballning eng zaif komponentidan bitta aniq qadam
  String _nextStep(dynamic score) {
    final components = (score.components as List).where((c) => !c.isFull).toList();
    if (components.isEmpty) return "Bugungi barcha me'yorlar bajarildi.";
    components.sort((a, b) => a.ratio.compareTo(b.ratio));
    return components.first.advice ?? 'Kunni muvozanatli yakunlashga harakat qiling.';
  }
}

class _RiskRow extends StatelessWidget {
  const _RiskRow({required this.risk, required this.divider});

  final HealthRisk risk;
  final bool divider;

  @override
  Widget build(BuildContext context) {
    final row = InkWell(
      onTap: () => SubScreen.push(context, _RiskDetail(risk: risk)),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: risk.color.withValues(alpha: 0.13),
                shape: BoxShape.circle,
              ),
              child: Icon(risk.icon, size: 17, color: risk.color),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          risk.title,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w500,
                            color: Colors.white,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: risk.color.withValues(alpha: 0.13),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          risk.levelLabel,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w500,
                            color: risk.color,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    risk.finding,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12, height: 1.45, color: U.textMuted),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, size: 16, color: U.textFaint),
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

class _RiskDetail extends StatelessWidget {
  const _RiskDetail({required this.risk});

  final HealthRisk risk;

  @override
  Widget build(BuildContext context) {
    return SubScreen(
      title: 'Tavsiya',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 54,
                height: 54,
                decoration: BoxDecoration(
                  color: risk.color.withValues(alpha: 0.13),
                  shape: BoxShape.circle,
                ),
                child: Icon(risk.icon, size: 24, color: risk.color),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      risk.title,
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w600,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      risk.finding,
                      style: const TextStyle(
                        fontSize: 12.5,
                        height: 1.5,
                        color: U.textMuted,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 24),
          const Text(
            'Nima qilish mumkin?',
            style: TextStyle(
              fontSize: 14.5,
              fontWeight: FontWeight.w600,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 10),
          UnumCard(
            child: Text(
              risk.action,
              style: const TextStyle(fontSize: 13.5, height: 1.55, color: U.textSoft),
            ),
          ),

          const SizedBox(height: 20),
          const Disclaimer(),
          const SizedBox(height: 20),
          UnumButton(
            label: 'Tushunarli',
            onPressed: () => Navigator.of(context).maybePop(),
          ),
        ],
      ),
    );
  }
}

/// AI bilan yozishma
class _ChatScreen extends StatefulWidget {
  const _ChatScreen();

  @override
  State<_ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<_ChatScreen> {
  final _ctrl = TextEditingController();
  bool _sending = false;

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _ctrl.text.trim();
    if (text.isEmpty || _sending) return;

    setState(() => _sending = true);
    _ctrl.clear();

    final app = context.read<AppState>();
    try {
      await app.addCoachMessage(text, 'user');
      final reply = await app.api.coachChat(
        messages: app.coachMessages,
        profile: app.profile,
        inventory: app.inventory,
        logsToday: app.logsTodaySummary,
      );
      await app.addCoachMessage(reply, 'ai');
    } catch (_) {
      await app.addCoachMessage(
        "Aloqa uzildi. Internet ulanishini tekshirib, qayta urinib ko'ring.",
        'ai',
      );
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final messages = app.coachMessages;

    return SubScreen(
      title: 'AI chat',
      bottomBar: Container(
        height: 48,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: U.surface,
          borderRadius: BorderRadius.circular(U.rRow),
          border: Border.all(color: U.border),
        ),
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: _ctrl,
                onSubmitted: (_) => _send(),
                textInputAction: TextInputAction.send,
                style: const TextStyle(fontSize: 13.5, color: Colors.white),
                decoration: const InputDecoration(
                  border: InputBorder.none,
                  hintText: 'Savolingizni yozing…',
                  hintStyle: TextStyle(color: U.textDim),
                ),
              ),
            ),
            IconButton(
              onPressed: _sending ? null : _send,
              icon: _sending
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2, color: U.green),
                    )
                  : const Icon(Icons.send, size: 18, color: U.green),
            ),
          ],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (messages.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 40),
              child: Center(
                child: Text(
                  "Savolingizni yozing — masalan\n\"Bugun nima yesam bo'ladi?\"",
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 13.5, height: 1.6, color: U.textDim),
                ),
              ),
            ),
          for (final m in messages) ...[
            if (m.sender == 'user')
              Align(
                alignment: Alignment.centerRight,
                child: Container(
                  margin: const EdgeInsets.only(bottom: 12, left: 40),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: U.green.withValues(alpha: 0.16),
                    borderRadius: const BorderRadius.only(
                      topLeft: Radius.circular(16),
                      topRight: Radius.circular(6),
                      bottomLeft: Radius.circular(16),
                      bottomRight: Radius.circular(16),
                    ),
                    border: Border.all(color: U.green.withValues(alpha: 0.25)),
                  ),
                  child: Text(
                    m.text,
                    style: const TextStyle(
                      fontSize: 13.5,
                      height: 1.45,
                      color: Color(0xFFDCFCE7),
                    ),
                  ),
                ),
              )
            else
              Container(
                margin: const EdgeInsets.only(bottom: 12, right: 40),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: U.surface,
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(6),
                    topRight: Radius.circular(16),
                    bottomLeft: Radius.circular(16),
                    bottomRight: Radius.circular(16),
                  ),
                  border: Border.all(color: U.border),
                ),
                child: Text(
                  m.text,
                  style: const TextStyle(fontSize: 13.5, height: 1.55, color: U.textSoft),
                ),
              ),
          ],
        ],
      ),
    );
  }
}
