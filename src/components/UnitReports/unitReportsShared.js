// src/components/UnitReports/unitReportsShared.js

export const MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

export const deNumber = (n, digits = 2) => {
  const v = typeof n === 'number' && isFinite(n) ? n : 0;
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(v);
};

export const dePercent = (n) => (n == null ? '–' : deNumber(n, 2) + ' %');

export const colorBySign = (v) => {
  const n = Number(v ?? 0);
  if (n === 0) return 'text-gray-700 dark:text-gray-200';
  return n < 0
    ? 'text-green-600 dark:text-green-400'
    : 'text-red-600 dark:text-red-400';
};

export const FALLBACK_COLORS = [
  '#60a5fa','#f472b6','#34d399','#f59e0b','#a78bfa','#f87171','#4ade80','#fb7185'
];
