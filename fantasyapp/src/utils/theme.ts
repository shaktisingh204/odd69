// Fantasy App Theme — Dream11-inspired red with premium glassmorphism accents
export const Colors = {
  // Primary brand
  primary: '#D13239',
  primaryDark: '#8F1C22',
  primaryLight: '#F05057',
  accent: '#FF8A5B',
  accentGold: '#FFD166',

  // Backgrounds
  bg: '#0E0F16',
  bgDeep: '#07080C',
  bgCard: '#FFFFFF',
  bgSurface: '#151824',
  bgSurfaceAlt: '#1E2232',
  bgDark: '#1A1A1A',
  bgModal: '#FFFFFF',
  bgTint: '#F5F6F8',

  // Glass
  glass: 'rgba(255,255,255,0.08)',
  glassStrong: 'rgba(255,255,255,0.14)',
  glassBorder: 'rgba(255,255,255,0.18)',
  glassBorderStrong: 'rgba(255,255,255,0.28)',
  glassDark: 'rgba(10,12,20,0.55)',

  // Text
  textPrimary: '#1A1A1A',
  textSecondary: '#555555',
  textMuted: '#999999',
  textInverse: '#FFFFFF',
  textOnPrimary: '#FFFFFF',
  textOnDark: '#F5F7FB',
  textOnDarkMuted: 'rgba(245,247,251,0.65)',
  textOnDarkFaint: 'rgba(245,247,251,0.45)',

  // Status
  success: '#22C55E',
  successBg: '#E8F5E9',
  successGlass: 'rgba(34,197,94,0.18)',
  danger: '#DC3545',
  dangerBg: '#FFEBEE',
  warning: '#FFC107',
  warningBg: '#FFF8E1',
  live: '#22C55E',
  liveBg: '#E8F5E9',
  liveGlow: 'rgba(34,197,94,0.35)',

  // UI elements
  border: '#E8E8E8',
  divider: '#F0F0F0',
  inputBg: '#F8F8F8',
  overlay: 'rgba(0,0,0,0.5)',
  shadow: 'rgba(0,0,0,0.08)',

  // Fantasy roles
  wk: '#9C27B0',
  bat: '#2196F3',
  ar: '#FF9800',
  bowl: '#4CAF50',

  // Team colors
  teamA: '#D13239',
  teamB: '#1565C0',

  // Gradient stops
  gradStart: '#D13239',
  gradEnd: '#B32028',
};

// Reusable gradient palettes
export const Gradients = {
  hero: ['#FF4D56', '#D13239', '#8F1C22'] as const,
  heroSoft: ['#FF6A5B', '#D13239'] as const,
  night: ['#1A1022', '#0E0F16', '#07080C'] as const,
  stadium: ['#4A0E12', '#2A0608', '#0E0F16'] as const,
  cta: ['#FF6A5B', '#D13239'] as const,
  gold: ['#FFD166', '#FF8A5B'] as const,
  success: ['#22C55E', '#15803D'] as const,
  live: ['#FF4D56', '#D13239'] as const,
  glass: ['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.04)'] as const,
  glassDark: ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.02)'] as const,
};

export const Fonts = {
  sizes: {
    xs: 11,
    sm: 12,
    md: 14,
    base: 15,
    lg: 16,
    xl: 18,
    xxl: 22,
    xxxl: 28,
    display: 34,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
    black: '900' as const,
  },
};

export const Radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  xxl: 28,
  full: 999,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const Shadow = {
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  lifted: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  },
  glow: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 10,
  },
  glowGold: {
    shadowColor: '#FFD166',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
};
