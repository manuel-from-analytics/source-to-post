import Papa from "papaparse";
import * as XLSX from "xlsx";

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
  fileKind: "csv" | "xlsx" | "xls";
  sheetName?: string;
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
  reactions: [/^reactions$/i, /^reacciones$/i, /^reações$/i, /^likes$/i, /^me gusta$/i, /reaction/i, /\blikes?\b/i],
  comments: [/^comments$/i, /^comentarios$/i, /^comentários$/i, /comment/i],
  shares: [/^shares$/i, /^reposts$/i, /^compartidos$/i, /^compartilhamentos$/i, /share/i, /repost/i],
};

const stringKeys = {
  url: [/post.*link/i, /post.*url/i, /\burl\b/i, /\blink\b/i, /enlace/i],
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
  const s = String(raw).trim();
  if (!s) return 0;
  // Handle percentages like "1.23%"
  const isPct = s.includes("%");
  const cleaned = s.replace(/%/g, "").replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(/,/g, ".");
  const n = parseFloat(cleaned);
  if (Number.isNaN(n)) return 0;
  return isPct ? n / 100 : n;
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
  const s = String(raw).trim();
  if (!s) return null;
  // Excel serial date number
  if (/^\d{4,6}(\.\d+)?$/.test(s)) {
    const n = parseFloat(s);
    if (n > 20000 && n < 80000) {
      // Excel epoch: 1899-12-30
      const ms = (n - 25569) * 86400 * 1000;
      const d = new Date(ms);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  // Try DD/MM/YYYY or MM/DD/YYYY
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    const [, a, b, yy] = m;
    const year = yy.length === 2 ? 2000 + parseInt(yy) : parseInt(yy);
    // Heuristic: if first part > 12, must be DD/MM/YYYY; else assume MM/DD/YYYY (LinkedIn US format)
    const aN = parseInt(a), bN = parseInt(b);
    let day: number, month: number;
    if (aN > 12) { day = aN; month = bN; }
    else { month = aN; day = bN; }
    const d2 = new Date(year, month - 1, day);
    if (!Number.isNaN(d2.getTime())) return d2.toISOString();
  }
  return null;
}

const SUPPORTED_EXT = /\.(csv|tsv|txt|xls|xlsx)$/i;

function fileKindOf(name: string): "csv" | "xls" | "xlsx" | null {
  const m = name.toLowerCase().match(/\.(csv|tsv|txt|xls|xlsx)$/);
  if (!m) return null;
  if (m[1] === "xlsx") return "xlsx";
  if (m[1] === "xls") return "xls";
  return "csv";
}

interface ExtractedTable {
  kind: "csv" | "xlsx" | "xls";
  sheetName?: string;
  headers: string[];
  records: Record<string, string>[];
}

async function readCsvCleanedText(file: File): Promise<string> {
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
  return lines.slice(startIdx).join("\n");
}

async function extractFromCsv(file: File): Promise<ExtractedTable> {
  const text = await readCsvCleanedText(file);
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  if (parsed.errors.length && parsed.data.length === 0) {
    throw new CsvValidationError(`No se pudo leer el CSV: ${parsed.errors[0].message}.`);
  }
  const headers = (parsed.meta.fields ?? []).map((h) => h.trim()).filter(Boolean);
  return { kind: "csv", headers, records: parsed.data as Record<string, string>[] };
}

const KNOWN_HEADER_TOKENS = [
  "impression", "impresion", "impressões",
  "click", "clic", "cliques",
  "reaction", "reaccion", "reações", "likes",
  "comment", "comentario", "comentário",
  "share", "repost", "compartid", "compartilh",
  "post title", "post link", "post url",
  "engagement", "views", "follows",
];

function scoreHeaderRow(cells: unknown[]): number {
  let score = 0;
  let nonEmpty = 0;
  for (const c of cells) {
    const s = String(c ?? "").toLowerCase().trim();
    if (!s) continue;
    nonEmpty++;
    if (KNOWN_HEADER_TOKENS.some((t) => s.includes(t))) score += 2;
  }
  return nonEmpty >= 3 ? score : 0;
}

function aoaToRecords(aoa: unknown[][]): { headers: string[]; records: Record<string, string>[] } | null {
  let bestIdx = -1;
  let bestScore = 0;
  const limit = Math.min(aoa.length, 15);
  for (let i = 0; i < limit; i++) {
    const s = scoreHeaderRow(aoa[i] || []);
    if (s > bestScore) {
      bestScore = s;
      bestIdx = i;
    }
  }
  if (bestIdx === -1 || bestScore < 4) return null;
  const headerRow = (aoa[bestIdx] || []).map((c) => String(c ?? "").trim());
  const records: Record<string, string>[] = [];
  for (let i = bestIdx + 1; i < aoa.length; i++) {
    const row = aoa[i] || [];
    if (row.every((c) => c === null || c === undefined || String(c).trim() === "")) continue;
    const rec: Record<string, string> = {};
    let hasContent = false;
    for (let j = 0; j < headerRow.length; j++) {
      const key = headerRow[j];
      if (!key) continue;
      const val = row[j];
      const sval = val === null || val === undefined ? "" : String(val);
      rec[key] = sval;
      if (sval.trim()) hasContent = true;
    }
    if (hasContent) records.push(rec);
  }
  return { headers: headerRow.filter(Boolean), records };
}

async function extractFromExcel(file: File, kind: "xls" | "xlsx"): Promise<ExtractedTable> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  let best: { sheetName: string; headers: string[]; records: Record<string, string>[]; score: number } | null = null;

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, defval: "", raw: false });
    const parsed = aoaToRecords(aoa);
    if (!parsed || parsed.records.length === 0) continue;

    // Score: prefer sheets that look post-level (have url/title)
    const lcHeaders = parsed.headers.map((h) => h.toLowerCase());
    let score = parsed.records.length;
    if (lcHeaders.some((h) => h.includes("url") || h.includes("link"))) score += 1000;
    if (lcHeaders.some((h) => h.includes("post title") || h.includes("title") || h.includes("título"))) score += 500;
    // Penalize daily-aggregate sheets (have 'date' but no url/title)
    const hasDateOnly = lcHeaders.some((h) => h === "date" || h.includes("fecha"))
      && !lcHeaders.some((h) => h.includes("url") || h.includes("link") || h.includes("title"));
    if (hasDateOnly) score -= 2000;

    if (!best || score > best.score) {
      best = { sheetName, headers: parsed.headers, records: parsed.records, score };
    }
  }

  if (!best) {
    throw new CsvValidationError("No se encontró ninguna hoja con datos por publicación. Asegúrate de exportar las analíticas de contenido (no solo agregados diarios).");
  }
  return { kind, sheetName: best.sheetName, headers: best.headers, records: best.records };
}

