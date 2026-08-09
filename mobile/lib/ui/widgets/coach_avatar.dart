import 'package:flutter/material.dart';

import '../tokens.dart';

/// AI Coach robot avatari — rasm yuklamaydi, to'liq chizma.
class CoachAvatar extends StatefulWidget {
  const CoachAvatar({super.key, this.size = 48, this.pulse = true});

  final double size;
  final bool pulse;

  @override
  State<CoachAvatar> createState() => _CoachAvatarState();
}

class _CoachAvatarState extends State<CoachAvatar> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2600),
  );

  @override
  void initState() {
    super.initState();
    if (widget.pulse) _c.repeat(reverse: true);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      builder: (context, _) => CustomPaint(
        size: Size(widget.size, widget.size),
        painter: _CoachPainter(eyeOpacity: widget.pulse ? 1 - _c.value * 0.55 : 1),
      ),
    );
  }
}

class _CoachPainter extends CustomPainter {
  _CoachPainter({required this.eyeOpacity});

  final double eyeOpacity;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 64; // chizma 64×64 tarmoqda tuzilgan
    Rect r(double x, double y, double w, double h) =>
        Rect.fromLTWH(x * s, y * s, w * s, h * s);

    // Antenna
    canvas.drawLine(
      Offset(32 * s, 9 * s),
      Offset(32 * s, 15 * s),
      Paint()
        ..color = const Color(0xFF5A6663)
        ..strokeWidth = 2.4 * s
        ..strokeCap = StrokeCap.round,
    );
    canvas.drawCircle(Offset(32 * s, 6 * s), 2.6 * s, Paint()..color = U.greenBright);

    // Yon "quloqlar"
    final ear = Paint()..color = const Color(0xFF2B3230);
    canvas.drawRRect(RRect.fromRectAndRadius(r(4, 28, 7, 14), Radius.circular(3.5 * s)), ear);
    canvas.drawRRect(RRect.fromRectAndRadius(r(53, 28, 7, 14), Radius.circular(3.5 * s)), ear);

    // Bosh
    canvas.drawRRect(
      RRect.fromRectAndRadius(r(10, 15, 44, 38), Radius.circular(14 * s)),
      Paint()..color = const Color(0xFF3A4341),
    );

    // Ekran
    canvas.drawRRect(
      RRect.fromRectAndRadius(r(16, 23, 32, 20), Radius.circular(9 * s)),
      Paint()..color = const Color(0xFF0F1413),
    );

    // Ko'zlar
    final eye = Paint()..color = U.green.withValues(alpha: eyeOpacity);
    canvas.drawCircle(Offset(25.5 * s, 33 * s), 4.6 * s, eye);
    canvas.drawCircle(Offset(38.5 * s, 33 * s), 4.6 * s, eye);

    final pupil = Paint()..color = const Color(0xFF0A1A10);
    canvas.drawCircle(Offset(25.5 * s, 33 * s), 1.8 * s, pupil);
    canvas.drawCircle(Offset(38.5 * s, 33 * s), 1.8 * s, pupil);
  }

  @override
  bool shouldRepaint(_CoachPainter old) => old.eyeOpacity != eyeOpacity;
}
