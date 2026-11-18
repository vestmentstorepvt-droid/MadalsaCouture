const pad = (n: number) => String(n).padStart(2, '0');

const LOCAL_INPUT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export function formatLocalInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Converts an ISO timestamp (or an already-local input value) into a datetime-local input value. */
export function toDatetimeLocal(value?: string | null): string {
  if (!value) return '';
  if (LOCAL_INPUT.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : formatLocalInput(date);
}

/** Converts a datetime-local value (local time) or ISO string into a UTC ISO string. */
export function localInputToIso(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Returns an ISO timestamp for the very end of the given YYYY-MM-DD day in local time. */
export function endOfDayIso(day: string): string {
  return new Date(`${day}T23:59:59.999`).toISOString();
}

/** Returns an ISO timestamp for the very start of the given YYYY-MM-DD day in local time. */
export function startOfDayIso(day: string): string {
  return new Date(`${day}T00:00:00.000`).toISOString();
}
