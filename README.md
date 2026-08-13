# Trading Research V9.1 — Safe Cloud Sync

## Seguridad añadida

- Antes de cada subida se compara el inventario local con Supabase.
- Si la subida borraría registros remotos, la sincronización automática se bloquea.
- Una sobrescritura manual destructiva exige escribir `SOBRESCRIBIR NUBE`.
- Antes de descargar se compara el inventario remoto con el local.
- Si la descarga eliminaría datos locales, exige escribir `REEMPLAZAR LOCAL`.
- Se guarda un snapshot local de seguridad antes de una sustitución cloud.
- Botón para actualizar el estado remoto real.
- Se mantiene Auth + RLS + bucket privado de imágenes de V9.

## Archivos de despliegue

Sube a GitHub los seis archivos de la raíz. No hace falta volver a ejecutar el SQL de Supabase.
