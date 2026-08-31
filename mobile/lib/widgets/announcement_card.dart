// ── ElForma · widgets/announcement_card.dart ──
// كارت الإعلان اللي الأدمن بيظبطه من لوحة الإدارة.
//
// كل حقل بيوصل من السيرفر له تأثير حقيقي هنا — مفيش حقل متجاهل:
//  · title / body / image / link / cta / phone
//  · style       → لون الحد والتدرج والأيقونة
//  · dismissible → زر الإغلاق (وبيتحفظ محليًا فمايرجعش تاني)
//  · maxViews    → أقصى عدد مرات ظهور للمستخدم ده (0 = بلا حدود)
//
// الإغلاق وعدّاد المشاهدات متعامل معاهم جوّا الكارت نفسه بـ SharedPreferences،
// عشان أي شاشة تستخدم الكارت تاخد السلوك ده من غير تكرار منطق.

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
import '../theme.dart';

class AnnouncementCard extends StatefulWidget {
  const AnnouncementCard({super.key, required this.data});
  final Map<String, dynamic> data;

  @override
  State<AnnouncementCard> createState() => _AnnouncementCardState();
}

class _AnnouncementCardState extends State<AnnouncementCard> {
  // الحالات التلاتة: بنتأكد الأول ، بنعرض ، مخفي خلاص.
  bool _checked = false;
  bool _hidden = false;

  String get _id {
    final raw = (widget.data['id'] ?? '').toString().trim();
    if (raw.isNotEmpty) return raw;
    // لو مفيش id لسبب ما، بنعتمد على العنوان كمفتاح مستقر.
    return 't:${(widget.data['title'] ?? '').toString().trim()}';
  }

  String _s(String key) => (widget.data[key] ?? '').toString().trim();

  int get _maxViews {
    final v = widget.data['maxViews'];
    if (v is num) return v.toInt();
    return int.tryParse('$v') ?? 0;
  }

  bool get _dismissible => widget.data['dismissible'] != false;

  @override
  void initState() {
    super.initState();
    _gate();
  }

  /// بيقرر هل الكارت يظهر ولا لأ، وبيزوّد عدّاد المشاهدات مرة واحدة لكل عرض.
  Future<void> _gate() async {
    try {
      final sp = await SharedPreferences.getInstance();
      final dismissed = sp.getStringList('ann_dismissed') ?? const <String>[];
      if (dismissed.contains(_id)) {
        if (mounted) setState(() { _hidden = true; _checked = true; });
        return;
      }
      final cap = _maxViews;
      if (cap > 0) {
        final key = 'ann_views_$_id';
        final seen = sp.getInt(key) ?? 0;
        if (seen >= cap) {
          if (mounted) setState(() { _hidden = true; _checked = true; });
          return;
        }
        await sp.setInt(key, seen + 1);
      }
    } catch (_) {
      // فشل التخزين المحلي ماينفعش يخفي إعلان الأدمن — بنعرضه عادي.
    }
    if (mounted) setState(() => _checked = true);
  }

  Future<void> _dismiss() async {
    setState(() => _hidden = true);
    try {
      final sp = await SharedPreferences.getInstance();
      final list = sp.getStringList('ann_dismissed') ?? const <String>[];
      if (!list.contains(_id)) {
        // بنحدّ القائمة عشان ماتكبرش للأبد.
        final next = [...list, _id];
        await sp.setStringList(
            'ann_dismissed', next.length > 200 ? next.sublist(next.length - 200) : next);
      }
    } catch (_) {}
  }

