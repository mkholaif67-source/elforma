// mobile/lib/connectivity_service.dart
// خدمة مراقبة حالة النت ومزامنة البيانات المؤجلة عند عودة الإنترنت
//
// الطريقة:
//   1. تراقب تغييرات الاتصال بلحظة بلحظة باستخدام connectivity_plus
//   2. لما يعود النت → تشغّل flushOfflineQueue() تلقائيًا
//   3. تعرض Banner أسفل الشاشة لما يكون التطبيق أوفلاين
import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'api.dart';

class ConnectivityService {
  ConnectivityService._();
  static final I = ConnectivityService._();

  final _connectivity = Connectivity();
  StreamSubscription? _sub;

  // ستريم بيبث قيمة bool: true = متصل، false = أوفلاين
  final _controller = StreamController<bool>.broadcast();
  Stream<bool> get onlineStream => _controller.stream;

  bool _isOnline = true;
  bool get isOnline => _isOnline;

  int _pendingCount = 0;
  int get pendingCount => _pendingCount;

  Future<void> init() async {
    // فحص الحالة المبدئية
    final result = await _connectivity.checkConnectivity();
    _isOnline = _isConnected(result);
    _updatePending();

    // استمع للتغييرات
    _sub = _connectivity.onConnectivityChanged.listen((result) async {
      final wasOffline = !_isOnline;
      _isOnline = _isConnected(result);
      _controller.add(_isOnline);

      if (_isOnline && wasOffline) {
        // عاد النت → عمل مزامنة فورية
        await _flush();
      }
    });
  }

  Future<void> _flush() async {
    final remaining = await Api.I.flushOfflineQueue();
    _pendingCount = remaining;
    _controller.add(_isOnline);
  }

  Future<void> _updatePending() async {
    _pendingCount = await Api.I.pendingOfflineCount();
  }

  bool _isConnected(List<ConnectivityResult> result) {
    return result.any((r) =>
      r == ConnectivityResult.mobile ||
      r == ConnectivityResult.wifi ||
      r == ConnectivityResult.ethernet);
  }

  void dispose() {
    _sub?.cancel();
    _controller.close();
  }
}
