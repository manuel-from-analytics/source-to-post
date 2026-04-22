

## Plan: Fechas de publicación por label

### Objetivo
Permitir registrar fechas de publicación independientes por cada label asignada a un post (ej: publicado en "Personal" el 12 abr y en "Empresa" el 18 abr), manteniendo el `status` global actual.

### Comportamiento

1. **Status global** (draft/final/published) sigue funcionando como ahora. Un post se marca como `published` en cuanto se publica en al menos una label.
2. **Dialog de detalle**: nueva sección **"Publicación por canal"** que lista cada label asignada al post con un botón:
   - Si no publicado en esa label → botón **"Marcar publicado hoy"** (un click, fija fecha = hoy).
   - Si ya publicado → muestra fecha (`12 abr 2026`) + botón pequeño para **despublicar** (borra la fecha).
   - Solo aparece esta sección si el post tiene labels asignadas.
3. **Tarjeta del listado**: debajo del badge global "Publicado", se listan las fechas por label como mini-badges con el color de cada label:
   ```
   [● Personal: 12 abr] [● Empresa: 18 abr]
   ```
   Solo lectura (no editables desde la tarjeta).
4. **Sincronización con status global**:
   - Al marcar la PRIMERA fecha de publicación por label → status global pasa a `published` (si no lo estaba ya).
   - Al despublicar la ÚLTIMA fecha → status global vuelve a `final`.
   - El campo `published_at` global se sincroniza con la fecha más antigua de las publicaciones por label.

### Cambios técnicos

**Base de datos** (migración):
- Nueva tabla `post_label_publications`:
  ```
  post_id uuid NOT NULL
  label_id uuid NOT NULL
  published_at timestamptz NOT NULL DEFAULT now()
  PRIMARY KEY (post_id, label_id)
  ```
- RLS: `EXISTS(generated_posts WHERE id = post_id AND user_id = auth.uid())` (mismo patrón que `post_label_assignments`).

**Hooks** (`src/hooks/usePostLabels.tsx`):
- `usePostLabelPublications(postId)` — fechas por label de un post.
- `useAllPostLabelPublications()` — bulk para el listado, devuelve `Record<post_id, Array<{label_id, published_at}>>`.
- `usePublishToLabel()` — inserta `(post_id, label_id, now())`. Si era la primera publicación, también actualiza `generated_posts.status = 'published'` y `published_at`.
- `useUnpublishFromLabel()` — borra el registro. Si era la última, vuelve `status = 'final'` y `published_at = null`.

**UI**:
- `src/pages/HistoryPage.tsx`:
  - Tarjeta: mostrar mini-badges de fechas por label (color heredado de la label) bajo el badge de status.
  - Dialog: nueva sección "Publicación por canal" con lista de labels asignadas y botón publicar/despublicar.
- `src/components/PostLabelWidgets.tsx`: nuevo componente `LabelPublishedDate` para los mini-badges con color.
- `src/i18n/translations.ts`: nuevas claves (`history.publishByChannel`, `history.markPublishedToday`, `history.unpublish`, `history.publishedOnLabel`).

### Casos borde
- Si despublicas en una label el post pierde esa fecha; si era la única, status vuelve a `final`.
- Si quitas una label de un post (desasignar), también se borran sus publicaciones por cascade lógico (manejado en `useTogglePostLabel` o vía `ON DELETE` cuando borre la asignación).
- Posts sin labels: la sección "Publicación por canal" no se muestra; el flujo actual de status global sigue intacto.

### Memoria
Actualizar `mem://features/post-history` reflejando que la publicación puede registrarse por label de forma independiente.

### Archivos a tocar
1. Nueva migración SQL (tabla `post_label_publications` + RLS).
2. `src/hooks/usePostLabels.tsx` — nuevos hooks de publicación por label.
3. `src/pages/HistoryPage.tsx` — sección dialog + mini-badges en tarjeta.
4. `src/components/PostLabelWidgets.tsx` — componente `LabelPublishedDate`.
5. `src/i18n/translations.ts` — claves nuevas (es/en/pt).

