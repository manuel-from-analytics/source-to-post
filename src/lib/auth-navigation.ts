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
    return safeAuthDestination(localStorage.getItem("postflow:next") ?? sessionStorage.getItem("postflow:next"));
  } catch {
    return "/dashboard";
  }
}

export function storeAuthDestination(destination: string): void {
  try {
    localStorage.setItem("postflow:next", safeAuthDestination(destination));
  } catch {
    try {
      sessionStorage.setItem("postflow:next", safeAuthDestination(destination));
    } catch {
      // Storage can be unavailable in private browsing contexts.
    }
  }
}

export function clearStoredAuthDestination(): void {
  try {
    localStorage.removeItem("postflow:next");
    sessionStorage.removeItem("postflow:next");
  } catch {
    // Storage can be unavailable in private browsing contexts.
  }
}