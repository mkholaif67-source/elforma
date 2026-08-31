// ── ElForma · screens/reviews_screen.dart ──
// Reviews: list all + submit/edit the user's own (server-side one-per-user).
// التقييمات: عرض وإضافة.

import 'package:flutter/material.dart';
import '../api.dart';
import '../theme.dart';

/// Native reviews screen. Shows approved reviews + aggregate stats from
/// /api/reviews, and lets a signed-in user submit their own review
/// (/api/reviews) which appears after server-side moderation.
class ReviewsScreen extends StatefulWidget {
  const ReviewsScreen({super.key});
  @override
  State<ReviewsScreen> createState() => _ReviewsScreenState();
}

class _ReviewsScreenState extends State<ReviewsScreen> {
  bool _loading = true;
  List<Map<String, dynamic>> _reviews = [];
  Map<String, dynamic> _stats = {};
  Map<String, dynamic>? _mine;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final results = await Future.wait([
      Api.I.reviewsList(),
      Api.I.reviewMine(),
    ]);
    if (!mounted) return;
    final list = results[0];
    final mine = results[1];
    setState(() {
      _loading = false;
      if (list.ok) {
        _reviews = ((list.data['reviews'] as List?) ?? [])
            .whereType<Map>()
            .map((e) => e.cast<String, dynamic>())
            .toList();
        _stats = (list.data['stats'] as Map?)?.cast<String, dynamic>() ?? {};
      }
      if (mine.ok && mine.data['review'] is Map) {
        _mine = (mine.data['review'] as Map).cast<String, dynamic>();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: const Text('آراء المشتركين',
            style: TextStyle(fontWeight: FontWeight.w900)),
        centerTitle: true,
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.nu,
        onPressed: _openForm,
        icon: const Icon(Icons.rate_review, color: Colors.white),
        label: Text(_mine != null ? 'عدل تقييمك' : 'أضف تقييمك',
            style: const TextStyle(
                color: Colors.white, fontWeight: FontWeight.w800)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.nu))
          : RefreshIndicator(
              onRefresh: _load,
              color: AppColors.nu,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 90),
                children: [
                  _statsHeader(),
                  if (_mine != null) ...[
                    const SizedBox(height: 16),
                    _mineCard(),
                  ],
                  const SizedBox(height: 18),
                  if (_reviews.isEmpty)
                    _empty()
                  else
                    ..._reviews.map(_reviewCard),
                ],
              ),
            ),
    );
  }

  Widget _statsHeader() {
    final avg = _stats['avg'] is num
        ? (_stats['avg'] as num).toDouble()
        : double.tryParse('${_stats['avg'] ?? ''}') ?? 0;
    final count = _stats['count'] ?? _reviews.length;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: LinearGradient(colors: [
          AppColors.nu.withValues(alpha: .16),
          AppColors.nu2.withValues(alpha: .05),
        ]),
        border: Border.all(color: AppColors.nu.withValues(alpha: .25)),
      ),
      child: Row(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(avg > 0 ? avg.toStringAsFixed(1) : '—',
                  style: const TextStyle(
                      fontSize: 40, fontWeight: FontWeight.w900)),
              _stars(avg.round(), size: 18),
            ],
          ),
          const SizedBox(width: 20),
          Expanded(
            child: Text('متوسط تقييم $count مشترك للتطبيق\nآراء حقيقية بعد المراجعة',
                style: const TextStyle(
                    color: AppColors.muted, fontSize: 12.5, height: 1.6)),
          ),
        ],
      ),
    );
  }

  Widget _stars(int rating, {double size = 16}) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (i) {
        return Icon(
          i < rating ? Icons.star_rounded : Icons.star_outline_rounded,
          color: AppColors.wo2,
          size: size,
        );
      }),
    );
  }

  Widget _mineCard() {
    final status = _mine!['status']?.toString() ?? '';
    final statusLabel = status == 'approved'
        ? 'ظاهر للجميع'
        : status == 'rejected'
            ? 'مرفوض'
            : 'قيد المراجعة';
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.nu.withValues(alpha: .3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            const Text('تقييمك',
                style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14)),
            const Spacer(),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.bg2,
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(statusLabel,
                  style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 11,
                      fontWeight: FontWeight.w700)),
            ),
          ]),
          const SizedBox(height: 8),
          _stars((_mine!['rating'] as num?)?.round() ?? 0),
          if ((_mine!['body']?.toString() ?? '').isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(_mine!['body'].toString(),
                style: const TextStyle(height: 1.6, fontSize: 13)),
          ],
        ],
      ),
    );
  }

  Widget _reviewCard(Map<String, dynamic> r) {
    final rating = (r['rating'] as num?)?.round() ?? 0;
    final name = r['name']?.toString() ?? 'مستخدم';
    final title = r['title']?.toString() ?? '';
    final body = r['body']?.toString() ?? '';
    final isCustomer = r['is_customer'] == true;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.line.withValues(alpha: .5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            CircleAvatar(
              radius: 18,
              backgroundColor: AppColors.nu.withValues(alpha: .16),
              child: Text(
                  name.isNotEmpty ? name.characters.first : '•',
                  style: const TextStyle(
                      color: AppColors.nu2, fontWeight: FontWeight.w900)),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Flexible(
                      child: Text(name,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontWeight: FontWeight.w800, fontSize: 13.5)),
                    ),
                    if (isCustomer) ...[
                      const SizedBox(width: 6),
                      const Icon(Icons.verified,
                          color: AppColors.nu2, size: 15),
                    ],
                  ]),
                  const SizedBox(height: 2),
                  _stars(rating, size: 14),
                ],
              ),
            ),
          ]),
          if (title.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(title,
                style: const TextStyle(
                    fontWeight: FontWeight.w800, fontSize: 14)),
          ],
          if (body.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(body,
                style: const TextStyle(
                    height: 1.6, fontSize: 13, color: AppColors.text)),
          ],
        ],
      ),
    );
  }

  Widget _empty() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 40),
      child: Column(
        children: [
          const Icon(Icons.reviews_outlined,
              color: AppColors.muted, size: 44),
          const SizedBox(height: 12),
          const Text('لسه مفيش تقييمات كن أول واحد!',
              style: TextStyle(color: AppColors.muted)),
        ],
      ),
    );
  }

  void _openForm() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.card2,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(22))),
      builder: (_) => _ReviewForm(existing: _mine),
    ).then((changed) {
      if (changed == true) {
        setState(() => _loading = true);
        _load();
      }
    });
  }
}

