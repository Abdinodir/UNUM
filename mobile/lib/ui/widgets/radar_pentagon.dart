import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../tokens.dart';
import 'metric_badge.dart';

/// "Hayot balansi" beshburchagi.
///
/// Panjara, ma'lumot ko'pburchagi va o'lchov raqamlari `CustomPainter` bilan,
/// cho'qqi ikonkalari va yozuvlari esa oddiy widget sifatida ustiga qo'yiladi —
/// shunda ular bosiladigan bo'ladi va matn uslublari oson boshqariladi.
class RadarPentagon extends StatelessWidget {
  const RadarPentagon({
    super.key,
    required this.values,
    this.size = 300,
    this.showScale = true,
    this.onSelect,
  });

  /// Har bir metrika uchun 0–100 oralig'idagi qiymat
  final Map<MetricKey, double> values;
  final double size;
  final bool showScale;
  final ValueChanged<MetricKey>? onSelect;

  /// Cho'qqi burchagi: soat 12 dan boshlab soat yo'nalishi bo'yicha 72°
  static double _angleAt(int index) => (-90 + index * 72) * math.pi / 180;

  static Offset _pointAt(Offset c, double r, int index) {
    final a = _angleAt(index);
    return Offset(c.dx + r * math.cos(a), c.dy + r * math.sin(a));
  }

  @override
  Widget build(BuildContext context) {
    final center = Offset(size / 2, size / 2 + 6);
    final radius = size * 0.30;
    final badge = math.max(28.0, size * 0.11);
    final labelSize = math.max(9.0, size * 0.038);
    final percentSize = math.max(10.0, size * 0.042);

    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          CustomPaint(
            size: Size(size, size),
            painter: _RadarPainter(
              values: values,
              center: center,
              radius: radius,
              showScale: showScale,
              scaleFontSize: math.max(8.0, size * 0.033),
            ),
          ),

          for (var i = 0; i < kRadarOrder.length; i++)
            ..._vertex(i, center, radius, badge, labelSize, percentSize),
        ],
      ),
    );
  }

  List<Widget> _vertex(
    int i,
    Offset center,
    double radius,
    double badge,
    double labelSize,
    double percentSize,
  ) {
    final key = kRadarOrder[i];
    final meta = kMetrics[key]!;
    final p = _pointAt(center, radius, i);
    final percent = (values[key] ?? 0).round();

    final label = Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: i == 1
          ? CrossAxisAlignment.start
          : i == 4
              ? CrossAxisAlignment.end
              : CrossAxisAlignment.center,
      children: [
        Text(
          meta.label,
          style: TextStyle(
            fontSize: labelSize,
            fontWeight: FontWeight.w500,
            color: U.text,
            height: 1.2,
          ),
        ),
        Text(
          '$percent%',
          style: TextStyle(
            fontSize: percentSize,
            fontWeight: FontWeight.w600,
            color: meta.color,
            height: 1.2,
          ),
        ),
      ],
    );

    // Yozuv joylashuvi cho'qqiga qarab o'zgaradi
    late final Widget positionedLabel;
    const gap = 8.0;
    if (i == 0) {
      positionedLabel = Positioned(
        left: 0,
        right: 0,
        bottom: null,
        top: p.dy - badge / 2 - gap - 30,
        child: Center(child: label),
      );
    } else if (i == 1) {
      positionedLabel = Positioned(
        left: p.dx + badge / 2 + gap,
        top: p.dy - 16,
        child: label,
      );
    } else if (i == 4) {
      positionedLabel = Positioned(
        right: size - (p.dx - badge / 2 - gap),
        top: p.dy - 16,
        child: label,
      );
    } else {
      positionedLabel = Positioned(
        left: p.dx - 60,
        width: 120,
        top: p.dy + badge / 2 + gap,
        child: Center(child: label),
      );
    }

    return [
      positionedLabel,
      Positioned(
        left: p.dx - badge / 2,
        top: p.dy - badge / 2,
        child: GestureDetector(
          onTap: onSelect == null ? null : () => onSelect!(key),
          child: MetricBadge(metric: key, size: badge, solid: true),
        ),
      ),
    ];
  }
}

class _RadarPainter extends CustomPainter {
  _RadarPainter({
    required this.values,
    required this.center,
    required this.radius,
    required this.showScale,
    required this.scaleFontSize,
  });

  final Map<MetricKey, double> values;
  final Offset center;
  final double radius;
  final bool showScale;
  final double scaleFontSize;

  static const _rings = [0.25, 0.5, 0.75, 1.0];

  Path _polygon(List<double> radii) {
    final path = Path();
    for (var i = 0; i < radii.length; i++) {
      final p = RadarPentagon._pointAt(center, radii[i], i);
      if (i == 0) {
        path.moveTo(p.dx, p.dy);
      } else {
        path.lineTo(p.dx, p.dy);
      }
    }
    return path..close();
  }

  @override
  void paint(Canvas canvas, Size size) {
    // Panjara — konsentrik beshburchaklar
    final gridPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1
      ..color = const Color(0x0FFFFFFF);

    for (final k in _rings) {
      canvas.drawPath(_polygon(List.filled(5, radius * k)), gridPaint);
    }

    // Markazdan cho'qqilarga radial chiziqlar
    final spokePaint = Paint()
      ..strokeWidth = 1
      ..color = const Color(0x0DFFFFFF);
    for (var i = 0; i < 5; i++) {
      canvas.drawLine(center, RadarPentagon._pointAt(center, radius, i), spokePaint);
    }

    // Ma'lumot ko'pburchagi
    final dataRadii = [
      for (final key in kRadarOrder)
        (values[key] ?? 0).clamp(0, 100) / 100 * radius,
    ];
    final dataPath = _polygon(dataRadii);

    canvas.drawPath(
      dataPath,
      Paint()..color = U.green.withValues(alpha: 0.22),
    );
    canvas.drawPath(
      dataPath,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.6
        ..strokeJoin = StrokeJoin.round
        ..color = U.greenBright,
    );

    // Cho'qqi nuqtalari
    final dotPaint = Paint()..color = U.greenBright;
    for (var i = 0; i < 5; i++) {
      canvas.drawCircle(RadarPentagon._pointAt(center, dataRadii[i], i), 3.2, dotPaint);
    }

    // O'lchov raqamlari — yuqori o'q bo'ylab
    if (showScale) {
      // 100 ataylab yo'q: uni tepadagi cho'qqi ikonkasi yopib qo'yadi
      for (final v in [0, 25, 50, 75]) {
        final tp = TextPainter(
          text: TextSpan(
            text: '$v',
            style: TextStyle(
              fontSize: scaleFontSize,
              fontWeight: FontWeight.w500,
              color: const Color(0x47FFFFFF),
            ),
          ),
          textDirection: TextDirection.ltr,
        )..layout();
        tp.paint(canvas, Offset(center.dx + 8, center.dy - v / 100 * radius - tp.height / 2));
      }
    }
  }

  @override
  bool shouldRepaint(_RadarPainter old) =>
      old.values != values || old.radius != radius || old.showScale != showScale;
}
