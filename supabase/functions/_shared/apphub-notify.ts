// Shared helper: send notifications to the user's external AppHub app
// via HTTP POST. Replaces email-based agent notifications.

const NOTIFY_URL = Deno.env.get("APPHUB_NOTIFY_URL") || "https://app-hub-alpha.vercel.app/api/notify";
const NOTIFY_TOKEN = Deno.env.get("APPHUB_NOTIFY_TOKEN");
const NOTIFY_SOURCE = Deno.env.get("APPHUB_NOTIFY_SOURCE") || "postflow";

export interface AppHubNotifyInput {
  title: string;
  status?: "ok" | "warning" | "error";
  body?: string;
  metadata?: Record<string, unknown>;
}

export async function appHubNotify(input: AppHubNotifyInput): Promise<boolean> {
  if (!NOTIFY_TOKEN) {
    console.error("APPHUB_NOTIFY_TOKEN not configured; skipping notification");
    return false;
  }
  try {
    const payload = {
      source: NOTIFY_SOURCE,
      title: (input.title || "").slice(0, 200),
      status: input.status || "ok",
      body: input.body ? input.body.slice(0, 8000) : undefined,
      metadata: input.metadata,
    };
    const resp = await fetch(NOTIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${NOTIFY_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      console.error("apphub notify failed:", resp.status, await resp.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (e: any) {
    console.error("apphub notify exception:", e?.message || e);
    return false;
  }
}
