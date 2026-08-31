// ── ElForma · theme.dart ──
// Central design tokens: AppColors palette + shared ThemeData. Single source for styling.
// مصدر الألوان والثيم الموحد — لا تكتب ألوانا ثابتة خارجه.

import 'package:flutter/material.dart';

class AppColors {
  static const bg = Color(0xFF070B14);
  static const bg2 = Color(0xFF0B1220);
  static const card = Color(0xFF0E1626);
  static const card2 = Color(0xFF0B1220);
  static const line = Color(0x1AFFFFFF);
  static const text = Color(0xFFEAF2F7);
  static const muted = Color(0xFF8496AB);
  // nutrition (teal) + workout (orange) brand accents
  static const nu = Color(0xFF00D4AA);
  static const nu2 = Color(0xFF37E6C2);
  static const wo = Color(0xFFFF6B35);
  static const wo2 = Color(0xFFFF8F5E);
}

ThemeData buildTheme() {
  final base = ThemeData.dark(useMaterial3: true);
  return base.copyWith(
    scaffoldBackgroundColor: AppColors.bg,
    colorScheme: base.colorScheme.copyWith(
      primary: AppColors.nu,
      secondary: AppColors.wo,
      surface: AppColors.card,
    ),
    textTheme: base.textTheme.apply(
      bodyColor: AppColors.text,
      displayColor: AppColors.text,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.card2,
      hintStyle: const TextStyle(color: AppColors.muted),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: AppColors.line),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: AppColors.nu, width: 1.6),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: AppColors.card,
      indicatorColor: AppColors.nu.withValues(alpha: .16),
      labelTextStyle: WidgetStateProperty.all(
        const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
      ),
    ),
  );
}