// ------------------------------------------------------------ REVIEW FORM
class _ReviewForm extends StatefulWidget {
  final Map<String, dynamic>? existing;
  const _ReviewForm({this.existing});
  @override
  State<_ReviewForm> createState() => _ReviewFormState();
}

class _ReviewFormState extends State<_ReviewForm> {
  int _rating = 5;
  final _title = TextEditingController();
  final _body = TextEditingController();
  bool _submitting = false;
  String? _error;
  String? _done;

  @override
  void initState() {
    super.initState();
    if (widget.existing != null) {
      _rating = (widget.existing!['rating'] as num?)?.round() ?? 5;
      _title.text = widget.existing!['title']?.toString() ?? '';
      _body.text = widget.existing!['body']?.toString() ?? '';
    }
  }

  @override
  void dispose() {
    _title.dispose();
    _body.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final body = _body.text.trim();
    if (body.length < 10) {
      setState(() => _error = 'اكتب مراجعة لا تقل عن 10 أحرف');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    final r = await Api.I.reviewSubmit({
      'rating': _rating,
      'title': _title.text.trim(),
      'body': body,
    });
    if (!mounted) return;
    setState(() {
      _submitting = false;
      if (r.status == 401) {
        _error = 'سجل دخولك الأول عشان تقدر تقيم';
      } else if (r.ok && r.data['ok'] == true) {
        _done = r.data['message']?.toString() ??
            'تم استلام تقييمك وهيظهر بعد المراجعة. شكرا!';
      } else {
        _error = r.error.isNotEmpty ? r.error : 'تعذر إرسال التقييم';
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 18, 20, 20 + bottom),
      child: _done != null ? _successView() : _form(),
    );
  }

  Widget _form() {
    return SingleChildScrollView(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 42,
              height: 4,
              decoration: BoxDecoration(
                  color: AppColors.line,
                  borderRadius: BorderRadius.circular(4)),
            ),
          ),
          const SizedBox(height: 16),
          const Text('قيم تجربتك مع الفورمة',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
          const SizedBox(height: 14),
          Center(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: List.generate(5, (i) {
                final idx = i + 1;
                return IconButton(
                  // Star ratings are meaningless to a screen reader without this.
                  tooltip: 'تقييم $idx من 5',
                  onPressed: () => setState(() => _rating = idx),
                  icon: Icon(
                    idx <= _rating
                        ? Icons.star_rounded
                        : Icons.star_outline_rounded,
                    color: AppColors.wo2,
                    size: 38,
                  ),
                );
              }),
            ),
          ),
          const SizedBox(height: 6),
          TextField(
            controller: _title,
            style: const TextStyle(
                fontWeight: FontWeight.w700, color: AppColors.text),
            decoration: _dec('عنوان (اختياري)'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _body,
            maxLines: 4,
            maxLength: 2000,
            style: const TextStyle(color: AppColors.text, height: 1.5),
            decoration: _dec('اكتب مراجعتك (10 أحرف على الأقل)'),
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!,
                style: const TextStyle(
                    color: Colors.redAccent, fontWeight: FontWeight.w600)),
          ],
          const SizedBox(height: 14),
          SizedBox(
            height: 52,
            child: ElevatedButton(
              onPressed: _submitting ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.nu,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
              ),
              child: _submitting
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                          strokeWidth: 2.4, color: Colors.white))
                  : const Text('إرسال التقييم',
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w900)),
            ),
          ),
        ],
      ),
    );
  }

  InputDecoration _dec(String hint) => InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: AppColors.muted, fontSize: 13),
        filled: true,
        fillColor: AppColors.bg2,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: AppColors.line.withValues(alpha: .6)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.nu2, width: 1.3),
        ),
      );

  Widget _successView() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const SizedBox(height: 8),
        Container(
          width: 64,
          height: 64,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: AppColors.nu.withValues(alpha: .16),
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.check_rounded,
              color: AppColors.nu2, size: 36),
        ),
        const SizedBox(height: 14),
        Text(_done!,
            textAlign: TextAlign.center,
            style: const TextStyle(
                fontSize: 14, height: 1.6, fontWeight: FontWeight.w700)),
        const SizedBox(height: 18),
        SizedBox(
          width: double.infinity,
          height: 50,
          child: ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.nu,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('تمام',
                style: TextStyle(
                    color: Colors.white, fontWeight: FontWeight.w900)),
          ),
        ),
      ],
    );
  }
}
