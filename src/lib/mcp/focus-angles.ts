// Shared "focus angle" instruction blocks used by every prompt builder.
// Keep this file in sync with src/lib/mcp/focus-angles.ts.

export const FOCUS_ANGLES = ["business", "technical", "strategic", "practical", "educational", "auto"] as const;
export type FocusAngle = (typeof FOCUS_ANGLES)[number];

type Lang = "es" | "en" | "pt";

const ES: Record<string, string> = {
  business: `ÁNGULO: Impacto de negocio (perfiles comerciales y directivos)
- El lector decide sobre su empresa: comprar, invertir, priorizar. No busca contexto de mercado.
- Prioriza casos reales con números. Usa SOLO cifras presentes en la fuente; si no hay cifras, formula el impacto de forma cualitativa y no inventes datos.
- Traduce tendencias técnicas a decisiones de negocio (presupuesto, riesgo, plazos).
- Habla de errores caros: por qué fallan los proyectos de analítica/IA y cuánto cuesta.
- Aporta frameworks de decisión: cómo saber si necesitas un dashboard, un agente, o nada.
- Opina con criterio de consultor: qué compran las empresas y qué acaba en un cajón.
- Evita la jerga técnica; si aparece un término, explícalo en una línea con su implicación económica.`,
  technical: `ÁNGULO: Profundidad técnica (perfiles técnicos)
- Explica cómo funciona por dentro: arquitectura, flujo de datos, componentes clave.
- Da números técnicos presentes en la fuente: latencias, costes de cómputo, contexto, precisión, límites. No inventes cifras.
- Expón trade-offs reales frente a la alternativa obvia.
- Incluye detalles de implementación que ahorran horas: configuración, patrón concreto, gotcha típico.
- Opinión técnica fundamentada: cuándo esta solución no merece la pena.
- Usa el término correcto sin diluirlo; asume que el lector conoce el dominio.`,
  strategic: `ÁNGULO: Visión de mercado y tendencia (dirección, decisores)
- El lector quiere entender el mercado, no tomar una decisión inmediata.
- Señala qué cambia en el sector y por qué ahora: la señal concreta detrás de la noticia.
- Analiza movimientos de los actores relevantes y qué implican para el resto.
- Plantea escenarios a 12-24 meses con su consecuencia práctica, e indica explícitamente qué señal invalidaría la predicción.
- Di qué apuestas envejecen mal y cuáles ganan tracción.
- Aporta una lectura propia del mercado, no un resumen neutro de la fuente.`,
  practical: `ÁNGULO: Accionable (cualquier perfil que quiera aplicarlo)
- Di qué puede hacer el lector hoy con esto: pasos concretos y ordenados.
- Indica requisitos previos reales (herramientas, datos, tiempo estimado).
- Incluye un ejemplo aplicado condensado, de 3 a 5 pasos máximo, no genérico.
- Menciona los errores frecuentes al intentarlo y cómo evitarlos.
- Cierra con un criterio de "hecho": cómo saber si ha funcionado.`,
  educational: `ÁNGULO: Divulgativo (audiencia no experta)
- Explica el concepto desde cero con una analogía cotidiana.
- Deja claro por qué importa a alguien que no trabaja en esto.
- Desmonta un malentendido habitual sobre el tema.
- Usa un ejemplo mínimo y reconocible.
- Cero jerga sin explicar.`,
  auto: `ÁNGULO: elige tú el más adecuado según la fuente entre business (decisión de empresa), strategic (lectura de mercado), practical (accionable), educational (divulgativo) y technical (profundidad técnica).
En caso de duda entre dos ángulos, prioriza en este orden: business > strategic > practical > educational > technical.`,
};

