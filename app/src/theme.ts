/**
 * Single source of truth for colour, spacing, and type size.
 * Every screen must use these tokens instead of magic numbers.
 *
 * Layout target: Vega renders React Native in a 960x540 dp canvas (scale 2 on
 * 1080p). All values here are dp, so the whole UI fits that canvas with the
 * screen padding below.
 */

export const colors = {
  background: '#080c11',
  backgroundElevated: '#101823',
  surface: '#151f2b',
  surfaceFocused: '#1c2938',
  surfaceSelected: '#ffb454',
  border: '#22303f',
  borderStrong: '#33465a',
  accent: '#ffb454',
  accentSoft: 'rgba(255, 180, 84, 0.14)',
  accentFaint: 'rgba(255, 180, 84, 0.06)',
  text: '#f5f8fb',
  textMuted: '#9aabbb',
  textFaint: '#66788a',
  textOnAccent: '#141008',
  textOnAccentMuted: '#5c4a2e',
  danger: '#ff6b6b',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 30,
  xxxl: 38,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  pill: 999,
} as const;

export const type = {
  display: 38,
  title: 28,
  card: 20,
  body: 16,
  meta: 12,
  micro: 10,
} as const;

/** Shared page frame. 960 - 2 * 32 = 896 of usable width. */
export const layout = {
  screenX: 32,
  screenTop: 24,
  screenBottom: 18,
  contentMax: 896,
  gridGap: 10,
} as const;
