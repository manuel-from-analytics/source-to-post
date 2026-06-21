import Papa from "papaparse";

export type LinkedInSource = "personal" | "company";

export interface ParsedMetricRow {
  source: LinkedInSource;
  linkedin_url: string | null;
  linkedin_urn: string | null;
  post_title: string | null;
  post_excerpt: string | null;
  posted_at: string | null; // ISO
  impressions: number;
  clicks: number;
  reactions: number;
  comments: number;
  shares: number;
  engagement_rate: number;
  raw: Record<string, unknown>;
}

const numberKeys: Record<string, RegExp[]> = {
  impressions: [/^impressions$/i, /^impresiones$/i, /^impressões$/i],
  clicks: [/^clicks$/i, /^clics$/i, /^cliques$/i],
  reactions: [/^reactions$/i, /^reacciones$/i, /^reações$/i, /^likes$/i, /^me gusta$/i],
  comments: [/^comments$/i, /^comentarios$/i, /^comentários$/i],
  shares: [/^shares$/i, /^reposts$/i, /^compartidos$/i, /^compartilhamentos$/i],
};

function pickNumber(row: Record<string, string>, kind: keyof typeof numberKeys): number {
  const keys = Object.keys(row);
  for (const k of keys) {
    if (numberKeys[kind].some((rx) => rx.test(k.trim()))) {
      const raw = (row[k] ?? "").toString().replace(/[^\d.,-]/g, "").replace(/,/g, "");
      const n = parseFloat(raw);
      if (!Number.isNaN(n)) return n;
    }
  }
  return 0;
}

function pickString(row: Record<string, string>, patterns: RegExp[]): string | null {
  const keys = Object.keys(row);
  for (const k of keys) {
    if (patterns.some((rx) => rx.test(k.trim()))) {
      const v = (row[k] ?? "").toString().trim();
      if (v) return v;
    }
  }
  return null;
}

function extractUrn(url: string | null): string | null {
  if (!url) return null;
  // Patterns: activity-1234567890, urn:li:activity:1234567890, share-1234567890
  const m =
    url.match(/(activity-\d+)/i) ||
    url.match(/(share-\d+)/i) ||
    url.match(/urn:li:[a-zA-Z]+:(\d+)/i) ||
    url.match(/(ugcPost-\d+)/i);
  return m ? m[1] || m[0] : null;
}

function parseDate(raw: string | null): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  return null;
}

export async function parseLinkedInCsv(
  file: File,
  source: LinkedInSource,
): Promise<ParsedMetricRow[]> {
  const text = await file.text();
  // LinkedIn exports often have preamble lines; find first line that looks like a header.
  const lines = text.split(/\r?\n/);
  let startIdx = 0;
  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    const l = lines[i].toLowerCase();
    if (
      (l.includes("impression") ||
        l.includes("impresiones") ||
        l.includes("impressões")) &&
      l.includes(",")
    ) {
      startIdx = i;
      break;
    }
  }
  const cleaned = lines.slice(startIdx).join("\n");
  const parsed = Papa.parse<Record<string, string>>(cleaned, {
    header: true,
    skipEmptyLines: true,
  });

  const rows: ParsedMetricRow[] = [];
  for (const row of parsed.data) {
    if (!row || typeof row !== "object") continue;

    const url = pickString(row, [/url/i, /link/i, /post.*url/i]);
    const title = pickString(row, [/^post title$/i, /^t[ií]tulo/i, /headline/i]);
    const excerpt = pickString(row, [/post text/i, /content/i, /texto/i, /conte[úu]do/i]);
    const date = pickString(row, [/posted/i, /created/i, /publicad/i, /fecha/i, /data/i, /date/i]);

    const impressions = pickNumber(row, "impressions");
    const clicks = pickNumber(row, "clicks");
    const reactions = pickNumber(row, "reactions");
    const comments = pickNumber(row, "comments");
    const shares = pickNumber(row, "shares");

    if (!impressions && !clicks && !reactions && !comments && !shares && !url) continue;

    const engagement_rate =
      impressions > 0 ? (reactions + comments + shares + clicks) / impressions : 0;

    rows.push({
      source,
      linkedin_url: url,
      linkedin_urn: extractUrn(url),
      post_title: title,
      post_excerpt: excerpt ? excerpt.slice(0, 500) : null,
      posted_at: parseDate(date),
      impressions,
      clicks,
      reactions,
      comments,
      shares,
      engagement_rate: Math.round(engagement_rate * 100000) / 100000,
      raw: row,
    });
  }
  return rows;
}

export function normalizeContent(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}