const EN: Record<string, string> = {
  business: `ANGLE: Business impact (commercial and executive profiles)
- The reader is deciding for their company: buy, invest, prioritise. They are not after market context.
- Prioritise real cases with numbers. Use ONLY figures present in the source; if there are none, express impact qualitatively and never invent data.
- Translate technical trends into business decisions (budget, risk, timelines).
- Cover expensive mistakes: why analytics/AI projects fail and what that costs.
- Offer decision frameworks: how to tell whether you need a dashboard, an agent, or nothing.
- Give a consultant's opinion: what companies actually buy and what ends up shelved.
- Avoid technical jargon; if a term appears, explain it in one line with its economic implication.`,
  technical: `ANGLE: Technical depth (technical profiles)
- Explain how it works under the hood: architecture, data flow, key components.
- Give technical numbers present in the source: latency, compute cost, context size, accuracy, limits. Never invent figures.
- Lay out real trade-offs against the obvious alternative.
- Include implementation details that save hours: configuration, a concrete pattern, a typical gotcha.
- Give a grounded technical opinion: when this solution is not worth it.
- Use the correct term without watering it down; assume domain knowledge.`,
  strategic: `ANGLE: Market view and trend (leadership, decision-makers)
- The reader wants to understand the market, not make an immediate decision.
- Point out what is changing in the sector and why now: the concrete signal behind the news.
- Analyse the moves of relevant players and what they imply for everyone else.
- Lay out 12-24 month scenarios with practical consequences, and explicitly state which signal would invalidate the prediction.
- Say which bets age badly and which gain traction.
- Provide your own reading of the market, not a neutral summary of the source.`,
  practical: `ANGLE: Actionable (anyone who wants to apply it)
- Say what the reader can do today: concrete, ordered steps.
- State real prerequisites (tools, data, estimated time).
- Include one condensed applied example, 3 to 5 steps maximum, not generic.
- Mention common mistakes and how to avoid them.
- Close with a "done" criterion: how to know it worked.`,
  educational: `ANGLE: Explanatory (non-expert audience)
- Explain the concept from scratch with an everyday analogy.
- Make clear why it matters to someone outside the field.
- Debunk a common misconception about the topic.
- Use a minimal, recognisable example.
- Zero unexplained jargon.`,
  auto: `ANGLE: choose the most suitable one for the source among business (company decision), strategic (market reading), practical (actionable), educational (explanatory) and technical (technical depth).
When torn between two angles, prefer this order: business > strategic > practical > educational > technical.`,
};

const PT: Record<string, string> = {
  business: `ÂNGULO: Impacto de negócio (perfis comerciais e diretivos)
- O leitor decide sobre a sua empresa: comprar, investir, priorizar. Não procura contexto de mercado.
- Prioriza casos reais com números. Usa APENAS valores presentes na fonte; se não houver, formula o impacto de forma qualitativa e não inventes dados.
- Traduz tendências técnicas em decisões de negócio (orçamento, risco, prazos).
- Fala de erros caros: porque falham os projetos de analítica/IA e quanto custam.
- Oferece frameworks de decisão: como saber se precisas de um dashboard, de um agente, ou de nada.
- Opinião de consultor: o que as empresas compram e o que acaba na gaveta.
- Evita jargão técnico; se aparecer um termo, explica-o numa linha com a sua implicação económica.`,
  technical: `ÂNGULO: Profundidade técnica (perfis técnicos)
- Explica como funciona por dentro: arquitetura, fluxo de dados, componentes-chave.
- Dá números técnicos presentes na fonte: latências, custos de computação, contexto, precisão, limites. Não inventes valores.
- Apresenta trade-offs reais face à alternativa óbvia.
- Inclui detalhes de implementação que poupam horas: configuração, padrão concreto, gotcha típico.
- Opinião técnica fundamentada: quando esta solução não compensa.
- Usa o termo correto sem o diluir; assume que o leitor conhece o domínio.`,
  strategic: `ÂNGULO: Visão de mercado e tendência (direção, decisores)
- O leitor quer entender o mercado, não tomar uma decisão imediata.
- Aponta o que muda no setor e porquê agora: o sinal concreto por trás da notícia.
- Analisa os movimentos dos atores relevantes e o que implicam para os restantes.
- Propõe cenários a 12-24 meses com consequência prática e indica explicitamente que sinal invalidaria a previsão.
- Diz que apostas envelhecem mal e quais ganham tração.
- Traz uma leitura própria do mercado, não um resumo neutro da fonte.`,
  practical: `ÂNGULO: Acionável (qualquer perfil que queira aplicá-lo)
- Diz o que o leitor pode fazer hoje: passos concretos e ordenados.
- Indica requisitos prévios reais (ferramentas, dados, tempo estimado).
- Inclui um exemplo aplicado condensado, de 3 a 5 passos no máximo, não genérico.
- Menciona os erros frequentes e como evitá-los.
- Fecha com um critério de "feito": como saber se funcionou.`,
  educational: `ÂNGULO: Divulgativo (audiência não especialista)
- Explica o conceito de raiz com uma analogia do dia a dia.
- Deixa claro porque importa a quem não trabalha nisto.
- Desmonta um mal-entendido habitual sobre o tema.
- Usa um exemplo mínimo e reconhecível.
- Zero jargão por explicar.`,
  auto: `ÂNGULO: escolhe o mais adequado à fonte entre business (decisão de empresa), strategic (leitura de mercado), practical (acionável), educational (divulgativo) e technical (profundidade técnica).
Em caso de dúvida entre dois ângulos, prioriza esta ordem: business > strategic > practical > educational > technical.`,
};

const BY_LANG: Record<Lang, Record<string, string>> = { es: ES, en: EN, pt: PT };

export function focusAngleInstruction(angle?: string | null, language?: string | null): string | null {
  if (!angle) return null;
  const lang: Lang = language === "en" ? "en" : language === "pt" ? "pt" : "es";
  return BY_LANG[lang][angle] ?? null;
}