async function extractTable(file: File): Promise<ExtractedTable> {
  const kind = fileKindOf(file.name);
  if (!kind) {
    throw new CsvValidationError(
      "Formato no soportado. Sube un archivo .csv, .xls o .xlsx exportado desde LinkedIn Analytics.",
    );
  }
  if (kind === "csv") return extractFromCsv(file);
  return extractFromExcel(file, kind);
}

function detectFormat(headers: string[], filename: string): { format: LinkedInCsvFormat; label: string; sourceHint: LinkedInSource | null } {
  const lc = headers.map((h) => h.toLowerCase().trim());
  const fn = filename.toLowerCase();
  const hasImpressions = lc.some((h) => h.includes("impression") || h.includes("impresion"));
  const hasReactions = lc.some((h) => h.includes("reaction") || h.includes("reaccion") || h === "likes" || h.includes("likes"));
  const hasUrl = lc.some((h) => h.includes("url") || h.includes("link"));
  const hasFollows = lc.some((h) => h.includes("follows"));
  const hasContentType = lc.some((h) => h === "content type");

  // LinkedIn company page export: has Likes + Reposts + Follows + Content Type
  if (hasFollows && hasContentType) {
    return { format: "linkedin-company-content", label: "LinkedIn — Página de empresa", sourceHint: "company" };
  }
  if (fn.includes("company") || fn.includes("empresa") || fn.includes("page-posts") || fn.includes("from-analytics")) {
    return { format: "linkedin-company-content", label: "LinkedIn — Página de empresa", sourceHint: "company" };
  }
  if (fn.includes("aggregateanalytics") || fn.includes("creator") || fn.includes("content_") || fn.includes("posts_")) {
    return { format: "linkedin-personal-content", label: "LinkedIn — Cuenta personal", sourceHint: "personal" };
  }
  if (hasImpressions && (hasReactions || hasUrl)) {
    return { format: "linkedin-generic", label: "LinkedIn (formato genérico)", sourceHint: null };
  }
  if (hasImpressions) {
    return { format: "linkedin-generic", label: "LinkedIn (formato genérico)", sourceHint: null };
  }
  return { format: "unknown", label: "Formato no reconocido", sourceHint: null };
}

export async function analyzeLinkedInFile(file: File): Promise<CsvAnalysis> {
  if (!SUPPORTED_EXT.test(file.name)) {
    throw new CsvValidationError(
      "Formato no soportado. Sube un archivo .csv, .xls o .xlsx exportado desde LinkedIn Analytics.",
    );
  }
  if (file.size === 0) throw new CsvValidationError("El archivo está vacío.");
  if (file.size > 15 * 1024 * 1024) {
    throw new CsvValidationError("El archivo supera los 15 MB. Reduce el rango de fechas exportado.");
  }

  const table = await extractTable(file);
  const { headers, records } = table;
  if (headers.length === 0) throw new CsvValidationError("No se detectaron columnas en el archivo.");

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
  if (table.kind !== "csv" && table.sheetName) {
    warnings.push(`Se está usando la hoja "${table.sheetName}" del archivo Excel.`);
  }
  if (format === "unknown" && missingRequired.length === 0) {
    warnings.push("No reconocemos el formato exacto, pero las columnas necesarias parecen presentes.");
  }

  const analysis: CsvAnalysis = {
    format,
    formatLabel: label,
    fileKind: table.kind,
    sheetName: table.sheetName,
    headers,
    rowCount: records.length,
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
  if (records.length === 0) {
    throw new CsvValidationError("El archivo no contiene filas de datos.", analysis);
  }

  return analysis;
}

// Backward-compatible alias
export const analyzeLinkedInCsv = analyzeLinkedInFile;

export async function parseLinkedInFile(
  file: File,
  source: LinkedInSource,
): Promise<ParsedMetricRow[]> {
  const analysis = await analyzeLinkedInFile(file);
  const table = await extractTable(file);

  const d = analysis.detected;
  const rows: ParsedMetricRow[] = [];
  for (const row of table.records) {
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

// Backward-compatible alias
export const parseLinkedInCsv = parseLinkedInFile;

export function normalizeContent(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}
