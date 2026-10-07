/**
 * @file dates.ts
 * @summary Single Responsibility: Formats ISO date strings with custom pattern tokens and ordinals without external dependencies.
 */

const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const DAYS_FULL = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Returns English ordinal suffix for a day number (e.g. 1 -> "1st", 2 -> "2nd", 3 -> "3rd", 4 -> "4th", 11 -> "11th")
 */
export function getOrdinalSuffix(day: number): string {
  const j = day % 10;
  const k = day % 100;
  if (j === 1 && k !== 11) {
    return `${day}st`;
  }
  if (j === 2 && k !== 12) {
    return `${day}nd`;
  }
  if (j === 3 && k !== 13) {
    return `${day}rd`;
  }
  return `${day}th`;
}

/**
 * Formats a date string or Date object with a token pattern.
 * Supported tokens:
 * - YYYY: 4-digit year (e.g. 2026)
 * - YY: 2-digit year (e.g. 26)
 * - MMMM: Full month name (e.g. July)
 * - MMM: 3-letter month (e.g. Jul)
 * - MM: 2-digit month (01-12)
 * - M: Month number (1-12)
 * - DDo: Zero-padded day with ordinal (e.g. 06th, 01st)
 * - Do: Day of month with ordinal (e.g. 6th, 1st, 22nd)
 * - DD: 2-digit day (01-31)
 * - D: Day of month (1-31)
 * - dddd: Full day of week (e.g. Friday)
 * - ddd: Short day of week (e.g. Fri)
 */
export function formatDate(input: string | Date | number, formatPattern = 'MMMM Do, YYYY'): string {
  if (!input) return '';
  const date = typeof input === 'object' && input instanceof Date ? input : new Date(input);
  if (isNaN(date.getTime())) {
    // If it's not a standard parsable date, return the raw input string
    return String(input);
  }

  const year = date.getUTCFullYear();
  const monthIdx = date.getUTCMonth();
  const day = date.getUTCDate();
  const dayOfWeek = date.getUTCDay();

  const padZero = (n: number) => n.toString().padStart(2, '0');

  // Order of replacements matters (longest matches first)
  const tokens: Array<[RegExp, string]> = [
    [/YYYY/g, year.toString()],
    [/YY/g, year.toString().slice(-2)],
    [/MMMM/g, MONTHS_FULL[monthIdx]],
    [/MMM/g, MONTHS_SHORT[monthIdx]],
    [/MM/g, padZero(monthIdx + 1)],
    [/M/g, (monthIdx + 1).toString()],
    [/dddd/g, DAYS_FULL[dayOfWeek]],
    [/ddd/g, DAYS_SHORT[dayOfWeek]],
    [/DDo/g, `${padZero(day)}${getOrdinalSuffix(day).slice(-2)}`], // e.g. "06th"
    [/Do/g, getOrdinalSuffix(day)], // e.g. "6th"
    [/DD/g, padZero(day)],
    [/D/g, day.toString()],
  ];

  let result = formatPattern;
  for (const [regex, replacement] of tokens) {
    result = result.replace(regex, replacement);
  }

  return result;
}
