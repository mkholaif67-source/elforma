// ElForma - screens/custom_reminders_screen.dart
// Free-form daily reminders for anything the user wants. Lives OUTSIDE the
// supplements screen so the supplements list stays focused.

import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../notification_service.dart';
import '../theme.dart';

class CustomRemindersScreen extends StatefulWidget {
  const CustomRemindersScreen({super.key});

  @override
  State<CustomRemindersScreen> createState() => _CustomRemindersScreenState();
}

class _CustomRemindersScreenState extends State<CustomRemindersScreen> {
  static const String _kKey = 'custom_reminders_v1';
  bool loading = true;
  List<Map<String, dynamic>> items = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  // مدى منفصل عن التذكيرات الثابتة (101/102/104/201-203) والمكملات (300+).
  int _notifId(String id) => 500 + (id.hashCode.abs() % 400);

  Future<void> _load() async {
    final sp = await SharedPreferences.getInstance();
    final raw = sp.getString(_kKey);
    final parsed = <Map<String, dynamic>>[];
    if (raw != null && raw.isNotEmpty) {
      for (final item in (jsonDecode(raw) as List)) {
        if (item is Map) parsed.add(Map<String, dynamic>.from(item));
      }
    }
    if (!mounted) return;
    setState(() {
      items = parsed;
      loading = false;
    });
  }

  Future<void> _persist() async {
    final sp = await SharedPreferences.getInstance();
    await sp.setString(_kKey, jsonEncode(items));
  }

  Future<void> _sync(Map<String, dynamic> item) async {
    final id = _notifId('${item['id']}');
    await NotificationService.I.cancel(id);
    if (item['enabled'] != true) return;
    await NotificationService.I.scheduleDaily(
      id: id,
      hour: item['hour'] as int,
      minute: item['minute'] as int,
      title: '${item['title']}',
      body: '${item['note'] ?? ''}'.isEmpty
          ? 'تذكير من الفورمة'
          : '${item['note']}',
      channel: 'custom_reminders',
    );
  }

  Future<void> _add() async {
    final titleCtrl = TextEditingController();
    final noteCtrl = TextEditingController();
    TimeOfDay picked = const TimeOfDay(hour: 8, minute: 0);

    final saved = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (innerContext, setLocal) => AlertDialog(
          backgroundColor: AppColors.card,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Text('تنبيه جديد',
              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 17)),
          content: Column(mainAxisSize: MainAxisSize.min, children: [
            TextField(
              controller: titleCtrl,
              decoration: const InputDecoration(
                  labelText: 'التنبيه',
                  hintText: 'مثلا: اشرب مية قبل الفطار'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: noteCtrl,
              decoration: const InputDecoration(
                  labelText: 'تفاصيل (اختياري)'),
            ),
            const SizedBox(height: 16),
            Row(children: [
              const Icon(Icons.schedule_rounded, color: AppColors.nu, size: 19),
              const SizedBox(width: 8),
              const Text('الموعد'),
              const Spacer(),
              TextButton(
                onPressed: () async {
                  final chosen = await showTimePicker(
                      context: innerContext, initialTime: picked);
                  if (chosen != null) setLocal(() => picked = chosen);
                },
                child: Text(picked.format(innerContext),
                    style: const TextStyle(fontWeight: FontWeight.w900)),
              ),
            ]),
          ]),
          actions: [
            TextButton(
                onPressed: () => Navigator.of(dialogContext).pop(false),
                child: const Text('إلغاء')),
            ElevatedButton(
                onPressed: () => Navigator.of(dialogContext).pop(true),
                child: const Text('حفظ')),
          ],
        ),
      ),
    );

    if (saved != true) return;
    final title = titleCtrl.text.trim();
    if (title.isEmpty) return;
    final item = <String, dynamic>{
      'id': 'r${DateTime.now().millisecondsSinceEpoch}',
      'title': title,
      'note': noteCtrl.text.trim(),
      'hour': picked.hour,
      'minute': picked.minute,
      'enabled': true,
    };
    setState(() => items.add(item));
    await _persist();
    await _sync(item);
  }

  Future<void> _toggle(Map<String, dynamic> item, bool value) async {
    setState(() => item['enabled'] = value);
    await _persist();
    await _sync(item);
  }

  Future<void> _editTime(Map<String, dynamic> item) async {
    final chosen = await showTimePicker(
      context: context,
      initialTime:
          TimeOfDay(hour: item['hour'] as int, minute: item['minute'] as int),
    );
    if (chosen == null) return;
    setState(() {
      item['hour'] = chosen.hour;
      item['minute'] = chosen.minute;
    });
    await _persist();
    await _sync(item);
  }

  Future<void> _delete(Map<String, dynamic> item) async {
    await NotificationService.I.cancel(_notifId('${item['id']}'));
    setState(() => items.remove(item));
    await _persist();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        centerTitle: true,
        title: const Text('تنبيهات مخصصة',
            style: TextStyle(fontWeight: FontWeight.w900)),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _add,
        backgroundColor: AppColors.nu,
        icon: const Icon(Icons.add_rounded, color: Colors.white),
        label: const Text('تنبيه جديد',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900)),
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.nu))
          : items.isEmpty
              ? const Center(
                  child: Padding(
                    padding: EdgeInsets.all(30),
                    child: Text(
                      'مفيش تنبيهات لسة.\nاعمل تنبيه لأي حاجة إنت عايزها في أي وقت',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppColors.muted, height: 1.7),
                    ),
                  ),
                )
              : ListView(
                  padding: const EdgeInsets.fromLTRB(18, 8, 18, 100),
                  children: items.map(_tile).toList(),
                ),
    );
  }

  Widget _tile(Map<String, dynamic> item) {
    final on = item['enabled'] == true;
    final time = TimeOfDay(
        hour: item['hour'] as int, minute: item['minute'] as int);
    return Container(
      margin: const EdgeInsets.only(bottom: 9),
      padding: const EdgeInsets.fromLTRB(13, 9, 6, 9),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
            color: on ? AppColors.nu.withValues(alpha: .38) : AppColors.line),
      ),
      child: Row(children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${item['title']}',
                style: const TextStyle(
                    fontWeight: FontWeight.w900, fontSize: 13.5)),
            const SizedBox(height: 2),
            InkWell(
              onTap: () => _editTime(item),
              child: Text(
                '${time.format(context)}${'${item['note'] ?? ''}'.isEmpty ? '' : ' · ${item['note']}'}',
                style: const TextStyle(
                    color: AppColors.muted, fontSize: 11, height: 1.4),
              ),
            ),
          ]),
        ),
        IconButton(
          onPressed: () => _delete(item),
          icon: const Icon(Icons.delete_outline_rounded,
              size: 18, color: AppColors.muted),
        ),
        Switch(value: on, onChanged: (value) => _toggle(item, value)),
      ]),
    );
  }
}
