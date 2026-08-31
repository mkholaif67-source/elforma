// ── ElForma · screens/food_picker_screen.dart ──
// Debounced food search + pick, backed by /api/mobile food search.
// بحث واختيار الأطعمة مع تأخير ذكي.

import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../api.dart';
import '../models/engine_contracts.dart';
import '../theme.dart';

class FoodPickerScreen extends StatefulWidget {
  final String diet;
  final List<String> health;
  final NutritionFoodItem? replacementTarget;
  const FoodPickerScreen({super.key, this.diet = 'balanced', this.health = const [], this.replacementTarget});

  @override
  State<FoodPickerScreen> createState() => _FoodPickerScreenState();
}

class _FoodPickerScreenState extends State<FoodPickerScreen> {
  final search = TextEditingController();
  Timer? debounce;
  String category = 'all';
  String mode = 'all';
  bool loading = true;
  String? error;
  List<Map<String, dynamic>> foods = [];

  num _n(dynamic value) => value is num ? value : num.tryParse('$value') ?? 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    debounce?.cancel();
    search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { loading = true; error = null; });
    final response = mode == 'all'
        ? await Api.I.searchFoods(search.text.trim(), category: category, diet: widget.diet, health: widget.health)
        : await Api.I.foodPreferences();
    if (!mounted) return;
    setState(() {
      loading = false;
      final sourceKey = mode == 'favorites' ? 'favorites' : mode == 'recent' ? 'recent' : 'foods';
      if (response.ok && response.data[sourceKey] is List) {
        foods = (response.data[sourceKey] as List).whereType<Map>()
            .map((item) => Map<String, dynamic>.from(item)).toList();
        if (widget.replacementTarget != null) foods.sort((a, b) => _match(b).compareTo(_match(a)));
      } else {
        error = response.error.isNotEmpty ? response.error : 'تعذر تحميل الأطعمة';
      }
    });
  }

  void _onSearch(String _) {
    if (mode != 'all') setState(() => mode = 'all');
    debounce?.cancel();
    debounce = Timer(const Duration(milliseconds: 350), _load);
  }

  double _suggestedGrams(Map<String, dynamic> food) {
    final target = widget.replacementTarget;
    final calories = _n(food['cal']).toDouble();
    if (target == null || calories <= 0 || target.calories <= 0) return 100;
    return (target.calories / calories * 100).clamp(10, 1000).toDouble();
  }

  int _match(Map<String, dynamic> food) {
    final target = widget.replacementTarget;
    if (target == null) return 0;
    final grams = _suggestedGrams(food), ratio = grams / 100;
    double gap(num actual, num expected) {
      final base = math.max(3.0, expected.toDouble().abs());
      return ((actual.toDouble() - expected.toDouble()).abs() / base).clamp(0, 2).toDouble();
    }
    final distance = gap(_n(food['cal']) * ratio, target.calories) * .35 +
        gap(_n(food['pro']) * ratio, target.protein) * .30 +
        gap(_n(food['carb']) * ratio, target.carbs) * .20 +
        gap(_n(food['fat']) * ratio, target.fat) * .15;
    return (100 - distance * 55).clamp(0, 100).round();
  }

  List<MapEntry<String, double>> _servings(Map<String, dynamic> food) {
    final name = '${food['nameAr'] ?? ''}';
    final cat = '${food['cat'] ?? ''}';
    final unit = '${food['unit'] ?? ''}';
    if (name.contains('بيض')) return const [MapEntry('بيضة', 50), MapEntry('بيضتان', 100), MapEntry('3 بيضات', 150)];
    if (unit.contains('مل') || name.contains('عصير') || name.contains('لبن')) {
      return const [MapEntry('نصف كوب', 120), MapEntry('كوب', 240), MapEntry('كوب ونصف', 360)];
    }
    if (cat == 'fat') return const [MapEntry('ملعقة صغيرة', 5), MapEntry('ملعقة كبيرة', 15), MapEntry('ملعقتان', 30)];
    if (cat == 'fruit') return const [MapEntry('ثمرة صغيرة', 100), MapEntry('ثمرة متوسطة', 150), MapEntry('ثمرة كبيرة', 200)];
    if (cat == 'carb') return const [MapEntry('نصف كوب', 90), MapEntry('كوب مطهي', 180), MapEntry('كوب ونصف', 270)];
    if (cat == 'dairy') return const [MapEntry('نصف كوب', 120), MapEntry('كوب', 240), MapEntry('كوب ونصف', 360)];
    return const [MapEntry('نصف حصة', 50), MapEntry('حصة', 100), MapEntry('حصة ونصف', 150), MapEntry('حصتان', 200)];
  }

  Future<void> _toggleFavorite(Map<String, dynamic> food) async {
    final next = food['favorite'] != true;
    setState(() => food['favorite'] = next);
    final response = await Api.I.saveFoodPreference('${food['id']}', favorite: next);
    if (!mounted) return;
    if (!response.ok) {
      setState(() => food['favorite'] = !next);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تعذر تحديث المفضلة')));
    } else if (mode == 'favorites' && !next) {
      setState(() => foods.removeWhere((item) => item['id'] == food['id']));
    }
  }

  Future<void> _select(Map<String, dynamic> food) async {
    var selected = _suggestedGrams(food);
    final controller = TextEditingController(text: selected.toStringAsFixed(selected % 1 == 0 ? 0 : 1));
    final grams = await showDialog<num>(
      context: context,
      builder: (context) => StatefulBuilder(builder: (context, setDialogState) => AlertDialog(
        backgroundColor: AppColors.card,
        title: Text(food['nameAr']?.toString() ?? 'حدد الكمية'),
        content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (widget.replacementTarget != null) ...[
            Container(padding: const EdgeInsets.all(10), decoration: BoxDecoration(
                color: AppColors.nu.withValues(alpha: .09), borderRadius: BorderRadius.circular(11)),
                child: Row(children: [
                  const Icon(Icons.balance_rounded, color: AppColors.nu, size: 19),
                  const SizedBox(width: 7),
                  Expanded(child: Text('تطابق الماكروز ${_match(food)}% · الكمية المقترحة ${_suggestedGrams(food).round()} جم',
                      style: const TextStyle(color: AppColors.nu, fontSize: 11, fontWeight: FontWeight.w800))),
                ])),
            const SizedBox(height: 12),
          ],
          const Text('اختر حصة منزلية', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12)),
          const SizedBox(height: 8),
          Wrap(spacing: 6, runSpacing: 6, children: _servings(food).map((entry) => ChoiceChip(
            selected: (selected - entry.value).abs() < .1,
            label: Text(entry.key),
            onSelected: (_) => setDialogState(() {
              selected = entry.value;
              controller.text = selected.toStringAsFixed(0);
            }),
          )).toList()),
          const SizedBox(height: 13),
          TextField(
            controller: controller,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            onChanged: (value) => selected = double.tryParse(value) ?? selected,
            decoration: const InputDecoration(labelText: 'أو اكتب الكمية', suffixText: 'جم / مل'),
          ),
          const SizedBox(height: 10),
          Text('${(_n(food['cal']) * selected / 100).round()} سعرة · P ${(_n(food['pro']) * selected / 100).toStringAsFixed(1)} · C ${(_n(food['carb']) * selected / 100).toStringAsFixed(1)} · F ${(_n(food['fat']) * selected / 100).toStringAsFixed(1)}',
              style: const TextStyle(color: AppColors.muted, fontSize: 11)),
        ])),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('إلغاء')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.nu, foregroundColor: const Color(0xFF04231B)),
            onPressed: () {
              final value = num.tryParse(controller.text.trim());
              if (value != null && value > 0 && value <= 2000) Navigator.pop(context, value);
            },
            child: Text(widget.replacementTarget == null ? 'إضافة' : 'استبدال'),
          ),
        ],
      )),
    );
    controller.dispose();
    if (!mounted || grams == null) return;
    await Api.I.saveFoodPreference('${food['id']}', used: true);
    if (!mounted) return;
    Navigator.pop(context, NutritionFoodItem.fromCatalog(food, grams));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        title: Text(widget.replacementTarget == null ? 'اختيار طعام' : 'استبدال ذكي',
            style: const TextStyle(fontWeight: FontWeight.w900)),
        centerTitle: true,
      ),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 9),
          child: TextField(
            controller: search,
            onChanged: _onSearch,
            decoration: const InputDecoration(hintText: 'ابحث عن أكل: فراخ أرز بيض فاكهة', prefixIcon: Icon(Icons.search_rounded)),
          ),
        ),
        _modeTabs(),
        Expanded(child: _results()),
      ]),
    );
  }

  Widget _modeTabs() => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(children: [
          _mode('all', 'الكتالوج', Icons.restaurant_menu_rounded),
          const SizedBox(width: 7),
          _mode('favorites', 'المفضلة', Icons.star_rounded),
          const SizedBox(width: 7),
          _mode('recent', 'الأخيرة', Icons.history_rounded),
        ]),
      );

  Widget _mode(String value, String label, IconData icon) => Expanded(child: InkWell(
        onTap: () { setState(() => mode = value); _load(); },
        borderRadius: BorderRadius.circular(11),
        child: Container(padding: const EdgeInsets.symmetric(vertical: 9),
          decoration: BoxDecoration(color: mode == value ? AppColors.nu : AppColors.card,
              borderRadius: BorderRadius.circular(11), border: Border.all(color: mode == value ? AppColors.nu : AppColors.line)),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(icon, size: 16, color: mode == value ? const Color(0xFF04231B) : AppColors.muted),
            const SizedBox(width: 5),
            Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900,
                color: mode == value ? const Color(0xFF04231B) : AppColors.text)),
          ]),
        ),
      ));

  Widget _results() {
    final categories = const {
      'all': 'الكل', 'protein': 'بروتين', 'carb': 'كارب', 'fat': 'دهون',
      'dairy': 'ألبان', 'fruit': 'فاكهة', 'veggie': 'خضار',
    };
    return Column(children: [
      if (mode == 'all') ...[
        const SizedBox(height: 9),
        SizedBox(height: 42, child: ListView(scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          children: categories.entries.map((entry) {
            final active = category == entry.key;
            return Padding(padding: const EdgeInsets.only(left: 7), child: ChoiceChip(
              selected: active, label: Text(entry.value), selectedColor: AppColors.nu,
              backgroundColor: AppColors.card,
              labelStyle: TextStyle(color: active ? const Color(0xFF04231B) : AppColors.text, fontWeight: FontWeight.w800),
              onSelected: (_) { setState(() => category = entry.key); _load(); },
            ));
          }).toList(),
        )),
      ],
      const SizedBox(height: 5),
      Expanded(child: loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.nu))
          : error != null
              ? Center(child: Text(error!, style: const TextStyle(color: AppColors.wo2)))
              : foods.isEmpty
                  ? Center(child: Text(mode == 'favorites' ? 'اضغط النجمة على أي طعام ليظهر هنا' : mode == 'recent' ? 'الأطعمة التي تستخدمها ستظهر هنا' : 'لا توجد نتائج',
                      textAlign: TextAlign.center, style: const TextStyle(color: AppColors.muted)))
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 30),
                      itemCount: foods.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (_, index) => _foodTile(foods[index]),
                    )),
    ]);
  }

  Widget _foodTile(Map<String, dynamic> food) {
    final match = _match(food);
    return InkWell(
      onTap: () => _select(food),
      borderRadius: BorderRadius.circular(15),
      child: Container(
        padding: const EdgeInsets.fromLTRB(11, 11, 7, 11),
        decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(15), border: Border.all(color: AppColors.line)),
        child: Row(children: [
          Container(width: 39, height: 39, decoration: BoxDecoration(color: AppColors.nu.withValues(alpha: .12), borderRadius: BorderRadius.circular(11)),
              child: Icon(widget.replacementTarget == null ? Icons.add_rounded : Icons.balance_rounded, color: AppColors.nu)),
          const SizedBox(width: 10),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text((food['nameAr'] ?? food['nameEn'] ?? '').toString(),
                  maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w900))),
              if (widget.replacementTarget != null) Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                decoration: BoxDecoration(color: match >= 75 ? AppColors.nu.withValues(alpha: .14) : AppColors.wo.withValues(alpha: .13), borderRadius: BorderRadius.circular(7)),
                child: Text('$match%', style: TextStyle(color: match >= 75 ? AppColors.nu : AppColors.wo2, fontSize: 9, fontWeight: FontWeight.w900)),
              ),
            ]),
            const SizedBox(height: 3),
            Text('${food['cal'] ?? 0} سعرة · P ${food['pro'] ?? 0} · C ${food['carb'] ?? 0} · F ${food['fat'] ?? 0} / ${food['unit'] ?? '100جم'}',
                style: const TextStyle(color: AppColors.muted, fontSize: 10)),
          ])),
          IconButton(
            tooltip: food['favorite'] == true ? 'إزالة من المفضلة' : 'إضافة للمفضلة',
            onPressed: () => _toggleFavorite(food),
            icon: Icon(food['favorite'] == true ? Icons.star_rounded : Icons.star_border_rounded,
                color: food['favorite'] == true ? const Color(0xFFFFC857) : AppColors.muted),
          ),
        ]),
      ),
    );
  }
}
