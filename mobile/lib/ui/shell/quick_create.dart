import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../tokens.dart';

/// Markazdagi "+" ochadigan tezkor yaratish menyusi.
///
/// Bu shunchaki "qo'shish" emas — UNUM'ning ASOSIY HARAKAT tugmasi.
/// Foydalanuvchi bosh ekranda turib "hozir 50 daqiqa ishlayman" desa,
/// bo'limlarni kezib yurmasdan darhol boshlashi kerak.
///
/// Ilgari bu yerda sog'liq metrikalari (ovqat/suv/qadam/uyqu/ekran) bo'lgan
/// radial menyu turardi. Mahsulot "personal OS" ga aylangach, tezkor
/// harakatlar ham o'zgardi: maqsad, vazifa, odat, fokus, kundalik.
enum QuickAction { goal, task, habit, focus, journal, meal, water }

class QuickCreateSheet extends StatelessWidget {
  const QuickCreateSheet({super.key, required this.onSelect});

  final ValueChanged<QuickAction> onSelect;

  static Future<void> open(
    BuildContext context,
    ValueChanged<QuickAction> onSelect,
  ) {
    return showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => QuickCreateSheet(onSelect: onSelect),
    );
  }

  static const _primary = <(QuickAction, String, String, IconData, Color)>[
    (QuickAction.goal, 'Maqsad', "Katta maqsad — AI bosqichlarga bo'lib beradi",
        Icons.adjust_rounded, Color(0xFF8B5CF6)),
    (QuickAction.task, 'Vazifa', 'Bugungi rejaga bitta ish',
        Icons.check_circle_outline, Color(0xFF22C55E)),
    (QuickAction.habit, 'Odat', "Takrorlanadigan odat — ketma-ketlik bilan",
        Icons.local_fire_department_outlined, Color(0xFFF59E0B)),
    (QuickAction.focus, 'Fokus seansi', 'Darhol boshlanadi — 25 / 45 / 60 daq',
        Icons.timer_outlined, Color(0xFF38BDF8)),
    (QuickAction.journal, 'Kundalik', "Bugungi holat yoki fikringiz",
        Icons.edit_note_rounded, Color(0xFFEC4899)),
  ];

  /// Sog'liq yozuvlari — ular ham tez-tez kerak, lekin ikkinchi darajali.
  static const _secondary = <(QuickAction, String, IconData, Color)>[
    (QuickAction.meal, 'Ovqat', Icons.restaurant, Color(0xFF22C55E)),
    (QuickAction.water, 'Suv', Icons.water_drop_outlined, Color(0xFF38BDF8)),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: U.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        border: Border(top: BorderSide(color: U.border)),
      ),
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(bottom: 14),
                decoration: BoxDecoration(
                  color: U.borderStrong,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
            ),
            const Padding(
              padding: EdgeInsets.only(left: 4, bottom: 10),
              child: Text(
                'Nima yaratamiz?',
                style: TextStyle(
                    fontSize: 17, fontWeight: FontWeight.w600, color: Colors.white),
              ),
            ),

            for (var i = 0; i < _primary.length; i++)
              _Row(
                data: _primary[i],
                first: i == 0,
                onTap: () {
                  HapticFeedback.lightImpact();
                  Navigator.pop(context);
                  onSelect(_primary[i].$1);
                },
              ),

            const Padding(
              padding: EdgeInsets.only(left: 4, top: 18, bottom: 8),
              child: Text(
                "Sog'liq",
                style: TextStyle(
                    fontSize: 12.5, fontWeight: FontWeight.w500, color: U.textMuted),
              ),
            ),
            Row(
              children: [
                for (final s in _secondary)
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(right: 10),
                      child: GestureDetector(
                        onTap: () {
                          HapticFeedback.lightImpact();
                          Navigator.pop(context);
                          onSelect(s.$1);
                        },
                        child: Container(
                          height: 56,
                          decoration: BoxDecoration(
                            color: U.surfaceAlt,
                            borderRadius: BorderRadius.circular(U.rRow),
                            border: Border.all(color: U.border),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(s.$3, size: 19, color: s.$4),
                              const SizedBox(width: 8),
                              Text(s.$2,
                                  style: const TextStyle(
                                      fontSize: 14.5,
                                      fontWeight: FontWeight.w500,
                                      color: Colors.white)),
                            ],
                          ),
                        ),
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

class _Row extends StatelessWidget {
  const _Row({required this.data, required this.first, required this.onTap});

  final (QuickAction, String, String, IconData, Color) data;
  final bool first;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final (_, title, subtitle, icon, color) = data;

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        decoration: BoxDecoration(
          border: first ? null : const Border(top: BorderSide(color: U.border)),
        ),
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, size: 21, color: color),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: const TextStyle(
                          fontSize: 15.5,
                          fontWeight: FontWeight.w600,
                          color: Colors.white)),
                  const SizedBox(height: 2),
                  Text(subtitle,
                      style: const TextStyle(
                          fontSize: 12, height: 1.35, color: U.textDim)),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, size: 18, color: U.textFaint),
          ],
        ),
      ),
    );
  }
}
