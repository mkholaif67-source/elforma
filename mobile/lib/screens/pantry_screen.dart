// ── ElForma · screens/pantry_screen.dart ──
// Pantry / available-foods manager that feeds availableFoods back to the engine.
// إدارة المخزن والأطعمة المتاحة.

import 'dart:async';
import 'package:flutter/material.dart';
import '../api.dart';
import '../models/profile_store.dart';
import '../theme.dart';

/// الأصناف المتاحة — the mobile twin of the website's step 6.
///
/// The nutrition engine plans meals out of `DE.availableFoods`. When that list
/// is empty the engine takes its documented emergency path ("لم يتم اختيار
/// أطعمة") and plans from the entire database, which is why plans used to
/// look like a random pile instead of an Egyptian meal. This screen is how the
/// user's real pantry finally reaches the engine.
class PantryScreen extends StatefulWidget {
  const PantryScreen({super.key});

  @override
  State<PantryScreen> createState() => _PantryScreenState();
}

class _CatalogCategory {
  final String key;
  final String label;
  const _CatalogCategory(this.key, this.label);
}

const List<_CatalogCategory> _categories = [
  _CatalogCategory('protein', 'بروتين'),
  _CatalogCategory('carb', 'نشويات'),
  _CatalogCategory('veggie', 'خضار'),
  _CatalogCategory('dairy', 'ألبان'),
  _CatalogCategory('fat', 'دهون'),
  _CatalogCategory('fruit', 'فاكهة'),
  _CatalogCategory('snack', 'سناك'),
];

class _PantryScreenState extends State<PantryScreen> {
  /// Mirrors bridge.MIN_PANTRY on the server: below this the server refuses the
  /// selection and plans from the full catalog instead, so we must not let the
  /// user leave thinking a 3-food pantry was accepted.
  static const int minimum = 8;

  final search = TextEditingController();
  Timer? debounce;

  String category = 'protein';
  bool loading = true;
  bool saving = false;
  String? error;

  List<Map<String, dynamic>> foods = [];
  final Set<String> selected = <String>{};
  final Map<String, String> names = <String, String>{};

  @override
  void initState() {
    super.initState();
    final profile = ProfileStore.I.profile;
    if (profile != null) {
      for (final id in ProfileStore.I.listOf('availableFoods')) {
        selected.add(id);
      }
    }
    _load();
  }

  @override
  void dispose() {
    debounce?.cancel();
    search.dispose();
    super.dispose();
  }

  String get _diet {
    final value = ProfileStore.I.str('diet');
    return value.isEmpty ? 'balanced' : value;
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    final response = await Api.I.searchFoods(
      search.text.trim(),
      category: category,
      diet: _diet,
      health: ProfileStore.I.listOf('healthConditions'),
    );
    if (!mounted) return;
    setState(() {
      loading = false;
      if (response.ok && response.data['foods'] is List) {
        foods = (response.data['foods'] as List)
            .whereType<Map>()
            .map((item) => Map<String, dynamic>.from(item))
            .toList();
        for (final food in foods) {
          names['${food['id']}'] = '${food['nameAr'] ?? food['nameEn'] ?? ''}';
        }
      } else {
        error = response.friendlyError('تعذر تحميل الأصناف حاول تاني');
      }
    });
  }

  void _onSearch(String _) {
    debounce?.cancel();
    debounce = Timer(const Duration(milliseconds: 350), _load);
  }

  Future<void> _save() async {
    final base = ProfileStore.I.profile;
    if (base == null) {
      setState(() => error = 'اكمل بياناتك الأساسية الأول عشان نقدر نحفظ أصنافك');
      return;
    }
    setState(() {
      saving = true;
      error = null;
    });
    // The server replaces the whole profile document, so we MUST send the
    // existing profile merged with the new pantry. Sending only availableFoods
    // would silently wipe the user's age, weight and goal.
    final payload = Map<String, dynamic>.from(base);
    payload['availableFoods'] = selected.toList();
    final response = await Api.I.saveMobileProfile(payload);
    if (!mounted) return;
    if (response.ok && response.data['profile'] is Map) {
      await ProfileStore.I
          .apply(Map<String, dynamic>.from(response.data['profile'] as Map));
      if (!mounted) return;
      Navigator.of(context).pop(true);
      return;
    }
    setState(() {
      saving = false;
      error = response.friendlyError('تعذر الحفظ حاول تاني');
    });
  }

