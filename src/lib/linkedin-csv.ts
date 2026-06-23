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

export interface SheetSummary {
  name: string;
  recordCount: number;
  headers: string[];
  hasUsableData: boolean;
  isAutoSelected: boolean;
}

export interface CsvAnalysis {
  format: LinkedInCsvFormat;
  formatLabel: string;
  fileKind: "csv" | "xlsx" | "xls";
  sheetName?: string;
  availableSheets?: SheetSummary[];
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

// IMPORTANT: order of patterns matters within a category. For "reactions", we
// accept LinkedIn's personal-account "Engagements" aggregate column as a
// fallback when no per-post reactions/likes column exists.
const numberKeys: Record<string, RegExp[]> = {
  impressions: [/^impressions$/i, /^impresiones$/i, /^impressões$/i, /impression/i],
  clicks: [/^clicks$/i, /^clics$/i, /^cliques$/i, /click/i],
  reactions: [
    /^reactions$/i, /^reacciones$/i, /^reações$/i,
    /^likes$/i, /^me gusta$/i,
    /reaction/i, /\blikes?\b/i,
    // Personal export aggregate: "Engagements" (sum of reactions+comments+shares).
    // We map it to reactions so ER = engagements/impressions stays correct.
    /^engagements?$/i,
  ],
  comments: [/^comments$/i, /^comentarios$/i, /^comentários$/i, /comment/i],
  shares: [/^shares$/i, /^reposts$/i, /^compartidos$/i, /^compartilhamentos$/i, /share/i, /repost/i],
};

const stringKeys = {
  url: [/post.*link/i, /post.*url/i, /\burl\b/i, /\blink\b/i, /enlace/i],
  title: [/^post title$/i, /^t[ií]tulo/i, /headline/i, /asunto/i],
  excerpt: [/post text/i, /^content$/i, /\btexto\b/i, /conte[úu]do/i, /publicaci[oó]n/i],
  date: [/^date$/i, /\bdate\b/i, /post.*date/i, /created.*date/i, /publish.*date/i, /^posted at$/i, /^posted on$/i, /publicad/i, /fecha/i, /\bdata\b/i],
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
  if (/^\d{4,6}(\.\d+)?$/.test(s)) {
    const n = parseFloat(s);
    if (n > 20000 && n < 80000) {
      const ms = (n - 25569) * 86400 * 1000;
      const d = new Date(ms);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    const [, a, b, yy] = m;
    const year = yy.length === 2 ? 2000 + parseInt(yy) : parseInt(yy);
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
  availableSheets?: SheetSummary[];
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
  return nonEmpty >= 2 ? score : 0;
}

/**
 * Splits a sheet into one or more sub-tables. LinkedIn's "TOP POSTS" sheet
 * lays out two mini-tables side by side separated by a blank column — one
 * ranked by engagements, the other by impressions — both reusing headers like
 * "Post URL". A single header row + single record per source row collapses
 * both into one and loses the engagements column. We split the header row on
 * blank cells and emit one sub-table per non-empty header group; the
 * downstream merge-by-URL recombines the metrics correctly.
 */
function aoaToTables(
  aoa: unknown[][],
): { headers: string[]; records: Record<string, string>[] }[] {
  let bestIdx = -1;
  let bestScore = 0;
  const limit = Math.min(aoa.length, 20);
  for (let i = 0; i < limit; i++) {
    const s = scoreHeaderRow(aoa[i] || []);
    if (s > bestScore) {
      bestScore = s;
      bestIdx = i;
    }
  }
  if (bestIdx === -1 || bestScore < 4) return [];
  const headerRow = (aoa[bestIdx] || []).map((c) => String(c ?? "").trim());

  const groups: { start: number; headers: string[] }[] = [];
  let i = 0;
  while (i < headerRow.length) {
    if (!headerRow[i]) { i++; continue; }
    const start = i;
    const hs: string[] = [];
    while (i < headerRow.length && headerRow[i]) { hs.push(headerRow[i]); i++; }
    groups.push({ start, headers: hs });
  }
  if (groups.length === 0) return [];

  const tables = groups.map((g) => ({
    headers: g.headers,
    records: [] as Record<string, string>[],
  }));

  for (let r = bestIdx + 1; r < aoa.length; r++) {
    const row = aoa[r] || [];
    if (row.every((c) => c === null || c === undefined || String(c).trim() === "")) continue;
    groups.forEach((g, gi) => {
      const rec: Record<string, string> = {};
      let hasContent = false;
      for (let k = 0; k < g.headers.length; k++) {
        const key = g.headers[k];
        const val = row[g.start + k];
        const sval = val === null || val === undefined ? "" : String(val);
        rec[key] = sval;
        if (sval.trim()) hasContent = true;
      }
      if (hasContent) tables[gi].records.push(rec);
    });
  }

  return tables.filter((t) => t.records.length > 0);
}

function aoaToRecords(aoa: unknown[][]): { headers: string[]; records: Record<string, string>[] } | null {
  const tables = aoaToTables(aoa);
  if (tables.length === 0) return null;
  // For legacy single-table consumers (analyze/UI preview), pick the table that
  // looks most post-like. The parser uses aoaToTables directly to merge.
  const scored = tables
    .map((t) => ({ t, s: scoreSheet(t.headers, t.records.length) }))
    .sort((a, b) => b.s - a.s);
  return scored[0].t;
}

function scoreSheet(headers: string[], recordCount: number): number {
  const lc = headers.map((h) => h.toLowerCase());
  let score = recordCount;
  if (lc.some((h) => h.includes("url") || h.includes("link"))) score += 1000;
  if (lc.some((h) => h.includes("post title") || h === "title" || h.includes("título"))) score += 500;
  // Penalize daily-aggregate sheets (have 'date' but no url/title)
  const hasDateOnly = lc.some((h) => h === "date" || h.includes("fecha"))
    && !lc.some((h) => h.includes("url") || h.includes("link") || h.includes("title"));
  if (hasDateOnly) score -= 2000;
  return score;
}

interface SheetParsed {
  name: string;
  headers: string[];
  records: Record<string, string>[];
  score: number;
}

async function parseAllSheets(file: File): Promise<{ all: SheetParsed[]; rawNames: string[] }> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  const all: SheetParsed[] = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, defval: "", raw: false });
    const parsed = aoaToRecords(aoa);
    if (!parsed) continue;
    all.push({
      name: sheetName,
      headers: parsed.headers,
      records: parsed.records,
      score: scoreSheet(parsed.headers, parsed.records.length),
    });
  }
  return { all, rawNames: wb.SheetNames };
}

