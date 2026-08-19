import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AttemptEditor } from "./AttemptEditor";
import type { Attempt, Climb } from "../types/domain";

const attempt: Attempt = {
  id: "attempt-a",
  sessionId: "session-a",
  climbId: "climb-a",
  timestamp: "2026-08-17T09:23:00.000Z",
  startedAt: "2026-08-17T09:22:00.000Z",
  endedAt: "2026-08-17T09:23:00.000Z",
  result: "fail",
  createdAt: "2026-08-17T09:23:00.000Z",
};

const climbs: Climb[] = [
  {
    id: "climb-a",
    sessionId: "session-a",
    grade: "2Q",
    name: "Yellow #12",
    createdAt: "2026-08-17T09:00:00.000Z",
  },
  {
    id: "climb-b",
    sessionId: "session-a",
    grade: "3Q",
    name: "Blue #7",
    createdAt: "2026-08-17T09:01:00.000Z",
  },
];

describe("AttemptEditor", () => {
  it("shows a read-only date, editable interval inputs, and editable result", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    const { container } = render(
      <AttemptEditor
        attempt={attempt}
        climbs={climbs}
        sessionStartedAt="2026-08-17T09:00:00.000Z"
        sessionEndedAt="2026-08-17T10:00:00.000Z"
        onCancel={vi.fn()}
        onDelete={vi.fn()}
        onSave={onSave}
      />,
    );

    expect(container.querySelectorAll('input[type="date"]')).toHaveLength(0);
    expect(container.querySelectorAll('input[type="datetime-local"]')).toHaveLength(2);
    expect(screen.getByText("Date")).toBeInTheDocument();
    expect(screen.getByText("Start")).toBeInTheDocument();
    expect(screen.getByText("End")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "SEND" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith(
      "attempt-a",
      expect.objectContaining({
        result: "send",
        climbId: "climb-a",
        startedAt: "2026-08-17T09:22:00.000Z",
        endedAt: "2026-08-17T09:23:00.000Z",
      }),
    );
  });
});
