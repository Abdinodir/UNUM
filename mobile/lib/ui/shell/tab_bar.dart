import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../tokens.dart';

enum UnumTab { home, plan, analysis, coach, profile }

const _tabs = <(UnumTab, String, IconData)>[
  (UnumTab.home, 'Asosiy', Icons.home_outlined),
  (UnumTab.plan, 'Reja', Icons.checklist_rounded),
  (UnumTab.analysis, 'Tahlil', Icons.bar_chart_rounded),
  (UnumTab.coach, 'AI Coach', Icons.smart_toy_outlined),
  (UnumTab.profile, 'Profil', Icons.person_outline),
];

/// Suzuvchi shisha tab bar. Markazda ko'tarilgan yashil "+" —
/// u tab EMAS, radial menyuni ochadi.
class UnumTabBar extends StatelessWidget {
  const UnumTabBar({
    super.key,
    required this.active,
    required this.onChanged,
    required this.addOpen,
    required this.onToggleAdd,
  });

  final UnumTab active;
  final ValueChanged<UnumTab> onChanged;
  final bool addOpen;
  final VoidCallback onToggleAdd;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
        // Balandlik = tugma (56) + bo'shliq (8) + bar (66).
        //
        // ⚠️ TUGMA CHEGARA ICHIDA TURISHI SHART. Flutter'da `Clip.none`
        // widgetni ota chegarasidan tashqarida CHIZADI, lekin BOSISHNI
        // qabul qilmaydi — hit-test baribir ota o'lchamiga cheklanadi.
        // Shu sabab `Positioned(top: -64)` da "+" ko'rinib turib bosilmasdi.
        child: SizedBox(
          height: 56 + 8 + 66,
          child: Stack(
            alignment: Alignment.bottomCenter,
            children: [
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                height: 66,
                child: Container(
                decoration: BoxDecoration(
                  color: const Color(0xEB141818),
                  borderRadius: BorderRadius.circular(26),
                  border: Border.all(color: U.borderStrong),
                  boxShadow: const [
                    BoxShadow(color: Color(0x99000000), blurRadius: 32, offset: Offset(0, 8)),
                  ],
                ),
                // Tablar RO'YXATDAN chiziladi, indeks bo'yicha QATTIQ
                // KODDA emas — aks holda ro'yxatga yangi tab qo'shilganda
                // u jimgina ko'rinmay qoladi (aynan shunday bo'lgan:
                // beshinchi "Profil" umuman render qilinmagan edi).
                //
                // Markazda BO'SHLIQ YO'Q: tab soni toq bo'lganda bo'shliq
                // markazga to'g'ri kelmaydi va "+" qo'shni tabni bosib
                // qolardi. Endi "+" bar ustida alohida turadi.
                  child: Row(children: [for (final t in _tabs) _tab(t)]),
                ),
              ),

              // "+" — bar ustida, lekin chegara ICHIDA (0..56), shuning
              // uchun ham ko'rinadi, ham bosiladi.
              Positioned(
                top: 0,
                child: GestureDetector(
                  onTap: () {
                    HapticFeedback.mediumImpact();
                    onToggleAdd();
                  },
                  child: AnimatedRotation(
                    turns: addOpen ? 0.25 : 0,
                    duration: const Duration(milliseconds: 220),
                    curve: Curves.easeOut,
                    child: Container(
                      width: 56,
                      height: 56,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: addOpen ? Colors.transparent : U.green,
                        border: addOpen ? Border.all(color: U.green, width: 2) : null,
                        boxShadow: addOpen
                            ? null
                            : [
                                BoxShadow(
                                  color: U.green.withValues(alpha: 0.35),
                                  blurRadius: 20,
                                  offset: const Offset(0, 6),
                                ),
                              ],
                      ),
                      child: Icon(
                        addOpen ? Icons.close : Icons.add,
                        size: 28,
                        color: addOpen ? U.green : U.greenInk,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _tab((UnumTab, String, IconData) t) {
    final (key, label, icon) = t;
    final isActive = active == key && !addOpen;

    return Expanded(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () {
          HapticFeedback.selectionClick();
          onChanged(key);
        },
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 21, color: isActive ? U.green : const Color(0xFF7B8481)),
            const SizedBox(height: 3),
            Text(
              label,
              style: TextStyle(
                fontSize: 10.5,
                fontWeight: isActive ? FontWeight.w600 : FontWeight.w500,
                color: isActive ? U.green : const Color(0xFF7B8481),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
