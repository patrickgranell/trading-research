# Trading Research V2

V2 centra la arquitectura en dos piezas:

1. **Catálogo de contratos**: símbolo, tick size, valor del tick, comisión por contrato y moneda.
2. **Estrategias de gestión por lotes**: contrato seleccionado del catálogo, rango ATR y uno o más lotes con stop independiente y TP fijo en ticks o módulo discrecional.

La aplicación calcula automáticamente riesgo teórico, comisión, P&L y R a partir de esas especificaciones.

## Despliegue Cloudflare

Build command:

```text
npm run build
```

Deploy command:

```text
npx wrangler deploy
```

Los datos siguen guardándose en `localStorage` durante la fase de validación. El siguiente paso será persistencia con Supabase.
