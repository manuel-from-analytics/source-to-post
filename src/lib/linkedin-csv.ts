import Papa from "papaparse";

export type LinkedInSource = "personal" | "company";

export type LinkedInCsvFormat =
  | "linkedin-personal-content"
  | "linkedin-company-content"
  | "linkedin-generic"
  | "unknown";

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

export interface CsvAnalysis {
  format: LinkedInCsvFormat;
  formatLabel: string;
  headers: string[];
  rowCount: number;
  detected: {
    impressions: string | null;
    clicks: string | null;
    reactions: string | null;
    comments: string | null;
    shares: string | null;
    url: string | null;
    title: string | null;
    excerpt: string | null;
    date: string | null;
  };
  missingRequired: string[];
  warnings: string[];
  sourceHint: LinkedInSource | null;
}

export class CsvValidationError extends Error {
  analysis?: CsvAnalysis;
  constructor(message: string, analysis?: CsvAnalysis) {
    super(message);
    this.name = "CsvValidationError";
    this.analysis = analysis;
  }
}

const numberKeys: Record<string, RegExp[]> = {
  impressions: [/^impressions$/i, /^impresiones$/i, /^impressões$/i, /impression/i],
  clicks: [/^clicks$/i, /^clics$/i, /^cliques$/i, /click/i],
  reactions: [/^reactions$/i, /^reacciones$/i, /^reações$/i, /^likes$/i, /^me gusta$/i, /reaction/i],
  comments: [/^comments$/i, /^comentarios$/i, /^comentários$/i, /comment/i],
  shares: [/^shares$/i, /^reposts$/i, /^compartidos$/i, /^compartilhamentos$/i, /share/i, /repost/i],
};

const stringKeys = {
  url: [/post.*url/i, /\burl\b/i, /\blink\b/i, /enlace/i],
  title: [/^post title$/i, /^t[ií]tulo/i, /headline/i, /asunto/i],
  excerpt: [/post text/i, /^content$/i, /\btexto\b/i, /conte[úu]do/i, /publicaci[oó]n/i],
  date: [/posted/i, /created/i, /publicad/i, /fecha/i, /\bdata\b/i, /\bdate\b/i],
} as const;

function findHeader(headers: string[], patterns: readonly RegExp[]): string | null {
  for (const h of headers) {
    if (patterns.some((rx) => rx.test(h.trim()))) return h;
  }
  return null;
}

function getByHeader(row: Record<string, string>, header: string | null): string {
  if (!header) return "";
  return (row[header] ?? "").toString();
}

function parseNumber(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(/,/g, ".");
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? 0 : n;
}

function extractUrn(url: string | null): string | null {
  if (!url) return null;
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
  // Try DD/MM/YYYY
  const m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    const [, dd, mm, yy] = m;
    const year = yy.length === 2 ? 2000 + parseInt(yy) : parseInt(yy);
    const d2 = new Date(year, parseInt(mm) - 1, parseInt(dd));
    if (!Number.isNaN(d2.getTime())) return d2.toISOString();
  }
  return null;
}

async function readCleanedText(file: File): Promise<{ text: string; allLines: string[] }> {
  const text = await file.text();
  const lines = text.split(/\r?\n/);
  let startIdx = 0;
  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    const l = lines[i].toLowerCase();
    if (
      (l.includes("impression") || l.includes("impresion") || l.includes("impressões")) &&
      (l.includes(",") || l.includes(";") || l.includes("\t"))
    ) {
      startIdx = i;
      break;
    }
  }
  return { text: lines.slice(startIdx).join("\n"), allLines: lines };
}

function detectFormat(headers: string[], filename: string): { format: LinkedInCsvFormat; label: string; sourceHint: LinkedInSource | null } {
  const lc = headers.map((h) => h.toLowerCase().trim());
  const fn = filename.toLowerCase();
  const hasImpressions = lc.some((h) => h.includes("impression") || h.includes("impresion"));
  const hasReactions = lc.some((h) => h.includes("reaction") || h.includes("reaccion") || h === "likes");
  const hasUrl = lc.some((h) => h.includes("url") || h.includes("link"));

  if (fn.includes("company") || fn.includes("empresa") || fn.includes("page-posts")) {
    return { format: "linkedin-company-content", label: "LinkedIn — Página de empresa", sourceHint: "company" };
  }
  if (fn.includes("creator") || fn.includes("content_") || fn.includes("posts_")) {
    return { format: "linkedin-personal-content", label: "LinkedIn — Cuenta personal", sourceHint: "personal" };
  }
  if (hasImpressions && hasReactions && hasUrl) {
    return { format: "linkedin-generic", label: "LinkedIn (formato genérico)", sourceHint: null };
  }
  if (hasImpressions) {
    return { format: "linkedin-generic", label: "LinkedIn (formato genérico)", sourceHint: null };
  }
  return { format: "unknown", label: "Formato no reconocido", sourceHint: null };
}

