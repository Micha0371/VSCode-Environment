export const colors = {
  bg: '#F6F5F1',
  surface: '#FFFFFF',
  border: '#E6E4DC',
  text: '#1F2A24',
  textMuted: '#6B7A72',
  primary: '#5B8C6A',
  primaryDark: '#416B4E',
  primaryOn: '#FFFFFF',
  danger: '#B0544C',
  dangerOn: '#FFFFFF',
  status: {
    in_stock: '#5B8C6A',
    low: '#C48B2A',
    out: '#B0544C',
  },
  statusBg: {
    in_stock: '#E3EEE5',
    low: '#F6E7CC',
    out: '#F1D9D6',
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 14,
  pill: 999,
} as const;

export const typography = {
  title: { fontSize: 26, fontWeight: '700' as const },
  heading: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  label: { fontSize: 13, fontWeight: '500' as const },
  small: { fontSize: 12, fontWeight: '400' as const },
} as const;

export type StatusKey = 'in_stock' | 'low' | 'out';
