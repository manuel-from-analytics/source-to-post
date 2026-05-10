## Objetivo

Evitar contenidos duplicados en las newsletters generadas, controlándolo en `supabase/functions/generate-newsletter/index.ts` (capa servidor, sin migraciones).

## Cambios

### 1. Normalización de URLs
Añadir helper `normalizeUrl(url)`:
- host en minúsculas, sin `www.`
- quitar fragmento `#...`
- quitar query params de tracking: `utm_*`, `gclid`, `fbclid`, `mc_cid`, `mc_eid`, `ref`, `ref_src`, `igshid`
- normalizar barra final (quitar trailing `/` excepto si es la raíz)
- si la URL no parsea, devolver el string original recortado

### 2. Lookback por tiempo en lugar de por cantidad
Reemplazar el `limit(500)` actual por:
- traer items de los últimos **90 días** del usuario (`created_at >= now() - 90d`), join implícito por RLS sobre `newsletters`
- guardar dos sets: `recentUrlsNorm` (todos) y `recentTitles` (últimos 30 días, para dedup por tema)

### 3. Inyectar también títulos recientes en el prompt
Además de las URLs ya usadas, pasar a la IA la lista de títulos recientes (últimos 30 días) con instrucción de no repetir el mismo tema/noticia aunque venga de otro medio.

### 4. Dedup duro post-IA (red de seguridad real)
Tras parsear `newsletter.items` y antes de guardar, filtrar:
- **Por URL**: descartar si `normalizeUrl(item.url)` está en `recentUrlsNorm` o ya apareció antes en el propio batch.
- **Por título / tema**: tokenizar título (lowercase, sin puntuación, sin stopwords ES/EN básicas, palabras ≥3 chars). Comparar Jaccard con cada título de `recentTitles` y con los títulos ya aceptados del batch. Descartar si solapamiento ≥ **0.7**.

### 5. Manejo cuando quedan pocos items
Tras los filtros:
- Si quedan **<3 items**, devolver `400` con mensaje claro: "No se encontró suficiente contenido nuevo. Prueba a ampliar el topic o la ventana de frescura." (no se guarda newsletter parcial).
- Si quedan **3–4**, guardar igual y loggear `console.warn` con cuántos se descartaron por dedup.
- Loggear siempre cuántos items entraron, cuántos se descartaron por URL y cuántos por título.

## Detalles técnicos

- Stopwords mínimas hardcoded ES+EN (`el la los las de del y o un una the a an of and or to in for on with`).
- Jaccard: `|A ∩ B| / |A ∪ B|` sobre sets de tokens.
- El filtro se aplica **después** del filtro de frescura existente (líneas 297–316), reusando la misma estructura `before/after + log`.
- No se modifica el esquema de BD, no se crean migraciones, no se toca `daily-agent`.

## Archivos afectados

- `supabase/functions/generate-newsletter/index.ts` (único archivo editado)

## Validación

- Después de desplegar, lanzar el agente manualmente y revisar logs de la función para confirmar mensajes tipo `Dedup dropped X by URL, Y by title`.
- Comprobar en `newsletter_items` que no aparecen URLs equivalentes ya presentes en newsletters previas del mismo usuario.
