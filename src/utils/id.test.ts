import { afterEach, describe, expect, it, vi } from "vitest";
import { generateId } from "./id";

const originalCrypto = globalThis.crypto;

afterEach(() => {
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: originalCrypto,
  });
});

describe("generateId", () => {
  it("uses crypto.randomUUID when available", () => {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {
        randomUUID: vi.fn(() => "random-uuid"),
        getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto),
      },
    });

    expect(generateId()).toBe("random-uuid");
    expect(globalThis.crypto.randomUUID).toHaveBeenCalled();
  });

  it("falls back when randomUUID is unavailable", () => {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {
        getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto),
      },
    });

    const first = generateId();
    const second = generateId();

    expect(first).not.toBe("");
    expect(second).not.toBe("");
    expect(first).not.toBe(second);
  });
});