export async function analyzeLinkedInCsv(file: File): Promise<CsvAnalysis> {
  if (!file.name.toLowerCase().match(/\.(csv|tsv|txt)$/)) {
    throw new CsvValidationError(
      "El archivo debe ser un CSV. Si descargaste un .xlsx desde LinkedIn, ábrelo y guárdalo como CSV.",
    );
  }
  if (file.size === 0) {
    throw new CsvValidationError("El archivo está vacío.");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new CsvValidationError("El archivo supera los 10 MB. Reduce el rango de fechas exportado.");
  }

  const { text } = await readCleanedText(file);
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length && parsed.data.length === 0) {
    throw new CsvValidationError(
      `No se pudo leer el CSV: ${parsed.errors[0].message}. Comprueba que el archivo no esté corrupto.`,
    );
  }

  const headers = (parsed.meta.fields ?? []).map((h) => h.trim()).filter(Boolean);
  if (headers.length === 0) {
    throw new CsvValidationError("No se detectaron columnas en el CSV.");
  }

  const detected = {
    impressions: findHeader(headers, numberKeys.impressions),
    clicks: findHeader(headers, numberKeys.clicks),
    reactions: findHeader(headers, numberKeys.reactions),
    comments: findHeader(headers, numberKeys.comments),
    shares: findHeader(headers, numberKeys.shares),
    url: findHeader(headers, stringKeys.url),
    title: findHeader(headers, stringKeys.title),
    excerpt: findHeader(headers, stringKeys.excerpt),
    date: findHeader(headers, stringKeys.date),
  };

  const missingRequired: string[] = [];
  if (!detected.impressions) missingRequired.push("Impresiones");
  if (!detected.reactions && !detected.clicks && !detected.comments) {
    missingRequired.push("Reacciones / Comentarios / Clics (al menos una)");
  }
  if (!detected.url && !detected.excerpt && !detected.title) {
    missingRequired.push("URL del post o texto/título (al menos uno)");
  }

  const { format, label, sourceHint } = detectFormat(headers, file.name);

  const warnings: string[] = [];
  if (!detected.date) warnings.push("No se detectó columna de fecha — los gráficos de evolución no podrán incluir estas filas.");
  if (!detected.url) warnings.push("No se detectó URL del post — el cruce con tus posts generados será solo por contenido.");
  if (format === "unknown" && missingRequired.length === 0) {
    warnings.push("No reconocemos el formato exacto, pero las columnas necesarias parecen presentes.");
  }

  const analysis: CsvAnalysis = {
    format,
    formatLabel: label,
    headers,
    rowCount: parsed.data.length,
    detected,
    missingRequired,
    warnings,
    sourceHint,
  };

  if (missingRequired.length > 0) {
    throw new CsvValidationError(
      `Faltan columnas obligatorias: ${missingRequired.join(", ")}.`,
      analysis,
    );
  }
  if (parsed.data.length === 0) {
    throw new CsvValidationError("El CSV no contiene filas de datos.", analysis);
  }

  return analysis;
}

export async function parseLinkedInCsv(
  file: File,
  source: LinkedInSource,
): Promise<ParsedMetricRow[]> {
  const analysis = await analyzeLinkedInCsv(file);
  const { text } = await readCleanedText(file);
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  const d = analysis.detected;
  const rows: ParsedMetricRow[] = [];
  for (const row of parsed.data) {
    if (!row || typeof row !== "object") continue;

    const url = getByHeader(row, d.url).trim() || null;
    const title = getByHeader(row, d.title).trim() || null;
    const excerpt = getByHeader(row, d.excerpt).trim() || null;
    const date = getByHeader(row, d.date).trim() || null;

    const impressions = parseNumber(getByHeader(row, d.impressions));
    const clicks = parseNumber(getByHeader(row, d.clicks));
    const reactions = parseNumber(getByHeader(row, d.reactions));
    const comments = parseNumber(getByHeader(row, d.comments));
    const shares = parseNumber(getByHeader(row, d.shares));

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
