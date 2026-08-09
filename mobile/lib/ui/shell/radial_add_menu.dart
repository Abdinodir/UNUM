import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../tokens.dart';

/// "+" bosilganda yarim doira bo'ylab chiqadigan 5 ta odat tugmasi.
/// Chapdan o'ngga: Screen time → Uyqu → Ovqatlanish (tepa) → Qadam → Maqsadlar.
class RadialAddMenu extends StatelessWidget {
  const RadialAddMenu({
    super.key,
    required this.animation,
    required this.onClose,
    required this.onSelect,
  });

  final Animation<double> animation;
  final VoidCallback onClose;
  final ValueChanged<MetricKey> onSelect;

  static const _arc = <(MetricKey, double)>[
    (MetricKey.screen, 180),
    (MetricKey.sleep, 135),
    (MetricKey.nutrition, 90),
    (MetricKey.steps, 45),
    (MetricKey.goals, 0),
  ];

  static const _radius = 116.0;
  static const _item = 58.0;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: animation,
      builder: (context, _) {
        final t = animation.value;
        if (t == 0) return const SizedBox.shrink();

        return Stack(
          children: [
            // Fon — bosilganda yopiladi
            Positioned.fill(
              child: GestureDetector(
                onTap: onClose,
                child: BackdropFilter(
                  filter: ui.ImageFilter.blur(sigmaX: 6 * t, sigmaY: 6 * t),
                  child: ColoredBox(color: U.bg.withValues(alpha: 0.88 * t)),
                ),
              ),
            ),

            // Langar — tab bardagi "+" markazi bilan BIR XIL balandlikda.
            //
            // Hisob (tab_bar.dart): pastki padding 12 + SizedBox 130,
            // "+" esa SizedBox ichida top:0 dan 56 gacha. Demak markazi
            // ekran pastidan: 12 + (130 - 56) + 28 = 114.
            // ⚠️ tab_bar.dart dagi o'lchamlar o'zgarsa BU HAM o'zgarsin,
            // aks holda menyu "+" dan uzilib qoladi.
            Positioned(
              left: 0,
              right: 0,
              bottom: MediaQuery.of(context).padding.bottom + 114,
              height: 0,
              child: Stack(
                clipBehavior: Clip.none,
                alignment: Alignment.center,
                children: [
                  for (var i = 0; i < _arc.length; i++) _button(i, t),
                ],
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _button(int i, double t) {
    final (metric, angle) = _arc[i];
    final meta = kMetrics[metric]!;

    // Har bir tugma biroz kechikib chiqadi
    final delay = i * 0.06;
    final local = ((t - delay) / (1 - delay)).clamp(0.0, 1.0);
    final eased = Curves.easeOutBack.transform(local);

    final rad = angle * math.pi / 180;
    final dx = _radius * math.cos(rad) * eased;
    final dy = -_radius * math.sin(rad) * eased;

    return Positioned(
      left: null,
      top: null,
      child: Transform.translate(
        offset: Offset(dx, dy),
        child: Opacity(
          opacity: local,
          child: Transform.scale(
            scale: 0.4 + 0.6 * eased,
            child: GestureDetector(
              onTap: () {
                HapticFeedback.mediumImpact();
                onSelect(metric);
              },
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: _item,
                    height: _item,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: meta.color,
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.4),
                          blurRadius: 16,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: Icon(meta.icon, size: 24, color: U.greenInk),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    meta.label,
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
