# Trading Research V31.6 — Execution Reconciliation

V31.6 parte de V31.5 y mantiene todo el motor existente, incluido Market Data calibrado, Running P&L intratrade, Report Builder, Mistakes Analysis, Supabase y Conflict Guard V9.2.

## Separación de capas

- **Ankora**: backtest/research. Nunca es candidata automática a una ejecución NinjaTrader.
- **Trading Research**: contexto cualitativo, hipótesis, checklist, errores, diario, notas y capturas.
- **NinjaTrader + histórico Tick**: fills, precios, timestamps, cantidad, resultado y evidencia de mercado.

## Execution Reconciliation

Una operación manual debe marcarse explícitamente como `Pendiente NinjaTrader`, `Replay`, `Sim` o `Live` para aparecer como candidata. El Grid de NinjaTrader propone matches por contrato, dirección, tiempo y precio, pero exige confirmación manual.

Al vincular, Trading Research autorellena únicamente campos objetivos de ejecución: entrada/salida exactas, precio, cantidad, resultado, P&L y, cuando existe Market Data, MFE/MAE. Los campos cualitativos no se sobrescriben.

La operación conserva una referencia de Execution Evidence y puede desvincularse restaurando los campos de ejecución anteriores al enlace.

## Deployment

El ZIP contiene exactamente los seis archivos raíz habituales. `npm run build` genera un único `dist/index.html` (single-bundle) para Cloudflare Workers. No requiere SQL nuevo.
