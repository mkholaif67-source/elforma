// mobile/lib/widgets/offline_banner.dart
// بانر صغير يظهر أسفل الشاشة عند انقطاع النت
// يختفي تلقائيًا لما يعود الاتصال وتنتهي المزامنة
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:elforma/connectivity_service.dart';
import 'package:elforma/theme.dart';

class OfflineBanner extends StatefulWidget {
  final Widget child;
  const OfflineBanner({super.key, required this.child});

  @override
  State<OfflineBanner> createState() => _OfflineBannerState();
}

class _OfflineBannerState extends State<OfflineBanner>
    with SingleTickerProviderStateMixin {
  bool _offline = false;
  int _pending = 0;
  bool _justSynced = false;
  StreamSubscription? _sub;
  late AnimationController _anim;

  @override
  void initState() {
    super.initState();
    _anim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 280),
    );
    final svc = ConnectivityService.I;
    _offline = !svc.isOnline;
    _pending = svc.pendingCount;
    if (_offline) _anim.forward();

    _sub = svc.onlineStream.listen((online) async {
      if (!mounted) return;
      setState(() {
        _offline = !online;
        _pending = svc.pendingCount;
      });
      if (online) {
        // عرض رسالة المزامنة لثانيتين ثم اختفاء
        setState(() => _justSynced = true);
        await Future.delayed(const Duration(seconds: 3));
        if (mounted) setState(() => _justSynced = false);
        await _anim.reverse();
      } else {
        await _anim.forward();
      }
    });
  }

  @override
  void dispose() {
    _sub?.cancel();
    _anim.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Banner
        SizeTransition(
          sizeFactor: _anim,
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 300),
            child: _justSynced
                ? _syncedBar()
                : _offline
                    ? _offlineBar()
                    : const SizedBox.shrink(),
          ),
        ),
        Expanded(child: widget.child),
      ],
    );
  }

  Widget _offlineBar() {
    return Container(
      key: const ValueKey('offline'),
      color: const Color(0xFF2D2D2D),
      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.wifi_off_rounded, color: Colors.white60, size: 14),
          const SizedBox(width: 6),
          Text(
            _pending > 0
                ? 'لا يوجد نت • $_pending عملية مؤجلة'
                : 'لا يوجد نت • بياناتك محفوظة على الجهاز',
            style: const TextStyle(
              color: Colors.white70,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _syncedBar() {
    return Container(
      key: const ValueKey('synced'),
      color: AppColors.nu.withOpacity(0.9),
      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 16),
      child: const Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.cloud_done_rounded, color: Colors.white, size: 14),
          SizedBox(width: 6),
          Text(
            'تمت المزامنة بنجاح',
            style: TextStyle(
              color: Colors.white,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
