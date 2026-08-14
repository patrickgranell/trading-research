# Trading Research V11.1 — Biblioteca Simple

Esta versión parte de V11/V10 y mantiene intacto el motor V9.2 Conflict Guard. Simplifica la reutilización de material entre Trading Plans.

## Biblioteca simple

- Cada Setup, VD, Contexto, NR, Hipótesis, Estrategia de gestión, regla de gestión del riesgo y salida discrecional tiene un botón **Guardar** junto a sus acciones.
- Al pulsar **Guardar**, se crea una copia independiente en **Configuración → Biblioteca**.
- Si vuelves a guardar un elemento con el mismo nombre después de modificarlo, la aplicación pregunta si quieres reemplazar la copia guardada.
- La Biblioteca muestra acciones simples: **Añadir al plan** y **Eliminar**.
- Añadir una plantilla copia el contenido al Trading Plan activo; editarla después dentro del plan no modifica la plantilla guardada.
- Eliminar una plantilla de Biblioteca no borra el elemento de ningún Trading Plan donde ya se haya usado.
- Las imágenes de Setups, VD y Contextos se conservan mediante las referencias existentes y siguen participando en Supabase Storage.

## Nube y seguridad

No requiere SQL nuevo. La Biblioteca sigue viajando dentro del payload sincronizado existente, protegida por Safe Sync, Conflict Guard y snapshots.

## Laboratorio

Se conserva completo el Laboratorio Analítico Avanzado de V10.

## Despliegue

Build: `npm run build`

Deploy: `npx wrangler deploy`
