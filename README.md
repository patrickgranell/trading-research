# Trading Research V5.1 — Visual Lab

Mejoras sobre V5:

- Corrige el estado visual de los selectores R / Ticks / US$ y Bruto / Neto en Operaciones.
- Añade **Visual Lab**:
  - Histograma + curva normal de referencia (sin asumir normalidad de los datos).
  - Gráfico de dispersión con selección libre de métricas X/Y.
  - Métricas disponibles: resultados, R, ticks, P&L, MFE, MAE, hora, stop, contratos y comisiones.
- Bloques de 20:
  - Panel de comisión añadido a cada bloque.
  - Selector independiente para ver comisiones en US$ o ticks equivalentes.
  - La unidad seleccionada se aplica también a la tabla comparativa y al detalle del bloque.

## Despliegue

Build command: `npm run build`

Deploy command: `npx wrangler deploy`
