import type { AttemptEffort } from "../types/domain";

export const effortLabels: Record<AttemptEffort, string> = {
  1: "Easy",
  2: "Easy-Moderate",
  3: "Moderate",
  4: "Moderate-Hard",
  5: "Hard",
  6: "Hard-Extreme",
  7: "Extreme",
};

export function toAttemptEffort(value: number): AttemptEffort {
  if (!Number.isInteger(value) || value < 1 || value > 7) {
    throw new Error("Attempt effort must be between 1 and 7.");
  }
  return value as AttemptEffort;
}