  Future<void> _open(String raw) async {
    if (raw.isEmpty) return;
    var url = raw.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://') &&
        !url.startsWith('tel:') && !url.startsWith('mailto:') &&
        !url.startsWith('wa.me') && !url.startsWith('whatsapp:') &&
        !url.startsWith('instagram:') && !url.startsWith('fb:')) {
      url = 'https://$url';
    }
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    bool launched = false;
    try {
      launched = await launchUrl(uri, mode: LaunchMode.platformDefault);
    } catch (_) {}
    if (!launched) {
      try { await launchUrl(uri, mode: LaunchMode.externalApplication); } catch (_) {}
    }
  }

  Future<void> _call(String phone) async {
    final digits = phone.replaceAll(RegExp(r'[^0-9+]'), '');
    if (digits.isEmpty) return;
    final uri = Uri.parse('tel:$digits');
    try { await launchUrl(uri, mode: LaunchMode.externalApplication); } catch (_) {}
  }

  /// شكل الكارت حسب style اللي اختاره الأدمن.
  ({Color tint, IconData icon}) get _look {
    switch (_s('style')) {
      case 'success':
        return (tint: AppColors.nu, icon: Icons.check_circle_rounded);
      case 'warn':
        return (tint: const Color(0xFFFBBF24), icon: Icons.warning_amber_rounded);
      case 'promo':
        return (tint: const Color(0xFFA78BFA), icon: Icons.local_offer_rounded);
      default:
        return (tint: const Color(0xFF38BDF8), icon: Icons.campaign_rounded);
    }
  }

  @override
  Widget build(BuildContext context) {
    // قبل ما نقرأ التخزين مابنومضش بالكارت وبعدين نخفيه.
    if (!_checked || _hidden) return const SizedBox.shrink();

    final look = _look;
    final title = _s('title').isEmpty ? 'إعلان' : _s('title');
    final body = _s('body');
    final link = _s('link');
    final phone = _s('phone');
    final image = _s('image');
    final cta = _s('cta').isEmpty ? 'اعرف أكتر' : _s('cta');

    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: LinearGradient(colors: [look.tint.withValues(alpha: .14), AppColors.card]),
        border: Border.all(color: look.tint.withValues(alpha: .28)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        if (image.isNotEmpty)
          AspectRatio(
            aspectRatio: 16 / 7,
            child: Image.network(
              image,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => const SizedBox.shrink(),
              loadingBuilder: (c, w, p) => p == null
                  ? w
                  : Container(color: AppColors.card2, child: const Center(child: CircularProgressIndicator(strokeWidth: 2))),
            ),
          ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Icon(look.icon, size: 18, color: look.tint),
              const SizedBox(width: 8),
              Expanded(
                child: Text(title,
                    style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15)),
              ),
              // زر الإغلاق بيظهر بس لما الأدمن يسمح بكده.
              if (_dismissible)
                GestureDetector(
                  onTap: _dismiss,
                  behavior: HitTestBehavior.opaque,
                  child: const Padding(
                    padding: EdgeInsets.only(right: 4, left: 4, bottom: 4),
                    child: Icon(Icons.close_rounded, size: 18, color: AppColors.muted),
                  ),
                ),
            ]),
            if (body.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(body, style: const TextStyle(color: AppColors.muted, fontSize: 12.5, height: 1.5)),
            ],
            if (link.isNotEmpty || phone.isNotEmpty) ...[
              const SizedBox(height: 12),
              Wrap(spacing: 8, runSpacing: 8, children: [
                if (link.isNotEmpty)
                  FilledButton.icon(
                    style: FilledButton.styleFrom(
                      backgroundColor: look.tint,
                      foregroundColor: const Color(0xFF04231B),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    ),
                    onPressed: () => _open(link),
                    icon: const Icon(Icons.open_in_new_rounded, size: 18),
                    label: Text(cta, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 12.5)),
                  ),
                if (phone.isNotEmpty)
                  OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.wo2,
                      side: BorderSide(color: AppColors.wo.withValues(alpha: .5)),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    ),
                    onPressed: () => _call(phone),
                    icon: const Icon(Icons.call_rounded, size: 18),
                    label: Text(phone, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
                  ),
              ]),
            ],
          ]),
        ),
      ]),
    );
  }
}
