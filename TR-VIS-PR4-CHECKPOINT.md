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
