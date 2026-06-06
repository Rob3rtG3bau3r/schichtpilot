import dayjs from 'dayjs';

export const normalizeDate = (value) => {
  if (!value) return null;
  return String(value).slice(0, 10);
};

export const getZusatzbedarfStatusClass = ({ benoetigt, eingetragen }) => {
  const need = Number(benoetigt || 0);
  const have = Number(eingetragen || 0);

  if (need <= 0) {
    return 'bg-gray-300 text-gray-900 dark:bg-gray-700 dark:text-gray-100';
  }

  if (have === 0) {
    return 'bg-red-600 text-white';
  }

  if (have < need) {
    return 'bg-orange-500 text-white';
  }

  if (have === need) {
    return 'bg-green-600 text-white';
  }

  return 'bg-emerald-900 text-white';
};

export const getZusatzbedarfStatusText = ({ benoetigt, eingetragen }) => {
  const need = Number(benoetigt || 0);
  const have = Number(eingetragen || 0);

  if (have === 0) return 'Nicht besetzt';
  if (have < need) return `Fehlt ${need - have}`;
  if (have === need) return 'Vollzählig';
  return `+${have - need}`;
};

const isInRange = (datum, start, end) => {
  if (!datum || !start) return false;

  const d = dayjs(datum).startOf('day');
  const s = dayjs(start).startOf('day');
  const e = end ? dayjs(end).startOf('day') : s;

  return (d.isSame(s, 'day') || d.isAfter(s, 'day')) &&
    (d.isSame(e, 'day') || d.isBefore(e, 'day'));
};

const appliesDaily = ({ datum, start, end, interval }) => {
  if (!isInRange(datum, start, end)) return false;

  const diff = dayjs(datum).startOf('day').diff(dayjs(start).startOf('day'), 'day');
  return diff >= 0 && diff % Number(interval || 1) === 0;
};

const appliesWeekly = ({ datum, start, end, interval, byweekday }) => {
  if (!isInRange(datum, start, end)) return false;

  const weekdays = Array.isArray(byweekday) ? byweekday : [];
  if (weekdays.length > 0 && !weekdays.includes(dayjs(datum).day())) return false;

  const startWeek = dayjs(start).startOf('week');
  const currentWeek = dayjs(datum).startOf('week');
  const diffWeeks = currentWeek.diff(startWeek, 'week');

  return diffWeeks >= 0 && diffWeeks % Number(interval || 1) === 0;
};

const appliesMonthly = ({ datum, start, end, interval }) => {
  if (!isInRange(datum, start, end)) return false;

  const d = dayjs(datum).startOf('day');
  const s = dayjs(start).startOf('day');

  if (d.date() !== s.date()) return false;

  const diffMonths = d.diff(s, 'month');
  return diffMonths >= 0 && diffMonths % Number(interval || 1) === 0;
};

export const zusatzbedarfGiltAmTag = (row, datum) => {
  const start = normalizeDate(row?.dtstart);
  const end = normalizeDate(row?.until);
  const freq = row?.freq || 'once';
  const interval = Number(row?.interval || 1);

  if (!row?.aktiv) return false;
  if (!start || !datum) return false;

  if (freq === 'once') {
    return isInRange(datum, start, end || start);
  }

  if (freq === 'daily') {
    return appliesDaily({ datum, start, end, interval });
  }

  if (freq === 'weekly') {
    return appliesWeekly({
      datum,
      start,
      end,
      interval,
      byweekday: row?.byweekday,
    });
  }

  if (freq === 'monthly') {
    return appliesMonthly({ datum, start, end, interval });
  }

  return false;
};

export const buildZusatzbedarfTermine = ({ rows, tage }) => {
  const result = {};

  for (const datum of tage || []) {
    result[datum] = [];

    for (const row of rows || []) {
      if (!zusatzbedarfGiltAmTag(row, datum)) continue;
      result[datum].push(row);
    }
  }

  return result;
};