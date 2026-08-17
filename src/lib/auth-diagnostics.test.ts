import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  classifyAuthError,
  getExistingAuthAttemptId,
  getAuthAttemptId,
  recordAuthCheckpoint,
  startAuthTrace,
} from "./auth-diagnostics";

describe("auth diagnostics", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("stores only safe checkpoint metadata", () => {
    expect(getExistingAuthAttemptId()).toBeNull();
    recordAuthCheckpoint("session_initializing");
    expect(sessionStorage.getItem("postflow:auth-trace")).toBeNull();
    const attemptId = startAuthTrace();
    recordAuthCheckpoint("oauth_response_failed", "missing_tokens");
    const serialized = sessionStorage.getItem("postflow:auth-trace") ?? "";

    expect(getAuthAttemptId()).toBe(attemptId);
    expect(getExistingAuthAttemptId()).toBe(attemptId);
    expect(serialized).toContain("oauth_response_failed");
    expect(serialized).toContain("missing_tokens");
    expect(serialized).not.toContain("access_token");
    expect(serialized).not.toContain("refresh_token");
  });

  it.each([
    ["Popup was blocked", "popup_blocked"],
    ["Sign in was cancelled", "popup_cancelled"],
    ["State is invalid", "invalid_state"],
    ["No tokens received", "missing_tokens"],
    ["OAuth timed out waiting for response", "oauth_timeout"],
    ["Unexpected provider response", "provider_error"],
  ])("classifies %s", (message, code) => {
    expect(classifyAuthError(new Error(message))).toBe(code);
  });
});