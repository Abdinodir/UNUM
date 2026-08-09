import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../tokens.dart';

/// Asosiy karta — barcha ekranlarda bir xil radius, fon va chegara.
class UnumCard extends StatelessWidget {
  const UnumCard({
    super.key,
    required this.child,
    this.onTap,
    this.padding = const EdgeInsets.all(16),
  });

  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    final card = Container(
      decoration: BoxDecoration(
        color: U.surface,
        borderRadius: BorderRadius.circular(U.rCard),
        border: Border.all(color: U.border),
      ),
      padding: padding,
      child: child,
    );

    if (onTap == null) return card;
    return InkWell(
      onTap: () {
        HapticFeedback.selectionClick();
        onTap!();
      },
      borderRadius: BorderRadius.circular(U.rCard),
      child: card,
    );
  }
}

/// Bo'lim sarlavhasi — o'ngda ixtiyoriy "Barchasini ko'rish" havolasi
class SectionHeader extends StatelessWidget {
  const SectionHeader({super.key, required this.title, this.actionLabel, this.onAction});

  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: [
          Expanded(
            child: Text(
              title,
              style: const TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w600,
                color: Colors.white,
                letterSpacing: -0.2,
              ),
            ),
          ),
          if (actionLabel != null)
            GestureDetector(
              onTap: onAction,
              child: Row(
                children: [
                  Text(
                    actionLabel!,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: U.green,
                    ),
                  ),
                  const Icon(Icons.chevron_right, size: 15, color: U.green),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

enum UnumButtonVariant { primary, secondary, ghost, danger, dangerSolid }

class UnumButton extends StatelessWidget {
  const UnumButton({
    super.key,
    required this.label,
    this.onPressed,
    this.variant = UnumButtonVariant.primary,
    this.icon,
    this.full = true,
  });

  final String label;
  final VoidCallback? onPressed;
  final UnumButtonVariant variant;
  final IconData? icon;
  final bool full;

  @override
  Widget build(BuildContext context) {
    final disabled = onPressed == null;

    late final Color bg;
    late final Color fg;
    Border? border;

    switch (variant) {
      case UnumButtonVariant.primary:
        bg = U.green;
        fg = U.greenInk;
      case UnumButtonVariant.secondary:
        bg = U.surfaceAlt;
        fg = Colors.white;
        border = Border.all(color: U.border);
      case UnumButtonVariant.ghost:
        bg = Colors.transparent;
        fg = U.textMuted;
      case UnumButtonVariant.danger:
        bg = U.danger.withValues(alpha: 0.12);
        fg = U.dangerText;
        border = Border.all(color: U.danger.withValues(alpha: 0.25));
      case UnumButtonVariant.dangerSolid:
        bg = const Color(0xFFB91C1C);
        fg = Colors.white;
    }

    return Opacity(
      opacity: disabled ? 0.4 : 1,
      child: Material(
        color: bg,
        borderRadius: BorderRadius.circular(U.rRow),
        child: InkWell(
          onTap: disabled
              ? null
              : () {
                  HapticFeedback.lightImpact();
                  onPressed!();
                },
          borderRadius: BorderRadius.circular(U.rRow),
          child: Container(
            height: 52,
            width: full ? double.infinity : null,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(U.rRow),
              border: border,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (icon != null) ...[
                  Icon(icon, size: 18, color: fg),
                  const SizedBox(width: 8),
                ],
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: fg,
                    letterSpacing: -0.2,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class UnumProgressBar extends StatelessWidget {
  const UnumProgressBar({
    super.key,
    required this.percent,
    required this.color,
    this.height = 4,
  });

  /// 0–100
  final num percent;
  final Color color;
  final double height;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(height),
      child: TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: percent.clamp(0, 100).toDouble()),
        duration: const Duration(milliseconds: 600),
        curve: Curves.easeOut,
        builder: (context, v, _) => LinearProgressIndicator(
          value: v / 100,
          minHeight: height,
          backgroundColor: const Color(0x12FFFFFF),
          valueColor: AlwaysStoppedAnimation(color),
        ),
      ),
    );
  }
}

/// Sozlama/menyu qatori. `value` o'ngdagi matn yoki widget (masalan Toggle).
class UnumListRow extends StatelessWidget {
  const UnumListRow({
    super.key,
    required this.title,
    this.icon,
    this.subtitle,
    this.value,
    this.onTap,
    this.chevron = true,
    this.danger = false,
    this.divider = false,
  });

  final String title;
  final Widget? icon;
  final String? subtitle;
  final Widget? value;
  final VoidCallback? onTap;
  final bool chevron;
  final bool danger;
  final bool divider;

  @override
  Widget build(BuildContext context) {
    final row = Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          if (icon != null) ...[icon!, const SizedBox(width: 12)],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                    color: danger ? U.dangerText : Colors.white,
                  ),
                ),
                if (subtitle != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      subtitle!,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12, color: U.textMuted),
                    ),
                  ),
              ],
            ),
          ),
          if (value != null) ...[const SizedBox(width: 8), value!],
          if (onTap != null && chevron)
            const Padding(
              padding: EdgeInsets.only(left: 4),
              child: Icon(Icons.chevron_right, size: 18, color: U.textFaint),
            ),
        ],
      ),
    );

    final content = onTap == null
        ? row
        : InkWell(
            onTap: () {
              HapticFeedback.selectionClick();
              onTap!();
            },
            child: row,
          );

    if (!divider) return content;
    return Column(
      children: [
        content,
        const Divider(height: 1, thickness: 1, color: Color(0x0DFFFFFF)),
      ],
    );
  }
}

/// Qatorlar guruhi — kartaga o'ralgan ro'yxat
class ListGroup extends StatelessWidget {
  const ListGroup({super.key, required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: U.surface,
        borderRadius: BorderRadius.circular(U.rCard),
        border: Border.all(color: U.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(children: children),
    );
  }
}

class UnumToggle extends StatelessWidget {
  const UnumToggle({super.key, required this.value, required this.onChanged});

  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Switch(
      value: value,
      onChanged: (v) {
        HapticFeedback.lightImpact();
        onChanged(v);
      },
      activeThumbColor: Colors.white,
      activeTrackColor: U.green,
      inactiveThumbColor: Colors.white,
      inactiveTrackColor: const Color(0x24FFFFFF),
      trackOutlineColor: WidgetStateProperty.all(Colors.transparent),
    );
  }
}

/// "Bu tibbiy maslahat emas" ogohlantirishi.
/// AI matn ko'rsatiladigan HAR BIR joyda majburiy.
class Disclaimer extends StatelessWidget {
  const Disclaimer({super.key, this.text});

  final String? text;

  static const _default =
      "Ushbu tavsiyalar AI tomonidan siz kiritgan ma'lumotlar asosida shakllantirilgan. "
      "Ular taxminiy bo'lib, tibbiy yoki professional maslahat o'rnini bosmaydi.";

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: U.danger.withValues(alpha: 0.09),
        borderRadius: BorderRadius.circular(U.rRow),
        border: Border.all(color: U.danger.withValues(alpha: 0.2)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.warning_amber_rounded, size: 16, color: U.dangerText),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text ?? _default,
              style: const TextStyle(
                fontSize: 11.5,
                height: 1.5,
                color: Color(0xFFE5A5A5),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
