# TR-VIS PR 3 — Investigación y evidencia visual

Fecha: 14/10/2026. Rama: `tr-vis-pr3-investigacion-evidencia-20261014`. Base: `main` tras PR #119, merge `b9fb6a963c98d35d8f00cd7b82a44d2eba26145a`.

## Alcance aprobado para iniciar

Seis paquetes **dentro de un único PR en borrador**, no seis PR:
1. Laboratorio (TR-VIS-006): contexto y pestañas delante de filtros; filtros completos plegables; estado de muestra visible.
2. Constructor (TR-VIS-002): fuente → filtros → comparación original/resultante → crear derivado, campos en retícula.
3. Segmentación y Validación (TR-VIS-007): n/escala/insuficiencia separados del rendimiento; OOS, IC95, bootstrap solo con evidencia disponible.
4. Biblioteca visual (TR-VIS-008): captura completa y comparador 2/3/4, filtros secundarios.
5. Market Data: recorrido protagonista, requisitos compactos, Calibración/Vinculación/Recorrido/Best Exit sin pérdida.
6. Accesibilidad, inventarios de herramientas, categorías largas, estados vacíos y ambos temas.

## Invariantes

- No tocar métricas, cálculos, reglas de elegibilidad ni persistencia.
- Mantener todos los filtros y taxonomías, días de semana, estudios guardados, distribución de entornos; sin imponer Backtesting→Live.
- Market Data se mantiene excluido de Backtesting.
- No alterar lo cerrado en PR #1 y PR #2; no publicar en producción.
- No merge hasta autorización explícita del usuario.

## Decisión de composición inicial

Se conservarán las cinco pestañas de Laboratorio creadas en Astra Lote 6 (Resumen, Segmentación, Salidas, Validación, Riesgo). Se adelantará navegación y muestra frente a los filtros, reubicados en un único grupo desplegable que conserva controles y estado.

No se reescribirán los motores Market Data; se conservarán sus cuatro tareas y se priorizará la sección de recorrido sobre la introducción extensa.

## Recorridos conjuntos de aceptación

- 3A: Laboratorio, filtros plegables, cambiar herramienta, Segmentación y Validación (n, escala, OOS).
- 3B: Constructor, origen, filtros, diferencia de muestras y CTA de derivación; demostrar independencia.
- 3C: Biblioteca, ampliar y comparar 2/3/4 capturas; desde operación elegible acceder a Recorrido de Market Data.

## Checkpoint de ejecución

- Estado actual: inicio. Base identificada y rama creada.
- Se ha constatado que Astra Lote 6 ya ofrece cinco pestañas de Lab y cuatro de Market Data; no duplicarlas.
- Paquetes completados: ninguno.
- Pruebas realizadas: inspección estática de `build.mjs`, `astra-lote6-research-runtime.js`, `verify-astra-lote6-browser.mjs`; todavía no hay CI de PR 3.
- Inventario antes/después y despliegue: pendientes de fixture Chromium.
- Autorización de merge: **pendiente**.
- Siguiente acción: implementar reorganización no destructiva de Laboratorio, probar conservación de filtros y tab panels, luego seguir por Constructor/Validación, Biblioteca y Market Data.
