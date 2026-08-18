import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IntervalTimer } from "./IntervalTimer";

describe("IntervalTimer", () => {
  it("shows elapsed interval from the supplied timestamp", () => {
    vi.setSystemTime(new Date("2026-08-17T09:04:30.000Z"));

    render(<IntervalTimer since="2026-08-17T09:00:00.000Z" />);

    expect(screen.getByText("04:30")).toBeInTheDocument();
  });
});
