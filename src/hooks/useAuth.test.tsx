import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";
import { AuthProvider, useAuth } from "./useAuth";

const getSession = vi.fn();
const getUser = vi.fn();
const signOut = vi.fn();
let authListener: ((event: string, session: Session | null) => void) | undefined;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => getSession(...args),
      getUser: (...args: unknown[]) => getUser(...args),
      signOut: (...args: unknown[]) => signOut(...args),
      onAuthStateChange: (listener: (event: string, session: Session | null) => void) => {
        authListener = listener;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    },
  },
}));

const fakeSession = {
  access_token: "test-access",
  refresh_token: "test-refresh",
  expires_in: 3600,
  token_type: "bearer",
  user: { id: "user-1" },
} as Session;

function Probe() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="status">{auth.status}</span>
      <span data-testid="user">{auth.user?.id ?? "none"}</span>
      <button onClick={() => void auth.confirmSession()}>confirm</button>
    </div>
  );
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    authListener = undefined;
  });

  it("settles as anonymous when no stored session exists", async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));
    expect(screen.getByTestId("user")).toHaveTextContent("none");
  });

  it("validates and exposes a stored session", async () => {
    getSession.mockResolvedValue({ data: { session: fakeSession }, error: null });
    getUser.mockResolvedValue({ data: { user: fakeSession.user }, error: null });
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(screen.getByTestId("user")).toHaveTextContent("user-1");
  });

  it("adopts a persisted session from INITIAL_SESSION after a reload", async () => {
    const pendingSession = deferred<{ data: { session: Session | null }; error: null }>();
    getSession.mockReturnValue(pendingSession.promise);
    render(<AuthProvider><Probe /></AuthProvider>);

    act(() => authListener?.("INITIAL_SESSION", fakeSession));
    pendingSession.resolve({ data: { session: null }, error: null });

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(screen.getByTestId("user")).toHaveTextContent("user-1");
  });

  it("keeps the restored user when the auth client refreshes its token", async () => {
    getSession.mockResolvedValue({ data: { session: fakeSession }, error: null });
    getUser.mockResolvedValue({ data: { user: fakeSession.user }, error: null });
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));

    const refreshedSession = { ...fakeSession, access_token: "refreshed-access" } as Session;
    act(() => authListener?.("TOKEN_REFRESHED", refreshedSession));

    expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    expect(screen.getByTestId("user")).toHaveTextContent("user-1");
  });

  it("does not let stale initialization overwrite a newer SIGNED_IN event", async () => {
    const pendingSession = deferred<{ data: { session: Session | null }; error: null }>();
    getSession.mockReturnValue(pendingSession.promise);
    render(<AuthProvider><Probe /></AuthProvider>);

    act(() => authListener?.("SIGNED_IN", fakeSession));
    pendingSession.resolve({ data: { session: null }, error: null });

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(screen.getByTestId("user")).toHaveTextContent("user-1");
  });

  it("confirms the helper-persisted session before navigation", async () => {
    getSession
      .mockResolvedValueOnce({ data: { session: null }, error: null })
      .mockResolvedValueOnce({ data: { session: fakeSession }, error: null });
    getUser.mockResolvedValue({ data: { user: fakeSession.user }, error: null });
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));

    fireEvent.click(screen.getByRole("button", { name: "confirm" }));
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it("waits for session hydration after a full-page OAuth return", async () => {
    sessionStorage.setItem("postflow:auth-attempt", "attempt-1");
    getSession
      .mockResolvedValueOnce({ data: { session: null }, error: null })
      .mockResolvedValueOnce({ data: { session: fakeSession }, error: null });
    getUser.mockResolvedValue({ data: { user: fakeSession.user }, error: null });

    render(<AuthProvider><Probe /></AuthProvider>);
    expect(screen.getByTestId("status")).toHaveTextContent("authenticating");
    act(() => authListener?.("INITIAL_SESSION", null));
    expect(screen.getByTestId("status")).toHaveTextContent("authenticating");
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"), { timeout: 1500 });
    expect(getSession).toHaveBeenCalledTimes(2);
  });
});