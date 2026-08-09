/// "Personal OS" modullarining modellari: maqsad, vazifa, odat, fokus,
/// Life Score, hisobot va prognoz.
///
/// ⚠️ Hisoblangan maydonlar (progress, streak, ball) SERVERDAN keladi va
/// bu yerda QAYTA HISOBLANMAYDI. Sabab: ilova va bot bir xil raqamni
/// ko'rsatishi shart, ikkita mustaqil implementatsiya esa muqarrar
/// ravishda bir-biridan uzilib qoladi (`score.ts`/`score.dart` juftligida
/// aynan shu muammo bor).
library;

int _int(dynamic v) => v is num ? v.toInt() : int.tryParse('$v') ?? 0;
double _dbl(dynamic v) => v is num ? v.toDouble() : double.tryParse('$v') ?? 0;
String _str(dynamic v) => v?.toString() ?? '';
bool _bool(dynamic v) => v == true;
String? _strOrNull(dynamic v) {
  final s = v?.toString();
  return (s == null || s.isEmpty) ? null : s;
}

// ══════════════════════════ MAQSAD ══════════════════════════

const goalCategories = <String, String>{
  'learning': "O'qish",
  'fitness': 'Sport',
  'health': "Sog'liq",
  'career': 'Karyera',
  'finance': 'Moliya',
  'personal': 'Shaxsiy',
};

class Milestone {
  Milestone({required this.id, required this.title, this.done = false, this.dueDate});

  String id;
  String title;
  bool done;
  String? dueDate;

  factory Milestone.fromJson(Map j) => Milestone(
        id: _str(j['id']),
        title: _str(j['title']),
        done: _bool(j['done']),
        dueDate: _strOrNull(j['dueDate']),
      );

  /// Serverga yuborishda `id` yangi bosqichlarda bo'sh bo'lishi mumkin.
  Map<String, dynamic> toJson() => {
        if (id.isNotEmpty) 'id': id,
        'title': title,
        'done': done,
        'dueDate': dueDate,
      };
}

class GoalMetric {
  GoalMetric({required this.unit, required this.start, required this.target, required this.current});

  String unit;
  double start;
  double target;
  double current;

  factory GoalMetric.fromJson(Map j) => GoalMetric(
        unit: _str(j['unit']),
        start: _dbl(j['start']),
        target: _dbl(j['target']),
        current: _dbl(j['current']),
      );

  Map<String, dynamic> toJson() =>
      {'unit': unit, 'start': start, 'target': target, 'current': current};
}

class Goal {
  Goal({
    required this.id,
    required this.title,
    this.description = '',
    this.category = 'personal',
    this.metric,
    this.milestones = const [],
    this.deadline,
    this.status = 'active',
    this.progressPercent = 0,
    this.daysLeft,
    this.milestonesDone = 0,
    this.milestonesTotal = 0,
  });

  String id;
  String title;
  String description;
  String category;
  GoalMetric? metric;
  List<Milestone> milestones;
  String? deadline;
  String status;

  // --- serverdan keladi ---
  final int progressPercent;
  final int? daysLeft;
  final int milestonesDone;
  final int milestonesTotal;

  String get categoryLabel => goalCategories[category] ?? 'Shaxsiy';
  bool get isActive => status == 'active';

  factory Goal.fromJson(Map j) => Goal(
        id: _str(j['id']),
        title: _str(j['title']),
        description: _str(j['description']),
        category: _str(j['category']).isEmpty ? 'personal' : _str(j['category']),
        metric: j['metric'] is Map ? GoalMetric.fromJson(j['metric'] as Map) : null,
        milestones: (j['milestones'] as List? ?? [])
            .whereType<Map>()
            .map(Milestone.fromJson)
            .toList(),
        deadline: _strOrNull(j['deadline']),
        status: _str(j['status']).isEmpty ? 'active' : _str(j['status']),
        progressPercent: _int(j['progressPercent']),
        daysLeft: j['daysLeft'] == null ? null : _int(j['daysLeft']),
        milestonesDone: _int(j['milestonesDone']),
        milestonesTotal: _int(j['milestonesTotal']),
      );

