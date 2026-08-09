import 'package:flutter/material.dart';

import '../tokens.dart';

/// Ekran tepasidagi sarlavha qatori.
class UnumTopBar extends StatelessWidget {
  const UnumTopBar({
    super.key,
    required this.title,
    this.subtitle,
    this.chevron = false,
    this.trailing,
    this.titleIcon,
  });

  final String title;
  final String? subtitle;

  /// Sarlavha yonidagi pastga qaragan strelka
  final bool chevron;
  final Widget? trailing;
  final IconData? titleIcon;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 8, 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        title,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 26,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                          letterSpacing: -0.6,
                          height: 1.1,
                        ),
                      ),
                    ),
                    if (titleIcon != null)
                      Padding(
                        padding: const EdgeInsets.only(left: 6),
                        child: Icon(titleIcon, size: 17, color: U.greenBright),
                      ),
                    if (chevron)
                      const Padding(
                        padding: EdgeInsets.only(left: 4),
                        child: Icon(Icons.keyboard_arrow_down, size: 20, color: U.textMuted),
                      ),
                  ],
                ),
                if (subtitle != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text(
                      subtitle!,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12.5, color: U.textMuted),
                    ),
                  ),
              ],
            ),
          ),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}

/// Tepa o'ngdagi dumaloq ikonka tugmasi (qo'ng'iroq, kalendar, sozlama)
class TopBarAction extends StatelessWidget {
  const TopBarAction({
    super.key,
    required this.icon,
    required this.tooltip,
    this.onPressed,
    this.color = Colors.white,
    this.dot = false,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback? onPressed;
  final Color color;

  /// O'ng yuqorida yashil nuqta (o'qilmagan bildirishnoma)
  final bool dot;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        IconButton(
          onPressed: onPressed,
          tooltip: tooltip,
          icon: Icon(icon, size: 21, color: color),
        ),
        if (dot)
          Positioned(
            right: 8,
            top: 8,
            child: Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                color: U.green,
                shape: BoxShape.circle,
                border: Border.all(color: U.bg, width: 2),
              ),
            ),
          ),
      ],
    );
  }
}
