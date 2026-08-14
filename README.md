# Trading Research V30.1 — Excursiones en ticks + Alerts Fix

V30.1 parte de V30 y conserva toda la base anterior: Supabase, Conflict Guard V9.2, snapshots, Dashboard configurable, Calendario, Research Grid, Exit Lab, Compliance, Estudios, Confianza estadística, Review & Notes, Objetivos, ayuda contextual, Monte Carlo, Risk & Stress Lab, Walk-Forward, Forward OOS, Data Quality Workbench, Quality-Aware Analytics, Research Decision Center y Change Tracking.

## Cambio principal · MAE/MFE se registran en ticks

- La observación primaria pasa a ser `MFE (ticks)` y `MAE (ticks)`.
- Ambos se registran como magnitudes positivas observables directamente en el gráfico.
- Trading Research calcula automáticamente la equivalencia en R usando contratos y exposición de riesgo inicial.
- Los análisis existentes continúan trabajando en R cuando la normalización es la lectura adecuada.
- Se mantienen `mfe` y `mae` derivados en R para compatibilidad con Exit Lab, Scatter y estadísticas históricas.
- Se añaden `mfeTicks` y `maeTicks` como datos primarios.
- Las operaciones antiguas con MFE/MAE en R se migran localmente a ticks cuando la exposición de riesgo permite derivarlos.
- `0 ticks` marcado como `Medido` sigue siendo un cero real; `No informado` y `N/A` continúan siendo estados distintos.

## Multi-lote

Para estrategias con varios lotes/stops, la equivalencia se normaliza sobre el riesgo agregado de la operación. El usuario introduce el recorrido del precio en ticks y la aplicación convierte ese recorrido a R sin exigir cálculo manual.

## Fix · Research Alerts / Forward OOS

V30.1 añade una reconciliación explícita alrededor del guardado de operaciones:

- guarda los conteos Forward antes de registrar una operación;
- comprueba los conteos después;
- si una operación nueva incrementa una muestra OOS y V30 no generó el evento, V30.1 lo crea de seguridad;
- al instalarse, reconcilia progreso OOS ya existente que no tenga un evento asociado;
- `Cambios` incorpora `Comprobar ahora` para volver a comparar el estado con la referencia sin modificarla.

`Actualizar referencia` conserva su función original: cambia el punto de comparación futuro y no debe usarse como botón de comprobación.

## Archivos

El paquete mantiene exactamente seis archivos en la raíz:

- `index.html`
- `app.js`
- `styles.css`
- `package.json`
- `wrangler.jsonc`
- `README.md`

No requiere SQL nuevo.
