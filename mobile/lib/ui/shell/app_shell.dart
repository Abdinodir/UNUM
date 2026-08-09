import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../state/app_state.dart';

import '../screens/add_flow.dart';
import '../screens/analysis_screen.dart';
import '../screens/coach_screen.dart';
import '../screens/home_screen.dart';
import '../screens/plan_screen.dart' show PlanScreen, CreateRequest;
import '../screens/profile_screen.dart';
import '../tokens.dart';
import '../widgets/journal_sheet.dart';
import 'quick_create.dart';
import 'tab_bar.dart';

/// Ilovaning asosiy qobig'i: 5 ta tab + markazdagi radial "+" menyu.
class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> with WidgetsBindingObserver {
  UnumTab _tab = UnumTab.home;

  /// Reja tabining qaysi bo'limi ochilsin.
  final _planSection = ValueNotifier<int>(0);

  /// "+" menyusidan yaratish so'rovi: bo'limga o'tish YETARLI EMAS,
  /// foydalanuvchi darhol yaratish oynasini kutadi. Har so'rovda qiymat
  /// almashadi, shuning uchun ketma-ket bosishlar ham ishlaydi.
  final _planCreate = ValueNotifier<CreateRequest?>(null);
  int _createSeq = 0;

  bool _addOpen = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Foydalanuvchi ilovadan chiqib yurib kelgan bo'lishi mumkin —
    // qaytganda Health Connect'dan yangi qadamni o'qiymiz.
    if (state == AppLifecycleState.resumed) {
      final app = context.read<AppState>();
      app.syncHealth();
      app.syncScreenTime();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _planCreate.dispose();
    _planSection.dispose();
    super.dispose();
  }

  /// Markazdagi "+" — tezkor yaratish varag'ini ochadi.
  ///
  /// Ilgari bu yerda sog'liq metrikalari (ovqat/suv/qadam/uyqu/ekran)
  /// bo'lgan radial menyu turardi. Mahsulot "personal OS" ga aylangach,
  /// tezkor harakatlar ham o'zgardi: maqsad, vazifa, odat, fokus,
  /// kundalik — sog'liq esa ikkinchi darajaga tushdi.
  void _toggleAdd() {
    setState(() => _addOpen = true);
    QuickCreateSheet.open(context, _runQuickAction)
        .whenComplete(() {
      if (mounted) setState(() => _addOpen = false);
    });
  }

  /// Reja tabining `section` bo'limini ochadi va (so'ralsa) darhol
  /// yaratish oynasini chiqaradi.
  void _openPlan(int section, {bool create = false}) {
    setState(() => _tab = UnumTab.plan);
    // Bir xil qiymat qayta yozilsa ham xabar ketishi uchun avval
    // boshqasiga o'tkazamiz — aks holda takroriy bosish ishlamasdi.
    _planSection.value = -1;
    _planSection.value = section;
    if (create) _planCreate.value = CreateRequest(section, ++_createSeq);
  }

  void _runQuickAction(QuickAction action) {
    switch (action) {
      case QuickAction.goal:
        _openPlan(3, create: true);
      case QuickAction.task:
        _openPlan(0, create: true);
      case QuickAction.habit:
        _openPlan(1, create: true);
      case QuickAction.focus:
        // Fokus uchun "yaratish oynasi" yo'q — taymerning o'zi shu ekran.
        _openPlan(2);
      case QuickAction.journal:
        JournalSheet.open(context, context.read<AppState>());
      case QuickAction.meal:
        AddFlow.open(context, AddKind.meal);
      case QuickAction.water:
        AddFlow.open(context, AddKind.water);
    }
  }

  void _openAdd(MetricKey metric) => _openAddKind(kindForMetric(metric));

  void _openAddKind(AddKind kind) => AddFlow.open(context, kind);

  @override
  Widget build(BuildContext context) {
    final pages = [
      HomeScreen(
        onOpenCoach: () => setState(() => _tab = UnumTab.coach),
        onAdd: _openAdd,
        onAddKind: _openAddKind,
      ),
      PlanScreen(
        app: context.read<AppState>(),
        openSection: _planSection,
        createRequest: _planCreate,
      ),
      const AnalysisScreen(),
      const CoachScreen(),
      const ProfileScreen(),
    ];

    return Scaffold(
      backgroundColor: U.bg,
      // Klaviatura chiqqanda maket sakramasin — ichki ekranlar o'zi hal qiladi
      resizeToAvoidBottomInset: false,
      body: Stack(
        children: [
          SafeArea(
            bottom: false,
            child: IndexedStack(
              index: UnumTab.values.indexOf(_tab),
              children: pages,
            ),
          ),

          Align(
            alignment: Alignment.bottomCenter,
            child: UnumTabBar(
              active: _tab,
              addOpen: _addOpen,
              onToggleAdd: _toggleAdd,
              onChanged: (t) {
                setState(() => _tab = t);
              },
            ),
          ),
        ],
      ),
    );
  }
}
