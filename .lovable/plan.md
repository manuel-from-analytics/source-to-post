# Enfoque parametrizable de los posts

Añadir un parámetro nuevo de "ángulo" (técnico vs comercial, etc.) que se elige de una lista, se combina con el campo de Enfoque libre actual, y se aplica en el agente diario, el generador manual y las tools MCP.

## Por qué así

Hoy solo existe `content_focus`: un texto libre (o "auto") que se inyecta tal cual en el prompt. Funciona, pero obliga a reescribir instrucciones a mano y el ángulo elegido no queda guardado como dato, así que no se puede filtrar ni analizar después.

La propuesta separa dos conceptos:

- **Ángulo (nuevo, lista cerrada):** el "para quién y con qué profundidad" — cada opción tiene detrás un bloque de instrucciones ya redactado.
- **Enfoque (existente, texto libre):** matices puntuales del día ("céntrate en el impacto en pymes").

Ambos se envían al modelo: primero el bloque del ángulo, después el texto libre como refinamiento.

## Ángulos propuestos

| Valor | Orientación del post |
| --- | --- |
| `technical` | Profundidad técnica: detalles de implementación, arquitectura, métricas, limitaciones. Público: perfiles técnicos. |
| `business` | Impacto de negocio: casos de uso, ROI, ahorro de tiempo/coste, riesgos. Público: perfiles comerciales y directivos. |
| `strategic` | Visión de mercado y tendencia: qué cambia en el sector y por qué importa. |
| `practical` | Accionable: qué puede aplicar el lector hoy, pasos concretos. |
| `educational` | Divulgativo: explicar el concepto desde cero, sin jerga. |
| `auto` | El modelo elige el ángulo según la fuente (comportamiento actual). |
| (vacío) | Sin instrucción de ángulo. |

Los textos de cada ángulo se escriben en español/inglés/portugués según el idioma de generación del post.

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
