export function currentClimbStorageKey(sessionId: string): string {
  return `climbingLogger.currentClimb.${sessionId}`;
}

export function saveCurrentClimbId(sessionId: string, climbId: string, storage: Storage = localStorage): void {
  storage.setItem(currentClimbStorageKey(sessionId), climbId);
}

export function getSavedCurrentClimbId(sessionId: string, storage: Storage = localStorage): string | null {
  return storage.getItem(currentClimbStorageKey(sessionId));
}
