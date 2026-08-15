# Trading Research V31.1.5 — Dashboard Profiles · Create Fix

V31.1.5 corrige la creación de nuevos dashboards con nombre. El problema era una referencia obsoleta al array de perfiles: durante la creación se volvía a normalizar `dashboardProfiles`, se sustituía el array interno y el nuevo perfil se añadía a la referencia anterior, por lo que no llegaba al Trading Plan.

## Corrección
- Crear Dashboard añade el perfil directamente a `p.dashboardProfiles` y activa inmediatamente la nueva vista.
- El dashboard nuevo conserva la opción de copiar la vista actual o partir de la plantilla predeterminada.
- Se mantienen renombrar, duplicar, eliminar, orden por arrastre y tamaños por widget.
- Se conserva el Runtime Fix de V31.1.4 y el build single-bundle.
- Market Data continúa pausado hasta completar la auditoría funcional.
- Supabase y Conflict Guard V9.2 no se modifican.

No requiere SQL nuevo.
