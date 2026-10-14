# TR-VIS PR 4 — Planes, escritura y seguimiento

Inicio: 15/10/2026. Rama: `tr-vis-pr4-planes-escritura-seguimiento-20261015`, basada en `main` después del merge PR #120 `7d7d3d0e2279769cdb58679ef986abfa7066584d`.

## Alcance y propuesta conjunta

Bloque final del plan consolidado; TR-VIS-009/011/012, cierre de 015/016. No se reabren PR 1–3.

1. **Trading Plans**: título y versión + entorno/estado protagonistas, número total/elegible de operaciones, dos métricas esenciales; Abrir principal, Editar secundario, mantenimiento plegado. Preservar grupos, derivados, versiones, historial e importaciones.
2. **Hallazgos y escritura**: presentar hallazgo/decisión y seguimiento antes que sus métricas; Diario emocional y Reflexiones con historia antes de estadísticas secundarias, conservando sus distinciones y visibilidad por entorno. Perspectivas: autor y fuente legibles.
3. **Calidad**: estado compacto → problema priorizado → cola de reparación → cobertura secundaria. Diferenciar utilizable, revisión pendiente y ausencia de datos; sin recalcular puntuaciones.
4. **Estado del plan**: acciones/prioridades al principio, importancia proporcionada y vacío neutro; accesos a objetivos, revisión, OOS, riesgo y calidad, sin duplicar motores.
5. **Objetivos, Cumplimiento, Errores**: meta/progreso, cobertura evaluada/total, frecuencia; desgloses secundarios; jamás confundir no evaluado y sin errores.
6. **Cambios/alertas**: orden cronológico e interpretación legible, mecanismos destructivos secundarios; traducir etiquetas de códigos visibles.
7. **Informes**: lectura editorial por delante del configurador, plantillas plegadas sin eliminar, impresión/PDF sin cambios en documento generado.
8. Revisar estados vacíos y etiquetas transversales de estas páginas, en claro/oscuro.

## Restricciones

- Composición y CSS únicamente; preservar funciones, estados, formularios, métricas, operación real, almacenamiento y separación Backtesting/SIM/Replay/Live.
- Registrar verificaciones de preexistencia sin cambios innecesarios.
- PR único en borrador, no fusionar hasta aprobación expresa.
- Un preview de revisión con commit; tres recorridos conjuntos:
  - 4A Planes → cambiar entorno → Diario/Reflexiones → Hallazgos.
  - 4B Estado del plan → Calidad → Objetivos → Cumplimiento/Errores → Alertas.
  - 4C Informes → plantilla → vista previa/imprimir; TP vacío y nombres largos.

## Estado inicial

- Base y rama identificadas, diseño por alcance propuesto; todavía no existe implementación ni CI del bloque.
- Verificado: `plansView`, `reviewView`, `journal`, `dataQualityView`, `researchDecisionCenter`, `goalsView`, `complianceView`, `mistakesView`, `researchChangesView`, `v313BuilderView` y `reportsView` existen en código base. Evitar reescribir sus motores.
- Siguiente paso: crear adaptador de presentación, test de estructura y preservación de acciones, ejecutar CI.


## Checkpoint de implementación 01 — 15/10/2026

**PR:** [#121](https://github.com/patrickgranell/trading-research/pull/121), borrador, sin merge. Rama `tr-vis-pr4-planes-escritura-seguimiento-20261015`, base `main` con PR #120 integrado.

**Paquetes abordados en código de presentación:** catálogo de TP (acciones y métricas secundarias plegadas), Review/Hallazgos (texto antes que KPIs), Diario (filtros) y Reflexiones/Perspectivas del nuevo módulo emocional V31.29 (texto/autor/fuente), Calidad (resumen → incidencias → cola → cobertura), Centro de decisiones (prioridades), Objetivos/Cumplimiento/Errores (progreso, cobertura y frecuencia), alertas (cronología y mantenimiento), Informes (documento editorial antes de plantillas/configuración). Se reutilizan nodos existentes y se comparan inventarios en tiempo de renderizado: ninguna acción ni campo puede desaparecer.

**Estado sin datos detectado y corregido:** una vista heredada de Diario intentaba `.toFixed` sobre estadísticas emocionales nulas, y el agrupador por emoción intentaba formatear expectancy nula. La transformación de build sustituye solamente la representación por '—', no la fórmula; la interfaz nueva de Diario ya emplea su presentación actual.

**Pruebas:** `verify-tr-vis-pr4-browser.mjs` (10 vistas e inventarios, más fixtures de Reflexiones y Perspectivas), `verify-tr-vis-pr4-print-browser.mjs` (imprimir informe de prueba de varias páginas a PDF con Chrome aislado). Se han corregido errores de reparentado detectados en CI. Los PR 1–3 mantuvieron PASS en las primeras ejecuciones. En una ejecución posterior, TR-UX-026 tuvo fallo transitorio del headless browser por ausencia de CSS computado; repetición de suite en curso.

**Restricciones y pendientes:** todavía no hay CI verde para la última cabeza ni confirmación del despliegue del preview. Comprobar con fixture de TP sin operaciones, entornos Backtesting/SIM/Replay/Live, texto largo, archivos/derivados, tema claro/oscuro; impresión/PDF real. No declarar PASS visual definitivo sin esas pruebas. No modificar producción.

**Siguiente acción:** esperar CI del commit `c63f8fe9` (o posterior), corregir cualquier test fallido dentro de #121, documentar casos y entregar preview único para recorridos 4A–4C. Autorización de merge: **NO**.
