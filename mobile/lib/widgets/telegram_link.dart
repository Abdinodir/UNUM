import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../config.dart';
import '../state/app_state.dart';
import '../theme.dart';

const _tgBlue = Color(0xFF229ED9);

/// Telegram botga ulanish.
///
/// Foydalanuvchi hech qanday kod ko'rmaydi va yozmaydi: kod deep-link ichiga
/// qo'shiladi (`t.me/bot?start=KOD`) va bitta tugma bosilganda Telegram ochilib,
/// ulanish o'z-o'zidan bajariladi.
///
/// Kod baribir olinadi va zaxira sifatida "qo'lda kiritish" ostida turadi —
/// Telegram o'rnatilmagan yoki deep-link ochilmagan holat uchun. Lekin u
/// asosiy oqimga xalaqit bermaydi.
class TelegramLinkSheet extends StatefulWidget {
  const TelegramLinkSheet({super.key});

  static Future<void> open(BuildContext context) => showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (_) => const TelegramLinkSheet(),
      );

  @override
  State<TelegramLinkSheet> createState() => _TelegramLinkSheetState();
}

class _TelegramLinkSheetState extends State<TelegramLinkSheet> {
  bool _loading = true;
  bool _linked = false;
  bool _opening = false;
  bool _showManual = false;
  String _code = '';
  String _deepLink = '';
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final app = context.read<AppState>();
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final linked = await app.api.telegramLinked();
      if (!mounted) return;
      if (linked) {
        setState(() {
          _linked = true;
          _loading = false;
        });
        return;
      }
      final r = await app.api.telegramCode();
      if (!mounted) return;
      setState(() {
        _linked = false;
        _code = r.code;
        _deepLink = r.deepLink.isNotEmpty
            ? r.deepLink
            : '${AppConfig.botLink}?start=${r.code}';
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('ApiException: ', '');
        _loading = false;
      });
    }
  }

  Future<void> _openTelegram() async {
    setState(() => _opening = true);
    final app = context.read<AppState>();
    try {
      final ok = await launchUrl(
        Uri.parse(_deepLink),
        mode: LaunchMode.externalApplication,
      );
      if (!ok) throw Exception('ochilmadi');
      // Foydalanuvchi qaytganda holatni tekshirish oson bo'lsin.
      if (mounted) setState(() => _showManual = true);
    } catch (_) {
      if (!mounted) return;
      setState(() => _showManual = true);
      app.notify(
          'Telegram ochilmadi — pastdagi kodni qo\'lda kiriting',
          type: 'warning');
    } finally {
      if (mounted) setState(() => _opening = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(22, 12, 22, 26),
      decoration: const BoxDecoration(
        color: AppColors.slate100,
        borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 44,
              height: 5,
              decoration: BoxDecoration(
                  color: AppColors.slate200,
                  borderRadius: BorderRadius.circular(3)),
            ),
          ),
          const SizedBox(height: 22),
          if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 46),
              child: Center(
                  child: CircularProgressIndicator(color: _tgBlue)),
            )
          else if (_error != null)
            _errorBox()
          else if (_linked)
            _linkedBox()
          else
            _connectBox(),
        ],
      ),
    );
  }

  // ─────────────────────────── ulanmagan ───────────────────────────
  Widget _connectBox() => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 68,
              height: 68,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: const LinearGradient(
                  colors: [Color(0xFF37AEE2), _tgBlue],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                boxShadow: [
                  BoxShadow(
                      color: _tgBlue.withValues(alpha: 0.32),
                      blurRadius: 20,
                      offset: const Offset(0, 8)),
                ],
              ),
              child: const Icon(Icons.send_rounded, color: Colors.white, size: 32),
            ),
          ),
          const SizedBox(height: 18),
          const Text('Telegram bilan bog\'lash',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 21, fontWeight: FontWeight.w900)),
          const SizedBox(height: 10),
          const Text(
            'Ovozingiz bilan taom kiriting — «Tushlikka 35 minga bir porsiya '
            'osh yedim» deb ayting, qolganini AI hisoblaydi.\n\n'
            'Hammasi shu hisobga tushadi.',
            textAlign: TextAlign.center,
            style:
                TextStyle(fontSize: 13.5, height: 1.55, color: AppColors.slate600),
          ),
          const SizedBox(height: 22),
          SizedBox(
            height: 56,
            child: FilledButton.icon(
              onPressed: _opening ? null : _openTelegram,
              style: FilledButton.styleFrom(
                backgroundColor: _tgBlue,
                disabledBackgroundColor: _tgBlue.withValues(alpha: 0.6),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16)),
              ),
              icon: _opening
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                          strokeWidth: 2.2, color: Colors.white))
                  : const Icon(Icons.send_rounded, size: 20),
              label: Text(
                  _opening ? 'Ochilmoqda…' : 'Telegramda ochish',
                  style: const TextStyle(
                      fontSize: 15.5, fontWeight: FontWeight.w900)),
            ),
          ),
          const SizedBox(height: 12),
          if (_showManual) ...[
            OutlinedButton.icon(
              onPressed: _load,
              icon: const Icon(Icons.refresh_rounded, size: 17),
              label: const Text('Bog\'landimi — tekshirish'),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.sky,
                minimumSize: const Size.fromHeight(46),
                side: BorderSide(color: AppColors.sky.withValues(alpha: 0.35)),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
              ),
            ),
            const SizedBox(height: 14),
          ],
          // Zaxira yo'l — asosiy oqimga xalaqit bermasin.
          Center(
            child: TextButton(
              onPressed: () => setState(() => _showManual = !_showManual),
              child: Text(
                _showManual ? 'Yashirish' : 'Telegram ochilmadimi?',
                style: const TextStyle(
                    fontSize: 12.5, color: AppColors.slate400),
              ),
            ),
          ),
          if (_showManual) _manualCode(),
        ],
      );

  Widget _manualCode() => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.slate50,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          children: [
            const Text(
              'Telegramda @unumlife_bot ni toping va shu kodni yuboring:',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12.5, color: AppColors.slate500),
            ),
            const SizedBox(height: 10),
            SelectableText(
              _code.split('').join(' '),
              textAlign: TextAlign.center,
              style: const TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 2,
                  color: AppColors.slate700),
            ),
            const SizedBox(height: 4),
            const Text('10 daqiqa amal qiladi',
                style: TextStyle(fontSize: 11, color: AppColors.slate400)),
          ],
        ),
      );

  // ─────────────────────────── ulangan ───────────────────────────
  Widget _linkedBox() => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: AppColors.emerald.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.check_rounded,
                  color: AppColors.emerald, size: 34),
            ),
          ),
          const SizedBox(height: 16),
          const Text('Telegram bog\'langan',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
          const SizedBox(height: 8),
          const Text(
            'Endi botga ovozli xabar yuborsangiz, taom shu hisobga tushadi.',
            textAlign: TextAlign.center,
            style: TextStyle(
                fontSize: 13.5, height: 1.5, color: AppColors.slate600),
          ),
          const SizedBox(height: 20),
          FilledButton.icon(
            onPressed: () => launchUrl(Uri.parse(AppConfig.botLink),
                mode: LaunchMode.externalApplication),
            style: FilledButton.styleFrom(
              backgroundColor: _tgBlue,
              minimumSize: const Size.fromHeight(50),
              shape:
                  RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
            ),
            icon: const Icon(Icons.send_rounded, size: 19),
            label: const Text('Botni ochish',
                style: TextStyle(fontWeight: FontWeight.w800)),
          ),
          const SizedBox(height: 6),
          TextButton(
            onPressed: () async {
              final app = context.read<AppState>();
              try {
                await app.api.telegramUnlink();
                app.notify('Telegram uzildi');
                if (mounted) _load();
              } catch (_) {
                app.notify('Uzib bo\'lmadi', type: 'warning');
              }
            },
            child: const Text('Bog\'lanishni uzish',
                style: TextStyle(color: AppColors.slate400, fontSize: 13)),
          ),
        ],
      );

  Widget _errorBox() => Column(
        children: [
          const Icon(Icons.cloud_off_rounded,
              size: 40, color: AppColors.slate300),
          const SizedBox(height: 14),
          Text(_error!,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 13, color: AppColors.slate600)),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: _load,
            icon: const Icon(Icons.refresh_rounded),
            label: const Text('Qayta urinish'),
          ),
        ],
      );
}
