# Trading Research V11 — Biblioteca Maestra

Esta versión parte de V10 y mantiene intacto el motor V9.2 Conflict Guard. Añade una Biblioteca Maestra global para reutilizar material entre Trading Plans sin volver a escribirlo.

## Biblioteca Maestra

- Guarda Setups, VD, Contextos, NR, Hipótesis, Estrategias de gestión, reglas de gestión del riesgo y salidas discrecionales.
- Importación masiva del material del Trading Plan activo.
- Si un elemento no cambia, no se duplica; si cambia, se crea una nueva versión.
- Los Trading Plans reciben snapshots independientes: una versión nueva de la Biblioteca no reescribe planes anteriores.
- Selector múltiple para añadir material de Biblioteca al plan activo.
- Creación de un Trading Plan nuevo directamente desde la Biblioteca.
- Archivado no destructivo de familias de material.
- Las referencias de imagen de la Biblioteca participan en backup y sincronización de Storage.

## Nube y seguridad

No requiere SQL nuevo. La Biblioteca Maestra viaja dentro del payload versionado de los Trading Plans, por lo que utiliza las tablas Supabase existentes y sigue protegida por Safe Sync, Conflict Guard y snapshots.

## Laboratorio

Se conserva completo el Laboratorio Analítico Avanzado de V10.

## Despliegue

Build: `npm run build`

Deploy: `npx wrangler deploy`
