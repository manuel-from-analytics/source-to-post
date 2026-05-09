# Agente diario nativo dentro de la app

Sí, totalmente. Con lo que ya hay montado (MCP tools atómicos, `generate_posts_from_newsletter`, `notify-review`, `agent_runs`) sólo falta el **orquestador**, y meterlo dentro de la propia infra es más simple, más barato y más fiable que un agente externo en Claude/n8n.

## Por qué hacerlo interno

- **Cero dependencias externas**: nada de n8n, GitHub Actions ni Claude Desktop encendido.
- **Sin problema de JWT**: el cron corre como service-role server-side, no necesita `x-agent-key` ni refresco de token.
- **Una sola fuente de verdad**: el código del agente vive junto al resto, se versiona, se testea.
- **Coste**: el cron de Supabase (`pg_cron` + `pg_net`) es gratis; sólo pagas el AI gateway que ya pagas.
- **UX**: puedes añadir UI de "última ejecución / re-ejecutar ahora" en `/mcp` o en un nuevo `/agent`.

El MCP que ya construimos **no se tira**: queda como vía B para cuando quieras un agente LLM externo que cure temas con criterio. La vía A (cron interno) cubre el 90% del caso de uso.

## Arquitectura propuesta

```text
pg_cron (07:00 daily)
   │
   ▼
edge function: daily-agent
   │  (service role, user_id objetivo)
   ├── 1. invoca generate-newsletter
   ├── 2. lee newsletter_items recién creados
   ├── 3. por cada item (en paralelo, Promise.all):
   │      - import_newsletter_item_as_input (lógica reutilizada)
   │      - generate-post (con defaults de profiles)
   │      - insert generated_posts (status=draft, source_newsletter_item_id)
   ├── 4. inserta agent_runs (posts_created, status)
   └── 5. invoca notify-review con post_ids
              │
              ▼
        Resend → tu email con deep links a /history?post=<id>
```

## Componentes a construir

### 1. Nueva edge function `daily-agent`
- Recibe `{ user_id, preference_profile_id?, voice_id?, tone?, length? }` (o los toma de `profiles`).
- Usa **service role key** internamente para saltarse RLS pero filtrando siempre por `user_id`.
- Reutiliza la lógica ya escrita en el MCP (`generate_posts_from_newsletter`) extrayéndola a un helper compartido `supabase/functions/_shared/agent.ts` para no duplicar.
- Idempotencia: el índice único en `(user_id, source_newsletter_item_id)` ya evita duplicados si se ejecuta dos veces.
- Loguea en `agent_runs` el resultado completo.

### 2. Tabla `agent_schedules` (nueva)
Permite que cada usuario configure su agente sin tocar SQL:

```text
agent_schedules
  user_id, enabled, cron_expression (default '0 7 * * *'),
  preference_profile_id, voice_id, tone, length, cta,
  notification_email, last_run_at
```

Con RLS para que cada usuario gestione el suyo.

### 3. pg_cron job
Un único job maestro cada hora que lee `agent_schedules` activos y dispara `daily-agent` por cada uno cuya hora cuadre. Más sencillo que crear un cron por usuario.

(Alternativa más simple para empezar: un único cron a las 7am que sirve para tu user_id hardcodeado. Lo evolucionamos cuando haya más usuarios.)

### 4. UI en `/mcp` (o nueva pestaña `/agent`)
- Toggle "Activar agente diario".
- Selectores: hora, voz por defecto, tono, longitud, perfil de newsletter.
- Email de notificación.
- Tabla con historial de `agent_runs` (fecha, posts creados, link al email enviado, estado).
- Botón "Ejecutar ahora" (invoca `daily-agent` manualmente para probar).

## Cambios concretos

1. **Refactor**: extraer helper `runDailyAgent(userId, opts)` desde `mcp-server/index.ts` a `supabase/functions/_shared/agent.ts`. El MCP tool `generate_posts_from_newsletter` y la nueva edge function lo llaman.
2. **Nueva edge function** `supabase/functions/daily-agent/index.ts` (verify_jwt = false, autenticada por service role + secret compartido para llamadas desde pg_net).
3. **Migración**: tabla `agent_schedules` con RLS. Habilitar `pg_cron` y `pg_net`. Crear job cron usando `supabase--insert` (no migration, contiene URLs/keys del proyecto).
4. **UI**: nuevo card "Agente diario" en `/mcp` con configuración + tabla `agent_runs`. Hook `useAgentSchedule`.
5. **Retirar (opcional)**: la sección "Daily Agent Recipe" con curl en `/mcp` queda como referencia avanzada para usuarios que quieran orquestar desde fuera.

## Comparativa rápida

| Aspecto | Agente interno (cron + edge) | Agente externo (Claude/n8n) |
|---|---|---|
| Setup usuario | 0 (toggle en UI) | Configurar n8n/Claude + agent key |
| Auth | Service role, sin caducidad | JWT 1h o agent key |
| Curado inteligente | Reglas fijas + prompt | LLM puede filtrar items |
| Coste extra | 0 | n8n cloud o Claude API |
| Mantenimiento | En el repo | Fuera del repo |

## Recomendación

Empezar por **agente interno** (cubre el caso "cada día genera N drafts y avísame"). El MCP queda disponible en paralelo para cuando quieras experimentar con un agente LLM que filtre temas con criterio antes de generar.

¿Procedo con esta arquitectura, o prefieres que el agente interno sea más simple (sin tabla `agent_schedules`, sólo cron fijo para tu usuario) en una primera iteración?
