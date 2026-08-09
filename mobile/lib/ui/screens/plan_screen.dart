import 'package:flutter/material.dart';


import '../../state/app_state.dart';
import '../tokens.dart';
import '../shell/top_bar.dart';
import '../widgets/kit.dart';
import '../widgets/segmented_control.dart';
import 'plan/day_tab.dart';
import 'plan/focus_tab.dart';
import 'plan/goals_tab.dart';
import 'plan/habits_tab.dart';

/// "+" menyusidan kelgan "yarat" so'rovi.
///
/// `section` MAJBURIY: barcha bo'limlar bitta notifier'ni tinglaydi, va
/// so'rovda bo'lim ko'rsatilmasa hammasi bir vaqtda o'z oynasini ochadi
/// (aynan shunday bo'lgan: "Vazifa" bosilganda "Yangi maqsad" chiqardi).
///
/// `seq` — ketma-ket bir xil so'rovlar ham xabar berishi uchun.
class CreateRequest {
  const CreateRequest(this.section, this.seq);
  final int section;
  final int seq;
}

/// "Reja" tabi — kunlik reja, odatlar, fokus va maqsadlar bir joyda.
///
/// Nega birga: vazifa odatga, odat maqsadga xizmat qiladi va ular orasida
/// o'tish tez-tez kerak. To'rttasi alohida tab bo'lsa pastdagi panel
/// yettitaga chiqib, markazdagi "+" uchun joy qolmasdi.
class PlanScreen extends StatefulWidget {
  const PlanScreen({
    super.key,
    required this.app,
    required this.openSection,
    required this.createRequest,
  });

  final AppState app;

  /// Tashqaridan bo'lim so'rovi (radial "+" menyusi shu orqali
  /// to'g'ridan-to'g'ri "Maqsad" ga olib keladi).
  ///
  /// `ValueNotifier` ishlatiladi, oddiy `int` emas: foydalanuvchi Maqsadga
  /// o'tib, keyin qo'lda Bugunga qaytsa va yana "+"dan Maqsad bossa,
  /// qiymat o'zgarmagani uchun hech narsa bo'lmasdi. Notifier esa har
  /// safar xabar beradi.
  final ValueNotifier<int> openSection;

  /// "+" menyusidan "yarat" so'rovi. Qiymat har safar o'zgaradi;
  /// bo'lim uni ko'rib o'z yaratish oynasini ochadi. Faqat bo'limga
  /// o'tish yetarli emas — foydalanuvchi darhol oyna kutadi.
  final ValueNotifier<CreateRequest?> createRequest;

  @override
  State<PlanScreen> createState() => _PlanScreenState();
}

class _PlanScreenState extends State<PlanScreen> {
  late int _section = widget.openSection.value;

  @override
  void initState() {
    super.initState();
    widget.openSection.addListener(_external);
  }

  @override
  void dispose() {
    widget.openSection.removeListener(_external);
    super.dispose();
  }

  void _external() {
    final v = widget.openSection.value;
    // `-1` — qobiq takroriy so'rovni bildirish uchun ishlatadigan
    // "reset" qiymati, haqiqiy bo'lim emas. Uni IndexedStack ga
    // uzatsak ilova qulaydi.
    if (v < 0 || v >= 4) return;
    if (mounted) setState(() => _section = v);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const UnumTopBar(title: 'Reja'),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          child: SegmentedControl<int>(
            value: _section,
            // Yorliqlar QISQA: to'rttasi 360px ekranga ham sig'ishi kerak.
            options: const [(0, 'Bugun'), (1, 'Odat'), (2, 'Fokus'), (3, 'Maqsad')],
            onChanged: (i) => setState(() => _section = i),
          ),
        ),
        Expanded(
          child: IndexedStack(
            index: _section,
            children: [
              DayTab(app: widget.app, createRequest: widget.createRequest),
              HabitsTab(app: widget.app, createRequest: widget.createRequest),
              FocusTab(app: widget.app),
              GoalsTab(app: widget.app, createRequest: widget.createRequest),
            ],
          ),
        ),
      ],
    );
  }
}

// ══════════════════ Bo'limlar uchun umumiy qism ══════════════════

/// Yuklanish / xato / bo'sh holatni bir joyda hal qiladigan qobiq.
///
/// Har bo'limda alohida yozilsa, ular albatta bir-biridan farq qila
/// boshlaydi — bittasida spinner markazda, boshqasida chapda bo'lib qoladi.
class PlanSection extends StatelessWidget {
  const PlanSection({
    super.key,
    required this.loading,
    required this.error,
    required this.onRetry,
    required this.child,
  });

  final bool loading;
  final String? error;
  final VoidCallback onRetry;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Center(
        child: SizedBox(
          width: 22, height: 22,
          child: CircularProgressIndicator(strokeWidth: 2.4, color: U.green),
        ),
      );
    }

    if (error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                error!,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 13.5, color: U.dangerText),
              ),
              const SizedBox(height: 14),
              UnumButton(
                label: 'Qayta urinish',
                variant: UnumButtonVariant.secondary,
                onPressed: onRetry,
              ),
            ],
          ),
        ),
      );
    }

    return RefreshIndicator(
      color: U.green,
      backgroundColor: U.surface,
      onRefresh: () async => onRetry(),
      child: child,
    );
  }
}

/// Bepul rejadagi chegara banneri.
class LimitBanner extends StatelessWidget {
  const LimitBanner({super.key, required this.limit, required this.what});

  final int limit;
  final String what;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 4),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: U.green.withValues(alpha: 0.06),
        border: Border.all(color: U.green.withValues(alpha: 0.25)),
        borderRadius: BorderRadius.circular(U.rCard),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.workspace_premium, size: 18, color: U.green),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "Bepul rejada $limit ta $what",
                  style: const TextStyle(
                      fontSize: 13.5, fontWeight: FontWeight.w600, color: Colors.white),
                ),
                const SizedBox(height: 2),
                Text(
                  // ⚠️ Play siyosati: ilova ichida narx ham, sotib olish
                  // tugmasi ham BO'LMASLIGI kerak (tashqi to'lov taqiqlangan).
                  'Cheksiz qilish uchun veb-sahifada obuna rasmiylashtiring, '
                  'yoki keraksizini arxivlang.',
                  style: TextStyle(fontSize: 12, height: 1.4, color: U.textMuted),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Bo'sh holat — barcha bo'limlarda bir xil ko'rinish.
class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    this.action,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 48),
      child: Column(
        children: [
          Icon(icon, size: 38, color: const Color(0xFF2E3735)),
          const SizedBox(height: 12),
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(
                fontSize: 16, fontWeight: FontWeight.w600, color: Colors.white),
          ),
          const SizedBox(height: 6),
          Text(
            subtitle,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 13, height: 1.45, color: U.textDim),
          ),
          if (action != null) ...[const SizedBox(height: 18), action!],
        ],
      ),
    );
  }
}
