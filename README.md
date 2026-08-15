# Trading Research V31.1.2 — Dashboard Profiles + Single-Bundle Deploy

V31.1.2 mantiene todas las funciones de V31.1.1 y cambia únicamente la estrategia de despliegue para eliminar la desincronización observada entre `index.html` y los assets JS/CSS de Cloudflare.

## Cambio de despliegue

- El ZIP sigue teniendo exactamente 6 archivos raíz: `index.html`, `app.js`, `styles.css`, `package.json`, `wrangler.jsonc`, `README.md`.
- `npm run build` genera **un único asset de producción**: `dist/index.html`.
- Ese `index.html` contiene `styles.css` y `app.js` embebidos. Ya no depende de `/app.js`, query strings ni nombres físicos separados.
- Incluye marcadores `trading-research-source-version=31.1.2`, `trading-research-build-version=31.1.2` y `V31.1.2-SINGLE-BUNDLE` para diagnóstico.
- Supabase CDN sigue cargándose externamente como antes.

## Dashboard Profiles

- Varios dashboards con nombre por Trading Plan.
- Crear, duplicar, renombrar, eliminar y cambiar de vista.
- Orden por arrastre y flechas.
- Anchura configurable de widgets.
- La antigua configuración migra a `Principal`.
- Market Data V31 permanece instalado pero congelado hasta completar la auditoría funcional.

---

# Trading Research V31.1.1 — Dashboard Profiles + Asset Versioning Fix

V31.1.1 parte de V31.1 y mantiene intactos Supabase, Conflict Guard V9.2, Research Decision Center, Change Tracking, MAE/MFE intratrade en ticks, Data Quality, Market Data Foundation y el resto de módulos existentes.

## Corrección de despliegue

Esta revisión corrige una desincronización observada en Cloudflare Workers: `index.html` nuevo podía convivir con una resolución antigua de la ruta estable `/app.js`.

El build ya no depende de `app.js?v=...` ni `styles.css?v=...` como única forma de versionado. A partir de esta versión genera nombres físicos nuevos dentro de `dist` usando la versión de `package.json`:

- `app-31.1.1.js`
- `styles-31.1.1.css`
- `index.html` referencia exactamente esos nombres.

En las siguientes versiones el mismo build generará automáticamente los nombres correspondientes a la nueva versión. Los seis archivos fuente del repositorio no cambian de estructura.

## Dashboard Profiles

- Varios dashboards con nombre por Trading Plan.
- Crear desde plantilla o duplicar la vista actual.
- Cambiar, renombrar, duplicar y eliminar perfiles.
- Orden de widgets por arrastre y controles precisos de movimiento.
- Tamaños de widgets sobre rejilla flexible.
- Configuración persistente por perfil y por Trading Plan.
- Migración de la configuración de Dashboard previa a un perfil `Principal`.

## Market Data

Market Data Foundation V31 permanece instalado, pero su desarrollo queda congelado hasta completar la auditoría funcional pendiente. No es requisito para validar Dashboard Profiles.

## MAE / MFE

- Datos primarios en ticks.
- Definición estándar intratrade: entrada → salida final real.
- R derivada del riesgo inicial.
- Estados separados: pendiente, medido utilizable y no recuperable/no evaluable.
- `N/A` resuelve revisión, pero no aumenta la cobertura utilizable.

## Despliegue

Cloudflare ejecuta `npm run build` y sirve `./dist` mediante Wrangler. El build genera tres assets desplegables con nombres versionados físicamente. No requiere SQL nuevo.

## Archivos fuente

El ZIP contiene exactamente seis archivos en la raíz:

- `index.html`
- `app.js`
- `styles.css`
- `package.json`
- `wrangler.jsonc`
- `README.md`
