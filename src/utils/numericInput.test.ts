import { describe, expect, it } from "vitest";
import { getOptionalNumericInputError, parseOptionalNumericInput } from "./numericInput";

describe("numeric input validation", () => {
  it("returns null for optional blank input", () => {
    expect(parseOptionalNumericInput(" ", { label: "Weight" })).toBeNull();
  });

  it("rejects text in numeric fields", () => {
    expect(() => parseOptionalNumericInput("10kg", { label: "Weight" })).toThrow("Weight must be a number.");
  });

  it("rejects decimal values for integer fields", () => {
    expect(() => parseOptionalNumericInput("5.5", { label: "Reps", integer: true })).toThrow("Reps must be a whole number.");
  });

  it("rejects values outside the configured range", () => {
    expect(() => parseOptionalNumericInput("181", { label: "Wall angle", min: 0, max: 180 })).toThrow(
      "Wall angle must be 180 or less.",
    );
  });

  it("returns a validation message without throwing", () => {
    expect(getOptionalNumericInputError("abc", { label: "Work duration" })).toBe("Work duration must be a number.");
  });
});
