import { normalizeContent } from "./linkedin-csv";

interface PostLike {
  id: string;
  content: string | null;
  linkedin_url?: string | null;
}

export interface PersonalPublication {
  post_id: string;
  published_at: string; // ISO
}

interface MetricLike {
  post_id?: string | null;
  source?: "personal" | "company" | string | null;
  linkedin_url?: string | null;
  post_excerpt?: string | null;
  post_title?: string | null;
  posted_at?: string | null;
}

function extractUrn(url: string | null | undefined): string | null {
  if (!url) return null;
  const m =
    url.match(/(activity-\d+)/i) ||
    url.match(/(share-\d+)/i) ||
    url.match(/urn:li:[a-zA-Z]+:(\d+)/i) ||
    url.match(/(ugcPost-\d+)/i);
  return m ? m[1] || m[0] : null;
}

function prefix(s: string | null | undefined, n = 80): string {
  if (!s) return "";
  return normalizeContent(s).slice(0, n);
}

/**
 * Returns the local date in Europe/Madrid as YYYY-MM-DD.
 * Using Madrid (the publishing user's local TZ) avoids the UTC-midnight drift
 * where LinkedIn exports posted_at as "22:00:00+00" (= 00:00 next day in Madrid).
 */
function madridDateKey(iso: string): string | null {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  // sv-SE locale yields YYYY-MM-DD
  return d.toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
}

function dayDiff(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const ta = Date.UTC(ay, am - 1, ad);
  const tb = Date.UTC(by, bm - 1, bd);
  return Math.abs(ta - tb) / 86400000;
}

// Allow up to ±2 calendar days between LinkedIn's reported date and the app's
// "published as Personal" date (covers cases where the user marks the post in
// the app a day after actually posting on LinkedIn, or vice versa).
const PERSONAL_DAY_TOLERANCE = 2;

export interface BuildMatcherOptions {
  /**
   * All personal metrics that should participate in 1-to-1 assignment.
   * When provided, personal matches are computed globally so each post is
   * mapped to at most one metric (the closest by date). When omitted, falls
   * back to per-call nearest-neighbor matching (legacy behaviour).
   */
  personalMetrics?: MetricLike[];
}

export function buildPostMatcher(
  posts: PostLike[],
  personalPublications: PersonalPublication[] = [],
  options: BuildMatcherOptions = {},
) {
  const byUrl = new Map<string, string>();
  const byUrn = new Map<string, string>();
  const byPrefix = new Map<string, string>();
  const prefixIndex: { prefix: string; id: string }[] = [];

  for (const p of posts) {
    if (p.linkedin_url) {
      byUrl.set(p.linkedin_url, p.id);
      const urn = extractUrn(p.linkedin_url);
      if (urn) byUrn.set(urn, p.id);
    }
    const pf = prefix(p.content);
    if (pf) {
      if (!byPrefix.has(pf)) byPrefix.set(pf, p.id);
      prefixIndex.push({ prefix: pf, id: p.id });
    }
  }

  // Personal pubs with Madrid date key.
  const personal = personalPublications
    .map((p) => ({ post_id: p.post_id, day: madridDateKey(p.published_at) }))
    .filter((p): p is { post_id: string; day: string } => !!p.day);

  // ---- Pre-compute global 1-to-1 personal assignment ----
  // Key for personal metrics: linkedin_url (always present in exports). Fallback to
  // url+date if missing.
  const personalAssignment = new Map<string, string>(); // metric key -> post id

  function metricKey(m: MetricLike): string {
    return m.linkedin_url || `${m.posted_at ?? ""}|${m.post_title ?? ""}`;
  }

  if (options.personalMetrics && personal.length > 0) {
    // Build all candidate pairs (metric, pub) within tolerance, sorted by
    // distance ascending. Greedily assign — each metric and each pub used once.
    type Pair = { mKey: string; postId: string; dist: number };
    const pairs: Pair[] = [];
    for (const m of options.personalMetrics) {
      if (m.source !== "personal" || !m.posted_at) continue;
      const mDay = madridDateKey(m.posted_at);
      if (!mDay) continue;
      const key = metricKey(m);
      for (const p of personal) {
        const d = dayDiff(mDay, p.day);
        if (d > PERSONAL_DAY_TOLERANCE) continue;
        pairs.push({ mKey: key, postId: p.post_id, dist: d });
      }
    }
    pairs.sort((a, b) => a.dist - b.dist);
    const usedMetrics = new Set<string>();
    const usedPosts = new Set<string>();
    for (const pair of pairs) {
      if (usedMetrics.has(pair.mKey) || usedPosts.has(pair.postId)) continue;
      personalAssignment.set(pair.mKey, pair.postId);
      usedMetrics.add(pair.mKey);
      usedPosts.add(pair.postId);
    }
  }

  return function match(m: MetricLike): string | null {
    if (m.post_id) return m.post_id;

    // Direct URL/URN match first (works for both sources when LinkedIn URL is known).
    if (m.linkedin_url && byUrl.has(m.linkedin_url)) return byUrl.get(m.linkedin_url)!;
    const urn = extractUrn(m.linkedin_url);
    if (urn && byUrn.has(urn)) return byUrn.get(urn)!;

    if (m.source === "personal") {
      // Prefer the pre-computed global assignment when available.
      const pre = personalAssignment.get(metricKey(m));
      if (pre) return pre;

      // Fallback: nearest day within tolerance (no uniqueness guarantee).
      if (!m.posted_at || personal.length === 0) return null;
      const mDay = madridDateKey(m.posted_at);
      if (!mDay) return null;
      let best: { id: string; d: number } | null = null;
      for (const p of personal) {
        const d = dayDiff(mDay, p.day);
        if (d > PERSONAL_DAY_TOLERANCE) continue;
        if (!best || d < best.d) best = { id: p.post_id, d };
      }
      return best?.id ?? null;
    }

    // Company: content prefix match.
    const candidates = [m.post_excerpt, m.post_title].filter(Boolean) as string[];
    for (const c of candidates) {
      const pf = prefix(c);
      if (!pf) continue;
      if (byPrefix.has(pf)) return byPrefix.get(pf)!;
      for (const entry of prefixIndex) {
        if (entry.prefix.startsWith(pf) || pf.startsWith(entry.prefix)) {
          const overlap = Math.min(entry.prefix.length, pf.length);
          if (overlap >= 30) return entry.id;
        }
      }
    }
    return null;
  };
}
