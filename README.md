# Trading Research V13 — Exit Lab

Esta versión parte de **V12 Research Grid** y conserva Supabase, V9.2 Conflict Guard, snapshots, Biblioteca Simple, modo Claro/Oscuro, Dashboard R/ticks/US$, Laboratorio Analítico y Research Grid.

## Nuevo: Exit Lab

- Diagnóstico de calidad/cobertura de MFE y MAE dentro del subconjunto filtrado.
- Captura media del MFE en operaciones ganadoras con datos consistentes.
- Cesión media desde el máximo favorable hasta el resultado final.
- Detección de trades que alcanzaron +1R y terminaron negativos.
- Curva comparativa **salida real vs TP fijo** configurable entre 0.5R y 3R.
- Tabla de escenarios de TP fijo con resultado, expectancy y Profit Factor.
- Tabla observada de qué ocurre después de alcanzar 0.5R, 1R, 1.5R, 2R, 2.5R y 3R.
- Diagnóstico de Break Even por trigger sin inventar la secuencia intratrade.
- Separación explícita entre métricas observadas, escenarios inferibles con MFE y simulaciones que requieren datos intratrade.

### Criterio de rigor

El modelo actual guarda un MFE vacío como `0`. Para no confundir un dato ausente con una excursión realmente nula, Exit Lab solo considera **MFE > 0** como MFE utilizable. El escenario de TP fijo se calcula únicamente como: “si MFE alcanzó el TP, salida completa en ese nivel; si no, conservar la salida real”. No se simulan trailing stops, parciales ni rutas intratrade sin datos que las soporten.

## Infraestructura

No requiere SQL nuevo ni cambios en Supabase/Cloudflare. Continúa usando los mismos seis archivos raíz del proyecto.


## V13.1 · Unidades analíticas completas
- Research Grid hace explícita la unidad analítica global (R, ticks o US$) y la base Bruto/Neto.
- Exit Lab mantiene TP/MFE/BE estructurados en R, pero convierte P&L, expectancy, equity, drawdown, cierres y cesión a la unidad global operación por operación.
- MFE/MAE observados siguen siendo excursiones brutas del precio.
