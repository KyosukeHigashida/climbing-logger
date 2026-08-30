export const colorThemes = [
  { id: "forest", label: "Forest" },
  { id: "slate", label: "Slate" },
  { id: "ember", label: "Ember" },
  { id: "dawn", label: "Dawn" },
] as const;

export type ColorThemeId = (typeof colorThemes)[number]["id"];

const defaultColorTheme: ColorThemeId = "forest";
const storageKey = "climbingLogger.colorTheme";

type ThemeStorage = Pick<Storage, "getItem" | "setItem">;

export function isColorThemeId(value: unknown): value is ColorThemeId {
  return typeof value === "string" && colorThemes.some((theme) => theme.id === value);
}

export function getStoredColorTheme(storage: Pick<Storage, "getItem"> = window.localStorage): ColorThemeId {
  try {
    const storedTheme = storage.getItem(storageKey);
    return isColorThemeId(storedTheme) ? storedTheme : defaultColorTheme;
  } catch {
    return defaultColorTheme;
  }
}

export function saveColorTheme(theme: ColorThemeId, storage: ThemeStorage = window.localStorage): void {
  try {
    storage.setItem(storageKey, theme);
  } catch {
    // Theme persistence should never block the logger.
  }
}

export function applyColorTheme(theme: ColorThemeId, root: HTMLElement = document.documentElement): void {
  root.dataset.theme = theme;
}
