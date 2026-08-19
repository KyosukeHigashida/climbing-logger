import { describe, expect, it } from "vitest";
import type { Climb, WallAngle } from "../types/domain";
import { getReusableWallAnglePreset } from "./wallAngles";

const createdAt = "2026-08-17T09:00:00.000Z";

function climb(input: Partial<Climb>): Climb {
  return {
    id: input.id ?? "climb",
    sessionId: input.sessionId ?? "session",
    grade: input.grade ?? "2Q",
    gymId: input.gymId ?? "gym-a",
    gradeId: input.gradeId ?? null,
    name: input.name ?? null,
    createdAt,
    ...input,
  };
}

function angle(input: Partial<WallAngle>): WallAngle {
  return {
    id: input.id ?? "angle",
    gymId: input.gymId ?? "gym-a",
    angle: input.angle ?? 120,
    order: input.order ?? 0,
    createdAt,
    ...input,
  };
}

describe("wall angle reuse", () => {
  it("uses the last climb wall angle from the current venue as the next initial selection", () => {
    const angles = [angle({ id: "a-110", angle: 110 }), angle({ id: "a-120", angle: 120, order: 1 })];
    const climbs = [
      climb({ id: "first", wallAnglePresetId: "a-110", wallAngle: 110 }),
      climb({ id: "second", wallAnglePresetId: "a-120", wallAngle: 120 }),
    ];

    expect(getReusableWallAnglePreset(climbs, "gym-a", angles)?.id).toBe("a-120");
  });

  it("falls back to matching the snapshot angle when the original master id no longer exists", () => {
    const angles = [angle({ id: "new-120", angle: 120 })];
    const climbs = [climb({ wallAnglePresetId: "deleted-120", wallAngle: 120 })];

    expect(getReusableWallAnglePreset(climbs, "gym-a", angles)?.id).toBe("new-120");
  });

  it("does not reuse a wall angle from another venue", () => {
    const angles = [angle({ id: "a-120", angle: 120 })];
    const climbs = [
      climb({ id: "other", gymId: "gym-b", wallAnglePresetId: "b-120", wallAngle: 120 }),
      climb({ id: "current", gymId: "gym-a" }),
    ];

    expect(getReusableWallAnglePreset(climbs, "gym-a", angles)).toBeNull();
  });
});
