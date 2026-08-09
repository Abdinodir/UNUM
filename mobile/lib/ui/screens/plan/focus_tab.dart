import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../plan_models.dart';
import '../../../state/app_state.dart';
import '../../tokens.dart';
import '../../widgets/kit.dart';
import '../plan_screen.dart';

const _presets = [15, 25, 45, 60];
const _weekday = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];

/// Pomodoro taymeri.
///
/// Taymer TELEFONDA ishlaydi, server faqat tugagan seansni oladi. Qolgan
/// vaqt aniq tugash vaqtidan (`_endsAt`) hisoblanadi, tiklarni sanab emas —
/// ilova fonga o'tganda `Timer` sekinlashadi va sanoq orqada qolardi.
class FocusTab extends StatefulWidget {
  const FocusTab({super.key, required this.app});
  final AppState app;

  @override
  State<FocusTab> createState() => _FocusTabState();
}

class _FocusTabState extends State<FocusTab> with WidgetsBindingObserver {
  FocusDay? _day;
  bool _loading = true;
  String? _error;

  int _planned = 25;
  String _kind = 'study';
  int _left = 25 * 60;
  DateTime? _endsAt;
  Timer? _timer;
  bool _saving = false;

  bool get _running => _endsAt != null;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load();
  }

  @override
  void dispose() {
    _timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Ilova fondan qaytganda qolgan vaqtni qayta hisoblaymiz.
    if (state == AppLifecycleState.resumed) _tick();
  }

  Future<void> _load() async {
    setState(() {
      _loading = _day == null;
      _error = null;
    });
    try {
      final d = await widget.app.api.focusDay();
      if (!mounted) return;
      setState(() {
        _day = d;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  void _tick() {
    final end = _endsAt;
    if (end == null) return;
    final remaining = end.difference(DateTime.now()).inSeconds;
    if (remaining <= 0) {
      _finish(_planned);
    } else {
      setState(() => _left = remaining);
    }
  }

  void _start() {
    setState(() => _endsAt = DateTime.now().add(Duration(seconds: _left)));
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(milliseconds: 500), (_) => _tick());
    HapticFeedback.mediumImpact();
  }

  void _pause() {
    _timer?.cancel();
    setState(() => _endsAt = null);
  }

  void _reset() {
    _timer?.cancel();
    setState(() {
      _endsAt = null;
      _left = _planned * 60;
    });
  }

  /// Muddatidan oldin tugatish — HAQIQATAN o'tgan vaqt yoziladi.
  void _stopEarly() {
    final spent = ((_planned * 60 - _left) / 60).round();
    if (spent >= 1) {
      _finish(spent);
    } else {
      _reset();
    }
  }

  Future<void> _finish(int minutes) async {
    _timer?.cancel();
    setState(() {
      _endsAt = null;
      _left = _planned * 60;
    });
    if (minutes < 1 || _saving) return;

    setState(() => _saving = true);
    HapticFeedback.heavyImpact();
    try {
      await widget.app.api.logFocus(kind: _kind, minutes: minutes);
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString())));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  String get _mmss {
    final m = (_left ~/ 60).toString().padLeft(2, '0');
    final s = (_left % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final day = _day;
    final ratio = _planned > 0 ? 1 - _left / (_planned * 60) : 0.0;
    final maxWeek = (day?.week.isEmpty ?? true)
        ? 1
        : day!.week.map((w) => w.minutes).reduce((a, b) => a > b ? a : b).clamp(1, 100000);

    return PlanSection(
      loading: _loading,
      error: _error,
      onRetry: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 120),
        children: [
          UnumCard(
            child: Column(
              children: [
                SizedBox(
                  width: 190,
                  height: 190,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      SizedBox.expand(
                        child: CircularProgressIndicator(
                          value: ratio.clamp(0.0, 1.0),
                          strokeWidth: 6,
                          strokeCap: StrokeCap.round,
                          backgroundColor: U.surfaceAlt,
                          valueColor: const AlwaysStoppedAnimation(U.green),
                        ),
                      ),
                      Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(_mmss,
                              style: const TextStyle(
                                  fontSize: 38,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                  fontFeatures: [FontFeature.tabularFigures()])),
                          const SizedBox(height: 2),
                          Text(focusKinds[_kind] ?? '',
                              style: const TextStyle(fontSize: 12, color: U.textDim)),
                        ],
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    for (final m in _presets)
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        child: GestureDetector(
                          onTap: _running
                              ? null
                              : () => setState(() {
                                    _planned = m;
                                    _left = m * 60;
                                  }),
                          child: Opacity(
                            opacity: _running ? 0.4 : 1,
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 14, vertical: 9),
                              decoration: BoxDecoration(
                                color: _planned == m ? U.green : U.surfaceAlt,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: U.border),
                              ),
                              child: Text('$m',
                                  style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w500,
                                      color: _planned == m ? U.greenInk : U.textMuted)),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),

                const SizedBox(height: 10),
                Wrap(
                  alignment: WrapAlignment.center,
                  spacing: 6,
                  children: [
                    for (final e in focusKinds.entries)
                      GestureDetector(
                        onTap: _running ? null : () => setState(() => _kind = e.key),
                        child: Opacity(
                          opacity: _running ? 0.4 : 1,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 6),
                            decoration: BoxDecoration(
                              color: _kind == e.key
                                  ? U.green.withValues(alpha: 0.18)
                                  : Colors.transparent,
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(e.value,
                                style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w500,
                                    color: _kind == e.key ? U.greenBright : U.textDim)),
                          ),
                        ),
                      ),
                  ],
                ),

                const SizedBox(height: 18),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    GestureDetector(
                      onTap: _saving ? null : (_running ? _pause : _start),
                      child: Container(
                        width: 58, height: 58,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: _running ? U.surfaceAlt : U.green,
                        ),
                        child: _saving
                            ? const Padding(
                                padding: EdgeInsets.all(18),
                                child: CircularProgressIndicator(
                                    strokeWidth: 2.4, color: U.greenInk),
                              )
                            : Icon(_running ? Icons.pause : Icons.play_arrow,
                                size: 26,
                                color: _running ? Colors.white : U.greenInk),
                      ),
                    ),
                    if (_left < _planned * 60) ...[
                      const SizedBox(width: 12),
                      GestureDetector(
                        onTap: _reset,
                        child: Container(
                          width: 44, height: 44,
                          decoration: const BoxDecoration(
                              shape: BoxShape.circle, color: U.surfaceAlt),
                          child: const Icon(Icons.refresh, size: 18, color: U.textMuted),
                        ),
                      ),
                      const SizedBox(width: 10),
                      GestureDetector(
                        onTap: _stopEarly,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 11),
                          decoration: BoxDecoration(
                            color: U.surfaceAlt,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: const Text('Tugatish',
                              style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w500,
                                  color: U.greenBright)),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),

          if (day != null) ...[
            const SizedBox(height: 12),
            UnumCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Bugun',
                          style: TextStyle(fontSize: 13, color: U.textMuted)),
                      Text('${day.minutes} / ${day.target} daq',
                          style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                              color: Colors.white)),
                    ],
                  ),
                  const SizedBox(height: 10),
                  UnumProgressBar(percent: day.percent, color: U.green),
                  if (day.byKind.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 12,
                      children: [
                        for (final k in day.byKind)
                          Text('${k.label} ${k.minutes} daq',
                              style: const TextStyle(fontSize: 11.5, color: U.textDim)),
                      ],
                    ),
                  ],
                ],
              ),
            ),

            const SizedBox(height: 12),
            UnumCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Oxirgi 7 kun',
                      style: TextStyle(fontSize: 13, color: U.textMuted)),
                  const SizedBox(height: 12),
                  SizedBox(
                    height: 64,
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        for (final w in day.week)
                          Expanded(
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 3),
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.end,
                                children: [
                                  Container(
                                    height: (w.minutes / maxWeek * 44).clamp(2, 44),
                                    decoration: BoxDecoration(
                                      color: U.green.withValues(
                                          alpha: w.minutes > 0 ? 1 : 0.15),
                                      borderRadius: BorderRadius.circular(3),
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    _weekday[DateTime.parse(w.date).weekday % 7],
                                    style: const TextStyle(
                                        fontSize: 10, color: U.textFaint),
                                  ),
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

            if (day.sessions.isNotEmpty) ...[
              const SizedBox(height: 12),
              UnumCard(
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    for (final s in day.sessions)
                      Container(
                        decoration: const BoxDecoration(
                          border: Border(bottom: BorderSide(color: U.border)),
                        ),
                        padding: const EdgeInsets.fromLTRB(14, 11, 8, 11),
                        child: Row(
                          children: [
                            Text('${s.minutes} daq',
                                style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                    color: Colors.white)),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                s.note.isEmpty ? s.kindLabel : '${s.kindLabel} · ${s.note}',
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontSize: 13, color: U.textMuted),
                              ),
                            ),
                            IconButton(
                              onPressed: () async {
                                await widget.app.api.deleteFocus(s.id);
                                await _load();
                              },
                              icon: const Icon(Icons.close, size: 16, color: U.textFaint),
                              tooltip: "O'chirish",
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ],
        ],
      ),
    );
  }
}
