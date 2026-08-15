# Trading Research V31.1.4 — Dashboard Profiles · Runtime Fix

V31.1.4 corrige el bloqueo de ejecución detectado después de V30. El parche V30.1 referenciaba `exitLabPanel`, pero el módulo real se denomina `exitLabModule`; esa excepción detenía la carga antes de V30.1/V30.2/V30.3/V31.1.

## Corrección
- La cadena V30.1/V30.2 envuelve ahora `exitLabModule` correctamente.
- Se conserva la definición MAE/MFE intratrade en ticks y Data Quality semántico.
- Se conservan Research Alerts, Decision Center y Conflict Guard V9.2.
- Market Data sigue pausado hasta completar la auditoría funcional.
- Dashboard Profiles permanece activo: varios dashboards con nombre, duplicar/renombrar/eliminar, orden por arrastre y tamaño de widgets por Trading Plan.
- Build single-bundle: Cloudflare publica un único `dist/index.html`.

No requiere SQL nuevo.
