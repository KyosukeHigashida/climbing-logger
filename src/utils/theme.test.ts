import { describe, expect, it } from "vitest";
import { applyColorTheme, getStoredColorTheme, isColorThemeId, saveColorTheme } from "./theme";

describe("theme utilities", () => {
  it("validates known color theme ids", () => {
    expect(isColorThemeId("forest")).toBe(true);
    expect(isColorThemeId("slate")).toBe(true);
    expect(isColorThemeId("ember")).toBe(true);
    expect(isColorThemeId("dawn")).toBe(true);
    expect(isColorThemeId("unknown")).toBe(false);
  });

  it("falls back to the current forest theme when storage has no valid theme", () => {
    const storage = {
      getItem: () => "unknown",
    };

    expect(getStoredColorTheme(storage)).toBe("forest");
  });

  it("saves and applies a color theme", () => {
    const saved: Record<string, string> = {};
    const storage = {
      getItem: (key: string) => saved[key] ?? null,
      setItem: (key: string, value: string) => {
        saved[key] = value;
      },
    };
    const root = document.createElement("html");

    saveColorTheme("slate", storage);
    applyColorTheme("slate", root);

    expect(getStoredColorTheme(storage)).toBe("slate");
    expect(root.dataset.theme).toBe("slate");
  });
});
