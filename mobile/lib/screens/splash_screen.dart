// ── ElForma · screens/splash_screen.dart ──
// Splash with the brand logo; boots the session and routes to auth or the app shell.
// شاشة البداية: شعار البراند + جملة تسويقية + إبهار حركي، بدون تكرار اسم التطبيق.

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../api.dart';
import '../models/profile_store.dart';
import '../theme.dart';
import '../widgets/error_view.dart';
import 'auth_screen.dart';
import 'shell_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});
  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

/// Single source of truth for where the brand mark sits on screen.
/// The glow, the radar rings and the logo all read this one value, so they
/// are concentric by construction and cannot drift apart again.
const Alignment _markCentre = Alignment(0, -0.30);

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    )..repeat(reverse: true);
    _boot();
  }

  // A boot that cannot reach the server used to fall through to the login
  // screen, which told the trainee a lie: they were never signed out, the
  // phone just had no connection — and they could not log in either.
  String? _bootError;
  bool _bootOffline = false;

  Future<void> _retryBoot() {
    setState(() { _bootError = null; });
    return _boot();
  }

  Future<void> _boot() async {
    await Api.I.init();

    /* Release gate first. If this build has been retired on the server we stop
       here instead of letting someone keep writing data with a version we know
       is broken. UpdateGate.check() never throws and never blocks on a network
       failure, so a bad signal cannot lock a paying user out of the app. */
    final gate = await UpdateGate.check();

    /* Maintenance is checked before the update gate because both arrive as
       `required`, but they are not the same dead end: an update sends you to
       the store, maintenance just asks you to wait. Showing the store button
       during maintenance would send the trainee chasing a fix that does not
       exist, so the two screens are kept separate. */
    if (gate.maintenance) {
      if (!mounted) return;
      Navigator.of(context).pushReplacement(MaterialPageRoute(
        builder: (_) => _MaintenanceScreen(gate: gate),
      ));
      return;
    }

    if (gate.verdict == UpdateVerdict.required) {
      if (!mounted) return;
      Navigator.of(context).pushReplacement(MaterialPageRoute(
        builder: (_) => _ForcedUpdateScreen(gate: gate),
      ));
      return;
    }

    final res = await Api.I.me();

    /* Distinguish "cannot reach the server" from "not signed in".
       401 is a real answer: there is no session, so the login screen is
       correct. A dead connection (0) or a server fault (5xx) is NOT an answer,
       and must never be presented as a logout. */
    if (!res.ok && (res.status == 0 || res.status >= 500)) {
      if (!mounted) return;
      setState(() {
        _bootOffline = efIsOffline(res.status);
        _bootError = efErrorMessage(res.status, res.data);
      });
      return;
    }

    final user = res.data['user'];
    // Warm the single source of truth while the splash animation plays, so the
    // workout and diet tabs can open straight onto results with no flicker.
    if (user != null) {
      await ProfileStore.I.ensureLoaded(force: true);
    }
    await Future.delayed(const Duration(milliseconds: 500));
    if (!mounted) return;
    Navigator.of(context).pushReplacement(MaterialPageRoute(
      builder: (_) => user != null ? const ShellScreen() : const AuthScreen(),
    ));
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_bootError != null) {
      return Scaffold(
        backgroundColor: AppColors.bg,
        body: ErrorView(
          message: _bootError!,
          offline: _bootOffline,
          onRetry: _retryBoot,
        ),
      );
    }
    return Scaffold(
      body: AnimatedBuilder(
        animation: _c,
        builder: (context, _) {
          final t = Curves.easeInOut.transform(_c.value);
          final glow = 0.30 + t * 0.40;
          final scale = 0.94 + t * 0.10;
          return Container(
            decoration: const BoxDecoration(
              gradient: RadialGradient(
                center: Alignment(0, -0.28),
                radius: 1.15,
                colors: [Color(0xFF0C1A2C), AppColors.bg],
              ),
            ),
            child: Stack(
              children: [
                // Ambient brand glow that breathes behind the mark.
                Align(
                  alignment: _markCentre,
                  child: Container(
                    width: 340,
                    height: 340,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: RadialGradient(colors: [
                        AppColors.nu.withValues(alpha: 0.18 * (glow / 0.7)),
                        Colors.transparent,
                      ]),
                    ),
                  ),
                ),
                // Aesthetic: calm radar rings breathing out of the brand mark.
                ...List.generate(3, (i) {
                  final phase = (t + i / 3) % 1.0;
                  final ringSize = 150.0 + phase * 200.0;
                  final fade = (1.0 - phase).clamp(0.0, 1.0);
                  return Align(
                    alignment: _markCentre,
                    child: Container(
                      width: ringSize,
                      height: ringSize,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                            color: AppColors.nu.withValues(alpha: 0.20 * fade),
                            width: 1.2),
                      ),
                    ),
                  );
                }),
                // The mark must share the EXACT centre of the rings above.
                // It used to sit in a centred Column while the rings were
                // anchored at Alignment(0, -0.30), so the glow never wrapped
                // the logo. Both now read from the same constant.
                Align(
                  alignment: _markCentre,
                  child: Transform.scale(
                        scale: scale,
                        child: Container(
                          width: 134,
                          height: 134,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(36),
                            boxShadow: [
                              BoxShadow(
                                color: AppColors.nu.withValues(alpha: glow),
                                blurRadius: 60,
                                spreadRadius: 6,
                              ),
                              BoxShadow(
                                color:
                                    AppColors.wo.withValues(alpha: glow * 0.35),
                                blurRadius: 90,
                                spreadRadius: 2,
                              ),
                            ],
                          ),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(36),
                            child: Image.asset('assets/logo.png',
                                width: 134, height: 134, fit: BoxFit.contain),
                          ),
                        ),
                      ),
                ),
                // The loader is its own layer. Keeping it out of the logo's
                // column is what guarantees it can never shift the mark off
                // the centre of the rings again.
                Align(
                  alignment: const Alignment(0, 0.34),
                  child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: List.generate(3, (i) {
                          final phase = (t + i * 0.22) % 1.0;
                          final a =
                              (1 - (phase - 0.5).abs() * 2).clamp(0.0, 1.0);
                          return Container(
                            margin:
                                const EdgeInsets.symmetric(horizontal: 4),
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: AppColors.nu
                                  .withValues(alpha: 0.25 + 0.75 * a),
                            ),
                          );
                        }),
                      ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

/// Shown while the admin has the app switched off from the dashboard. Unlike
/// the forced-update screen this is a TEMPORARY dead end, so the single action
/// it offers is a fresh boot: the moment maintenance is turned off in the
/// dashboard, tapping retry lets the trainee straight back in with no reinstall
/// and no store trip.
class _MaintenanceScreen extends StatelessWidget {
  const _MaintenanceScreen({required this.gate});
  final UpdateGate gate;

  @override
  Widget build(BuildContext context) {
    final title =
        gate.maintenanceTitle.trim().isEmpty ? 'صيانة مؤقتة' : gate.maintenanceTitle.trim();
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 96,
                  height: 96,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.wo.withValues(alpha: 0.14),
                    border: Border.all(
                        color: AppColors.wo.withValues(alpha: 0.40), width: 1.4),
                  ),
                  child: const Icon(Icons.build_circle_rounded,
                      color: AppColors.wo, size: 46),
                ),
                const SizedBox(height: 24),
                Text(
                  title,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                      color: AppColors.text,
                      fontSize: 24,
                      fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 12),
                Text(
                  gate.message,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                      color: AppColors.muted, fontSize: 15, height: 1.6),
                ),
                const SizedBox(height: 28),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.nu,
                      foregroundColor: Colors.black,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14)),
                    ),
                    onPressed: () => Navigator.of(context).pushReplacement(
                      MaterialPageRoute(builder: (_) => const SplashScreen()),
                    ),
                    icon: const Icon(Icons.refresh_rounded, size: 20),
                    label: const Text('جرّب تاني',
                        style: TextStyle(
                            fontSize: 16, fontWeight: FontWeight.w800)),
                  ),
                ),
                const SizedBox(height: 18),
                const Text(
                  'بياناتك واشتراكك محفوظين زي ما همّا',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.muted, fontSize: 12.5),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Shown ONLY when the server has retired this build. There is deliberately no
