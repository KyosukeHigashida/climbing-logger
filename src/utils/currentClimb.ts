export function currentClimbStorageKey(sessionId: string): string {
  return `climbingLogger.currentClimb.${sessionId}`;
}

export type SavedWallSelection = {
  wallType: "gym" | "board";
  wallBoardId: string | null;
};

export function currentWallStorageKey(sessionId: string): string {
  return `climbingLogger.currentWall.${sessionId}`;
}

export function saveCurrentClimbId(sessionId: string, climbId: string, storage: Storage = localStorage): void {
  storage.setItem(currentClimbStorageKey(sessionId), climbId);
}

export function getSavedCurrentClimbId(sessionId: string, storage: Storage = localStorage): string | null {
  return storage.getItem(currentClimbStorageKey(sessionId));
}

export function saveCurrentWallSelection(
  sessionId: string,
  wallSelection: SavedWallSelection,
  storage: Storage = localStorage,
): void {
  storage.setItem(currentWallStorageKey(sessionId), JSON.stringify(wallSelection));
}

export function getSavedCurrentWallSelection(sessionId: string, storage: Storage = localStorage): SavedWallSelection | null {
  const raw = storage.getItem(currentWallStorageKey(sessionId));
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<SavedWallSelection>;
    if (parsed.wallType === "gym") {
      return { wallType: "gym", wallBoardId: null };
    }
    if (parsed.wallType === "board" && typeof parsed.wallBoardId === "string" && parsed.wallBoardId.length > 0) {
      return { wallType: "board", wallBoardId: parsed.wallBoardId };
    }
  } catch {
    return null;
  }
  return null;
}
