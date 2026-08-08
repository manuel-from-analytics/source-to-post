// Factual grounding guard: every number/metric in a generated post must be
// present in the source material. Unsupported figures are rewritten as
// qualitative impact instead of invented data.
// Keep this file in sync with src/lib/mcp/numeric-guard.ts.

export const NUMERIC_GROUNDING_RULE = `REGLA INNEGOCIABLE - CIFRAS Y MÉTRICAS:
- Cualquier número, porcentaje, importe, multiplicador, fecha o métrica que aparezca en el post DEBE estar literalmente presente en las fuentes proporcionadas.
- Está PROHIBIDO estimar, redondear al alza, extrapolar o inventar cifras, aunque suenen plausibles.
- Si no hay una cifra en la fuente que respalde la idea, exprésala de forma cualitativa (por ejemplo: "una reducción notable del tiempo de respuesta") en lugar de poner un número.
- Puedes usar números que no son datos de la fuente solo cuando describen la estructura del propio post (por ejemplo "3 ideas", "2 pasos").
- Ante la duda, elimina la cifra y describe el impacto cualitativamente.`;

const NUM_TOKEN = /(?:[$€£]\s?)?\d[\d.,]*\s?(?:%|x|k|m|bn?|mil|millones|millón|miles|billones|mm)?/gi;

function normalizeNumber(raw: string): string {
  return raw.replace(/[^\d]/g, "");
}

function isMetricLike(raw: string): boolean {
  const lower = raw.toLowerCase().trim();
  if (/[%$€£]/.test(lower)) return true;
  if (/\d\s?(x|k|m|bn?|mil|millones|millón|miles|billones|mm)\b/.test(lower)) return true;
  if (/\d[.,]\d/.test(lower)) return true; // decimals / thousand separators
  const digits = normalizeNumber(lower);
  if (digits.length >= 3) return true; // >= 100, includes years
  return false;
}

/** Numbers used in the post that cannot be found in the source text. */
export function unsupportedNumbers(post: string, sources: string[]): string[] {
  const sourceDigits = new Set<string>();
  const sourceBlob = sources.join(" \n ");
  for (const m of sourceBlob.match(NUM_TOKEN) || []) {
    const d = normalizeNumber(m);
    if (d) sourceDigits.add(d);
  }
  const found = new Set<string>();
  for (const m of post.match(NUM_TOKEN) || []) {
    const token = m.trim();
    if (!isMetricLike(token)) continue;
    const d = normalizeNumber(token);
    if (!d) continue;
    if (sourceDigits.has(d)) continue;
    found.add(token);
  }
  return [...found];
}

export function numericRewritePrompt(post: string, offenders: string[], sources: string[]): string {
  return `El siguiente post de LinkedIn contiene cifras que NO aparecen en las fuentes y por tanto son inventadas: ${offenders
    .map((o) => `"${o}"`)
    .join(", ")}.

FUENTES:
${sources.join("\n\n---\n\n")}

POST:
${post}

Reescribe el post eliminando esas cifras concretas y sustituyéndolas por una descripción cualitativa del impacto (sin números). Mantén exactamente el mismo tono, estructura, idioma y longitud aproximada. Conserva intactas las cifras que sí están en las fuentes. Devuelve solo el post reescrito, sin explicaciones.`;
}

/**
 * Verifies the post's figures against the sources and, if it finds invented
 * ones, asks the model for one rewrite pass. Returns the safest version.
 */
export async function enforceNumericGrounding(
  post: string,
  sources: string[],
  rewrite: (prompt: string) => Promise<string>,
): Promise<{ content: string; rewritten: boolean; offenders: string[] }> {
  if (!post.trim() || sources.length === 0) return { content: post, rewritten: false, offenders: [] };
  const offenders = unsupportedNumbers(post, sources);
  if (offenders.length === 0) return { content: post, rewritten: false, offenders: [] };
  try {
    const revised = (await rewrite(numericRewritePrompt(post, offenders, sources)))?.trim();
    if (!revised) return { content: post, rewritten: false, offenders };
    const stillBad = unsupportedNumbers(revised, sources);
    // Only accept the rewrite if it actually improved grounding.
    if (stillBad.length < offenders.length) {
      return { content: revised, rewritten: true, offenders };
    }
    return { content: post, rewritten: false, offenders };
  } catch (_e) {
    return { content: post, rewritten: false, offenders };
  }
}
