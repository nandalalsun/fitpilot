export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD. */
export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromISO = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const todayISO = () => toISO(new Date());
export const addDays = (iso: string, n: number) => { const d = fromISO(iso); d.setDate(d.getDate() + n); return toISO(d); };
export const daysBetween = (a: string, b: string) => Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86400000);
export const weekday = (iso: string) => fromISO(iso).getDay();
/** Monday of the week containing iso. */
export const weekStart = (iso: string) => { const wd = weekday(iso); return addDays(iso, wd === 0 ? -6 : 1 - wd); };

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const fmtDate = (iso: string, today = todayISO()) => {
  const diff = daysBetween(today, iso);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  const d = fromISO(iso);
  return `${DAY_SHORT[d.getDay()]} ${d.toLocaleString('en', { month: 'short' })} ${d.getDate()}`;
};

export const KG_PER_LB = 0.45359237;
export const round = (n: number, step = 1) => Math.round(n / step) * step;
export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Convert stored kg to display units, rounded so 70 lb round-trips to 70. */
export const toDisplayWeight = (kg: number, units: 'metric' | 'imperial') =>
  units === 'imperial' ? round(kg / KG_PER_LB, 0.5) : round(kg, 0.25);
export const fromDisplayWeight = (v: number, units: 'metric' | 'imperial') => (units === 'imperial' ? v * KG_PER_LB : v);
export const weightUnit = (units: 'metric' | 'imperial') => (units === 'imperial' ? 'lb' : 'kg');
export const fmtWeight = (kg: number | null | undefined, units: 'metric' | 'imperial') =>
  kg == null ? 'Bodyweight' : `${toDisplayWeight(kg, units)} ${weightUnit(units)}`;
/** Default stepper increment in display units. */
export const weightStep = (units: 'metric' | 'imperial') => (units === 'imperial' ? 5 : 2.5);

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
export const avg = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);

export const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
export const listJoin = (xs: string[]) =>
  xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
