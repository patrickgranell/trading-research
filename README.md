# Trading Research V10 — Advanced Analytics Lab

Esta versión mantiene intacta la infraestructura V9.2 Conflict Guard y añade una capa analítica no destructiva.

## Laboratorio Analítico Avanzado

- Heatmap Foco × Estrés con Expectancy / WR / PF / resultado total y tamaño de muestra.
- Scatter MAE/MFE frente a resultado económico en US$.
- Penalizaciones conductuales por pérdida neta asociada.
- Histograma de distribución de resultados en R con diagnóstico de stops alrededor de −1R.
- Matriz de Edge configurable (Setup × Contexto por defecto).
- Estabilidad del Edge mediante ventanas móviles de 20 / 40 / 100 operaciones.
- Simulador de reglas de riesgo: señales brutas vs gestión del Trading Plan.
- Tabla final del subconjunto analizado.
- Filtros interactivos compartidos entre módulos.

## Seguridad

El motor Supabase, Safe Sync, Conflict Guard y snapshots de V9.2 no se modifica.

## Despliegue

Build: `npm run build`

Deploy: `npx wrangler deploy`
