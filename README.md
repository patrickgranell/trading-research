# Trading Research V31.6.1 — Environment Isolation Fix

V31.6.1 parte de V31.6 y mantiene todo el motor existente. Esta revisión corrige el aislamiento Replay / Sim / Live en Execution Reconciliation.

## Separación de capas

- **Ankora**: backtest/research. Nunca es candidata automática a una ejecución NinjaTrader.
- **Trading Research**: contexto cualitativo, hipótesis, checklist, errores, diario, notas y capturas.
- **NinjaTrader + histórico Tick**: fills, precios, timestamps, cantidad, resultado y evidencia de mercado.


## Fix V31.6.1 · Replay / Sim / Live

- El selector de entorno de **Vinculación** ahora es un filtro de vista; ya no modifica el entorno almacenado del Grid.
- El entorno del Grid se detecta al importar desde las columnas **Cuenta** y **Conexión** de NinjaTrader (`Playback101/Reproducción` → Replay, `Sim101`/simulación → Sim, resto identificado → Live).
- Si un CSV mezcla entornos o no permite determinar el entorno, la importación se bloquea para evitar contaminación.
- Los Grids anteriores a V31.6.1 se migran como Replay, porque el importador V31.4/V31.5 estaba definido exclusivamente para Playback y no conservaba Cuenta/Conexión.
- Replay, Sim y Live quedan aislados en candidatos, contadores y vinculación. `Pendiente NinjaTrader` sigue siendo genérico y adopta el entorno del fill al confirmar el enlace.
- La vinculación incorpora una segunda validación defensiva: una operación ya marcada Replay/Sim/Live no puede enlazarse con otro entorno aunque la UI quedara desactualizada.

## Execution Reconciliation

Una operación manual debe marcarse explícitamente como `Pendiente NinjaTrader`, `Replay`, `Sim` o `Live` para aparecer como candidata. El Grid de NinjaTrader propone matches por contrato, dirección, tiempo y precio, pero exige confirmación manual.

Al vincular, Trading Research autorellena únicamente campos objetivos de ejecución: entrada/salida exactas, precio, cantidad, resultado, P&L y, cuando existe Market Data, MFE/MAE. Los campos cualitativos no se sobrescriben.

La operación conserva una referencia de Execution Evidence y puede desvincularse restaurando los campos de ejecución anteriores al enlace.

## Deployment

El ZIP contiene exactamente los seis archivos raíz habituales. `npm run build` genera un único `dist/index.html` (single-bundle) para Cloudflare Workers. No requiere SQL nuevo.
