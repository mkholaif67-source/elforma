import 'package:flutter/material.dart';
import '../theme.dart';

// ============================================================================
//  SHARED FAILURE / EMPTY / LOADING SURFACES
//
//  Before this file, six screens handled a failed request by either showing a
//  spinner forever or rendering an empty scaffold. Both look like the app is
//  broken and neither tells the trainee what to do. Worse, a trainee on a bad
//  connection had no way to retry other than force-closing the app.
//
//  Everything here is deliberately dumb: no network, no state, no navigation.
//  A screen owns its own retry logic and simply passes onRetry in.
// ============================================================================

/// Turns an HTTP status into copy a trainee can actually act on.
///
/// The status codes that matter are the ones our own server returns:
///   0   -> the request never left the phone (no connection / DNS / timeout)
///   401 -> the session expired
///   403 -> signed in, but not allowed (expired subscription)
///   429 -> our own rate limiter
///   5xx -> our server fell over; explicitly NOT the trainee's fault
String efErrorMessage(int status, [dynamic data]) {
  final code = (data is Map && data['error'] != null) ? '${data['error']}' : '';

  if (status == 0) {
    return 'مفيش اتصال بالإنترنت. اتأكد من الشبكة وجرب تاني';
  }
  if (status == 401 || code == 'unauthenticated') {
    return 'الجلسة انتهت. سجل دخول تاني';
  }
  if (status == 403) {
    if (code == 'subscription_required' || code == 'forbidden') {
      return 'محتاج اشتراك فعال عشان توصل للجزء ده';
    }
    return 'مش مسموح بالوصول للجزء ده';
  }
  if (status == 429) {
    return 'طلبات كتيرة في وقت قصير. استنى دقيقة وحاول تاني';
  }
  if (status >= 500) {
    return 'فيه مشكلة عندنا في السيرفر مش منك. جرب كمان شوية';
  }
  if (status == 404) {
    return 'مالقيناش البيانات دي';
  }
  return 'حصل خطأ غير متوقع. جرب تاني';
}

/// True when the failure is a dead connection rather than a server answer.
bool efIsOffline(int status) => status == 0;

/// The standard failure surface: icon, one honest sentence, one retry button.
class ErrorView extends StatelessWidget {
  const ErrorView({
    super.key,
    required this.message,
    this.onRetry,
    this.offline = false,
    this.retryLabel = 'حاول تاني',
    this.compact = false,
  });

  final String message;
  final VoidCallback? onRetry;
  final bool offline;
  final String retryLabel;

  /// compact = the screen already has a header/appbar above it.
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final icon = offline ? Icons.wifi_off_rounded : Icons.error_outline_rounded;

    return Center(
      child: Padding(
        padding: EdgeInsets.symmetric(
          horizontal: 28,
          vertical: compact ? 24 : 40,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: compact ? 56 : 72,
              height: compact ? 56 : 72,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.wo.withValues(alpha: 0.12),
              ),
              child: Icon(icon, size: compact ? 28 : 36, color: AppColors.wo),
            ),
            const SizedBox(height: 16),
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: AppColors.text,
                fontSize: compact ? 14 : 15,
                height: 1.6,
              ),
            ),
            if (onRetry != null) ...[
              const SizedBox(height: 20),
              FilledButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh_rounded, size: 18),
                label: Text(retryLabel),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.nu,
                  foregroundColor: AppColors.bg,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 26, vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// "Nothing here yet" — a success with no data, which is NOT an error and must
/// never be dressed up as one.
class EmptyView extends StatelessWidget {
  const EmptyView({
    super.key,
    required this.message,
    this.icon = Icons.inbox_rounded,
    this.actionLabel,
    this.onAction,
  });

  final String message;
  final IconData icon;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 44, color: AppColors.muted),
            const SizedBox(height: 14),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(
                  color: AppColors.muted, fontSize: 14, height: 1.6),
            ),
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 18),
              FilledButton(
                onPressed: onAction,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.nu,
                  foregroundColor: AppColors.bg,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: Text(actionLabel!),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// One spinner for the whole app so loading never looks different per screen.
class LoadingView extends StatelessWidget {
  const LoadingView({super.key, this.label});

  final String? label;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CircularProgressIndicator(color: AppColors.nu),
          if (label != null) ...[
            const SizedBox(height: 14),
            Text(
              label!,
              style: const TextStyle(color: AppColors.muted, fontSize: 13),
            ),
          ],
        ],
      ),
    );
  }
}
