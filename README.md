# Trading Research V11.5 — Modo Claro / Oscuro

Esta versión parte de **V11.4** y mantiene intactos Supabase, V9.2 Conflict Guard, snapshots, Biblioteca Simple, Laboratorio, unidades del Dashboard, resets gráficos y reglas de legibilidad/signos.

## Nuevo

- Selector visual **Oscuro / Claro** en la barra lateral.
- El modo oscuro continúa siendo la apariencia predeterminada.
- La preferencia se guarda **solo en el navegador/dispositivo** mediante `localStorage`; no modifica Trading Plans ni se sincroniza con Supabase.
- El modo claro adapta paneles, tablas, formularios, modales, configuración, Biblioteca, Nube, Laboratorio y gráficos a fondos claros con contraste específico.
- Verde/rojo mantiene su semántica financiera. No se añaden signos `+` ni `-` nuevos.
- El color neutro de heatmaps/matrices se adapta automáticamente al tema.

## Infraestructura

No requiere SQL nuevo ni cambios en Cloudflare/Supabase. Continúa usando los mismos seis archivos raíz del proyecto.
