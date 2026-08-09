import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../tokens.dart';

/// Unum Score halqasi. Qiymat o'zgarganda animatsiya bilan to'ladi.
class ScoreRing extends StatelessWidget {
  const ScoreRing({
    super.key,
    required this.value,
    this.size = 150,
    this.thickness = 10,
    this.showDenominator = true,
  });

  /// 0–100
  final num value;
  final double size;
  final double thickness;
  final bool showDenominator;

  @override
  Widget build(BuildContext context) {
    final clamped = value.clamp(0, 100).toDouble();
    final color = U.scoreColor(clamped);

    return SizedBox(
      width: size,
      height: size,
      child: TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: clamped),
        duration: const Duration(milliseconds: 900),
        curve: Curves.easeOut,
        builder: (context, animated, _) => Stack(
          alignment: Alignment.center,
          children: [
            CustomPaint(
              size: Size(size, size),
              painter: _RingPainter(
                percent: animated,
                thickness: thickness,
                color: color,
              ),
            ),
            Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '${animated.round()}',
                  style: TextStyle(
                    fontSize: size * 0.31,
                    fontWeight: FontWeight.w700,
                    color: U.text,
                    height: 1,
                    letterSpacing: -0.5,
                  ),
                ),
                if (showDenominator)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      '/100',
                      style: TextStyle(
                        fontSize: size * 0.1,
                        fontWeight: FontWeight.w500,
                        color: U.textDim,
                        height: 1,
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({required this.percent, required this.thickness, required this.color});

  final double percent;
  final double thickness;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final radius = (size.width - thickness) / 2;

    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = thickness
        ..color = const Color(0x12FFFFFF),
    );

    if (percent <= 0) return;

    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      -math.pi / 2,
      2 * math.pi * (percent / 100),
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = thickness
        ..strokeCap = StrokeCap.round
        ..color = color,
    );
  }

  @override
  bool shouldRepaint(_RingPainter old) =>
      old.percent != percent || old.color != color || old.thickness != thickness;
}
