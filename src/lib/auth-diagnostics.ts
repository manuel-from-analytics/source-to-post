export type AuthCheckpoint =
  | "oauth_started"
  | "oauth_redirected"
  | "oauth_response_received"
  | "oauth_response_failed"
  | "session_initializing"
  | "session_missing"
  | "session_validating"
  | "session_authenticated"
  | "session_invalid"
  | "session_event"
  | "route_authenticated"
  | "route_anonymous";

type AuthTraceEntry = {
  attemptId: string;
  checkpoint: AuthCheckpoint;
  elapsedMs: number;
  path: string;
  flow: "iframe" | "redirect";
  detail?: string;
};

const TRACE_KEY = "postflow:auth-trace";
const ATTEMPT_KEY = "postflow:auth-attempt";
const START_KEY = "postflow:auth-started-at";
const MAX_ENTRIES = 30;
const ATTEMPT_TTL_MS = 15 * 60 * 1000;

function availableStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function createAttemptId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}

function flowType(): "iframe" | "redirect" {
  try {
    return window.self !== window.top ? "iframe" : "redirect";
  } catch {
    return "iframe";
  }
}

export function startAuthTrace(): string {
  const storage = availableStorage();
  const attemptId = createAttemptId();
  storage?.setItem(ATTEMPT_KEY, attemptId);
  storage?.setItem(START_KEY, String(Date.now()));
  storage?.removeItem(TRACE_KEY);
  recordAuthCheckpoint("oauth_started");
  return attemptId;
}

export function getAuthAttemptId(): string {
  const storage = availableStorage();
  const existing = storage?.getItem(ATTEMPT_KEY);
  if (existing) return existing;
  const attemptId = createAttemptId();
  storage?.setItem(ATTEMPT_KEY, attemptId);
  storage?.setItem(START_KEY, String(Date.now()));
  return attemptId;
}

export function getExistingAuthAttemptId(): string | null {
  const storage = availableStorage();
  const attemptId = storage?.getItem(ATTEMPT_KEY) ?? null;
  const startedAt = Number(storage?.getItem(START_KEY));
  if (!attemptId || !startedAt || Date.now() - startedAt > ATTEMPT_TTL_MS) {
    storage?.removeItem(ATTEMPT_KEY);
    storage?.removeItem(START_KEY);
    storage?.removeItem(TRACE_KEY);
    return null;
  }
  return attemptId;
}

export function completeAuthTrace(): void {
  const storage = availableStorage();
  storage?.removeItem(ATTEMPT_KEY);
  storage?.removeItem(START_KEY);
}

export function recordAuthCheckpoint(checkpoint: AuthCheckpoint, detail?: string): void {
  const storage = availableStorage();
  if (!storage) return;
  const attemptId = storage.getItem(ATTEMPT_KEY);
  if (!attemptId) return;

  const startedAt = Number(storage.getItem(START_KEY)) || Date.now();
  const entry: AuthTraceEntry = {
    attemptId,
    checkpoint,
    elapsedMs: Math.max(0, Date.now() - startedAt),
    path: window.location.pathname,
    flow: flowType(),
    detail,
  };

  let entries: AuthTraceEntry[] = [];
  try {
    entries = JSON.parse(storage.getItem(TRACE_KEY) ?? "[]") as AuthTraceEntry[];
  } catch {
    entries = [];
  }
  storage.setItem(TRACE_KEY, JSON.stringify([...entries, entry].slice(-MAX_ENTRIES)));
}

export function classifyAuthError(error: unknown): string {
  if (!(error instanceof Error)) return "unknown_error";
  const message = error.message.toLowerCase();
  if (message.includes("popup was blocked")) return "popup_blocked";
  if (message.includes("cancelled")) return "popup_cancelled";
  if (message.includes("state is invalid")) return "invalid_state";
  if (message.includes("no tokens")) return "missing_tokens";
  if (message.includes("timed out")) return "oauth_timeout";
  if (message.includes("legacy_flow")) return "legacy_flow";
  return "provider_error";
}