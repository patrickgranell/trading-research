# Trading Research V31.5 — Running P&L Intratrade

V31.5 parte de V31.4 y mantiene intacta la calibración Market Data ya validada.

## Running P&L

- Nueva segunda fase dentro de `Market Data`: **Running P&L**.
- Reconstruye cada operación calibrada tick a tick usando `Last` exclusivamente entre el fill de entrada localizado y el fill final de salida.
- Permite ver el recorrido como **P&L en ticks** o como **precio Last**.
- Conserva por separado el resultado real del fill: la curva Last no se fuerza artificialmente a terminar en el precio de ejecución.
- Marca MFE, MAE, último Last y fill de salida.
- Incluye inspector temporal con hora Grid, tiempo transcurrido, Last, Bid/Ask y P&L Last en cualquier punto del recorrido.
- Muestra duración, número de observaciones, resultado realizado, MFE/MAE y diferencia entre Last de cierre y fill real.
- Desde la tabla de calibración se puede abrir directamente el recorrido de cualquiera de las operaciones reconstruidas.

La definición permanece estrictamente intratrade. No se analiza todavía el mercado posterior al cierre, no se simulan stops/targets alternativos y esto no es un Market Replay.

## Market Data local

Los históricos Tick y los Grids de ejecución continúan guardándose únicamente en IndexedDB del navegador. No se suben a Supabase, no entran en Conflict Guard y no modifican el Trading Plan.

## Base conservada

Incluye V31.4 Market Data Calibration, Report Builder, comparación avanzada de Trading Plans, Mistakes Analysis, Dashboard Profiles, Data Quality, Exit Lab, Research Grid, Walk-Forward, Forward OOS, Monte Carlo, Stress Lab, Change Tracking, Conflict Guard V9.2 y el resto de módulos previos.

No requiere SQL nuevo.
