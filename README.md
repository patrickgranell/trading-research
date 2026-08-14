# Trading Research V11.4 — Unidades visibles + Reset de Laboratorio

Esta versión parte de **V11.3** y mantiene intactos Supabase, V9.2 Conflict Guard, snapshots, Biblioteca Simple, Laboratorio y las reglas de legibilidad/signos.

## Dashboard

La unidad del Dashboard puede cambiarse entre `R`, `Ticks` y `US$`. El selector aparece tanto en la cabecera como dentro del propio panel de Equity. La curva, el título, el acumulado y la escala lateral se recalculan en la unidad elegida.

## Laboratorio

Las selecciones interactivas ya son reversibles en los módulos que filtran el estudio:

- Heatmap Foco × Estrés
- Penalizaciones conductuales
- Histograma de distribución de riesgo
- Matriz de Edge

Al seleccionar aparece `Restablecer` en el propio gráfico. Volver a pulsar la misma selección también la desactiva. Cuando existe cualquier selección gráfica, arriba aparece `Restablecer selecciones de gráficos`.

La Matriz de Edge admite además correctamente NR, Hipótesis y Hora como filtros interactivos.

## Despliegue

No requiere SQL nuevo ni cambios en Supabase. Mantén los 6 archivos en la raíz del repositorio.
