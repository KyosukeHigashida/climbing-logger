export async function requestPersistentStorage(): Promise<boolean | null> {
  if (!("storage" in navigator) || typeof navigator.storage.persist !== "function") {
    return null;
  }

  try {
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}
