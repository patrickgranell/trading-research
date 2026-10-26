# Auditoría R3 · PR 2 · CP-05/06
Fecha: 26/10/2026 (Europe/Madrid). Rama: audit-r3/pr2-ficha-importacion-journal.
Base: main fe4c83a52a56c94a30e78fd6ba1aa13f1b91a153 (merge #123).

CP-05.1 inventario: app.js V30.1 ya registra MFE/MAE primarios en ticks, R derivada y estados medido/ausente/N/A. tr-pr2-operation-lots-runtime.js ya soporta salida distinta por lote, cantidad, pendiente y cierre por último lote. El importador Ankora (TXT separado por |) ya ofrece RAW, preview, insert/update/skip/conflict y editor normalizado; verify-ankora-idempotency.mjs prueba conservación de anotaciones y reimportación, pero no un fichero real.

Fixture de trabajo: fixtures/audit-r3-pr2-ankora-SYNTHETIC.txt contiene dos filas **ficticias**, una con dos lotes y salidas independientes y otra con resultado cero. No representa exportación real del usuario ni certificación del importador. Usar perfiles/datos aislados, nunca datos de producción.

Primera implementación:
- CP-05.2 parcial: reordenación no destructiva de formulario (entrada/salida/régimen/lotes antes de clasificación), conservando nodos, valores, IDs y eventos originales.
- CP-06.1 parcial: añade Contexto H4, Fase H4, Tipo de operación, Precio entrada, MFE/MAE ticks, R neta y P&L bruto como columnas opt-in en Registro/Laboratorio, junto con familias en su selector, respetando la libre ordenación y preferencias históricas.
- CP-06 pendiente: Cumplimiento todavía tiene tabla fija; quedan revisión de taxonomías y otras listas.

Estado: cambios de primera fase en rama, NO certificados ni validados por usuario. Falta CI, prueba E2E de fixture y edición/reimportación, comprobar pendientes/lotes y terminar CP-05/06. No presentar lote hasta completar revisión técnica conjunta, y NO fusionar sin autorización.

Próximo paso: verificar CI y comportamiento en navegador; completar columnas Cumplimiento/catálogo; preparar una sola preview web para revisión del usuario.

## Corrección de compatibilidad / CI inicial
- La ficha real utiliza «2 · Clasificación de la oportunidad» (taxonomía canónica). El adaptador ahora la detecta sin sensibilidad a mayúsculas y reconoce sus secciones ya reorganizadas.
- Primer CI de web: build completo PASS; Chromium Lote 8 falló una vez a 500px durante hidratación de dos operaciones sintéticas; rerun superó Lote 8 y encontró que la prueba UX104 exigía exactamente 21 columnas, incompatible con las ocho columnas nuevas. Se actualizó esta aserción para verificar las 29 cabeceras, sin reducir la cobertura de columnas existentes. Esperar nueva ejecución verde.

## CP-06.1 · Taxonomías en columnas
Registro y Laboratorio exponen como opt-in taxonomías personalizadas presentes en el TP, usando IDs estables, conservando valores históricos si se archivan. Etiquetas escapadas para nombres editables. La lectura del registro no escribe en el TP. Pendiente validación automática y visual.

## CP-06.2 · Cumplimiento (implementación pendiente de certificación)
- «Operaciones evaluadas» conserva sus ocho celdas originales y sus acciones, pero añade catálogo dinámico de otros campos y taxonomías personalizadas. Preferencias de columnas por TP con ocultación, reordenación (flechas/arrastre) y restauración. «Análisis por regla» gana ancho útil.
- El adaptador no cambia criterios de evaluación, importaciones, métricas ni filtros. Comprobar en CI: cabeceras, filas vacías, valores, persistencia y acciones. No darlo por cerrado hasta navegador.

## Prueba de columnas adaptada sin perder regresiones
La regresión anterior exigía 21 columnas y que el nuevo TP no ocultara ninguna; ahora la configuración conserva las 21 columnas previas visibles y añade ocho campos nuevos ocultos por defecto. La prueba exige 29 columnas, verifica los ocho nuevos IDs, aislamiento de preferencias y 31 columnas con dos lotes, sin relajar comprobación de Acciones ni orden.

## Puerta de navegador añadida
verify-audit-r3-pr2-browser.mjs: usa únicamente fixture aislado y comprueba orden de ficha, conservación de IDs/campos/lotes, taxonomía propia como columna, Cumplimiento y preferencias. Incluido en workflow CI tras pruebas de columnas; resultado pendiente al subir cambios.

La prueba real de Chromium pasó orden de ficha, nodos originales, lotes, catálogo de 20 columnas, taxonomía, persistencia y datos sin mutación; falló por buscar el atributo heredado `data-tr-onclick` tras normalización del motor de acciones. Se cambió la aserción para comprobar el botón visible «Ver» en la celda Acciones, sin alterar la implementación.

## CP-05.3 · Política explícita de enriquecimiento Ankora
Para actualizaciones RAW con misma identidad: los datos de ejecución siguen siendo fuente, mientras que notas, Setup, VD, NR, hipótesis, Contexto y Tipo editados localmente prevalecen sobre los nuevos valores RAW. Los campos normalizados que nunca fueron editados sí pueden actualizarse desde el fichero. La versión RAW/fingerprint conserva los valores originales. Un cierre declarado con 0 ticks se clasifica como neutro; 0 sin fecha de salida permanece pendiente. Añadidos casos a verify-ankora-idempotency.mjs. Esto aún requiere CI y ensayo del fixture sintético con el flujo de importación visual.

## Resolución de guardas arquitectónicas · integración Ankora
Intento inicial de cambiar app.js rechazado por hash del source anterior a contratos. Se restaura su blob canónico inalterado y la suite estructural intacta. El comportamiento de enriquecimiento/local RAW y cero medido se implementa en audit-r3-pr2-ankora-runtime.js sobre el contrato de importación y queda cubierto en el Chromium integrado con el fixture sintético. No se han modificado datos existentes.

## CP-06.3 · Catálogo de ejes + familias semánticas (cambio pendiente CI)
- El origen de AR-29 es verificable en taxonomy-runtime.js: el adaptador añade todas las taxonomías core a las opciones legacy del desglose, duplicando Setup, VD, NR e Hipótesis. Nuevo adaptador audit-r3-pr2-taxonomy-grid-runtime.js elimina únicamente representaciones duplicadas y conserva la selección histórica válida.
- El Research Grid original no presenta ejes de taxonomías personalizadas. El adaptador los añade con valor canónico por ID, etiqueta renombrable y la misma selección/filtro de Laboratorio. Las no clasificadas se omiten de ejes de taxonomía y se informa cobertura n/N. Se respeta restauración de filtros y no se alteran resultados OOS.
- Selectores de columnas de Registro/Laboratorio/Cumplimiento incorporan botón por familia, sin quitar reordenación libre ni permitir ocultar todas las columnas.
- Validación pendiente: eje → celda → filtro → reapertura, renombrado/archivo, contexto de TP y filtro OOS.
