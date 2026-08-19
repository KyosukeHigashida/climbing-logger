import { describe, expect, it } from "vitest";
import type { Grade, WallAngle } from "../types/domain";
import { getGradeOptionsForSelect, getWallAngleOptionsForSelect } from "./SessionPage";

const grade: Grade = {
  id: "grade-2q",
  gymId: "gym-a",
  label: "2Q",
  order: 0,
  isArchived: false,
  createdAt: "2026-08-17T09:00:00.000Z",
};

const wallAngle: WallAngle = {
  id: "angle-120",
  gymId: "gym-a",
  angle: 120,
  order: 0,
  isArchived: false,
  createdAt: "2026-08-17T09:00:00.000Z",
};

describe("SessionPage wall angle UI", () => {
  it("does not render orphan wall angle presets with a saved suffix", () => {
    const options = getWallAngleOptionsForSelect("orphan-angle", 120, [wallAngle]);

    expect(options[0]).toMatchObject({ id: "orphan-angle", label: "120°" });
    expect(options.map((option) => option.label).join(" ")).not.toContain("(saved)");
  });

  it("keeps snapshot-only grade and wall angle values visible in selectors", () => {
    expect(getGradeOptionsForSelect(null, "2Q", [grade])[0]).toMatchObject({ label: "2Q" });
    expect(getWallAngleOptionsForSelect(null, 120, [wallAngle])[0]).toMatchObject({ label: "120°" });
  });
});
