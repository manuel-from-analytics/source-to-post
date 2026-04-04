

## Plan: Hacer PostFlow instalable como PWA

### Resumen
Configuraremos la app para que sea instalable desde el navegador del móvil, con su propio icono y pantalla completa (sin barra del navegador). No necesita App Store ni Google Play.

### Pasos

1. **Crear `public/manifest.json`** con nombre, colores, iconos y `display: "standalone"` para que el sistema operativo la reconozca como app instalable.

2. **Crear iconos PWA** en `public/` (192x192 y 512x512 px). Se generarán iconos SVG simples con el logo de Sparkles/PostFlow.

3. **Actualizar `index.html`** para enlazar el manifest y añadir meta tags de iOS (apple-mobile-web-app-capable, apple-touch-icon, theme-color).

4. **Crear página `/install`** con instrucciones visuales para instalar la app según el dispositivo (iOS: Compartir → Añadir a pantalla de inicio; Android: menú del navegador → Instalar). Incluir botón que dispare el prompt nativo de instalación en Android.

5. **Añadir enlace a la página de instalación** en el sidebar de la app.

### Notas importantes
- No se usará `vite-plugin-pwa` ni service workers para mantener la compatibilidad con el editor de Lovable.
- La instalación funcionará solo en la versión publicada, no en el preview del editor.
- Solo con el manifest y los meta tags, la app ya será instalable en la mayoría de navegadores móviles.

### Detalle técnico
- No hay dependencias nuevas
- Archivos nuevos: `public/manifest.json`, `public/icon-192.svg`, `public/icon-512.svg`, `src/pages/InstallPage.tsx`
- Archivos modificados: `index.html`, `src/App.tsx`, `src/components/layout/AppLayout.tsx`

