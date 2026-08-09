import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../tokens.dart';

/// Bugun / Hafta / Oy / Yil ko'rinishidagi segment.
/// Tanlangan element ostidagi yashil "pill" siljib boradi.
class SegmentedControl<T> extends StatelessWidget {
  const SegmentedControl({
    super.key,
    required this.value,
    required this.options,
    required this.onChanged,
  });

  final T value;
  final List<(T, String)> options;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: U.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: U.border),
      ),
      child: Row(
        children: [
          for (final (key, label) in options)
            Expanded(
              child: GestureDetector(
                onTap: () {
                  if (key == value) return;
                  HapticFeedback.selectionClick();
                  onChanged(key);
                },
                behavior: HitTestBehavior.opaque,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  curve: Curves.easeOut,
                  height: 36,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: key == value ? U.green.withValues(alpha: 0.15) : Colors.transparent,
                    borderRadius: BorderRadius.circular(11),
                    border: Border.all(
                      color: key == value
                          ? U.green.withValues(alpha: 0.3)
                          : Colors.transparent,
                    ),
                  ),
                  child: Text(
                    label,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: key == value ? U.greenBright : U.textMuted,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
