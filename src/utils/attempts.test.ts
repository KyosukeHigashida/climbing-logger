import { describe, expect, it } from "vitest";
import type { Attempt, Climb } from "../types/domain";
import {
  getAttemptCount,
  getClimbAttemptInterval,
  getFailCount,
  getPreviousClimbAttempt,
  getPreviousSessionAttempt,
  getSendCount,
  getSessionAttemptIntervals,
  getSessionAttemptInterval,
  isFlash,
  sortAttemptsByTimestampDesc,
} from "./attempts";

function attempt(id: string, climbId: string, timestamp: string, result: "fail" | "send" = "fail"): Attempt {
  return {
    id,
    sessionId: "session-a",
    climbId,
    timestamp,
    startedAt: timestamp,
    endedAt: timestamp,
    result,
    createdAt: timestamp,
  };
}

const climbA: Climb = {
  id: "climb-a",
  sessionId: "session-a",
  grade: "2Q",
  name: "A",
  createdAt: "2026-08-17T09:00:00.000Z",
};

describe("attempt utilities", () => {
  it("calculates previous session and same-climb attempt intervals from raw timestamps", () => {
    const attempts = [
      attempt("a1", "climb-a", "2026-08-17T09:00:00.000Z"),
      attempt("b1", "climb-b", "2026-08-17T09:04:00.000Z"),
      attempt("a2", "climb-a", "2026-08-17T09:09:00.000Z"),
    ];

    expect(getSessionAttemptInterval(attempts, attempts[2])).toBe(5 * 60 * 1000);
    expect(getSessionAttemptIntervals(attempts).get("a2")).toBe(5 * 60 * 1000);
    expect(getSessionAttemptIntervals(attempts).get("a1")).toBeNull();
    expect(getClimbAttemptInterval(attempts, attempts[2])).toBe(9 * 60 * 1000);
    expect(getPreviousSessionAttempt(attempts, attempts[0])).toBeNull();
    expect(getPreviousClimbAttempt(attempts, attempts[0])).toBeNull();
  });

  it("sorts timeline attempts newest first by timestamp, not insertion order", () => {
    const attempts = [
      attempt("a", "climb-a", "2026-08-17T09:20:00.000Z"),
      attempt("b", "climb-b", "2026-08-17T09:30:00.000Z"),
      attempt("c", "climb-c", "2026-08-17T09:10:00.000Z"),
    ];

    expect(sortAttemptsByTimestampDesc(attempts).map((item) => item.id)).toEqual(["b", "a", "c"]);

    const editedAttempts = [
      attempt("a", "climb-a", "2026-08-17T09:20:00.000Z"),
      attempt("b", "climb-b", "2026-08-17T09:15:00.000Z"),
    ];

    expect(sortAttemptsByTimestampDesc(editedAttempts).map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("derives attempt, send, and fail counts from raw attempts", () => {
    const attempts = [
      attempt("1", "climb-a", "2026-08-17T09:00:00.000Z", "fail"),
      attempt("2", "climb-a", "2026-08-17T09:01:00.000Z", "fail"),
      attempt("3", "climb-a", "2026-08-17T09:02:00.000Z", "send"),
      attempt("4", "climb-b", "2026-08-17T09:03:00.000Z", "send"),
      attempt("5", "climb-b", "2026-08-17T09:04:00.000Z", "fail"),
    ];

    expect(getAttemptCount(attempts)).toBe(5);
    expect(getAttemptCount(attempts, "climb-a")).toBe(3);
    expect(getSendCount(attempts)).toBe(2);
    expect(getFailCount(attempts)).toBe(3);
  });

  it("detects flash from the first same-climb attempt in timestamp order", () => {
    expect(isFlash(climbA, [attempt("1", "climb-a", "2026-08-17T09:00:00.000Z", "send")])).toBe(true);
    expect(
      isFlash(climbA, [
        attempt("1", "climb-a", "2026-08-17T09:00:00.000Z", "fail"),
        attempt("2", "climb-a", "2026-08-17T09:03:00.000Z", "send"),
      ]),
    ).toBe(false);
    expect(
      isFlash(climbA, [
        attempt("late", "climb-a", "2026-08-17T09:03:00.000Z", "fail"),
        attempt("early", "climb-a", "2026-08-17T09:00:00.000Z", "send"),
      ]),
    ).toBe(true);
  });
});
