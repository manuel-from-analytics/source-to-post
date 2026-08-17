export function safeAuthDestination(raw: string | null): string {
  if (!raw) return "/dashboard";
  try {
    const decoded = decodeURIComponent(raw);
    if (!decoded.startsWith("/") || decoded.startsWith("//") || decoded.startsWith("/\\")) {
      return "/dashboard";
    }
    return decoded;
  } catch {
    return "/dashboard";
  }
}

export function readStoredAuthDestination(): string {
  try {
    return safeAuthDestination(sessionStorage.getItem("postflow:next"));
  } catch {
    return "/dashboard";
  }
}

export function clearStoredAuthDestination(): void {
  try {
    sessionStorage.removeItem("postflow:next");
  } catch {
    // Storage can be unavailable in private browsing contexts.
  }
}