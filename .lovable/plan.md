
## Enfoque recomendado

Tu agente externo (Claude/Cursor/n8n/cron) debería poder hacer todo el flujo vía MCP, sin tocar la UI. Hoy el MCP solo **lee** newsletters ya creadas; hay que añadir **acciones** para generarla, materializar sus fuentes como `inputs`, y notificar al final. La generación de posts ya existe (`generate_post` + `save_post`), sólo falta encadenarla.

Flujo objetivo del agente (1 ejecución/día):

```text
1. list_voices / get_defaults     → elegir voz y presets
2. generate_newsletter            → nueva (NUEVO tool)
3. list_newsletter_items          → fuentes encontradas (NUEVO)
4. import_newsletter_item → input → por cada item (NUEVO)
5. generate_post + save_post(status=draft)  → 1 post por input
6. notify_review                  → email/Slack/Telegram (NUEVO)
```

## Cambios al MCP (`supabase/functions/mcp-server/index.ts`)

### Nuevas tools

1. **`generate_newsletter`** — invoca la edge function `generate-newsletter` con el JWT del usuario. Params: `topic?`, `language?`, `freshness_months?`, `preference_profile_id?`. Devuelve `{ newsletter_id, items: [...] }`. Evita que el agente tenga que reimplementar Firecrawl.

2. **`list_newsletter_items`** — `{ newsletter_id }` → lista de items con `id, title, url, description, source_type, imported_to_library, input_id`. Permite al agente saber qué falta importar.

3. **`import_newsletter_item_as_input`** — `{ item_id, extract_content?: boolean }`. Crea un `input` (type=`url` o `youtube` según source), opcionalmente llama a `extract-url` para traer el contenido completo, marca `newsletter_items.imported_to_library=true` y guarda `input_id`. Devuelve el `input` creado.

4. **`generate_posts_from_newsletter`** (atajo opcional, recomendado) — `{ newsletter_id, voice_id?, goal?, tone?, language?, length?, cta?, target_audience?, content_focus? }`. En el server hace el bucle: importa cada item → genera post → guarda como `draft`. Devuelve `[{ item_id, input_id, post_id }]`. Esto reduce a **2 llamadas MCP** todo el día (`generate_newsletter` + este). Mucho más fiable que dejar al agente orquestar 5×N llamadas.

5. **`get_user_defaults`** — devuelve `profiles` (default_voice_id, default_cta, default_length, preferred_language, app_language, default_writing_style) para que el agente no tenga que pedirlo cada vez.

6. **`notify_review`** — `{ channel: "email"|"slack"|"telegram", subject?, summary, post_ids[] }`. Llama a una nueva edge function que manda el aviso con enlaces deep-link a `/history?post=<id>` para revisión manual. Empezaría por **email vía Resend** (o el connector que prefieras) por ser el menos fricción.

### Mejoras a tools existentes

- **`list_posts`**: añadir filtros `created_after`, `created_before` y `source_newsletter_id` (requiere columna nueva, ver abajo) para que el agente confirme idempotencia ("¿ya generé hoy?").
- **`generate_post`**: añadir flag `save: boolean` y `status` para fusionar generate+save en una sola llamada (menos round-trips).
- Devolver en todas las tools JSON estructurado además del texto, con un `meta` que incluya `count` y `next_cursor` para paginación futura.

## Cambios de base de datos

- `generated_posts.source_newsletter_id uuid NULL` — trazabilidad y para la deduplicación diaria.
- `generated_posts.source_newsletter_item_id uuid NULL` — clave para idempotencia: índice único parcial `(user_id, source_newsletter_item_id)` evita posts duplicados si el agente reintenta.
- (Opcional) `agent_runs` — log de ejecuciones del agente (`started_at`, `newsletter_id`, `posts_created`, `notified_at`, `status`, `error`) para que tengas un dashboard y el agente pueda saltarse días ya procesados.

## Notificación: opciones

| Canal | Pros | Setup |
|-------|------|-------|
| **Email (Resend)** ← recomendado | sencillo, ya tienes connector pattern, llega seguro | conectar Resend connector |
| Telegram bot | push instantáneo en móvil, perfecto para revisar y copiar | conectar Telegram connector |
| Slack DM | si ya lo usas a diario | conectar Slack connector |

La tool `notify_review` debería ser polimorfa pero internamente delegar a la edge function correspondiente según `channel`.

## Cómo orquestar el agente (lado externo)

Dos opciones, en orden de simplicidad:

1. **Cron + cliente MCP** (n8n, GitHub Actions, o un script Deno con cron): cada día a las 7am llama `generate_posts_from_newsletter` con tus defaults y luego `notify_review`. ~30 líneas.
2. **Agente LLM con MCP** (Claude Desktop con un workflow guardado, o un agente custom): útil si quieres que el LLM elija el `topic` del día o filtre items por relevancia antes de generar. Más flexible pero más coste/latencia.

Recomendación: empieza por la **opción 1** con `generate_posts_from_newsletter` (un solo tool call hace todo). Si luego quieres curado inteligente, mueves a opción 2 usando las tools atómicas (`list_newsletter_items` + `import_newsletter_item_as_input` + `generate_post` + `save_post`).

## Consideraciones técnicas

- El `x-user-token` actual del MCP es un JWT que expira en ~1h. Para un agente diario hay que decidir: (a) usar **service role + user_id fijo** en una tool dedicada `agent_run` autenticada por API key larga, o (b) hacer login con email/password en cada run para refrescar token. Recomiendo (a) con una tabla `agent_api_keys` (hash + user_id) y un header alternativo `x-agent-key` en el MCP — más seguro y sin caducidad.
- `generate_posts_from_newsletter` puede tardar 30–60s si genera 5 posts. La edge function aguanta (max 150s), pero conviene paralelizar las llamadas al AI gateway con `Promise.all`.
- Idempotencia: el índice único en `source_newsletter_item_id` + un `ON CONFLICT DO NOTHING` evita duplicados si el cron se dispara dos veces.

## Entregables (orden de implementación)

1. Migración: columnas + índice único + tabla `agent_runs` opcional.
2. MCP: `get_user_defaults`, `generate_newsletter`, `list_newsletter_items`, `import_newsletter_item_as_input`, `generate_posts_from_newsletter`.
3. Auth de agente: tabla `agent_api_keys` + header `x-agent-key` en MCP.
4. Edge function `notify-review` (Resend) + tool `notify_review`.
5. Documentación en `/mcp` page con ejemplo de script cron.