  @override
  Widget build(BuildContext context) {
    final enough = selected.length >= minimum;
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        title: const Text('الأصناف المتاحة عندك'),
        actions: [
          if (selected.isNotEmpty)
            TextButton(
              onPressed: saving ? null : () => setState(selected.clear),
              child: const Text('مسح الكل'),
            ),
        ],
      ),
      body: Column(
        children: [
          _header(enough),
          _searchField(),
          _categoryPills(),
          Expanded(child: _list()),
        ],
      ),
      bottomNavigationBar: _saveBar(enough),
    );
  }

  Widget _header(bool enough) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: enough
              ? AppColors.nu.withValues(alpha: .35)
              : AppColors.line,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            enough
                ? 'اخترت ${selected.length} صنف خطتك هتتبني منهم'
                : 'اخترت ${selected.length} من $minimum على الأقل',
            style: TextStyle(
              color: enough ? AppColors.nu : AppColors.text,
              fontWeight: FontWeight.w700,
              fontSize: 15,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            enough
                ? 'هنركب وجباتك من الأكل المتوفر عندك فعلا مش من قاعدة بيانات عامة'
                : 'لو اختيارك أقل من $minimum صنف مش هيكفي لوجبات متوازنة وهنرجع لقاعدة الأطعمة الكاملة. حاول تختار من كل مجموعة: بروتين ونشويات وخضار ودهون',
            style: const TextStyle(color: AppColors.muted, fontSize: 12.5, height: 1.5),
          ),
          if (error != null) ...[
            const SizedBox(height: 10),
            Text(
              error!,
              style: const TextStyle(color: AppColors.wo, fontSize: 12.5),
            ),
          ],
        ],
      ),
    );
  }

  Widget _searchField() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
      child: TextField(
        controller: search,
        onChanged: _onSearch,
        style: const TextStyle(color: AppColors.text),
        decoration: InputDecoration(
          hintText: 'ابحث عن صنف (مثال: فول قريش عيش)',
          hintStyle: const TextStyle(color: AppColors.muted, fontSize: 13),
          filled: true,
          fillColor: AppColors.card2,
          prefixIcon: const Icon(Icons.search, color: AppColors.muted, size: 20),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: AppColors.line),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: AppColors.line),
          ),
        ),
      ),
    );
  }

  Widget _categoryPills() {
    return SizedBox(
      height: 46,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: _categories.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final item = _categories[index];
          final active = item.key == category;
          return GestureDetector(
            onTap: () {
              if (active) return;
              setState(() => category = item.key);
              _load();
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                color: active ? AppColors.nu.withValues(alpha: .16) : AppColors.card,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(
                  color: active ? AppColors.nu : AppColors.line,
                ),
              ),
              child: Text(
                item.label,
                style: TextStyle(
                  color: active ? AppColors.nu : AppColors.muted,
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _list() {
    if (loading) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.nu, strokeWidth: 2),
      );
    }
    if (foods.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Text(
            search.text.trim().isEmpty
                ? 'مفيش أصناف في المجموعة دي'
                : 'ملقيناش أصناف باسم «${search.text.trim()}»',
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.muted, fontSize: 13.5),
          ),
        ),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 20),
      itemCount: foods.length,
      itemBuilder: (context, index) {
        final food = foods[index];
        final id = '${food['id']}';
        final active = selected.contains(id);
        final cal = food['cal'];
        final pro = food['pro'];
        return Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: GestureDetector(
            onTap: () => setState(() {
              if (active) {
                selected.remove(id);
              } else {
                selected.add(id);
              }
            }),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: active ? AppColors.nu.withValues(alpha: .10) : AppColors.card,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: active ? AppColors.nu.withValues(alpha: .55) : AppColors.line,
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    active ? Icons.check_circle : Icons.circle_outlined,
                    color: active ? AppColors.nu : AppColors.muted,
                    size: 22,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${food['nameAr'] ?? food['nameEn'] ?? ''}',
                          style: const TextStyle(
                            color: AppColors.text,
                            fontWeight: FontWeight.w700,
                            fontSize: 14.5,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          '$cal سعرة · بروتين $proج / 100جم',
                          style: const TextStyle(color: AppColors.muted, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _saveBar(bool enough) {
    return SafeArea(
      minimum: const EdgeInsets.fromLTRB(16, 0, 16, 14),
      child: SizedBox(
        height: 52,
        child: FilledButton(
          onPressed: saving ? null : _save,
          style: FilledButton.styleFrom(
            backgroundColor: AppColors.nu,
            foregroundColor: const Color(0xFF04231B),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
          child: saving
              ? const SizedBox(
                  height: 20,
                  width: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Color(0xFF04231B),
                  ),
                )
              : Text(
                  enough
                      ? 'احفظ وابني خطتي من دول'
                      : selected.isEmpty
                          ? 'استخدم كل الأطعمة المتاحة'
                          : 'احفظ (محتاج $minimum على الأقل)',
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
                ),
        ),
      ),
    );
  }
}
