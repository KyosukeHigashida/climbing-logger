import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { ActiveSessionProvider } from "../context/ActiveSessionContext";
import { db } from "../db/db";
import { createGym, createSession, getActiveSession } from "../db/repository";
import { HomePage } from "./HomePage";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("HomePage", () => {
  it("keeps gym and board master actions available during an active session", async () => {
    const user = userEvent.setup();
    const gym = await createGym("BETA");
    const session = await createSession(gym.id);

    renderHome();

    expect(await screen.findByRole("button", { name: "CONTINUE SESSION" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Add Gym" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Add Board" })).toBeInTheDocument();
    expect(screen.queryByText("Select Gym")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "+ Add Gym" }));
    expect(await screen.findByText("Gym master route")).toBeInTheDocument();

    await waitFor(async () => {
      expect(await getActiveSession()).toMatchObject({ id: session.id, initialGymId: gym.id, endedAt: null });
    });
  });

  it("shows gym selection only when no active session exists", async () => {
    await createGym("BETA");

    renderHome();

    expect(await screen.findByRole("button", { name: "START SESSION" })).toBeInTheDocument();
    expect(screen.getByText("Select Gym")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Add Gym" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Add Board" })).toBeInTheDocument();
  });
});

function renderHome() {
  return render(
    <ActiveSessionProvider>
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/gyms" element={<div>Gym master route</div>} />
          <Route path="/boards" element={<div>Board master route</div>} />
        </Routes>
      </MemoryRouter>
    </ActiveSessionProvider>,
  );
}
