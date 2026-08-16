# Trading Research V31.7.1

## Intratrade Candlestick Price Evidence

V31.7 mantiene el aislamiento de entornos de V31.6.1 (Replay / Sim / Live) y rediseña la pestaña 2 de Market Data para que la vista principal represente **precio real**, no P&L transformado.

### Cambios principales

- `2 · Recorrido` sustituye la lectura principal de Running P&L.
- Vista predeterminada: **velas OHLC construidas con ticks Last** dentro de la ventana exacta fill de entrada → fill de salida.
- Intervalo de vela automático para mantener una densidad legible (~90 barras objetivo).
- Superposición de:
  - fill real de entrada;
  - fill real de salida;
  - MFE;
  - MAE;
  - cursor/inspector tick a tick.
- Un SHORT ganador ya se visualiza como caída de precio; un LONG ganador, como subida de precio.
- La antigua curva de `P&L · ticks` se conserva como **vista auxiliar**, claramente separada de la acción del precio.
- No se utiliza información posterior al cierre de la operación.
- No requiere cambios SQL.

## Comprobaciones recomendadas

1. Abrir Market Data → `2 · Recorrido`.
2. Seleccionar la operación SHORT `73.92 → 73.72`.
3. Confirmar que la vista predeterminada es `Velas · precio` y que el recorrido refleja una caída del mercado.
4. Confirmar que Entrada, Salida, MFE y MAE están correctamente superpuestos.
5. Cambiar a `P&L auxiliar · ticks` y verificar que la curva anterior sigue disponible solo como métrica secundaria.

## Build

```bash
npm run build
```


## V31.7.1
Corrige el contraste de las tarjetas KPI y del inspector tick a tick en modo oscuro. El modo claro y el gráfico de velas no cambian.
