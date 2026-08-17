import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ProtectedRoute } from "./ProtectedRoute";

const authState = vi.hoisted(() => ({ user: null as { id: string } | null, loading: false }));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => authState }));

function renderRoute() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route path="/login" element={<div>login</div>} />
        <Route path="/dashboard" element={<ProtectedRoute><div>dashboard</div></ProtectedRoute>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  it("redirects an anonymous user", () => {
    authState.user = null;
    authState.loading = false;
    renderRoute();
    expect(screen.getByText("login")).toBeInTheDocument();
  });

  it("renders only after the user is authenticated", () => {
    authState.user = { id: "user-1" };
    authState.loading = false;
    renderRoute();
    expect(screen.getByText("dashboard")).toBeInTheDocument();
  });
});