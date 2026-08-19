import type { Climb } from "../types/domain";

export function formatClimbLabel(climb: Climb): string {
  return climb.wallAngle === undefined ? climb.grade : `${climb.grade} · ${climb.wallAngle}°`;
}
