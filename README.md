# Trading Research V31.1.3 — Dashboard Profiles · Stable Runtime

Hotfix de estabilidad basado en V31.1.2. Cloudflare estaba desplegando correctamente la versión nueva, pero el parche V31 Market Data interrumpía la ejecución antes de que V31.1 Dashboard Profiles llegara a activarse.

## Cambio principal

- Market Data Foundation queda **pausado y fuera del runtime** hasta el final de la auditoría funcional, tal como se decidió.
- Se mantienen intactos V30.3, Supabase, Conflict Guard V9.2 y todos los módulos previos.
- Dashboard Profiles sigue activo: múltiples dashboards con nombre por Trading Plan, duplicar/renombrar/eliminar, orden por arrastre, flechas de precisión y tamaños de widget.
- Build single-bundle: Cloudflare publica un único `dist/index.html` con CSS y JS embebidos.
- No requiere SQL nuevo.

## Despliegue

Subir exactamente los seis archivos raíz a GitHub. Cloudflare ejecuta `npm run build` y publica un único asset `/index.html`.
