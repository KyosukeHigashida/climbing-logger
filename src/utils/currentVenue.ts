export function currentVenueStorageKey(sessionId: string): string {
  return `climbingLogger.currentVenue.${sessionId}`;
}

export function saveCurrentVenueId(sessionId: string, gymId: string | null, storage: Storage = localStorage): void {
  const key = currentVenueStorageKey(sessionId);
  if (gymId) {
    storage.setItem(key, gymId);
  } else {
    storage.removeItem(key);
  }
}

export function getSavedCurrentVenueId(sessionId: string, storage: Storage = localStorage): string | null {
  return storage.getItem(currentVenueStorageKey(sessionId));
}