async function extractFromExcel(
  file: File,
  kind: "xls" | "xlsx",
  preferredSheet?: string,
): Promise<ExtractedTable> {
  const { all } = await parseAllSheets(file);
  if (all.length === 0) {
    throw new CsvValidationError(
      "No se encontró ninguna hoja con datos legibles. Asegúrate de exportar las analíticas de contenido (no solo agregados diarios).",
    );
  }

  const sorted = [...all].sort((a, b) => b.score - a.score);
  const auto = sorted[0];

  let chosen = auto;
  if (preferredSheet) {
    const found = all.find((s) => s.name === preferredSheet);
    if (found) chosen = found;
  }

  const availableSheets: SheetSummary[] = all.map((s) => ({
    name: s.name,
    recordCount: s.records.length,
    headers: s.headers,
    hasUsableData: s.score > 0,
    isAutoSelected: s.name === auto.name,
  }));

  return {
    kind,
    sheetName: chosen.name,
    headers: chosen.headers,
    records: chosen.records,
    availableSheets,
  };
}

async function extractTable(file: File, preferredSheet?: string): Promise<ExtractedTable> {
  const kind = fileKindOf(file.name);
  if (!kind) {
    throw new CsvValidationError(
      "Formato no soportado. Sube un archivo .csv, .xls o .xlsx exportado desde LinkedIn Analytics.",
    );
  }
  if (kind === "csv") return extractFromCsv(file);
  return extractFromExcel(file, kind, preferredSheet);
}

