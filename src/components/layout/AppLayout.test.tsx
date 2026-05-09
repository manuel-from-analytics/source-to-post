import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppLayout } from "./AppLayout";

const signOutMock = vi.fn().mockResolvedValue(undefined);
const navigateMock = vi.fn();

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ signOut: signOutMock, session: null, user: null, loading: false }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("@/i18n/LanguageContext", () => ({
  useLanguage: () => ({ t: (k: string) => k, language: "es", setLanguage: () => {} }),
}));

function renderLayout() {
  return render(
    <MemoryRouter>
      <AppLayout>
        <div>content</div>
      </AppLayout>
    </MemoryRouter>
  );
}

describe("AppLayout logout button", () => {
  beforeEach(() => {
    signOutMock.mockClear();
    navigateMock.mockClear();
  });

  it("calls signOut and redirects to /auth", async () => {
    renderLayout();
    const buttons = screen.getAllByText("nav.logout");
    expect(buttons.length).toBeGreaterThan(0);
    fireEvent.click(buttons[0]);
    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalledTimes(1);
      expect(navigateMock).toHaveBeenCalledWith("/auth");
    });
  });
});
