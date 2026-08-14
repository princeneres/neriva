const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// Content and Object date fields hold ISO 8601 date-only strings, which parse
// as UTC midnight. Formatting those in the viewer's zone would move the
// calendar day (2026-01-05 reads as Jan 4 anywhere west of UTC), so a
// date-only value is rendered in UTC and only a real timestamp follows the
// viewer's zone. A value that is not a date at all is shown as authored
// rather than as "Invalid Date".
export function formatCalendarDate(
  value: string | null,
  options: Intl.DateTimeFormatOptions,
  locale = 'en-US',
): string | null {
  if (value === null) {
    return null;
  }
  const text = value.trim();
  if (text === '') {
    return null;
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return text;
  }
  return parsed.toLocaleDateString(locale, {
    ...options,
    ...(DATE_ONLY.test(text) ? { timeZone: 'UTC' } : {}),
  });
}
