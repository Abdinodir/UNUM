import 'package:flutter/material.dart';

import '../../state/app_state.dart';
import '../tokens.dart';
import 'kit.dart';

/// Kundalik yozuvi.
///
/// ⚠️ BALLGA TA'SIR QILMAYDI. Yozgan-yozmagani uchun odam baholanmasligi
/// kerak: kundalik majburiyat emas, o'zi uchun joy. AI haftalik hisobotda
/// undan foydalanishi mumkin, lekin Life Score uni hisobga olmaydi.
class JournalSheet extends StatefulWidget {
  const JournalSheet({super.key, required this.app});

  final AppState app;

  static Future<void> open(BuildContext context, AppState app) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => JournalSheet(app: app),
    );
  }

  @override
  State<JournalSheet> createState() => _JournalSheetState();
}

class _JournalSheetState extends State<JournalSheet> {
  final _text = TextEditingController();
  int _mood = 3;
  bool _saving = false;

  static const _moods = ['😞', '🙁', '😐', '🙂', '😄'];

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final text = _text.text.trim();
    if (text.isEmpty || _saving) return;

    setState(() => _saving = true);
    final nav = Navigator.of(context);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await widget.app.api.create('journal', {
        'timestamp': DateTime.now().toIso8601String(),
        'text': text,
        'mood': _mood,
      });
      if (!mounted) return;
      nav.pop();
      messenger.showSnackBar(const SnackBar(content: Text('Kundalik saqlandi')));
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      messenger.showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: const BoxDecoration(
          color: U.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          border: Border(top: BorderSide(color: U.border)),
        ),
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 18),
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
                padding: EdgeInsets.only(left: 4, bottom: 12),
                child: Text('Bugun qanday o’tdi?',
                    style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w600,
                        color: Colors.white)),
              ),

              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  for (var i = 0; i < _moods.length; i++)
                    GestureDetector(
                      onTap: () => setState(() => _mood = i + 1),
                      child: Container(
                        width: 52,
                        height: 52,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: _mood == i + 1
                              ? U.green.withValues(alpha: 0.18)
                              : U.surfaceAlt,
                          borderRadius: BorderRadius.circular(14),
                          border: _mood == i + 1
                              ? Border.all(color: U.green)
                              : null,
                        ),
                        child: Text(_moods[i], style: const TextStyle(fontSize: 24)),
                      ),
                    ),
                ],
              ),

              const SizedBox(height: 14),
              TextField(
                controller: _text,
                autofocus: true,
                maxLines: 5,
                maxLength: 5000,
                buildCounter: (_, {required currentLength, required isFocused, maxLength}) => null,
                style: const TextStyle(fontSize: 15, height: 1.45, color: Colors.white),
                decoration: InputDecoration(
                  hintText: 'Nima bo’ldi, nimani o’rgandingiz, nima qiynadi…',
                  hintStyle: const TextStyle(color: U.textFaint, fontSize: 15),
                  filled: true,
                  fillColor: const Color(0xFF0E1211),
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: U.border),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: U.border),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide(color: U.green.withValues(alpha: 0.6)),
                  ),
                ),
              ),

              const SizedBox(height: 8),
              const Text(
                'Kundalik ballga ta’sir qilmaydi — bu shaxsiy joyingiz.',
                style: TextStyle(fontSize: 11.5, color: U.textDim),
              ),

              const SizedBox(height: 14),
              UnumButton(
                label: _saving ? 'Saqlanmoqda…' : 'Saqlash',
                onPressed: _saving ? null : _save,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
