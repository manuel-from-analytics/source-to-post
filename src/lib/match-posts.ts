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

// Maximum time difference allowed when matching a personal metric to a personal
// publication entry. LinkedIn exports often store posted_at at the day boundary
// in UTC (e.g. 22:00:00+00 = next day in Madrid), so ±36h covers TZ shifts and
// small clock offsets while still keeping the match unambiguous (we publish
// at most one personal post per day).
const PERSONAL_DATE_TOLERANCE_MS = 36 * 60 * 60 * 1000;

export function buildPostMatcher(
  posts: PostLike[],
  personalPublications: PersonalPublication[] = [],
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

  const personal = personalPublications
    .map((p) => ({ post_id: p.post_id, t: new Date(p.published_at).getTime() }))
    .filter((p) => Number.isFinite(p.t));

  return function match(m: MetricLike): string | null {
    if (m.post_id) return m.post_id;

    // Direct URL/URN match first (works for both sources when LinkedIn URL is known).
    if (m.linkedin_url && byUrl.has(m.linkedin_url)) return byUrl.get(m.linkedin_url)!;
    const urn = extractUrn(m.linkedin_url);
    if (urn && byUrn.has(urn)) return byUrn.get(urn)!;

    if (m.source === "personal") {
      // Match against the per-label "Personal" publication date — closest within ±36h.
      if (!m.posted_at) return null;
      const t = new Date(m.posted_at).getTime();
      if (!Number.isFinite(t)) return null;
      let best: { id: string; diff: number } | null = null;
      for (const p of personal) {
        const diff = Math.abs(p.t - t);
        if (diff > PERSONAL_DATE_TOLERANCE_MS) continue;
        if (!best || diff < best.diff) best = { id: p.post_id, diff };
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
