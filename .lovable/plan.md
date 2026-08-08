# Enfoque parametrizable de los posts

Añadir un parámetro nuevo de "ángulo" (técnico vs comercial, etc.) que se elige de una lista, se combina con el campo de Enfoque libre actual, y se aplica en el agente diario, el generador manual y las tools MCP.

## Por qué así

Hoy solo existe `content_focus`: un texto libre (o "auto") que se inyecta tal cual en el prompt. Funciona, pero obliga a reescribir instrucciones a mano y el ángulo elegido no queda guardado como dato, así que no se puede filtrar ni analizar después.

La propuesta separa dos conceptos:

- **Ángulo (nuevo, lista cerrada):** el "para quién y con qué profundidad" — cada opción tiene detrás un bloque de instrucciones ya redactado.
- **Enfoque (existente, texto libre):** matices puntuales del día ("céntrate en el impacto en pymes").

Ambos se envían al modelo: primero el bloque del ángulo, después el texto libre como refinamiento.

## Ángulos propuestos

Cada ángulo no es una etiqueta: lleva detrás un bloque de instrucciones con los tipos de contenido que el modelo debe priorizar y el punto de vista desde el que escribir.

**`business` — Impacto de negocio (perfiles comerciales y directivos)**
- Discriminante: el lector **decide sobre su empresa** (comprar, invertir, priorizar), no busca contexto de mercado
- Casos reales con números: "X empresa redujo un 30% el tiempo de reporting con…". Usa **solo cifras presentes en la fuente**; si no hay, formula el impacto de forma cualitativa sin inventar datos
- Traducir tendencias técnicas a decisiones de negocio: "Qué significa [tendencia] para tu presupuesto de datos en 2027"
- Errores caros: por qué fallan los proyectos de analítica/IA y cuánto cuesta
- Frameworks de decisión: cómo saber si necesitas un dashboard, un agente, o nada
- Opinión con criterio, desde la experiencia de consultor: qué compran las empresas y qué acaba en un cajón
- Evitar jerga técnica; si aparece un término, explicarlo en una línea con su implicación económica

**`technical` — Profundidad técnica (perfiles técnicos)**
- Cómo funciona por dentro: arquitectura, flujo de datos, componentes clave
- Números técnicos: latencias, costes de cómputo, tamaños de contexto, precisión, límites
- Trade-offs reales: qué se gana y qué se pierde frente a la alternativa obvia
- Detalles de implementación que ahorran horas: configuración, patrón concreto, gotcha típico
- Opinión técnica fundamentada: cuándo esta solución no merece la pena
- Usar el término correcto sin diluirlo; asumir que el lector conoce el dominio

**`strategic` — Visión de mercado y tendencia (dirección, decisores)**
- Discriminante: el lector **quiere entender el mercado**, no tomar una decisión inmediata
- Qué cambia en el sector y por qué ahora: señal concreta detrás de la noticia
- Movimientos de los actores relevantes y qué implican para el resto
- Escenarios a 12-24 meses con su consecuencia práctica, señalando **explícitamente qué señal invalidaría la predicción**
- Qué apuestas envejecen mal y cuáles ganan tracción
- Lectura propia del mercado, no resumen neutro de la fuente

**`practical` — Accionable (cualquier perfil que quiera aplicarlo)**
- Qué puede hacer el lector hoy con esto: pasos concretos y ordenados
- Requisitos previos reales (herramientas, datos, tiempo estimado)
- Un ejemplo aplicado condensado (3-5 pasos máximo), no genérico
- Errores frecuentes al intentarlo y cómo evitarlos
- Criterio de "hecho": cómo saber si ha funcionado

**`educational` — Divulgativo (audiencia no experta)**
- Explicar el concepto desde cero con una analogía cotidiana
- Por qué importa a alguien que no trabaja en esto
- Desmontar un malentendido habitual sobre el tema
- Un ejemplo mínimo y reconocible
- Cero jerga sin explicar

**`auto`** — el modelo elige el ángulo más adecuado según la fuente y devuelve cuál eligió. En caso de duda entre dos ángulos, orden de preferencia: **business > strategic > practical > educational > technical**.

**(vacío)** — sin instrucción de ángulo.

Las instrucciones de formato comunes (frases cortas, saltos de línea, sin markdown, emojis con moderación) se mantienen en el bloque de estilo base del system prompt, compartido por todos los ángulos.


Los bloques se redactan en español/inglés/portugués según el idioma de generación del post.


## Alcance

1. **Agente diario:** nuevo selector "Ángulo del post" en la tarjeta de configuración del agente, junto a Objetivo/Tono. Se guarda en la programación y se usa en cada run. Un único ángulo fijo por run.
2. **Generador manual:** mismo selector en la página de generación, con el mismo listado.
3. **MCP:** parámetro opcional `focus_angle` en las tools de generación, con los mismos valores.
4. **Historial:** el ángulo usado se guarda junto al post (igual que tono/objetivo) para poder verlo después y para que "duplicar post" lo conserve.

## Detalles técnicos

**Base de datos (migración):**
- `agent_schedules.focus_angle text` (nullable).
- `generated_posts.focus_angle text` (nullable).
- Sin cambios de RLS: ambas tablas ya tienen políticas por usuario.

**Mapa de ángulos compartido:** un único diccionario `focus_angle -> instrucción` por idioma, duplicado en los tres puntos donde se construye el prompt hoy:
- `supabase/functions/daily-agent/index.ts` (`generateContent`)
- `supabase/functions/generate-post/index.ts`
- `src/lib/mcp/generate-content.ts`

En cada uno se inserta el bloque del ángulo justo antes del bloque `ENFOQUE` existente. Con `auto`, el ángulo se añade a la lista de campos que el modelo decide y se devuelve en `decisions.focus_angle`, igual que ya se hace con `goal`, `tone`, etc., para persistirlo en el post.

**Frontend:**
- `src/components/AgentSettingsCard.tsx`: nuevo `Select` de ángulo + hint que explica que se combina con el texto de Enfoque.
- `src/pages/GeneratorPage.tsx`: mismo `Select`, enviado en `generate` y `save`.
- `src/hooks/useGeneratePost.tsx` y `src/hooks/usePosts.tsx`: propagar `focus_angle`.
- Etiquetas nuevas en `src/i18n/translations.ts` para ES/EN/PT (nombre del campo, los cinco ángulos, hint).

**MCP:** `focus_angle: z.string().optional()` en `generate-post.ts`, `generate-posts-from-newsletter.ts`, `save-post.ts` y `update-post.ts`; regenerar el manifiesto y desplegar la función `mcp`.

**Despliegue:** redeploy de `daily-agent`, `generate-post` y `mcp`.

## Fuera de alcance

- Rotación de varios ángulos por run (elegido: uno fijo).
- Perfiles de generación reutilizables (se puede añadir más adelante sobre esta base).
