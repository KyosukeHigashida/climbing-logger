import type { Climb, WallAngle } from "../types/domain";

export function getReusableWallAnglePreset(
  climbs: Climb[],
  currentVenueId: string | null,
  wallAngles: WallAngle[],
): WallAngle | null {
  if (!currentVenueId) {
    return null;
  }

  const currentVenueWallAngles = wallAngles
    .filter((wallAngle) => wallAngle.gymId === currentVenueId)
    .sort((a, b) => a.order - b.order);
  const lastMatchingWallAngle = [...climbs]
    .reverse()
    .find((climb) => climb.gymId === currentVenueId && climb.wallAngle !== undefined);

  if (!lastMatchingWallAngle) {
    return null;
  }

  if (lastMatchingWallAngle.wallAnglePresetId) {
    const samePreset = currentVenueWallAngles.find(
      (wallAngle) => wallAngle.id === lastMatchingWallAngle.wallAnglePresetId,
    );
    if (samePreset) {
      return samePreset;
    }
  }

  return currentVenueWallAngles.find((wallAngle) => wallAngle.angle === lastMatchingWallAngle.wallAngle) ?? null;
}
