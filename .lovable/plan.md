

## Plan: Preferencias editables y system prompt neutro

### Objetivo
1. Simplificar el system prompt para que sea neutro ("curador experto estilo Kloshletter").
2. Mover TODAS las reglas hardcodeadas (tipos de fuente, frescura, FT/HBR/McKinsey, mínimo académico, dominios, etc.) a una **caja de preferencias editable** en la página de Newsletter.
3. El usuario decide vía toggle si esas preferencias se inyectan o no al generar.

### UX en `NewsletterPage.tsx`
Nueva tarjeta colapsable arriba del generador:

```text
┌─ Preferencias de newsletter ────────── [▼] ┐
│  [✓] Aplicar preferencias al generar       │
│  ┌────────────────────────────────────┐    │
│  │ Eres curador para un consultor de  │    │
│  │ Analytics & GenAI. Prioriza FT,    │    │
│  │ HBR, McKinsey. Mín 1 fuente        │    │
│  │ académica. Frescura <6 meses...    │    │
│  └────────────────────────────────────┘    │
│  [Guardar preferencias]                    │
└────────────────────────────────────────────┘
```

- Colapsada por defecto.
- Toggle "Aplicar preferencias" persiste si se envían o no.
- Textarea libre, multilinea, sin estructura forzada — el usuario escribe lo que quiera.
- Botón "Guardar" persiste en BD.
- Valor por defecto al crear el campo: el texto actual hardcodeado (perfil Analytics/GenAI + reglas), para no romper la experiencia del usuario actual.

### Cambios en BD
Migración: añadir 2 columnas a `profiles`:
- `newsletter_preferences` (text, nullable) — el texto editable.
- `newsletter_preferences_enabled` (boolean, default true) — el toggle.

Inicializar `newsletter_preferences` con el bloque actual de reglas para usuarios existentes (vía DEFAULT en migración).

### Cambios en edge function `generate-newsletter`
1. **System prompt nuevo** (neutro):
   > "Eres un curador experto de newsletters estilo Kloshletter: legibles, escaneables, accionables. Tu trabajo es entregar la mejor newsletter posible sobre el tema solicitado. Output MUST be valid JSON only."

2. **Leer preferencias del perfil** y, si `newsletter_preferences_enabled` es true y el texto no está vacío, inyectarlas en el user prompt como bloque **"USER PREFERENCES"**.

3. **Limpiar queries de Firecrawl**: quitar sufijos `"latest trends insights"` y la query académica forzada. Hacer una sola búsqueda con `topic` tal cual + años recientes (esto último también pasa a ser opcional según preferencias, pero por simplicidad lo dejamos como query plana del topic).

4. **Quitar validaciones hardcodeadas**: eliminar el filtro de fechas <6 meses y el conteo de académicas en código. Esas reglas ahora viven en las preferencias del usuario y el modelo las aplica si están activas.

5. **Mantener**: estructura JSON de salida (subject/items/closing), tool calling, idioma del usuario, deduplicación de URLs ya usadas.

### Cambios en frontend
- `useNewsletters.tsx`: nuevo hook `useNewsletterPreferences()` (get/update sobre `profiles`).
- `NewsletterPage.tsx`: nueva sección colapsable con textarea + toggle + botón guardar.
- `translations.ts`: añadir claves ES/EN/PT (`newsletter.preferences`, `newsletter.preferencesApply`, `newsletter.preferencesPlaceholder`, `newsletter.preferencesSaved`, etc.).

### Detalles técnicos clave
- La migración usa `DEFAULT` con el texto largo de reglas actual (en español) para que ningún usuario existente note diferencia.
- El textarea soporta texto largo, con `min-h-[200px]` y scroll.
- El system prompt neutro se queda en código (no editable) para mantener formato JSON estable.
- Mantener `formatNewsletter()` y los emojis 📰🏢📚🎓 tal cual.

### Archivos a modificar
1. Migración SQL nueva (añadir columnas a `profiles`).
2. `supabase/functions/generate-newsletter/index.ts` — system prompt + leer preferencias + limpiar queries + quitar validaciones hardcoded.
3. `src/hooks/useNewsletters.tsx` — añadir `useNewsletterPreferences`.
4. `src/pages/NewsletterPage.tsx` — UI de la caja colapsable.
5. `src/i18n/translations.ts` — claves nuevas.

### Memoria
Actualizar `mem://features/newsletter` reflejando que las reglas (frescura, fuentes, perfil) ya no están hardcodeadas sino que son preferencias editables por usuario.

