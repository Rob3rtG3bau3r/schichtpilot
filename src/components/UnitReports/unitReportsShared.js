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

export const colorBySign = (n) =>
  n > 0 ? 'text-emerald-600 dark:text-emerald-400'
: n < 0 ? 'text-red-600 dark:text-red-400'
        : 'text-gray-900 dark:text-gray-100';

export const FALLBACK_COLORS = [
  '#60a5fa','#f472b6','#34d399','#f59e0b','#a78bfa','#f87171','#4ade80','#fb7185'
];
