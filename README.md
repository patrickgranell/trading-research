# Trading Research V22 — Robustez / Monte Carlo

V17 parte de V15 Dashboard Personalizable y conserva toda la infraestructura anterior: Supabase, V9.2 Conflict Guard, snapshots, Biblioteca Simple, modo claro/oscuro, Dashboard configurable, Calendario, Research Grid y Exit Lab.

## Nuevo · Checklist del Trading Plan

- Nueva pestaña `Configuración → Checklist`.
- Reglas editables por Trading Plan con categoría, descripción, estado y condición obligatoria/opcional.
- Reordenación de reglas.
- Cada regla puede guardarse en la Biblioteca Simple y reutilizarse en otros Trading Plans.
- Las operaciones manuales pueden registrar el checklist como `Evaluado` o `No evaluado`.
- Al evaluar, cada operación guarda un snapshot independiente de las reglas para que cambios futuros del plan no reescriban el histórico.
- Si se guarda una operación con reglas obligatorias incumplidas, la aplicación lo advierte antes de continuar.
- Checklist y `Disciplina` permanecen como capas independientes.

## Nuevo · Cumplimiento del Plan

Nueva sección principal `Cumplimiento` con:

- Cobertura de checklist.
- Cumplimiento medio.
- Porcentaje de operaciones con el 100% de reglas obligatorias.
- Expectancy de operaciones 100% cumplidas frente a operaciones con incumplimientos.
- Diferencia de expectancy.
- Análisis por regla: tasa de cumplimiento, expectancy cumplida/incumplida, delta y resultado negativo asociado.
- Ranking de incumplimientos observados.
- Filtros por Setup y Contexto.
- Unidades R / ticks / US$ y Bruto / Neto.
- Tabla de operaciones evaluadas y filtro para inspeccionar los fallos de una regla concreta.

Las importaciones antiguas o trades sin checklist se consideran `No evaluados`; nunca se convierten automáticamente en incumplimientos. `TPCompliance` de Ankora sigue siendo válido para Disciplina, pero V17 no inventa qué regla concreta falló.

## Dashboard

El personalizador añade dos opciones nuevas:

- KPI `Cumplimiento checklist`.
- Panel `Cumplimiento por regla`.

No están forzados en el Dashboard: se pueden activar desde `⚙ Personalizar`.

## Infraestructura

No requiere SQL nuevo ni cambios en Supabase/Cloudflare. Continúa utilizando los mismos seis archivos raíz.


## V17 · Estudios guardados

El Laboratorio permite guardar, cargar, actualizar, duplicar, eliminar y comparar configuraciones de estudio por Trading Plan. Se persisten filtros, unidad/base, Research Grid y parámetros de Exit Lab sin duplicar operaciones. También se corrige el filtrado desde Research Grid para NR, Hipótesis y Hora.


## V17.1 · Corrección Profit Factor en comparación de estudios

Cuando una muestra no tiene operaciones perdedoras, el Profit Factor es infinito. La comparación de estudios conserva ahora `∞` en lugar de convertirlo erróneamente a `0.00`, y el delta muestra `+∞`, `-∞` o `—` según corresponda.

## V20 · Review & Notes

Se añade una capa de incertidumbre al Laboratorio para evitar sobreinterpretar muestras pequeñas:

- IC 95% aproximado de la expectancy mediante intervalo t.
- Intervalo de Wilson 95% para el win rate.
- Desviación por trade y error estándar.
- Límite inferior 95% como lectura conservadora del edge.
- Clasificación explícita de la evidencia: exploratoria, inconclusa, positiva o negativa.
- Madurez de muestra y objetivo configurable de 20 / 50 / 100 / 200 operaciones.
- Comparación simple entre primera y segunda mitad de la muestra para detectar cambios de signo.
- Nueva métrica `Límite inferior 95%` dentro de Research Grid.
- Aviso metodológico sobre independencia, cambios de régimen, data snooping y múltiples comparaciones.

La capa estadística utiliza la unidad/base activa del Laboratorio (R, ticks o US$; bruto o neto). No requiere SQL nuevo.


## V20 · Review & Notes
- Archivo de reviews por operación, día, semana, mes, bloque, estudio o plan general.
- Hallazgo/evidencia, decisión, tags, estado y horizonte de seguimiento.
- Métricas actuales del contexto vinculado en R/ticks/US$ y bruto/neto.
- Búsqueda y filtros por tipo, estado y tag.
- Acceso rápido desde el calendario y widget opcional en el Dashboard personalizable.
- Las reviews forman parte del Trading Plan y se sincronizan mediante la misma persistencia V9.2.


## V20 · Objetivos & Scorecard
- Nueva sección de objetivos cuantificables por Trading Plan.
- Horizontes: plan completo, últimas 20/50/100 y mes actual.
- Métricas de rendimiento, cumplimiento y calidad de datos.
- Scorecard dinámico y panel opcional para Dashboard.

## V21 · Ayuda contextual + Glosario

- Añade iconos `i` contextuales junto a métricas y módulos importantes.
- Hover/foco: resumen corto sin salir de la pantalla.
- Clic: explicación ampliada con significado y utilidad práctica.
- Glosario central accesible desde la barra lateral con búsqueda.
- Definiciones centralizadas para evitar explicaciones contradictorias entre pantallas.
- Cobertura inicial: Expectancy, Win Rate, Profit Factor, Drawdown, R/Ticks/US$, Bruto/Neto, MFE/MAE, Equity, distribuciones, heatmaps, Research Grid, Exit Lab, confianza estadística, IC95, Compliance, Diario, Estudios, Reviews, Calendario, Objetivos, Conflict Guard y Snapshots.
- Compatible con modo oscuro/claro y con interacción táctil mediante clic.
- No modifica el dataset ni requiere cambios SQL.


## V22 · Robustez / Monte Carlo

El Laboratorio añade un módulo de robustez basado en bootstrap determinista sobre el subconjunto filtrado:

- 500 / 1.000 / 2.500 simulaciones.
- Horizonte igual a la muestra actual o 20 / 50 / 100 / 200 trades.
- Probabilidad empírica de secuencia positiva.
- Percentiles 5 / 50 / 95 de resultado final y expectancy.
- Distribución de máximo drawdown y drawdown severo (cola 5%).
- Percentil 95 de la racha perdedora máxima.
- Fan chart de equity bootstrap con banda p5–p95 y mediana.
- Comparación con drawdown y racha perdedora observados.
- Funciona con R / ticks / US$ y Bruto / Neto.

El módulo se presenta explícitamente como análisis de robustez y sensibilidad de secuencia, no como predicción. El remuestreo no modela cambios de régimen, dependencia temporal ni deterioro futuro del edge.
