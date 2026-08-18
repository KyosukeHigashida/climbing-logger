export function nowIso(): string {
  return new Date().toISOString();
}

export function formatClockDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

export function formatIntervalDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}:${String(remainingMinutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

export function formatReadableDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function toTimeInputValue(iso: string): string {
  return toDateTimeLocalValue(iso).slice(11, 16);
}

export function applyLocalTimeWithinRange(
  originalIso: string,
  timeValue: string,
  startedAt: string,
  endedAt: string | null,
): string {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(timeValue)) {
    throw new Error("Time must use HH:mm format.");
  }

  const originalLocal = toDateTimeLocalValue(originalIso);
  const originalDate = originalLocal.slice(0, 10);
  const originalMs = new Date(originalIso).getTime();
  const startMs = new Date(startedAt).getTime();
  const endMs = endedAt ? new Date(endedAt).getTime() : Date.now();

  const candidates = [-1, 0, 1]
    .map((dayOffset) => addDaysToLocalDate(originalDate, dayOffset))
    .map((dateValue) => fromDateTimeLocalValue(`${dateValue}T${timeValue}`))
    .filter((iso) => {
      const timestampMs = new Date(iso).getTime();
      return timestampMs >= startMs && timestampMs <= endMs;
    })
    .sort((a, b) => {
      return Math.abs(new Date(a).getTime() - originalMs) - Math.abs(new Date(b).getTime() - originalMs);
    });

  const bestCandidate = candidates[0];
  if (!bestCandidate) {
    throw new Error("Time must stay within the session range.");
  }

  return bestCandidate;
}

function addDaysToLocalDate(dateValue: string, dayOffset: number): string {
  const date = new Date(`${dateValue}T00:00`);
  date.setDate(date.getDate() + dayOffset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toDateTimeLocalValue(iso: string): string {
  const date = new Date(iso);
  const timezoneOffsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

export function fromDateTimeLocalValue(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Timestamp is invalid.");
  }
  return date.toISOString();
}

export function formatSessionDuration(startedAt: string, endedAt: string | null): string {
  const minutes = getSessionDurationMinutes(startedAt, endedAt);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) {
    return `${remainingMinutes}m`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

export function getSessionDurationMinutes(startedAt: string, endedAt: string | null, now = Date.now()): number {
  const end = endedAt ? new Date(endedAt).getTime() : now;
  return Math.max(0, Math.floor((end - new Date(startedAt).getTime()) / 60000));
}
