import 'package:flutter/material.dart';

import '../tokens.dart';

/// Metrikaning doira ichidagi rangli ikonkasi.
/// Radar cho'qqilarida (`solid: true`) ham, ro'yxat qatorlarida ham ishlatiladi.
class MetricBadge extends StatelessWidget {
  const MetricBadge({
    super.key,
    required this.metric,
    this.size = 40,
    this.solid = false,
  });

  final MetricKey metric;
  final double size;

  /// To'q fon o'rniga to'liq rangli doira
  final bool solid;

  @override
  Widget build(BuildContext context) {
    final meta = kMetrics[metric]!;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: solid ? meta.color : meta.color.withValues(alpha: 0.13),
        border: Border.all(
          color: solid ? meta.color : meta.color.withValues(alpha: 0.33),
        ),
      ),
      alignment: Alignment.center,
      child: Icon(
        meta.icon,
        size: size * 0.46,
        color: solid ? U.bg : meta.color,
      ),
    );
  }
}
