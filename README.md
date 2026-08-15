# Trading Research V31.4 — Market Data Calibration

V31.4 parte de V31.3 y reactiva Market Data únicamente como motor de calibración verificable.

## Market Data · Calibración

- Importa históricos NinjaTrader Tick Replay (`yyyyMMdd HHmmss fffffff;Last;Bid;Ask;Volume`).
- Guarda los históricos grandes solo en IndexedDB local; no se sincronizan con Supabase ni entran en Conflict Guard.
- Importa el Grid CSV de ejecuciones de NinjaTrader Playback.
- Reconstruye trades entrada → salida final, incluidas salidas parciales básicas.
- Detecta automáticamente el desfase horario Grid local → histórico UTC y permite ajuste manual.
- Localiza cada fill usando timestamp, precio y lado Bid/Ask/Last dentro de una ventana de ±3 s.
- Calcula MFE/MAE en ticks usando el recorrido Last exclusivamente mientras la posición está abierta.
- Muestra calidad del match, delta temporal, ticks procesados y advertencias de coherencia.

Running P&L, Best Exit ampliado y simulación SL/TP siguen bloqueados hasta validar esta capa contra operaciones conocidas.

## Base conservada

Incluye Report Builder, comparación avanzada de Trading Plans, Mistakes Analysis, Dashboard Profiles, Data Quality, Exit Lab, Research Grid, Walk-Forward, Forward OOS, Monte Carlo, Stress Lab, Change Tracking, Conflict Guard V9.2 y el resto de V31.3.

No requiere SQL nuevo.