/// way past it: the whole point is that a release we know is broken stops
/// writing data. It is a dead end by design, so it must explain itself clearly
/// and hand the user a single obvious action.
class _ForcedUpdateScreen extends StatelessWidget {
  const _ForcedUpdateScreen({required this.gate});
  final UpdateGate gate;

  Future<void> _openStore(BuildContext context) async {
    final url = gate.storeUrl.trim();
    if (url.isEmpty) return;
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    final opened =
        await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('تعذر فتح المتجر حدث التطبيق يدويا')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 96,
                  height: 96,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.wo.withValues(alpha: 0.14),
                    border: Border.all(
                        color: AppColors.wo.withValues(alpha: 0.40), width: 1.4),
                  ),
                  child: const Icon(Icons.system_update_rounded,
                      color: AppColors.wo, size: 44),
                ),
                const SizedBox(height: 24),
                const Text(
                  'محتاج تحديث',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      color: AppColors.text,
                      fontSize: 24,
                      fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 12),
                Text(
                  gate.message,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                      color: AppColors.muted, fontSize: 15, height: 1.6),
                ),
                const SizedBox(height: 28),
                if (gate.storeUrl.trim().isNotEmpty)
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.nu,
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14)),
                      ),
                      onPressed: () => _openStore(context),
                      child: const Text('حدث دلوقتي',
                          style: TextStyle(
                              fontSize: 16, fontWeight: FontWeight.w800)),
                    ),
                  )
                else
                  const Text(
                    'حدث التطبيق من المتجر وافتحه تاني',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppColors.muted, fontSize: 13.5),
                  ),
                const SizedBox(height: 18),
                Text(
                  'نسختك الحالية: $kAppBuild',
                  style: const TextStyle(
                      color: AppColors.muted, fontSize: 11.5),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