function detectFormat(headers: string[], filename: string): { format: LinkedInCsvFormat; label: string; sourceHint: LinkedInSource | null } {
  const lc = headers.map((h) => h.toLowerCase().trim());
  const fn = filename.toLowerCase();
  const hasImpressions = lc.some((h) => h.includes("impression") || h.includes("impresion"));
  const hasReactions = lc.some((h) => h.includes("reaction") || h.includes("reaccion") || h === "likes" || h.includes("likes"));
  const hasUrl = lc.some((h) => h.includes("url") || h.includes("link"));
  const hasFollows = lc.some((h) => h.includes("follows"));
  const hasContentType = lc.some((h) => h === "content type");
  const hasEngagementsOnly =
    lc.some((h) => h === "engagements") &&
    !lc.some((h) => h === "likes" || h.includes("reaction") || h.includes("comment"));

  if (hasFollows && hasContentType) {
    return { format: "linkedin-company-content", label: "LinkedIn — Página de empresa", sourceHint: "company" };
  }
  if (hasEngagementsOnly && hasImpressions) {
    return { format: "linkedin-personal-content", label: "LinkedIn — Cuenta personal (agregado)", sourceHint: "personal" };
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

export async function analyzeLinkedInFile(file: File, sheetName?: string): Promise<CsvAnalysis> {
  if (!SUPPORTED_EXT.test(file.name)) {
    throw new CsvValidationError(
      "Formato no soportado. Sube un archivo .csv, .xls o .xlsx exportado desde LinkedIn Analytics.",
    );
  }
  if (file.size === 0) throw new CsvValidationError("El archivo está vacío.");
  if (file.size > 15 * 1024 * 1024) {
    throw new CsvValidationError("El archivo supera los 15 MB. Reduce el rango de fechas exportado.");
  }

  const table = await extractTable(file, sheetName);
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
    missingRequired.push("Engagements / Reacciones / Comentarios / Clics (al menos una)");
  }
  if (!detected.url && !detected.excerpt && !detected.title) {
    missingRequired.push("URL del post o texto/título (al menos uno)");
  }

  const { format, label, sourceHint } = detectFormat(headers, file.name);

  const warnings: string[] = [];
  if (!detected.date) warnings.push("No se detectó columna de fecha — los gráficos de evolución no podrán incluir estas filas.");
  if (!detected.url) warnings.push("No se detectó URL del post — el cruce con tus posts generados será solo por contenido.");
  if (table.kind !== "csv" && table.sheetName) {
    warnings.push(`Hoja seleccionada: "${table.sheetName}".`);
  }
  if (format === "linkedin-personal-content" && /engagements?/i.test(detected.reactions ?? "")) {
    warnings.push("Export personal: solo guardamos Impresiones y Engagements (agregado). El desglose por reacción/comentario/repost no está disponible en este export.");
  }
  if (format === "unknown" && missingRequired.length === 0) {
    warnings.push("No reconocemos el formato exacto, pero las columnas necesarias parecen presentes.");
  }

  const analysis: CsvAnalysis = {
    format,
    formatLabel: label,
    fileKind: table.kind,
    sheetName: table.sheetName,
    availableSheets: table.availableSheets,
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
    throw new CsvValidationError("La hoja seleccionada no contiene filas de datos.", analysis);
  }

  return analysis;
}

export const analyzeLinkedInCsv = analyzeLinkedInFile;

interface DetectedFields {
  impressions: string | null;
  clicks: string | null;
  reactions: string | null;
  comments: string | null;
  shares: string | null;
  url: string | null;
  title: string | null;
  excerpt: string | null;
  date: string | null;
}

function detectFields(headers: string[]): DetectedFields {
  return {
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
}

interface ParsedRowDraft extends ParsedMetricRow {
  _isAggregate?: boolean;
}

function mergeRow(
  byKey: Map<string, ParsedRowDraft>,
  source: LinkedInSource,
  d: DetectedFields,
  row: Record<string, string>,
) {
  const url = getByHeader(row, d.url).trim() || null;
  const title = getByHeader(row, d.title).trim() || null;
  const excerpt = getByHeader(row, d.excerpt).trim() || null;
  const date = getByHeader(row, d.date).trim() || null;
  const urn = extractUrn(url);
  // Key on URN > URL > title (so rows split across sheets can be merged).
  const key = urn || url || (title ? `t:${title.toLowerCase()}` : null);
  if (!key) return;

  const impressions = parseNumber(getByHeader(row, d.impressions));
  const clicks = parseNumber(getByHeader(row, d.clicks));
  const reactions = parseNumber(getByHeader(row, d.reactions));
  const comments = parseNumber(getByHeader(row, d.comments));
  const shares = parseNumber(getByHeader(row, d.shares));

  // Skip totally empty rows (no metrics, no identifying content).
  if (!impressions && !clicks && !reactions && !comments && !shares && !url && !title) return;

  // Personal exports use an aggregate "Engagements" column (= reactions + comments
  // + reposts as LinkedIn defines it, NOT clicks). When that header is present we
  // store it in `reactions` and skip summing the other fields on top.
  const isAggregate =
    source === "personal" && !!d.reactions && /engagements?/i.test(d.reactions);

  const existing = byKey.get(key);
  if (!existing) {
    byKey.set(key, {
      source,
      linkedin_url: url,
      linkedin_urn: urn,
      post_title: title,
      post_excerpt: excerpt ? excerpt.slice(0, 500) : null,
      posted_at: parseDate(date),
      impressions,
      clicks,
      reactions,
      comments,
      shares,
      engagement_rate: 0,
      raw: row,
      _isAggregate: isAggregate,
    });
    return;
  }
  existing.impressions = Math.max(existing.impressions, impressions);
  existing.clicks = Math.max(existing.clicks, clicks);
  existing.reactions = Math.max(existing.reactions, reactions);
  existing.comments = Math.max(existing.comments, comments);
  existing.shares = Math.max(existing.shares, shares);
  if (!existing.linkedin_url && url) existing.linkedin_url = url;
  if (!existing.linkedin_urn && urn) existing.linkedin_urn = urn;
  if (!existing.post_title && title) existing.post_title = title;
  if (!existing.post_excerpt && excerpt) existing.post_excerpt = excerpt.slice(0, 500);
  if (!existing.posted_at && date) existing.posted_at = parseDate(date);
  existing._isAggregate = existing._isAggregate || isAggregate;
  // Keep widest raw for debugging.
  existing.raw = { ...existing.raw, ...row };
}

function finalizeRows(byKey: Map<string, ParsedRowDraft>): ParsedMetricRow[] {
  const out: ParsedMetricRow[] = [];
  for (const r of byKey.values()) {
    const sum = r._isAggregate
      ? r.reactions
      : r.reactions + r.comments + r.shares + r.clicks;
    r.engagement_rate =
      r.impressions > 0 ? Math.round((sum / r.impressions) * 100000) / 100000 : 0;
    delete r._isAggregate;
    if (
      r.impressions ||
      r.clicks ||
      r.reactions ||
      r.comments ||
      r.shares ||
      r.linkedin_url
    ) {
      out.push(r);
    }
  }
  return out;
}

export async function parseLinkedInFile(
  file: File,
  source: LinkedInSource,
  sheetName?: string,
): Promise<ParsedMetricRow[]> {
  const kind = fileKindOf(file.name);
  if (!kind) {
    throw new CsvValidationError("Formato no soportado.");
  }

  const byKey = new Map<string, ParsedRowDraft>();

  if (kind === "csv") {
    const table = await extractFromCsv(file);
    const d = detectFields(table.headers);
    for (const row of table.records) {
      if (!row || typeof row !== "object") continue;
      mergeRow(byKey, source, d, row);
    }
    return finalizeRows(byKey);
  }

  // For Excel exports, parse ALL sheets and merge by URL/URN. LinkedIn often
  // splits "Impressions" and "Engagements" into separate sheets, so the only
  // way to get both numbers on the same post is to merge across sheets.
  const { all } = await parseAllSheets(file);
  if (all.length === 0) {
    throw new CsvValidationError("No se encontró ninguna hoja con datos legibles.");
  }
  for (const sheet of all) {
    const d = detectFields(sheet.headers);
    // Skip sheets that have no identifying column AND no metrics — they can't
    // contribute anything useful and would just inflate the raw map.
    const hasMetric =
      d.impressions || d.clicks || d.reactions || d.comments || d.shares;
    const hasId = d.url || d.title;
    if (!hasMetric || !hasId) continue;
    for (const row of sheet.records) {
      if (!row || typeof row !== "object") continue;
      mergeRow(byKey, source, d, row);
    }
  }
  // sheetName arg is preserved in the signature for backwards compatibility
  // but is intentionally ignored now that we merge across all sheets.
  void sheetName;
  return finalizeRows(byKey);
}


export const parseLinkedInCsv = parseLinkedInFile;

export function normalizeContent(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}
