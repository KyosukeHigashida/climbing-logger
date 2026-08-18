import { describe, expect, it, vi } from "vitest";
import {
  applyLocalTimeWithinRange,
  fromDateTimeLocalValue,
  getSessionDurationMinutes,
} from "./time";

describe("time utilities", () => {
  it("calculates ended and active session duration in minutes", () => {
    expect(
      getSessionDurationMinutes("2026-08-17T09:00:00.000Z", "2026-08-17T10:30:00.000Z"),
    ).toBe(90);

    vi.setSystemTime(new Date("2026-08-17T10:00:00.000Z"));
    expect(getSessionDurationMinutes("2026-08-17T09:15:00.000Z", null)).toBe(45);
  });

  it("applies an edited local time while keeping the attempt inside the session range", () => {
    const startedAt = fromDateTimeLocalValue("2026-08-17T18:00");
    const endedAt = fromDateTimeLocalValue("2026-08-17T20:00");
    const original = fromDateTimeLocalValue("2026-08-17T18:23");

    expect(applyLocalTimeWithinRange(original, "18:20", startedAt, endedAt)).toBe(
      fromDateTimeLocalValue("2026-08-17T18:20"),
    );
    expect(() => applyLocalTimeWithinRange(original, "17:59", startedAt, endedAt)).toThrow(
      "Time must stay within the session range.",
    );
    expect(() => applyLocalTimeWithinRange(original, "20:01", startedAt, endedAt)).toThrow(
      "Time must stay within the session range.",
    );
  });

  it("allows valid sessions that cross midnight without same-date assumptions", () => {
    const startedAt = fromDateTimeLocalValue("2026-08-17T23:30");
    const endedAt = fromDateTimeLocalValue("2026-08-18T01:10");
    const original = fromDateTimeLocalValue("2026-08-18T00:25");

    expect(applyLocalTimeWithinRange(original, "00:20", startedAt, endedAt)).toBe(
      fromDateTimeLocalValue("2026-08-18T00:20"),
    );
  });
});
