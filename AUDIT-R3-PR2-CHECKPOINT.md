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
