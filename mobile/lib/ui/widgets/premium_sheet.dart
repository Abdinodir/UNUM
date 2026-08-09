import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../config.dart';

import '../tokens.dart';
import 'kit.dart';

/// Qulflangan funksiya bosilganda chiqadigan taklif.
///
/// NIMA UCHUN KERAK. Ilgari premium funksiya bosilganda hech narsa
/// bo'lmasdi yoki quruq xato matni chiqardi. Foydalanuvchi nima
/// yo'qotayotganini ham, uni qanday ochishni ham bilmasdi — bu ham yomon
/// tajriba, ham sotuv imkoniyatini yo'qotish.
///
/// ⚠️ BU YERDA NARX HAM, "SOTIB OLISH" TUGMASI HAM YO'Q.
/// Google Play ilova ichidagi raqamli obunani tashqi to'lov tizimi bilan
/// sotishni taqiqlaydi (Play Billing majburiy). Shuning uchun funksiya
/// nima berishi tushuntiriladi va obuna hisobga bog'langach ilovada
/// O'ZI ochilishi aytiladi.
class PremiumSheet extends StatelessWidget {
  const PremiumSheet({super.key, required this.feature, required this.benefits});

  /// Qaysi funksiya qulflangan — sarlavhada aytiladi.
  final String feature;

  /// Shu funksiya nima berishi (2–4 qator).
  final List<String> benefits;

  static Future<void> show(
    BuildContext context, {
    required String feature,
    required List<String> benefits,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => PremiumSheet(feature: feature, benefits: benefits),
    );
  }

  /// Xatoni ko'rib, premium kerakligini aniqlaydi.
  static bool isPremiumError(Object e) => e.toString().contains('premium_required');

  /// Katalogdagi funksiya bo'yicha taklifni ochadi.
  static Future<void> forFeature(BuildContext context, PremiumFeature f) =>
      show(context, feature: f.title, benefits: f.benefits);

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: U.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        border: Border(top: BorderSide(color: U.border)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 10, 20, 20),
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
                margin: const EdgeInsets.only(bottom: 18),
                decoration: BoxDecoration(
                  color: U.borderStrong,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
            ),

            Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: U.green.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.workspace_premium, size: 22, color: U.green),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(feature,
                          style: const TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w600,
                              color: Colors.white)),
                      const SizedBox(height: 2),
                      const Text('Premium funksiyasi',
                          style: TextStyle(fontSize: 12.5, color: U.greenBright)),
                    ],
                  ),
                ),
              ],
            ),

            const SizedBox(height: 16),
            for (final b in benefits)
              Padding(
                padding: const EdgeInsets.only(bottom: 9),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Padding(
                      padding: EdgeInsets.only(top: 2),
                      child: Icon(Icons.check, size: 16, color: U.green),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(b,
                          style: const TextStyle(
                              fontSize: 13.5, height: 1.4, color: U.textSoft)),
                    ),
                  ],
                ),
              ),

            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(13),
              decoration: BoxDecoration(
                color: U.surfaceAlt,
                borderRadius: BorderRadius.circular(U.rRow),
              ),
              child: const Text(
                "Obuna hisobingizga bog'lanadi va ilovada avtomatik ochiladi — "
                "qayta kirish shart emas.",
                style: TextStyle(fontSize: 12.5, height: 1.5, color: U.textMuted),
              ),
            ),

            const SizedBox(height: 14),
            // ⚠️ Narx BU YERDA ko'rsatilmaydi va to'lov ilova ichida
            // amalga oshmaydi — foydalanuvchi Telegram botga o'tadi va
            // obunani o'sha yerda rasmiylashtiradi.
            UnumButton(
              label: 'Telegram botda ochish',
              icon: Icons.send_rounded,
              onPressed: () async {
                Navigator.pop(context);
                await launchUrl(
                  Uri.parse('${AppConfig.botLink}?start=premium'),
                  mode: LaunchMode.externalApplication,
                );
              },
            ),
            const SizedBox(height: 8),
            UnumButton(
              label: 'Keyinroq',
              variant: UnumButtonVariant.ghost,
              onPressed: () => Navigator.pop(context),
            ),
          ],
        ),
      ),
    );
  }
}


/// Premium funksiyalar katalogi.
///
/// Matnlar BIR JOYDA turadi: har ekranda alohida yozilsa, ular tez orada
/// bir-biridan farq qila boshlaydi va ba'zilari umuman yangilanmay qoladi.
/// Har bir tavsif "nima beradi" ni aytadi — "nima yo'q" ni emas.
enum PremiumFeature {
  lifeScore,
  weeklyReview,
  prediction,
  goalBreakdown,
  goalCoach,
  unlimitedGoals,
  unlimitedHabits,
}

extension PremiumFeatureCopy on PremiumFeature {
  String get title => switch (this) {
        PremiumFeature.lifeScore => 'Life Score',
        PremiumFeature.weeklyReview => 'Haftalik hisobot',
        PremiumFeature.prediction => 'Maqsad prognozi',
        PremiumFeature.goalBreakdown => "AI bilan bosqichlarga bo'lish",
        PremiumFeature.goalCoach => 'AI Goal Coach',
        PremiumFeature.unlimitedGoals => 'Cheksiz maqsad',
        PremiumFeature.unlimitedHabits => 'Cheksiz odat',
      };

  List<String> get benefits => switch (this) {
        PremiumFeature.lifeScore => const [
            'Reja, odat, fokus, uyqu va ovqatlanish — hammasi bitta ballda',
            "Kun oxirida aniq bilasiz: bugun oldinga siljidingizmi yoki yo'q",
            "Eng ko'p ball qayerdan yo'qolayotganini ko'rsatadi",
            'Yozmagan narsangiz ballni pasaytirmaydi',
          ],
        PremiumFeature.weeklyReview => const [
            'Har hafta: nima bajarildi, qayerda cho\'kdingiz',
            "O'tgan hafta bilan solishtiradi — o'syapsizmi yoki tushyapsizmi",
            'Eng yaxshi va eng past kuningizni ko\'rsatadi',
            'AI keyingi hafta uchun 2–3 ta aniq qadam beradi',
          ],
        PremiumFeature.prediction => const [
            'Hozirgi temp bilan maqsadga qachon yetishingizni hisoblaydi',
            'Kechikayotgan bo\'lsangiz oldindan ogohlantiradi',
            "Kuniga qancha kerakligini va siz qancha qilayotganingizni aytadi",
          ],
        PremiumFeature.goalBreakdown => const [
            "Maqsadingizni 4–8 ta bajariladigan bosqichga bo'lib beradi",
            "Har bosqichga muddat qo'yadi va deadline ichiga joylashtiradi",
            'Nimadan boshlashni aytadi — o\'zingiz o\'ylab o\'tirmaysiz',
          ],
        PremiumFeature.goalCoach => const [
            'Savolingizga sizning HAQIQIY raqamlaringizga qarab javob beradi',
            'Qaysi maqsad orqada qolayotganini biladi',
            "Kunlik AI so'rovlari 12 tadan 120 taga chiqadi",
          ],
        PremiumFeature.unlimitedGoals => const [
            'Maqsad soni cheklanmaydi',
            'Har biriga AI bosqich, prognoz va hisobot',
          ],
        PremiumFeature.unlimitedHabits => const [
            'Odat soni cheklanmaydi',
            'Har biri Life Score va haftalik hisobotga kiradi',
          ],
      };
}