  /// Serverga yuboriladigan shakl — hisoblangan maydonlar YUBORILMAYDI.
  Map<String, dynamic> toPayload() => {
        'title': title,
        'description': description,
        'category': category,
        'deadline': deadline,
        'status': status,
        'milestones': milestones.map((m) => m.toJson()).toList(),
        'metric': metric?.toJson(),
      };
}

// ══════════════════════════ VAZIFA ══════════════════════════

const taskPriorities = <String, String>{
  'high': 'Muhim',
  'normal': "O'rtacha",
  'low': 'Past',
};

class PlanTask {
  PlanTask({
    required this.id,
    required this.title,
    this.notes = '',
    required this.date,
    this.done = false,
    this.priority = 'normal',
    this.goalId,
    this.estimateMin,
  });

  String id;
  String title;
  String notes;
  String date;
  bool done;
  String priority;
  String? goalId;
  int? estimateMin;

  String get priorityLabel => taskPriorities[priority] ?? "O'rtacha";

  factory PlanTask.fromJson(Map j) => PlanTask(
        id: _str(j['id']),
        title: _str(j['title']),
        notes: _str(j['notes']),
        date: _str(j['date']),
        done: _bool(j['done']),
        priority: _str(j['priority']).isEmpty ? 'normal' : _str(j['priority']),
        goalId: _strOrNull(j['goalId']),
        estimateMin: j['estimateMin'] == null ? null : _int(j['estimateMin']),
      );

  Map<String, dynamic> toPayload() => {
        'title': title,
        'notes': notes,
        'date': date,
        'done': done,
        'priority': priority,
        'goalId': goalId,
        'estimateMin': estimateMin,
      };
}

class DayPlan {
  DayPlan({
    required this.date,
    required this.tasks,
    required this.overdue,
    required this.done,
    required this.total,
    this.percent,
  });

  final String date;
  final List<PlanTask> tasks;

  /// O'tgan kunlardagi bajarilmaganlar — faqat bugungi kunni ko'rganda keladi.
  final List<PlanTask> overdue;
  final int done;
  final int total;

  /// `null` = o'sha kunda umuman vazifa yo'q (0% dan FARQ qiladi).
  final int? percent;

  factory DayPlan.fromJson(Map j) {
    final stats = (j['stats'] as Map?) ?? const {};
    List<PlanTask> list(String key) => (j[key] as List? ?? [])
        .whereType<Map>()
        .map(PlanTask.fromJson)
        .toList();
    return DayPlan(
      date: _str(j['date']),
      tasks: list('tasks'),
      overdue: list('overdue'),
      done: _int(stats['done']),
      total: _int(stats['total']),
      percent: stats['percent'] == null ? null : _int(stats['percent']),
    );
  }
}

// ══════════════════════════ ODAT ══════════════════════════

const habitSchedules = <String, String>{
  'daily': 'Har kuni',
  'weekdays': 'Ish kunlari',
  'custom': 'Tanlangan',
};

const weekdayShort = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];

class HabitDay {
  HabitDay({required this.date, required this.done, required this.due});
  final String date;
  final bool done;
  final bool due;

  factory HabitDay.fromJson(Map j) =>
      HabitDay(date: _str(j['date']), done: _bool(j['done']), due: _bool(j['due']));
}

class Habit {
  Habit({
    required this.id,
    required this.title,
    this.emoji = '🎯',
    this.schedule = 'daily',
    this.days = const [],
    this.status = 'active',
    this.doneToday = false,
    this.dueToday = true,
    this.streak = 0,
    this.best = 0,
    this.recent = const [],
    this.totalDone = 0,
  });

  String id;
  String title;
  String emoji;
  String schedule;
  List<int> days;
  String status;

  // --- serverdan keladi ---
  final bool doneToday;
  final bool dueToday;
  final int streak;
  final int best;
  final List<HabitDay> recent;
  final int totalDone;

  bool get isActive => status == 'active';

  String get scheduleLabel {
    if (schedule == 'daily') return 'Har kuni';
    if (schedule == 'weekdays') return 'Ish kunlari';
    return days.map((d) => weekdayShort[d]).join(', ');
  }

