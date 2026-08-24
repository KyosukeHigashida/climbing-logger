import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db/db";
import { HistoryPage } from "./HistoryPage";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("HistoryPage", () => {
  it("selects a calendar day and opens the existing session summary route", async () => {
    const user = userEvent.setup();
    await db.gyms.add({
      id: "gym-beta",
      name: "BETA",
      isArchived: false,
      createdAt: "2026-08-01T00:00:00.000Z",
    });
    await db.sessions.bulkAdd([
      {
        id: "session-a",
        startedAt: "2026-08-24T10:00:00+09:00",
        endedAt: "2026-08-24T11:00:00+09:00",
        initialGymId: "gym-beta",
        createdAt: "2026-08-24T10:00:00+09:00",
      },
      {
        id: "session-b",
        startedAt: "2026-08-25T10:00:00+09:00",
        endedAt: "2026-08-25T11:00:00+09:00",
        initialGymId: "gym-beta",
        createdAt: "2026-08-25T10:00:00+09:00",
      },
    ]);
    await db.attempts.add({
      id: "attempt-a",
      sessionId: "session-a",
      climbId: "climb-a",
      startedAt: "2026-08-24T10:10:00+09:00",
      endedAt: "2026-08-24T10:11:00+09:00",
      result: "send",
      createdAt: "2026-08-24T10:10:00+09:00",
    });
    await db.strengthSets.add({
      id: "set-b",
      sessionId: "session-b",
      name: "Pull-up",
      startedAt: "2026-08-25T10:10:00+09:00",
      endedAt: "2026-08-25T10:11:00+09:00",
      createdAt: "2026-08-25T10:10:00+09:00",
    });

    renderHistory();

    expect(await screen.findByText("Activity Calendar")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /2026-08-24/ }));

    const selectedDay = screen.getByRole("region", { name: "Selected day sessions" });
    expect(within(selectedDay).getByText("BETA")).toBeInTheDocument();
    expect(within(selectedDay).getByText("1 attempts · 1 sends · 0 training sets")).toBeInTheDocument();

    await user.click(within(selectedDay).getByRole("button", { name: /Open Summary/ }));
    expect(await screen.findByText("Summary route for session-a")).toBeInTheDocument();
  });
});

function renderHistory() {
  return render(
    <MemoryRouter initialEntries={["/history"]}>
      <Routes>
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/session/:sessionId/summary" element={<SummaryRouteProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

function SummaryRouteProbe() {
  const { sessionId = "unknown" } = useParams();
  return <div>Summary route for {sessionId}</div>;
}
