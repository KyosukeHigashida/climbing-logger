import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActiveSessionProvider } from "../context/ActiveSessionContext";
import { db } from "../db/db";
import { createSession, endSession, updateSessionReview } from "../db/repository";
import { SessionSummaryPage } from "./SessionSummaryPage";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("SessionSummaryPage", () => {
  it("saves optional session review fields from the summary page", async () => {
    const user = userEvent.setup();
    vi.setSystemTime(new Date("2026-08-17T09:00:00.000Z"));
    const session = await createSession();
    vi.setSystemTime(new Date("2026-08-17T10:00:00.000Z"));
    await endSession(session.id);

    renderSummary(session.id);

    expect(await screen.findByText("SESSION REVIEW")).toBeInTheDocument();
    await user.click(screen.getByLabelText("Session RPE"));
    fireEvent.change(screen.getByLabelText("Session RPE", { selector: 'input[type="range"]' }), { target: { value: "8" } });
    await user.click(screen.getByLabelText("Performance"));
    fireEvent.change(screen.getByLabelText("Session performance"), { target: { value: "4" } });
    await user.type(screen.getByLabelText("Memo"), "Good pacing after warm-up.");

    await user.click(screen.getByRole("button", { name: "SAVE REVIEW" }));

    await waitFor(async () => {
      expect(await db.sessions.get(session.id)).toMatchObject({
        sessionRpe: 8,
        performance: 4,
        memo: "Good pacing after warm-up.",
      });
    });
    expect(await screen.findByText("Review saved.")).toBeInTheDocument();
  });

  it("shows saved review values and allows editing them again", async () => {
    const user = userEvent.setup();
    const session = await createSession();
    await endSession(session.id);
    await updateSessionReview(session.id, {
      sessionRpe: 6,
      performance: 2,
      memo: "Felt flat.",
    });

    renderSummary(session.id);

    expect(await screen.findByDisplayValue("Felt flat.")).toBeInTheDocument();
    expect(screen.getByText("RPE 6")).toBeInTheDocument();
    expect(screen.getByText("Below normal")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Memo"));
    await user.type(screen.getByLabelText("Memo"), "Better than expected by the end.");
    fireEvent.change(screen.getByLabelText("Session performance"), { target: { value: "5" } });
    await user.click(screen.getByRole("button", { name: "SAVE REVIEW" }));

    await waitFor(async () => {
      expect(await db.sessions.get(session.id)).toMatchObject({
        sessionRpe: 6,
        performance: 5,
        memo: "Better than expected by the end.",
      });
    });
  });
});

function renderSummary(sessionId: string) {
  return render(
    <ActiveSessionProvider>
      <MemoryRouter initialEntries={[`/session/${sessionId}/summary`]}>
        <Routes>
          <Route path="/session/:sessionId/summary" element={<SessionSummaryPage />} />
        </Routes>
      </MemoryRouter>
    </ActiveSessionProvider>,
  );
}
