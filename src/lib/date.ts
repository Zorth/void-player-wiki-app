export const TIMEZONE_CET = 'Europe/Brussels';

/**
 * Format a timestamp or Date object into a 24-hour time string in Europe/Brussels (CET/CEST).
 * Output format: HH:mm (e.g. "14:30") or HH:mm:ss if includeSeconds is true (e.g. "14:30:45").
 * Strictly avoids 12-hour AM/PM representations.
 */
export function formatTime24h(date: Date | string | number, includeSeconds: boolean = false): string {
  try {
    const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: TIMEZONE_CET,
      hour: '2-digit',
      minute: '2-digit',
      second: includeSeconds ? '2-digit' : undefined,
      hour12: false,
    }).format(d);
  } catch {
    return '';
  }
}

/**
 * Format a timestamp or Date object into a readable date string in Europe/Brussels (CET/CEST).
 * Output format: "26 Sep 2026".
 */
export function formatDate(date: Date | string | number): string {
  try {
    const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: TIMEZONE_CET,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return '';
  }
}

/**
 * Format a timestamp or Date object into a full date and 24-hour time string in Europe/Brussels (CET/CEST).
 * Output format: "26 Sep 2026, 14:30" (or with seconds: "26 Sep 2026, 14:30:45").
 * Strictly 24-hour format, zero AM/PM.
 */
export function formatDateTime24h(date: Date | string | number, includeSeconds: boolean = false): string {
  try {
    const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';
    const datePart = formatDate(d);
    const timePart = formatTime24h(d, includeSeconds);
    return `${datePart}, ${timePart}`;
  } catch {
    return '';
  }
}
