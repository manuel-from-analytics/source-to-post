# Diagnóstico y estabilización end-to-end del login con Google

## Estado confirmado

- El backend alojado está operativo, pero no hay eventos recientes en los logs de autenticación. Esto apunta a que el flujo se interrumpe antes de que la sesión llegue a registrarse en el backend, o a que la respuesta administrada no vuelve correctamente a la app.
- En Preview, el SDK abre un popup y espera un `postMessage` con tokens; fuera de iframe hace una redirección completa. Son dos caminos distintos y deben probarse por separado.
- La capa autogenerada `lovable.auth.signInWithOAuth` ya persiste los tokens con `setSession`, pero `Auth.tsx` vuelve a ejecutar `setSession` y `getUser`. Hay dos propietarios de la misma transición de sesión.
- El login solicita retorno a `/`, mientras existe además `/auth/callback` con lógica manual de `setSession`/`exchangeCodeForSession`; esa ruta no participa en el flujo actual. Mantener ambos modelos permite carreras y hace difícil saber qué código procesó la respuesta.
- `AuthProvider` valida una sesión inicial con `getSession` + `getUser`; `RootRedirect` y `ProtectedRoute` dependen después de ese estado. Hoy no hay trazabilidad para distinguir “no llegaron tokens”, “falló persistencia”, “falló validación” o “el contexto no recibió el evento”.
- Los locks no están alineados: `package.json` y `bun.lock` resuelven `cloud-auth-js` 1.1.2, mientras `package-lock.json` conserva 1.0.1. Según el instalador usado, un entorno puede ejecutar un flujo distinto.
- No existen pruebas específicas del login OAuth, del `AuthProvider`, de `RootRedirect`, de `ProtectedRoute` ni del callback.

## Camino que vamos a instrumentar

```text
/login
  -> click Google
  -> SDK administrado
      -> Preview iframe: popup -> broker -> Google -> consentimiento -> postMessage
      -> App publicada: redirect -> broker -> Google -> consentimiento -> redirect a /
  -> respuesta con tokens
  -> una única persistencia de sesión
  -> evento SIGNED_IN / sesión inicial
  -> AuthProvider publica user
  -> RootRedirect recupera destino seguro
  -> /dashboard
  -> ProtectedRoute confirma user y renderiza
```

Cada flecha tendrá un checkpoint sin registrar tokens, correos ni datos personales: inicio, tipo de flujo, respuesta recibida, persistencia completada, sesión validada, contexto actualizado y ruta final.

## Implementación

1. **Crear un diagnóstico de auth seguro**
   - Añadir un pequeño registrador de eventos de sesión con códigos estables, tiempos y ruta/origen, sin secretos.
   - Mantener un buffer efímero en memoria/session storage y mostrar un identificador de diagnóstico cuando falle el login.
   - Capturar errores reales del SDK y de la validación en lugar del mensaje genérico actual.

2. **Dejar un solo propietario por transición**
   - Usar exclusivamente el helper administrado para iniciar Google OAuth y persistir su respuesta en Preview.
   - Eliminar la segunda llamada manual a `setSession` desde login/signup.
   - Unificar el retorno en una sola ruta pública y retirar del camino activo la lógica duplicada de intercambio de código/tokens.
   - Hacer que la navegación espere una confirmación explícita del `AuthProvider`, con timeout y error recuperable, nunca un rebote silencioso a `/login`.

3. **Convertir `AuthProvider` en una máquina de estados observable**
   - Estados: `initializing`, `anonymous`, `authenticating`, `authenticated`, `error`.
   - Separar lectura local, validación remota y recepción de eventos.
   - Garantizar que una inicialización tardía no sobrescriba un `SIGNED_IN` válido y que el desmontaje no deje promesas activas.

4. **Alinear dependencias**
   - Sincronizar los lockfiles con la misma versión exacta del SDK de auth para que Preview, build y publicación ejecuten el mismo código.
   - Verificar que la configuración del proveedor Google administrado sigue activa antes de la prueba real.

5. **Añadir pruebas por capa**
   - **Unitarias:** destino seguro, estados y transiciones del proveedor, inicialización con/sin sesión, `SIGNED_IN` durante una validación pendiente, errores y timeout.
   - **Integración React:** `/`, `/index`, `/login`, callback público y rutas protegidas con sesiones simuladas; comprobar que nunca hay rebote tras confirmar usuario.
   - **Contrato del helper:** respuesta popup correcta, `redirected: true`, popup bloqueado, estado inválido, respuesta sin tokens y error del proveedor.
   - **Playwright:** simular el `postMessage` administrado y verificar `login -> sesión persistida -> dashboard`; probar recarga directa de `/dashboard` y sesión caducada.

6. **Validación end-to-end real**
   - Ejecutar primero toda la matriz automatizada.
   - Probar por separado Preview móvil/iframe y app publicada, registrando el último checkpoint alcanzado.
   - Confirmar: una sola petición OAuth, una sola persistencia, usuario válido, URL final `/dashboard`, recarga estable y ausencia de vuelta a `/login`.
   - Si el flujo real se detiene antes de entregar tokens y siguen sin aparecer eventos del backend, la evidencia aislará el fallo en broker/proveedor en lugar de seguir modificando el enrutado a ciegas.

## Criterios de aceptación

- Google completa el login tanto en Preview como en la app publicada.
- Tras el consentimiento se llega a `/dashboard` una sola vez y una recarga mantiene la sesión.
- No se ejecutan intercambios ni `setSession` duplicados.
- Un fallo indica exactamente la etapa y un identificador diagnóstico, sin exponer credenciales.
- Las pruebas cubren todos los saltos del diagrama y previenen la regresión del bucle.
