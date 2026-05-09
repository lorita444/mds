export const colors = {
  bg: {
    primary: '#030712',
    secondary: '#0c0c1e',
    card: '#0f1629',
    cardBorder: 'rgba(139, 92, 246, 0.18)',
    elevated: '#141430',
    overlay: 'rgba(3, 7, 18, 0.88)',
    input: '#0a0f1e',
  },
  cosmic: {
    purple: '#7c3aed',
    purpleLight: '#a78bfa',
    purpleFaint: 'rgba(124, 58, 237, 0.12)',
    purpleGlow: 'rgba(124, 58, 237, 0.45)',
    teal: '#0d9488',
    tealLight: '#5eead4',
    tealFaint: 'rgba(13, 148, 136, 0.15)',
    blue: '#1d4ed8',
    blueLight: '#93c5fd',
    pink: '#db2777',
    pinkLight: '#f9a8d4',
    gold: '#d97706',
    goldLight: '#fbbf24',
  },
  crystal: {
    primary: '#38bdf8',
    light: '#7dd3fc',
    glow: 'rgba(56, 189, 248, 0.35)',
  },
  text: {
    primary: '#f1f5f9',
    secondary: '#94a3b8',
    muted: '#475569',
    accent: '#a78bfa',
    dim: '#334155',
  },
  status: {
    success: '#22c55e',
    successFaint: 'rgba(34, 197, 94, 0.15)',
    warning: '#f59e0b',
    warningFaint: 'rgba(245, 158, 11, 0.15)',
    error: '#ef4444',
    errorFaint: 'rgba(239, 68, 68, 0.15)',
    info: '#3b82f6',
  },
  rarity: {
    common: { color: '#94a3b8', glow: 'rgba(148, 163, 184, 0.3)', bg: 'rgba(148, 163, 184, 0.1)' },
    uncommon: { color: '#22c55e', glow: 'rgba(34, 197, 94, 0.3)', bg: 'rgba(34, 197, 94, 0.1)' },
    rare: { color: '#3b82f6', glow: 'rgba(59, 130, 246, 0.3)', bg: 'rgba(59, 130, 246, 0.1)' },
    epic: { color: '#a855f7', glow: 'rgba(168, 85, 247, 0.3)', bg: 'rgba(168, 85, 247, 0.1)' },
    legendary: { color: '#f59e0b', glow: 'rgba(245, 158, 11, 0.3)', bg: 'rgba(245, 158, 11, 0.1)' },
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  xl: 28,
  xxl: 36,
  full: 9999,
} as const;

export const typography = {
  sizes: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 17,
    lg: 20,
    xl: 24,
    xxl: 30,
    display: 38,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    heavy: '800' as const,
  },
  tracking: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
    wider: 1,
    widest: 2,
  },
} as const;

export type Rarity = keyof typeof colors.rarity;
