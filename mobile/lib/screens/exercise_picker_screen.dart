// ── ElForma · screens/exercise_picker_screen.dart ──
// Picker to browse / replace an exercise using server-provided safe alternatives.
// اختيار/استبدال تمرين من البدائل الآمنة.

import 'package:flutter/material.dart';
import '../api.dart';
import '../theme.dart';

class ExercisePickerScreen extends StatefulWidget {
  final String currentName;
  const ExercisePickerScreen({super.key, required this.currentName});

  @override
  State<ExercisePickerScreen> createState() => _ExercisePickerScreenState();
}

class _ExercisePickerScreenState extends State<ExercisePickerScreen> {
  bool loading = true;
  String? error;
  List<Map<String, dynamic>> exercises = [];
  List<String> injuries = [];
  String equipment = 'gym';
  String goal = 'muscle';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final bootstrap = await Api.I.mobileBootstrap();
    if (bootstrap.data['profile'] is Map) {
      final profile = bootstrap.data['profile'] as Map;
      equipment = (profile['equipment'] ?? 'gym').toString();
      final savedGoal = (profile['goal'] ?? 'gain').toString();
      goal = savedGoal == 'lose' ? 'cut' : savedGoal == 'strength' ? 'strength' : savedGoal == 'fitness' ? 'fitness' : 'muscle';
      injuries = profile['injuries'] is List
          ? (profile['injuries'] as List).whereType<String>().toList()
          : [];
    }
    final response = await Api.I.exerciseAlternatives(widget.currentName,
        equipment: equipment, goal: goal, injuries: injuries);
    if (!mounted) return;
    setState(() {
      loading = false;
      if (response.ok && response.data['exercises'] is List) {
        exercises = (response.data['exercises'] as List).whereType<Map>()
            .map((item) => Map<String, dynamic>.from(item)).toList();
      } else {
        error = response.error.isNotEmpty ? response.error : 'تعذر تحميل البدائل';
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        title: const Text('بدل التمرين', style: TextStyle(fontWeight: FontWeight.w900)),
        centerTitle: true,
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.wo))
          : error != null
              ? Center(child: Text(error!, style: const TextStyle(color: AppColors.wo2)))
              : ListView(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 30),
                  children: [
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(color: AppColors.nu.withValues(alpha: .08),
                          borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.nu.withValues(alpha: .24))),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        const Icon(Icons.health_and_safety_outlined, color: AppColors.nu),
                        const SizedBox(width: 9),
                        Expanded(child: Text(
                          injuries.isEmpty
                              ? 'البدائل من نفس المجموعة العضلية ومناسبة لمعداتك'
                              : 'تم استبعاد التمارين غير المناسبة لإصاباتك المسجلة: ${injuries.join('، ')}',
                          style: const TextStyle(color: AppColors.muted, fontSize: 12, height: 1.5),
                        )),
                      ]),
                    ),
                    const SizedBox(height: 12),
                    if (exercises.isEmpty)
                      const Padding(
                        padding: EdgeInsets.all(24),
                        child: Text('لا يوجد بديل آمن مطابق حاليا', textAlign: TextAlign.center,
                            style: TextStyle(color: AppColors.muted)),
                      )
                    else
                      ...exercises.map(_tile),
                  ],
                ),
    );
  }

  Widget _tile(Map<String, dynamic> exercise) => Container(
        margin: const EdgeInsets.only(bottom: 9),
        decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(15),
            border: Border.all(color: AppColors.line)),
        child: ListTile(
          onTap: () => Navigator.pop(context, exercise),
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
          leading: Container(width: 40, height: 40, decoration: BoxDecoration(
              color: AppColors.wo.withValues(alpha: .12), borderRadius: BorderRadius.circular(11)),
              child: const Icon(Icons.swap_horiz_rounded, color: AppColors.wo2)),
          title: Text((exercise['n'] ?? '').toString(),
              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14)),
          subtitle: Text('${exercise['mu'] ?? ''} · مستوى ${exercise['tier'] ?? 'A'}',
              style: const TextStyle(color: AppColors.muted, fontSize: 11)),
          trailing: const Icon(Icons.chevron_left_rounded, color: AppColors.muted),
        ),
      );
}
