// Auto-publish agent: runs hourly via pg_cron.
// For each enabled schedule whose configured (day, hour) matches the user's
// local timezone (Europe/Madrid by default), picks the oldest "ready" post
// with the user's personal/company label and publishes it to LinkedIn.
// Sends an email with the LinkedIn URL on success, or a notice if no posts.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { publishTextToLinkedIn } from "../_shared/linkedin-publish.ts";
import { recordLabelPublication, type LabelKind } from "../_shared/label-publication.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Returns {dayOfWeek (0=Sun..6=Sat), hour} in the given IANA timezone.
function nowInTz(tz: string): { dow: number; hour: number; iso: string } {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    hour: "2-digit",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    minute: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dow = dowMap[parts.weekday as string] ?? new Date().getUTCDay();
  const hour = parseInt(parts.hour as string, 10);
  const iso = `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute} ${tz}`;
  return { dow, hour, iso };
}

async function sendEmail(templateName: string, recipient: string, idempotencyKey: string, data: Record<string, any>) {
  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ANON_KEY}`,
        apikey: ANON_KEY,
      },
      body: JSON.stringify({
        templateName,
        recipientEmail: recipient,
        idempotencyKey,
        templateData: data,
      }),
    });
    if (!resp.ok) console.error("email failed:", templateName, resp.status, await resp.text().catch(() => ""));
  } catch (e: any) {
    console.error("email exception:", e?.message || e);
  }
}

async function resolveEmail(admin: any, userId: string, configured?: string | null): Promise<string | undefined> {
  if (configured) return configured;
  try {
    const { data } = await admin.auth.admin.getUserById(userId);
    return data?.user?.email ?? undefined;
  } catch { return undefined; }
}

async function runForSchedule(admin: any, sched: any): Promise<{ ok: boolean; reason: string }> {
  const userId = sched.user_id as string;
  const target: LabelKind = sched.target === "company" ? "company" : "personal";
  const { iso } = nowInTz(sched.timezone || "Europe/Madrid");

  // 1) Find the user's label of this kind
  const { data: label } = await admin
    .from("post_labels")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", target)
    .maybeSingle();

  let postId: string | null = null;
  let post: any = null;

  if (label) {
    // 2) Find oldest "ready" post assigned to that label
    const { data: assignments } = await admin
      .from("post_label_assignments")
      .select("post_id")
      .eq("label_id", label.id);
    const ids = (assignments || []).map((a: any) => a.post_id);
    if (ids.length) {
      const { data: candidates } = await admin
        .from("generated_posts")
        .select("id, content, title, user_id, status, linkedin_url, created_at")
        .in("id", ids)
        .eq("user_id", userId)
        .eq("status", "final")
        .is("linkedin_url", null)
        .order("created_at", { ascending: true })
        .limit(1);
      if (candidates && candidates.length) {
        post = candidates[0];
        postId = post.id;
      }
    }
  }

  const email = await resolveEmail(admin, userId, sched.notification_email);

  if (!post || !postId) {
    if (email) {
      await sendEmail("auto-publish-no-posts", email, `auto-publish-no-posts-${sched.id}-${iso}`, {
        target,
        scheduledAt: iso,
      });
    }
    await admin.from("auto_publish_schedules").update({
      last_run_at: new Date().toISOString(),
      last_run_status: "no_posts",
      last_run_message: "No posts ready",
    }).eq("id", sched.id);
    return { ok: false, reason: "no_posts" };
  }

  // 3) Publish
  const result = await publishTextToLinkedIn(post.content || "");
  if (!result.ok) {
    await admin.from("auto_publish_schedules").update({
      last_run_at: new Date().toISOString(),
      last_run_status: "failed",
      last_run_message: result.error ?? "publish failed",
    }).eq("id", sched.id);
    return { ok: false, reason: result.error ?? "publish failed" };
  }

  const nowIso = new Date().toISOString();
  await admin.from("generated_posts").update({
    linkedin_url: result.linkedin_url,
    linkedin_published_at: nowIso,
    status: "published",
    published_at: nowIso,
  }).eq("id", postId);

  await recordLabelPublication(admin, userId, postId, target, nowIso);

  if (email) {
    const preview = (post.content || "").trim().slice(0, 180);
    await sendEmail("auto-publish-success", email, `auto-publish-success-${postId}`, {
      postTitle: post.title || "Sin título",
      postPreview: preview,
      linkedinUrl: result.linkedin_url,
      target,
    });
  }

  await admin.from("auto_publish_schedules").update({
    last_run_at: nowIso,
    last_run_status: "published",
    last_run_message: result.linkedin_url ?? null,
  }).eq("id", sched.id);

  return { ok: true, reason: "published" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Optional: allow manual trigger for a single user when body contains { user_id }.
    let manualUserId: string | null = null;
    try {
      const body = await req.json();
      if (body && typeof body.user_id === "string") manualUserId = body.user_id;
    } catch { /* no body */ }

    const query = admin.from("auto_publish_schedules").select("*").eq("enabled", true);
    const { data: schedules, error } = manualUserId
      ? await admin.from("auto_publish_schedules").select("*").eq("user_id", manualUserId)
      : await query;
    if (error) throw error;

    // Preload timezone per user from profiles, so the schedule's own timezone is ignored
    // and the unified profile timezone (configured in Settings) is used everywhere.
    const tzMap = new Map<string, string>();
    const uids = Array.from(new Set((schedules || []).map((s: any) => s.user_id)));
    if (uids.length > 0) {
      const { data: profs } = await admin.from("profiles").select("id, timezone").in("id", uids);
      for (const p of (profs || []) as any[]) tzMap.set(p.id, p.timezone || "Europe/Madrid");
    }

    const results: any[] = [];
    for (const sched of schedules || []) {
      const userTz = tzMap.get(sched.user_id) || sched.timezone || "Europe/Madrid";
      // Override schedule timezone with the unified profile timezone.
      sched.timezone = userTz;
      // Match current time to schedule (skip when not manual)
      if (!manualUserId) {
        const { dow, hour } = nowInTz(userTz);
        const days: number[] = Array.isArray(sched.days_of_week) ? sched.days_of_week : [];
        if (!days.includes(dow) || hour !== sched.hour) {
          continue;
        }
        // Idempotency: skip if last_run_at is within last 50 minutes
        if (sched.last_run_at) {
          const last = new Date(sched.last_run_at).getTime();
          if (Date.now() - last < 50 * 60 * 1000) continue;
        }
      }
      try {
        const r = await runForSchedule(admin, sched);
        results.push({ user_id: sched.user_id, ...r });
      } catch (e: any) {
        console.error("auto-publish error for user", sched.user_id, e?.message || e);
        results.push({ user_id: sched.user_id, ok: false, reason: e?.message || "error" });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("auto-publish-linkedin error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
