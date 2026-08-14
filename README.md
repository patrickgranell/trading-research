# Trading Research V12 — Research Grid

Esta versión parte de **V11.5** y mantiene intactos Supabase, V9.2 Conflict Guard, snapshots, Biblioteca Simple, Laboratorio Analítico, Dashboard R/ticks/US$, resets gráficos, legibilidad y modo Claro/Oscuro.

## Nuevo: Research Grid

- Tabla dinámica/pivot dentro del Laboratorio Analítico.
- Filas y columnas seleccionables: Setup, Contexto, VD, NR, Hipótesis, Estrategia, Dirección, Hora, Comportamiento, Emoción, Foco y Estrés.
- Métrica seleccionable: Expectancy, resultado total, Win rate, Profit Factor, nº de operaciones, media ganadora, media perdedora y max drawdown.
- Respeta la **unidad global R / ticks / US$** y la base **Bruto / Neto** del Laboratorio.
- Totales por fila, por columna y total general.
- Control de muestra mínima (`n`) para atenuar celdas con poca evidencia.
- Límite de categorías configurable para mantener la matriz legible.
- Un clic en una celda filtra todo el Laboratorio por esa combinación; un segundo clic o **Restablecer selección** recupera el estado anterior.
- Los ejes pueden intercambiarse con un botón.
- Comportamiento y Emoción admiten etiquetas múltiples sin duplicar una operación dentro de la misma celda.

## Infraestructura

No requiere SQL nuevo ni cambios en Cloudflare/Supabase. Continúa usando los mismos seis archivos raíz del proyecto.
