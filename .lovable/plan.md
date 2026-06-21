## Contexto y por qué CSV

El conector de LinkedIn de Lovable solo tiene los scopes `openid, profile, email, w_member_social` y `available_scopes = none`, es decir, no permite pedir más. Eso solo da para publicar y leer tu identidad — **ningún endpoint de analytics ni de listar posts publicados**. La única vía fiable hoy es el export CSV que LinkedIn ofrece desde la propia plataforma. La parte de auto-publish (otro requerimiento) sí podrá usar el conector más adelante.

Vinculo las dos conexiones de LinkedIn al proyecto ahora para tener las credenciales listas, aunque el módulo de Rendimiento no las use.

## Alcance

Nuevo apartado **Rendimiento** (página `/performance`) con:

- Subida de CSV de LinkedIn (uno o varios), distinguiendo origen: **Personal** o **Empresa** (lo eliges al subir).
- Cruce automático con `generated_posts` por URL del post o, si no hay URL, por similitud de contenido (primeros ~200 chars normalizados).
- Vista **Top posts** (ordenable por cualquier métrica, filtrable por origen y por etiqueta `personal/empresa`).
- Vista **Evolución temporal** (gráfico de líneas: impresiones, engagement rate, etc. agrupado por semana/mes).
- Métricas: impresiones, clics, reacciones, comentarios, compartidos, **engagement rate** (`(reacciones + comentarios + compartidos + clics) / impresiones`).
- Botón "Refrescar datos" = volver a subir CSV (la última subida por origen pisa la anterior para esos posts).

## Modelo de datos

Una nueva tabla `linkedin_post_metrics`:

```text
linkedin_post_metrics
- id (uuid, pk)
- user_id (uuid, fk auth.users)
- post_id (uuid, fk generated_posts, nullable)   -- null si no se logró cruzar
- source ('personal' | 'company')
- linkedin_url (text, nullable)
- linkedin_urn (text, nullable)
- post_title (text, nullable)
- posted_at (timestamptz, nullable)
- impressions (int)
- clicks (int)
- reactions (int)
- comments (int)
- shares (int)
- engagement_rate (numeric)                       -- calculada en cliente al insertar
- raw (jsonb)                                     -- fila CSV original para auditoría
- imported_at (timestamptz default now())
- unique (user_id, source, linkedin_urn) where linkedin_urn is not null
```

RLS: solo el dueño. GRANTs estándar para `authenticated` y `service_role`.

## Flujo de subida

Componente cliente en `src/pages/PerformancePage.tsx`:

1. Selector "Origen": Personal / Empresa.
2. Drag & drop del CSV exportado por LinkedIn (formato distinto entre perfil y página, lo detectamos por columnas).
3. Parsing en cliente con `papaparse` (ya común en el ecosistema; si no está instalado lo añadimos).
4. Normalización a un esquema único, cálculo de engagement rate.
5. Cruce con `generated_posts`:
   - 1ª pasada: match exacto de `linkedin_url` si la guardas en el post (campo nuevo opcional `linkedin_url` en `generated_posts`, ver más abajo).
   - 2ª pasada: similitud de contenido (lowercased + sin emojis + primeros 200 chars) contra `generated_posts.content`.
6. `upsert` en `linkedin_post_metrics` con conflict en `(user_id, source, linkedin_urn)`.
7. Toast con "X filas importadas, Y cruzadas con posts generados, Z sin cruzar".

Filas sin cruzar siguen visibles en Rendimiento (no obligamos a que el post venga de la app).

## Cambio menor en `generated_posts`

Añadir columna opcional `linkedin_url text` para que, cuando publiques (manual o por API) puedas pegarla y mejorar el match. No es bloqueante para esta entrega.

## UI

- Sidebar: nuevo enlace "Rendimiento" (icono BarChart3).
- Página `/performance` con tabs: **Resumen**, **Top posts**, **Evolución**, **Importar CSV**.
- Filtros globales: rango de fechas, origen (Personal / Empresa / Ambas), etiqueta (`personal`, `empresa`, otras existentes), solo posts generados por la app.
- Resumen: 4 KPIs (impresiones totales, engagement rate medio, posts publicados, top post).
- Top posts: tabla con título, fecha, origen, etiqueta, métricas, link a LinkedIn, link al post original en la app si está cruzado.
- Evolución: line chart con `recharts` (ya instalado, ver `src/components/ui/chart.tsx`).

## Internacionalización

Strings nuevos en `src/i18n/translations.ts` (es/en/pt) para el módulo Rendimiento.

## Detalles técnicos

- Migración SQL para `linkedin_post_metrics` + columna `linkedin_url` en `generated_posts` (con GRANTs y RLS).
- Hook `useLinkedinMetrics()` con TanStack Query.
- Hook `useImportLinkedinCsv()` que parsea y hace upsert.
- Parser CSV tolerante: detecta cabeceras tanto del export de perfil personal como del de Company Page (los nombres de columnas difieren).
- No tocamos `mcp-server` en esta iteración; si quieres, en una pasada posterior añadimos una tool MCP `get_post_performance`.

## Pasos de implementación

1. Vincular las dos conexiones de LinkedIn al proyecto (`standard_connectors--connect linkedin`, dos veces).
2. Migración: crear `linkedin_post_metrics`, añadir `linkedin_url` a `generated_posts`, RLS + GRANTs.
3. Añadir `papaparse` si no está.
4. Parser CSV (`src/lib/linkedin-csv.ts`) con detección de formato personal vs company.
5. Hook `useLinkedinMetrics`, `useImportLinkedinCsv`.
6. Página `PerformancePage` + ruta + entrada de sidebar.
7. Componentes: `PerformanceSummary`, `TopPostsTable`, `PerformanceTimeline`, `ImportCsvDialog`.
8. Traducciones es/en/pt.
9. Verificar build y abrir la página, importar un CSV de prueba.

## Fuera de alcance

- Lectura en vivo de analytics vía API de LinkedIn (no posible con el conector actual).
- Auto-publish (otro requerimiento).
- MCP tool de rendimiento (siguiente iteración si interesa).
