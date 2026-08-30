import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActiveSessionProvider } from "../context/ActiveSessionContext";
import { db } from "../db/db";
import { createGym, createSession, endSession, getActiveSession } from "../db/repository";
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

  it("collapses and expands recent sessions", async () => {
    const user = userEvent.setup();
    const gym = await createGym("BETA");
    const session = await createSession(gym.id);
    await endSession(session.id);

    renderHome();

    const recentSessions = await screen.findByRole("region", { name: "Recent sessions" });
    expect(within(recentSessions).getByText("BETA")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Recent Sessions/ }));
    expect(within(recentSessions).queryByText("BETA")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Recent Sessions/ }));
    expect(within(recentSessions).getByText("BETA")).toBeInTheDocument();
  });

  it("opens settings and selects a color theme", async () => {
    const user = userEvent.setup();
    const handleColorThemeChange = vi.fn();

    renderHome({ colorTheme: "forest", onColorThemeChange: handleColorThemeChange });

    await user.click(await screen.findByRole("button", { name: "Settings" }));
    const settings = screen.getByRole("dialog", { name: "Settings" });

    expect(within(settings).getByRole("button", { name: "Forest" })).toHaveAttribute("aria-pressed", "true");
    await user.click(within(settings).getByRole("button", { name: "Slate" }));

    expect(handleColorThemeChange).toHaveBeenCalledWith("slate");
  });
});

function renderHome(props: ComponentProps<typeof HomePage> = {}) {
  return render(
    <ActiveSessionProvider>
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<HomePage {...props} />} />
          <Route path="/gyms" element={<div>Gym master route</div>} />
          <Route path="/boards" element={<div>Board master route</div>} />
        </Routes>
      </MemoryRouter>
    </ActiveSessionProvider>,
  );
}
