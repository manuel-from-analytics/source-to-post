import { normalizeContent } from "./linkedin-csv";

interface PostLike {
  id: string;
  content: string | null;
  linkedin_url?: string | null;
}

interface MetricLike {
  post_id?: string | null;
  linkedin_url?: string | null;
  post_excerpt?: string | null;
  post_title?: string | null;
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

export function buildPostMatcher(posts: PostLike[]) {
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

  return function match(m: MetricLike): string | null {
    if (m.post_id) return m.post_id;
    if (m.linkedin_url && byUrl.has(m.linkedin_url)) return byUrl.get(m.linkedin_url)!;
    const urn = extractUrn(m.linkedin_url);
    if (urn && byUrn.has(urn)) return byUrn.get(urn)!;

    const candidates = [m.post_excerpt, m.post_title].filter(Boolean) as string[];
    for (const c of candidates) {
      const pf = prefix(c);
      if (!pf) continue;
      if (byPrefix.has(pf)) return byPrefix.get(pf)!;
      // bidirectional prefix match (excerpt may be truncated shorter or longer)
      for (const entry of prefixIndex) {
        if (entry.prefix.startsWith(pf) || pf.startsWith(entry.prefix)) {
          // require a meaningful overlap
          const overlap = Math.min(entry.prefix.length, pf.length);
          if (overlap >= 30) return entry.id;
        }
      }
    }
    return null;
  };
}
