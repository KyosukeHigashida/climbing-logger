import { fireEvent, render, screen, within } from "@testing-library/react";
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
    const currentMonth = new Date();
    const sessionADay = formatLocalDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 24));
    const sessionBDay = formatLocalDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 25));
    await db.gyms.add({
      id: "gym-beta",
      name: "BETA",
      isArchived: false,
      createdAt: "2026-08-01T00:00:00.000Z",
    });
    await db.sessions.bulkAdd([
      {
        id: "session-a",
        startedAt: `${sessionADay}T10:00:00+09:00`,
        endedAt: `${sessionADay}T11:00:00+09:00`,
        initialGymId: "gym-beta",
        createdAt: `${sessionADay}T10:00:00+09:00`,
      },
      {
        id: "session-b",
        startedAt: `${sessionBDay}T10:00:00+09:00`,
        endedAt: `${sessionBDay}T11:00:00+09:00`,
        initialGymId: "gym-beta",
        createdAt: `${sessionBDay}T10:00:00+09:00`,
      },
    ]);
    await db.attempts.add({
      id: "attempt-a",
      sessionId: "session-a",
      climbId: "climb-a",
      startedAt: `${sessionADay}T10:10:00+09:00`,
      endedAt: `${sessionADay}T10:11:00+09:00`,
      result: "send",
      createdAt: `${sessionADay}T10:10:00+09:00`,
    });
    await db.strengthSets.add({
      id: "set-b",
      sessionId: "session-b",
      name: "Pull-up",
      startedAt: `${sessionBDay}T10:10:00+09:00`,
      endedAt: `${sessionBDay}T10:11:00+09:00`,
      createdAt: `${sessionBDay}T10:10:00+09:00`,
    });

    renderHistory();

    expect(await screen.findByText("Activity Calendar")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: new RegExp(sessionADay) }));

    const selectedDay = screen.getByRole("region", { name: "Selected day sessions" });
    expect(within(selectedDay).getByText("BETA")).toBeInTheDocument();
    expect(within(selectedDay).getByText("1 attempts · 1 sends · 0 training sets")).toBeInTheDocument();

    await user.click(within(selectedDay).getByRole("button", { name: /Open Summary/ }));
    expect(await screen.findByText("Summary route for session-a")).toBeInTheDocument();
  });

  it("places the month title above the calendar, controls below it, and changes months by swipe", async () => {
    renderHistory();

    const currentMonth = new Date();
    const currentMonthTitle = formatMonthTitle(currentMonth);
    const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    const nextMonthTitle = formatMonthTitle(nextMonth);
    const grid = await screen.findByRole("grid", { name: currentMonthTitle });
    const title = screen.getByText(currentMonthTitle);
    const previousButton = screen.getByRole("button", { name: "Previous month" });

    expect(Boolean(title.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(Boolean(grid.compareDocumentPosition(previousButton) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);

    fireEvent.pointerDown(grid, { clientX: 240, clientY: 120 });
    fireEvent.pointerUp(grid, { clientX: 120, clientY: 126 });

    expect(await screen.findByRole("grid", { name: nextMonthTitle })).toBeInTheDocument();
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

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMonthTitle(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(date);
}

function SummaryRouteProbe() {
  const { sessionId = "unknown" } = useParams();
  return <div>Summary route for {sessionId}</div>;
}
