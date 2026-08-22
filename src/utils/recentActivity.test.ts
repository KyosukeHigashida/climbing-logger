import { describe, expect, it } from "vitest";
import type { Attempt, Climb, StrengthSet } from "../types/domain";
import { buildRecentActivity, getStrengthNameSuggestions } from "./recentActivity";

const climbs: Climb[] = [
  { id: "v4", sessionId: "s", grade: "V4", name: "Blue", createdAt: "2026-08-17T14:00:00.000Z" },
  { id: "v5", sessionId: "s", grade: "V5", name: "Red", createdAt: "2026-08-17T14:01:00.000Z" },
];

const attempts: Attempt[] = [
  {
    id: "a1",
    sessionId: "s",
    climbId: "v4",
    startedAt: "2026-08-17T14:00:00.000Z",
    endedAt: "2026-08-17T14:00:20.000Z",
    result: "fail",
    createdAt: "2026-08-17T14:00:00.000Z",
  },
  {
    id: "a2",
    sessionId: "s",
    climbId: "v5",
    startedAt: "2026-08-17T14:10:00.000Z",
    endedAt: "2026-08-17T14:10:20.000Z",
    result: "send",
    createdAt: "2026-08-17T14:10:00.000Z",
  },
  {
    id: "a3",
    sessionId: "s",
    climbId: "v4",
    startedAt: "2026-08-17T14:20:00.000Z",
    endedAt: "2026-08-17T14:20:20.000Z",
    result: "send",
    createdAt: "2026-08-17T14:20:00.000Z",
  },
];

const strengthSets: StrengthSet[] = [
  {
    id: "set-1",
    sessionId: "s",
    name: "Weighted Pull-up",
    startedAt: "2026-08-17T14:05:00.000Z",
    endedAt: "2026-08-17T14:05:20.000Z",
    createdAt: "2026-08-17T14:05:00.000Z",
  },
  {
    id: "set-2",
    sessionId: "s",
    name: "Front Lever",
    startedAt: "2026-08-17T14:25:00.000Z",
    endedAt: "2026-08-17T14:25:12.000Z",
    createdAt: "2026-08-17T14:25:00.000Z",
  },
];

describe("recent activity", () => {
  it("sorts climbs by latest attempt time and mixes strength sets", () => {
    expect(buildRecentActivity(climbs, attempts, strengthSets).map((item) => (item.type === "climb" ? item.climb.id : item.set.id))).toEqual([
      "set-2",
      "v4",
      "v5",
      "set-1",
    ]);
  });

  it("filters climbs and training activity", () => {
    expect(buildRecentActivity(climbs, attempts, strengthSets, "climbs").map((item) => item.type)).toEqual(["climb", "climb"]);
    expect(buildRecentActivity(climbs, attempts, strengthSets, "training").map((item) => item.type)).toEqual(["training", "training"]);
  });

  it("derives recent distinct strength names without blocking arbitrary input", () => {
    expect(getStrengthNameSuggestions([...strengthSets, { ...strengthSets[0], id: "set-3", startedAt: "2026-08-17T14:30:00.000Z" }])).toEqual([
      "Weighted Pull-up",
      "Front Lever",
    ]);
  });
});
