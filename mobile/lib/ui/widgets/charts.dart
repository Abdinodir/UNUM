import 'package:flutter/material.dart';

import '../tokens.dart';

/// Trend kartalaridagi kichik chiziqli grafik.
class Sparkline extends StatelessWidget {
  const Sparkline({
    super.key,
    required this.points,
    required this.color,
    this.width = 100,
    this.height = 40,
    this.filled = true,
    this.dots = true,
  });

  final List<double> points;
  final Color color;
  final double width;
  final double height;
  final bool filled;
  final bool dots;

  @override
  Widget build(BuildContext context) {
    if (points.length < 2) return SizedBox(width: width, height: height);
    return CustomPaint(
      size: Size(width, height),
      painter: _SparkPainter(points: points, color: color, filled: filled, dots: dots),
    );
  }
}

class _SparkPainter extends CustomPainter {
  _SparkPainter({
    required this.points,
    required this.color,
    required this.filled,
    required this.dots,
  });

  final List<double> points;
  final Color color;
  final bool filled;
  final bool dots;

  @override
  void paint(Canvas canvas, Size size) {
    final min = points.reduce((a, b) => a < b ? a : b);
    final max = points.reduce((a, b) => a > b ? a : b);
    final span = (max - min) == 0 ? 1.0 : (max - min);
    const padY = 5.0;

    final coords = <Offset>[
      for (var i = 0; i < points.length; i++)
        Offset(
          i / (points.length - 1) * size.width,
          size.height - padY - (points[i] - min) / span * (size.height - padY * 2),
        ),
    ];

    final line = Path()..moveTo(coords.first.dx, coords.first.dy);
    for (final c in coords.skip(1)) {
      line.lineTo(c.dx, c.dy);
    }

    if (filled) {
      final area = Path.from(line)
        ..lineTo(size.width, size.height)
        ..lineTo(0, size.height)
        ..close();
      canvas.drawPath(
        area,
        Paint()
          ..shader = LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [color.withValues(alpha: 0.28), color.withValues(alpha: 0)],
          ).createShader(Offset.zero & size),
      );
    }

    canvas.drawPath(
      line,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.6
        ..strokeJoin = StrokeJoin.round
        ..strokeCap = StrokeCap.round
        ..color = color,
    );

    if (dots) {
      final dot = Paint()..color = color;
      for (final c in coords) {
        canvas.drawCircle(c, 2, dot);
      }
    }
  }

  @override
  bool shouldRepaint(_SparkPainter old) => old.points != points || old.color != color;
}

/// Faollik haritasi: 7 qator (hafta kunlari) × N ustun, qiymat 0–1.
class HeatmapGrid extends StatelessWidget {
  const HeatmapGrid({super.key, required this.data});

  final List<List<double>> data;

  static const _dayLetters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  /// Qiymatga qarab yashil to'yinganlik — 0 bo'lsa deyarli ko'rinmas
  static Color _cellColor(double v) =>
      U.green.withValues(alpha: 0.06 + v.clamp(0, 1) * 0.74);

  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) return const SizedBox.shrink();
    final cols = data.first.length;
    final weeks = (cols / 7).round().clamp(1, 12);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Column(
              children: [
                for (final d in _dayLetters)
                  SizedBox(
                    height: 14,
                    child: Text(
                      d,
                      style: const TextStyle(fontSize: 9, color: U.textDim, height: 1.5),
                    ),
                  ),
              ],
            ),
            const SizedBox(width: 6),
            Expanded(
              child: Column(
                children: [
                  for (final row in data)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 3),
                      child: Row(
                        children: [
                          for (final v in row)
                            Expanded(
                              child: Padding(
                                padding: const EdgeInsets.only(right: 3),
                                child: AspectRatio(
                                  aspectRatio: 1,
                                  child: DecoratedBox(
                                    decoration: BoxDecoration(
                                      color: _cellColor(v),
                                      borderRadius: BorderRadius.circular(3),
                                    ),
                                  ),
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
        ),
        const SizedBox(height: 6),
        Padding(
          padding: const EdgeInsets.only(left: 20),
          child: Row(
            children: [
              for (var i = 0; i < weeks; i++)
                Expanded(
                  child: Text(
                    '${i + 1}-h',
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 10, color: U.textDim),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}
