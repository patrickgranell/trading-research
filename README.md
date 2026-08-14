# Trading Research V9.2 — Conflict Guard

## Novedades

- Conflict Guard por revisión remota usando `trading_workspace.updated_at`.
- Bloqueo del auto-sync cuando otro dispositivo ha cambiado Supabase desde la última revisión conocida.
- Reserva condicional de revisión antes de escribir para reducir carreras entre dispositivos.
- Resolución manual explícita con `RESOLVER CON LOCAL`.
- Descargas con cambios locales pendientes protegidas mediante `REEMPLAZAR LOCAL`.
- Historial de hasta 3 snapshots locales automáticos antes de subidas/descargas importantes.
- Restauración manual de snapshots con auto-sync desactivado por seguridad.
- Indicadores de revisión base, cambios locales y estado del Conflict Guard.

## SQL

No requiere cambios de esquema respecto a V9/V9.1. Reutiliza el campo `updated_at` existente en `trading_workspace`.

## Despliegue

Sustituir los 6 archivos del repositorio y desplegar como las versiones anteriores.