  factory Habit.fromJson(Map j) => Habit(
        id: _str(j['id']),
        title: _str(j['title']),
        emoji: _str(j['emoji']).isEmpty ? '🎯' : _str(j['emoji']),
        schedule: _str(j['schedule']).isEmpty ? 'daily' : _str(j['schedule']),
        days: (j['days'] as List? ?? []).map(_int).toList(),
        status: _str(j['status']).isEmpty ? 'active' : _str(j['status']),
        doneToday: _bool(j['doneToday']),
        dueToday: _bool(j['dueToday']),
        streak: _int(j['streak']),
        best: _int(j['best']),
        recent: (j['recent'] as List? ?? [])
            .whereType<Map>()
            .map(HabitDay.fromJson)
            .toList(),
        totalDone: _int(j['totalDone']),
      );

  /// ⚠️ `log` YUBORILMAYDI — server uni PUT orqali qabul qilmaydi
  /// (soxta ketma-ketlik yozishning oldini oladi).
  Map<String, dynamic> toPayload() => {
        'title': title,
        'emoji': emoji,
        'schedule': schedule,
        'days': days,
        'status': status,
      };
}

// ══════════════════════════ FOKUS ══════════════════════════

const focusKinds = <String, String>{
  'study': "O'qish",
  'work': 'Ish',
  'skill': 'Mahorat',
  'hobby': 'Hobbi',
};

class FocusEntry {
  FocusEntry({required this.id, required this.timestamp, required this.kind,
    required this.minutes, this.note = ''});

  final String id;
  final String timestamp;
  final String kind;
  final int minutes;
  final String note;

  String get kindLabel => focusKinds[kind] ?? "O'qish";

  factory FocusEntry.fromJson(Map j) => FocusEntry(
        id: _str(j['id']),
        timestamp: _str(j['timestamp']),
        kind: _str(j['kind']),
        minutes: _int(j['minutes']),
        note: _str(j['note']),
      );
}

class FocusDay {
  FocusDay({required this.sessions, required this.minutes, required this.target,
    required this.percent, required this.byKind, required this.week});

  final List<FocusEntry> sessions;
  final int minutes;
  final int target;
  final int percent;
  final List<({String label, int minutes})> byKind;
  final List<({String date, int minutes})> week;

  factory FocusDay.fromJson(Map j) => FocusDay(
        sessions: (j['sessions'] as List? ?? [])
            .whereType<Map>()
            .map(FocusEntry.fromJson)
            .toList(),
        minutes: _int(j['minutes']),
        target: _int(j['target']),
        percent: _int(j['percent']),
        byKind: (j['byKind'] as List? ?? [])
            .whereType<Map>()
            .map((k) => (label: _str(k['label']), minutes: _int(k['minutes'])))
            .toList(),
        week: (j['week'] as List? ?? [])
            .whereType<Map>()
            .map((w) => (date: _str(w['date']), minutes: _int(w['minutes'])))
            .toList(),
      );
}

// ══════════════════════════ LIFE SCORE ══════════════════════════

class LifeComponent {
  LifeComponent({required this.id, required this.label, required this.ratio,
    required this.available, required this.detail});

  final String id;
  final String label;
  final double ratio;
  final bool available;
  final String detail;

  factory LifeComponent.fromJson(Map j) => LifeComponent(
        id: _str(j['id']),
        label: _str(j['label']),
        ratio: _dbl(j['ratio']),
        available: _bool(j['available']),
        detail: _str(j['detail']),
      );
}

class LifeScore {
  LifeScore({required this.locked, this.total = 0, this.hasData = false,
    this.grade = '', this.components = const [], this.weakest});

  /// Premium emas — server raqamlarni UMUMAN yubormaydi.
  final bool locked;
  final int total;
  final bool hasData;
  final String grade;
  final List<LifeComponent> components;
  final LifeComponent? weakest;

  List<LifeComponent> get usable =>
      components.where((c) => c.available).toList();

