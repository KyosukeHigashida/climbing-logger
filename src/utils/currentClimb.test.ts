import { describe, expect, it } from "vitest";
import { currentClimbStorageKey, getSavedCurrentClimbId, saveCurrentClimbId } from "./currentClimb";

describe("current climb storage", () => {
  it("saves and restores the current climb id by session", () => {
    saveCurrentClimbId("session-a", "climb-a");

    expect(currentClimbStorageKey("session-a")).toBe("climbingLogger.currentClimb.session-a");
    expect(getSavedCurrentClimbId("session-a")).toBe("climb-a");
    expect(getSavedCurrentClimbId("session-b")).toBeNull();
  });
});
