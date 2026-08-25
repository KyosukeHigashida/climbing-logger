import { describe, expect, it } from "vitest";
import type { Attempt, StrengthSet } from "../types/domain";
import {
  getCompletedStrengthSetCountForIdentity,
  getLastCompletedPhysicalActivityEnd,
  getLatestStrengthSetByName,
  getStrengthSetIntervals,
  getStrengthSetNumbers,
} from "./strengthSets";

describe("strength set derived metadata", () => {
  it("counts set numbers by exercise name in chronological order", () => {
    const numbers = getStrengthSetNumbers([
      strengthSet("pull-3", "Weighted Pull-up", "2026-08-25T10:20:00.000Z"),
      strengthSet("leg-1", "Hanging Leg Raise", "2026-08-25T10:10:00.000Z"),
      strengthSet("pull-1", "Weighted Pull-up", "2026-08-25T10:00:00.000Z"),
      strengthSet("pull-2", "Weighted Pull-up", "2026-08-25T10:15:00.000Z"),
    ]);

    expect(numbers.get("pull-1")).toBe(1);
    expect(numbers.get("pull-2")).toBe(2);
    expect(numbers.get("pull-3")).toBe(3);
    expect(numbers.get("leg-1")).toBe(1);
  });

  it("trims exercise names without changing case-sensitive identity", () => {
    const numbers = getStrengthSetNumbers([
      strengthSet("trimmed", "Weighted Pull-up", "2026-08-25T10:00:00.000Z"),
      strengthSet("spaced", " Weighted Pull-up ", "2026-08-25T10:05:00.000Z"),
      strengthSet("lower", "weighted pull-up", "2026-08-25T10:10:00.000Z"),
    ]);

    expect(numbers.get("trimmed")).toBe(1);
    expect(numbers.get("spaced")).toBe(2);
    expect(numbers.get("lower")).toBe(1);
  });

  it("does not count active sets until they are finished", () => {
    const numbers = getStrengthSetNumbers([
      strengthSet("finished", "Weighted Pull-up", "2026-08-25T10:00:00.000Z"),
      strengthSet("active", "Weighted Pull-up", "2026-08-25T10:10:00.000Z", null),
    ]);

    expect(numbers.get("finished")).toBe(1);
    expect(numbers.get("active")).toBeUndefined();
  });

  it("counts completed sets by training identity including load format", () => {
    const sets = [
      { ...strengthSet("pull-10-a", "Weighted Pull-up", "2026-08-25T10:00:00.000Z"), weight: 10, reps: 5, workDurationSeconds: 20 },
      { ...strengthSet("pull-10-b", "Weighted Pull-up", "2026-08-25T10:05:00.000Z"), weight: 10, reps: 5, workDurationSeconds: 20 },
      { ...strengthSet("pull-20", "Weighted Pull-up", "2026-08-25T10:10:00.000Z"), weight: 20, reps: 5, workDurationSeconds: 20 },
      { ...strengthSet("active", "Weighted Pull-up", "2026-08-25T10:15:00.000Z", null), weight: 10, reps: 5, workDurationSeconds: 20 },
    ];

    expect(getCompletedStrengthSetCountForIdentity(sets, { name: "Weighted Pull-up", weight: 10, reps: 5, workDurationSeconds: 20 })).toBe(2);
    expect(getCompletedStrengthSetCountForIdentity(sets, { name: "Weighted Pull-up", weight: 20, reps: 5, workDurationSeconds: 20 })).toBe(1);
    expect(getCompletedStrengthSetCountForIdentity(sets, null)).toBe(0);
  });

  it("finds the latest strength set by exercise name", () => {
    const latest = getLatestStrengthSetByName(
      [
        strengthSet("old", "Weighted Pull-up", "2026-08-25T10:00:00.000Z", "2026-08-25T10:00:20.000Z"),
        strengthSet("new", "Weighted Pull-up", "2026-08-25T10:10:00.000Z", "2026-08-25T10:10:20.000Z"),
        strengthSet("other", "Front Lever", "2026-08-25T10:20:00.000Z", "2026-08-25T10:20:20.000Z"),
      ],
      "Weighted Pull-up",
    );

    expect(latest?.id).toBe("new");
  });

  it("derives interval from the previous completed physical activity across attempts and strength sets", () => {
    const intervals = getStrengthSetIntervals(
      [
        attempt("attempt-a", "2026-08-25T10:00:00.000Z", "2026-08-25T10:01:00.000Z"),
        attempt("attempt-b", "2026-08-25T10:12:00.000Z", "2026-08-25T10:12:30.000Z"),
      ],
      [
        strengthSet("set-a", "Weighted Pull-up", "2026-08-25T10:05:00.000Z", "2026-08-25T10:05:20.000Z"),
        strengthSet("set-b", "Weighted Pull-up", "2026-08-25T10:15:00.000Z", "2026-08-25T10:15:20.000Z"),
      ],
    );

    expect(intervals.get("set-a")).toBe(4 * 60 * 1000);
    expect(intervals.get("set-b")).toBe(2.5 * 60 * 1000);
  });

  it("does not show an interval for the first physical activity", () => {
    const intervals = getStrengthSetIntervals([], [
      strengthSet("first", "Weighted Pull-up", "2026-08-25T10:00:00.000Z", "2026-08-25T10:00:20.000Z"),
    ]);

    expect(intervals.get("first")).toBeNull();
  });

  it("finds the latest completed physical activity end across attempts and strength sets", () => {
    expect(
      getLastCompletedPhysicalActivityEnd(
        [attempt("attempt-a", "2026-08-25T10:00:00.000Z", "2026-08-25T10:01:00.000Z")],
        [strengthSet("set-a", "Weighted Pull-up", "2026-08-25T10:05:00.000Z", "2026-08-25T10:05:20.000Z")],
      ),
    ).toBe("2026-08-25T10:05:20.000Z");
  });
});

function attempt(id: string, startedAt: string, endedAt: string): Attempt {
  return {
    id,
    sessionId: "session",
    climbId: "climb",
    startedAt,
    endedAt,
    result: "fail",
    createdAt: startedAt,
  };
}

function strengthSet(id: string, name: string, startedAt: string, endedAt: string | null = "2026-08-25T10:00:20.000Z"): StrengthSet {
  return {
    id,
    sessionId: "session",
    name,
    startedAt,
    endedAt,
    createdAt: startedAt,
  };
}
