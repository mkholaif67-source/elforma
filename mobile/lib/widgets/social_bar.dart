// ── ElForma · widgets/social_bar.dart ──
// أيقونات السوشيال ميديا بشكل أنيق (SVG). الروابط قابلة للتعديل من مكان واحد.
// لو عايز تغير الحسابات، غير قيم kSocialLinks تحت بس.

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:elforma/theme.dart';

/// [OWNER-RULE] روابط السوشيال placeholder بايظة مؤقتا — مافيش حسابات
/// أشخاص حقيقية هنا. لما تحط لينكاتك الفعلية غير القيم دي بس.
const Map<String, String> kSocialLinks = {
  'facebook': '#',
  'instagram': '#',
  'tiktok': '#',
  'twitter': '#',
};

class _Social {
  final String key;
  final String asset;
  final Color color;
  const _Social(this.key, this.asset, this.color);
}

class SocialBar extends StatelessWidget {
  const SocialBar({super.key});

  static const List<_Social> _items = [
    _Social('facebook', 'assets/social/facebook.svg', Color(0xFF1877F2)),
    _Social('instagram', 'assets/social/instagram.svg', Color(0xFFE1306C)),
    _Social('tiktok', 'assets/social/tiktok.svg', Color(0xFF25F4EE)),
    _Social('twitter', 'assets/social/twitter.svg', Color(0xFF1DA1F2)),
  ];

  bool _isPlaceholder(String? url) =>
      url == null || url.isEmpty || url == '#' || !url.startsWith('http');

  Future<void> _open(String key, BuildContext context) async {
    final url = kSocialLinks[key];
    // [OWNER-RULE] لينك بايظ مؤقت: ما نفتحش حاجة ونوري تنبيه لطيف.
    if (_isPlaceholder(url)) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('الحساب لسة مش متاح — هيتضاف قريبا')));
      return;
    }
    final uri = Uri.tryParse(url!);
    if (uri == null) return;
    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      // تجاهل بصمت لو مفيش متصفح.
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const Text('تابعنا على',
            style: TextStyle(color: AppColors.muted, fontSize: 12, fontWeight: FontWeight.w700)),
        const SizedBox(height: 12),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            for (final s in _items) ...[
              _iconButton(s, context),
              const SizedBox(width: 14),
            ],
          ],
        ),
      ],
    );
  }

  Widget _iconButton(_Social s, BuildContext context) {
    return GestureDetector(
      onTap: () => _open(s.key, context),
      child: Container(
        width: 46,
        height: 46,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: AppColors.card,
          border: Border.all(color: s.color.withValues(alpha: .55), width: 1.4),
          boxShadow: [
            BoxShadow(
              color: s.color.withValues(alpha: .22),
              blurRadius: 14,
              spreadRadius: 0,
            ),
          ],
        ),
        child: Center(
          child: SvgPicture.asset(
            s.asset,
            width: 21,
            height: 21,
            colorFilter: ColorFilter.mode(s.color, BlendMode.srcIn),
          ),
        ),
      ),
    );
  }
}
