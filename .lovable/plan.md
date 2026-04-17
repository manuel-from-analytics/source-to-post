

## Plan: Importar notas en Content Focus

### Comportamiento confirmado
- **Inserción**: solo el texto de la nota, sin encabezado ni etiqueta. Si el textarea ya tiene contenido, se añade un salto de línea antes.
- **Reinserción**: tras añadir una nota, su botón se deshabilita y muestra "Añadida". Si el usuario cambia el texto del textarea manualmente, el estado "añadida" se mantiene (es un control para evitar doble click, no un seguimiento de contenido).
- **Reset del estado "añadida"**: si el usuario desmarca la fuente y la vuelve a marcar, las notas reaparecen disponibles. Si limpia completamente el textarea, también se reinicia.

### UI

Encima del textarea de Content Focus, dentro del mismo bloque, aparece un panel colapsable **solo cuando hay fuentes seleccionadas con notas**:

```text
Content Focus
┌─────────────────────────────────────────┐
│ ▼ Importar desde mis notas (3)          │
│   Article X                             │
│     "Lorem ipsum dolor sit..."  [+ Añadir]│
│     "Otra nota breve..."        [Añadida]│
│   PDF Y                                 │
│     "Texto de la nota..."       [+ Añadir]│
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ Textarea editable libremente            │
└─────────────────────────────────────────┘
```

- Panel abierto por defecto cuando hay notas
- Notas agrupadas por título de fuente
- Preview de la nota truncado (~80 chars) con `title` HTML para ver completa al hover
- Si no hay fuentes seleccionadas o ninguna tiene notas → panel oculto

### Cambios técnicos

**Sin cambios en backend ni base de datos.** Las notas viajan dentro del propio `content_focus` como texto libre que ya envía el edge function `generate-post`.

Archivos a modificar:
1. `src/pages/GeneratorPage.tsx`
   - Query a `input_notes` filtrando por las fuentes en `selectedSources` (vía Supabase, agrupando resultados por `input_id`)
   - Estado local `addedNoteIds: Set<string>` para marcar notas ya insertadas
   - Handler `handleAddNote(noteContent, noteId)`: añade el texto al final de `contentFocus` con `\n` separador si ya hay contenido
   - Componente colapsable usando `Collapsible` (ya disponible en el UI kit)
2. `src/i18n/translations.ts` — claves nuevas en ES/EN/PT:
   - `generator.importFromNotes` ("Importar desde mis notas")
   - `generator.addNote` ("Añadir")
   - `generator.noteAdded` ("Añadida")
   - `generator.notesAvailable` ("{count} disponibles")

### Consideración de rendimiento

La query a `input_notes` se ejecuta solo cuando `selectedSources.length > 0` y se invalida cada vez que cambia la lista de fuentes seleccionadas. Cacheo vía TanStack Query con clave `["input-notes-for-sources", selectedSources.sort().join(",")]`.

