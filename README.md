# Trading Research V31.6 — Execution Reconciliation

V31.6 parte de V31.5 y formaliza la separación entre **Research/Backtest** y **evidencia de ejecución**.

## NinjaTrader ↔ Journal

- Ankora continúa siendo una fuente de backtesting y nunca entra automáticamente en el matching de ejecuciones.
- El Grid de NinjaTrader se clasifica explícitamente como Replay, Simulado o Live.
- Una operación manual del Journal puede prepararse antes de operar y después vincularse a su ejecución.
- El matching usa contrato, dirección, proximidad temporal y, cuando existe, precio de entrada. Siempre requiere confirmación.
- Al vincular, NinjaTrader autorellena timestamps de entrada/salida, contrato, cantidad, precio, resultado, P&L/comisión y MFE/MAE cuando existe Market Data calibrado.
- Setup, VD, NR, hipótesis, contexto, checklist, Mistakes, diario emocional, notas e imágenes no se sobrescriben.
- Si no existe operación previa, puede crearse un borrador desde NinjaTrader con los campos cualitativos pendientes.
- El enlace guarda procedencia y puede abrir directamente el Running P&L local cuando el Grid/histórico están disponibles.

## Seguridad metodológica

La reconciliación no transforma una operación Ankora en una ejecución real. Los históricos Tick y Grids permanecen en IndexedDB; la operación vinculada guarda únicamente la evidencia resumida necesaria en el Journal. Conflict Guard V9.2 y Supabase continúan intactos.

## Build

El despliegue mantiene el sistema single-bundle: `npm run build` genera un único `dist/index.html`.