  factory LifeScore.fromJson(Map j) {
    if (_bool(j['locked'])) return LifeScore(locked: true);
    return LifeScore(
      locked: false,
      total: _int(j['total']),
      hasData: _bool(j['hasData']),
      grade: _str(j['grade']),
      components: (j['components'] as List? ?? [])
          .whereType<Map>()
          .map(LifeComponent.fromJson)
          .toList(),
      weakest: j['weakest'] is Map
          ? LifeComponent.fromJson(j['weakest'] as Map)
          : null,
    );
  }
}

// ══════════════════════════ HISOBOT / PROGNOZ ══════════════════════════

class Review {
  Review({required this.locked, this.from = '', this.to = '',
    this.tasksDone = 0, this.tasksTotal = 0, this.tasksPercent,
    this.habitsDone = 0, this.habitsDue = 0, this.habitsPercent,
    this.focusMinutes = 0, this.focusPerDay = 0,
    this.average, this.previousAverage, this.trend,
    this.best, this.worst, this.weakest, this.topStreak,
    this.highlights = const []});

  final bool locked;
  final String from;
  final String to;
  final int tasksDone, tasksTotal;
  final int? tasksPercent;
  final int habitsDone, habitsDue;
  final int? habitsPercent;
  final int focusMinutes, focusPerDay;
  final int? average, previousAverage;
  final String? trend;
  final ({String date, int total})? best;
  final ({String date, int total})? worst;
  final String? weakest;
  final ({String title, int streak})? topStreak;
  final List<String> highlights;

  factory Review.fromJson(Map j) {
    if (_bool(j['locked'])) return Review(locked: true);
    final t = (j['tasks'] as Map?) ?? const {};
    final h = (j['habits'] as Map?) ?? const {};
    final f = (j['focus'] as Map?) ?? const {};
    final ls = (j['lifeScore'] as Map?) ?? const {};
    ({String date, int total})? day(dynamic v) =>
        v is Map ? (date: _str(v['date']), total: _int(v['total'])) : null;

    return Review(
      locked: false,
      from: _str(j['from']),
      to: _str(j['to']),
      tasksDone: _int(t['done']),
      tasksTotal: _int(t['total']),
      tasksPercent: t['percent'] == null ? null : _int(t['percent']),
      habitsDone: _int(h['done']),
      habitsDue: _int(h['due']),
      habitsPercent: h['percent'] == null ? null : _int(h['percent']),
      focusMinutes: _int(f['minutes']),
      focusPerDay: _int(f['perDay']),
      average: ls['average'] == null ? null : _int(ls['average']),
      previousAverage:
          j['previousAverage'] == null ? null : _int(j['previousAverage']),
      trend: _strOrNull(j['trend']),
      best: day(ls['best']),
      worst: day(ls['worst']),
      weakest: j['weakest'] is Map ? _str((j['weakest'] as Map)['label']) : null,
      topStreak: j['topStreak'] is Map
          ? (
              title: _str((j['topStreak'] as Map)['title']),
              streak: _int((j['topStreak'] as Map)['streak'])
            )
          : null,
      highlights:
          (j['highlights'] as List? ?? []).map((e) => e.toString()).toList(),
    );
  }
}

class Prediction {
  Prediction({required this.goalId, required this.title, required this.message,
    this.onTrack, this.daysLate});

  final String goalId;
  final String title;
  final String message;
  final bool? onTrack;
  final int? daysLate;

  factory Prediction.fromJson(Map j) => Prediction(
        goalId: _str(j['goalId']),
        title: _str(j['title']),
        message: _str(j['message']),
        onTrack: j['onTrack'] == null ? null : _bool(j['onTrack']),
        daysLate: j['daysLate'] == null ? null : _int(j['daysLate']),
      );
}

class Narrative {
  Narrative({this.summary = '', this.win = '', this.problem = '',
    this.nextSteps = const []});

  final String summary;
  final String win;
  final String problem;
  final List<String> nextSteps;

  factory Narrative.fromJson(Map j) => Narrative(
        summary: _str(j['summary']),
        win: _str(j['win']),
        problem: _str(j['problem']),
        nextSteps:
            (j['nextWeek'] as List? ?? []).map((e) => e.toString()).toList(),
      );
}
