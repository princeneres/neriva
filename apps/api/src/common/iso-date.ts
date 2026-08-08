// ISO 8601: date-only, or date-time with optional seconds, fractional
// seconds and UTC/offset designator.
const ISO_8601_PATTERN =
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})?)?$/;

// Component range checks on top of the shape regex. Date.parse cannot be
// trusted here: V8 rolls impossible calendar dates (2026-02-30) over into
// the next month instead of rejecting them.
export function isValidIsoDate(value: string): boolean {
  const match = ISO_8601_PATTERN.exec(value);
  if (!match) {
    return false;
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (month < 1 || month > 12) {
    return false;
  }
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) {
    return false;
  }
  const [, timePart, secondsPart] = match;
  if (timePart !== undefined) {
    const hour = Number(value.slice(11, 13));
    const minute = Number(value.slice(14, 16));
    if (hour > 23 || minute > 59) {
      return false;
    }
    if (secondsPart !== undefined && Number(value.slice(17, 19)) > 59) {
      return false;
    }
  }
  return true;
}
