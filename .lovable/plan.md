## Objetivo

Publicar posts generados directamente en LinkedIn desde la app, usando el conector ya vinculado. Solo perfil personal (tu cuenta) en esta iteración. Empresa visible pero deshabilitada con tooltip "Próximamente — requiere aprobación de LinkedIn".

## Alcance

1. **Publicar ahora** (texto plano).
2. **Programar publicación** (fecha/hora futura).
3. **Guardar `linkedin_url`** en `generated_posts` tras publicar, para que el match con `linkedin_post_metrics` sea exacto.

Fuera de alcance: imágenes/vídeo, edición tras publicar, publicación en Company Page, OAuth per-user.

## Backend

### Edge function `publish-linkedin`
- Valida JWT del usuario (mismo patrón que `generate-post`).
- Body: `{ post_id: string }`.
- Lee `generated_posts.content` y valida pertenencia al usuario.
- Llama gateway: `POST https://connector-gateway.lovable.dev/linkedin/v2/userinfo` para obtener `sub` (URN del miembro), luego `POST .../v2/ugcPosts` con:
  ```json
  {
    "author": "urn:li:person:{sub}",
    "lifecycleState": "PUBLISHED",
    "specificContent": {
      "com.linkedin.ugc.ShareContent": {
        "shareCommentary": { "text": "<content>" },
        "shareMediaCategory": "NONE"
      }
    },
    "visibility": { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" }
  }
  ```
- Headers: `Authorization: Bearer $LOVABLE_API_KEY`, `X-Connection-Api-Key: $LINKEDIN_API_KEY`, `X-Restli-Protocol-Version: 2.0.0`.
- Toma el URN del response (`id` o `x-restli-id` header) → construye `https://www.linkedin.com/feed/update/{urn}/` y guarda en `generated_posts.linkedin_url` + nueva columna `linkedin_published_at timestamptz`.

### Programación: tabla `scheduled_publications`
```text
- id uuid pk
- user_id uuid fk auth.users
- post_id uuid fk generated_posts
- target ('personal' | 'company')   -- por ahora solo 'personal'
- scheduled_at timestamptz
- status ('pending' | 'publishing' | 'done' | 'failed')
- attempts int default 0
- error text nullable
- linkedin_url text nullable
- created_at, updated_at
```
RLS: solo dueño. GRANTs `authenticated` + `service_role`. Trigger `update_updated_at_column`.

### Cron `publish-linkedin-cron`
- Edge function que cada minuto (`pg_cron` → `SELECT net.http_post(...)`) busca filas `status='pending' AND scheduled_at <= now()`, marca `publishing`, llama internamente la lógica de `publish-linkedin`, actualiza a `done`/`failed`.
- Reintentos: máximo 3, backoff exponencial dentro del propio cron.

## Frontend

### Componente `PublishToLinkedinDialog`
Disparado desde `HistoryPage` (botón nuevo en cada post) y `GeneratorPage` (tras generar).

Contenido:
- **Destino**: radio "Perfil personal" (activo) / "Página de empresa" (deshabilitado con tooltip i18n).
- **Cuándo**: "Publicar ahora" / "Programar".
- Si programar: `<input type="datetime-local">` con validación min = ahora + 5 min.
- Vista previa del contenido (read-only, primer párrafo + "ver más").
- Botón "Publicar" / "Programar".

Tras publicar OK:
- Toast con link a LinkedIn.
- `linkedin_url` se rellena → `linkedin_post_metrics` matchea automáticamente en próximos imports.

### Hook `usePublishLinkedin`
- `publishNow(postId)` → invoca edge function `publish-linkedin`.
- `schedule(postId, datetime)` → insert en `scheduled_publications`.
- `useScheduledPublications()` query para listar programadas en una nueva sección "Programadas" dentro de Rendimiento (o un drawer en History).

### i18n
Strings nuevos en `src/i18n/translations.ts` (es/en/pt): título dialog, labels, tooltip empresa, errores.

## Migración SQL

```sql
ALTER TABLE public.generated_posts
  ADD COLUMN IF NOT EXISTS linkedin_published_at timestamptz;

CREATE TABLE public.scheduled_publications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.generated_posts(id) on delete cascade,
  target text not null check (target in ('personal','company')),
  scheduled_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','publishing','done','failed')),
  attempts int not null default 0,
  error text,
  linkedin_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_publications TO authenticated;
GRANT ALL ON public.scheduled_publications TO service_role;
ALTER TABLE public.scheduled_publications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own rows" ON public.scheduled_publications
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.scheduled_publications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- cron cada minuto
SELECT cron.schedule(
  'publish-linkedin-cron',
  '* * * * *',
  $$ SELECT net.http_post(
       url := 'https://ofpnsqvcagowvaavzzxh.supabase.co/functions/v1/publish-linkedin-cron',
       headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || current_setting('app.cron_secret', true))
     ) $$
);
```

## Pasos de implementación

1. Migración (tabla + columna + cron).
2. Edge function `publish-linkedin`.
3. Edge function `publish-linkedin-cron`.
4. Hook `usePublishLinkedin` + query de programadas.
5. Componente `PublishToLinkedinDialog`.
6. Botones de disparo en `HistoryPage` y `GeneratorPage`.
7. Sección "Programadas" en `PerformancePage` (lista + cancelar pendiente).
8. Traducciones es/en/pt.
9. Verificar publicando un post real.

## Limitaciones a comunicar en UI

- Solo perfil personal por ahora.
- Las publicaciones salen de **tu** cuenta de LinkedIn (la del conector), no de la de cada usuario.
- LinkedIn no permite editar un post una vez publicado; sí borrarlo.
- Métricas no llegan vía API; siguen importándose por CSV pero el match será exacto gracias a la URL guardada.
