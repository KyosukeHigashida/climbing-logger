import { describe, expect, it } from "vitest";
import type { Attempt } from "../types/domain";
import { buildSessionTimeline, getActionDurationMs } from "./timeline";

function attempt(input: Partial<Attempt>): Attempt {
  return {
    id: input.id ?? "attempt",
    sessionId: "session",
    climbId: input.climbId ?? "climb-a",
    startedAt: input.startedAt ?? "2026-08-17T18:00:00.000Z",
    endedAt: input.endedAt ?? "2026-08-17T18:00:45.000Z",
    timestamp: input.timestamp ?? input.endedAt ?? "2026-08-17T18:00:45.000Z",
    result: input.result ?? "send",
    createdAt: input.createdAt ?? input.startedAt ?? "2026-08-17T18:00:00.000Z",
    ...input,
  };
}

describe("timeline intervals", () => {
  it("derives action interval from attempt start and end", () => {
    expect(
      getActionDurationMs(
        attempt({
          startedAt: "2026-08-17T18:00:00.000Z",
          endedAt: "2026-08-17T18:00:45.000Z",
        }),
      ),
    ).toBe(45_000);
  });

  it("builds Attempt / Rest / Attempt order including cross-climb rest", () => {
    const attempts = [
      attempt({
        id: "a",
        climbId: "climb-a",
        startedAt: "2026-08-17T18:00:00.000Z",
        endedAt: "2026-08-17T18:01:00.000Z",
      }),
      attempt({
        id: "b",
        climbId: "climb-b",
        startedAt: "2026-08-17T18:06:00.000Z",
        endedAt: "2026-08-17T18:07:00.000Z",
      }),
    ];

    const timeline = buildSessionTimeline(attempts);
    expect(timeline.map((item) => item.type)).toEqual(["attempt", "rest", "attempt"]);
    expect(timeline[1]).toMatchObject({
      type: "rest",
      durationMs: 5 * 60 * 1000,
      previousAttemptId: "a",
      nextAttemptId: "b",
    });
  });

  it("keeps legacy timestamp-only attempts without inventing action duration", () => {
    const timeline = buildSessionTimeline([
      attempt({
        id: "legacy",
        startedAt: null,
        endedAt: "2026-08-17T18:01:00.000Z",
        timestamp: "2026-08-17T18:01:00.000Z",
      }),
    ]);

    expect(timeline[0]).toMatchObject({ type: "attempt", actionDurationMs: null });
  });
});
