# TR-VIS · Checkpoint PR 2 — Operativa y resumen

Fecha: 13/10/2026.
Base: `main` en `722a069015faace439892f49639d99094d3d3485` (PR #118 integrado).
Rama: `tr-vis-pr2-operativa-resumen-20261013`.
PR: https://github.com/patrickgranell/trading-research/pull/119 (**Draft / sin merge**).
Commit funcional validado: `998e06b72b410370f74fb6e78b5080458a5f7217`.
CI PASS: https://github.com/patrickgranell/trading-research/actions/runs/38426703573
Cloudflare Branch Preview al mismo SHA: https://tr-vis-pr2-operativa-resumen-20261013-trading-research.tradingresearch.workers.dev

## Alcance del documento fuente
`Plan-Trabajo-Trading-Research-PR-Consolidados(1).md`, apartado 4:
TR-VIS-004/005/010/013/014, TR-VIS-007 en Dashboard/Bloques, TR-VIS-015 en estas vistas.
No alterar fórmulas, datos, persistencia, TP/versiones/entornos, widgets guardados, filtros ni herramientas.

## Cambios en un único PR
1. `tr-vis-pr2-operativa-runtime.js` añadido al bundle de render vía `build.mjs`. Es presentación exclusiva de Dashboard, Operaciones, Bloques, Calendario y modal de operación; navegación, métricas y storage no editados.
2. Dashboard: cuatro KPI de resultado/expectancy/PF/DD destacados **cuando figuran en el perfil**; secundarios menos prominentes; Equity con más altura y opción reversible «Ampliar curva a 2/3» cuando son dos paneles 6/6. La opción no reescribe las dimensiones guardadas. Personalizar, perfiles y tamaños permanecen intactos. Si el usuario ocultó «Resultado» en el perfil, no se añade silenciosamente.
3. Operaciones: «Vista compacta / Vista completa» junto al configurador del PR1. Compacta conserva fecha y hora unidas en la columna de fecha, mantiene símbolo/dirección/setup/resultado y deja las demás columnas recuperables con Vista completa. No borra columnas ni datos, no modifica preferencias de columnas ni su orden. Presentación de resultados alineada a la derecha.
4. Bloques: reordenar por n (elegibles), resultado, expectancy, DD, curva. Las otras 3 métricas se conservan en `details` desplegable; acciones originales permanecen. El último bloque incompleto muestra fracción de registros sobre 20. Escala de cada minicurva es propia, explicitada; tabla comparativa detallada intacta.
5. Calendario: información del día, métrica y conteo `n=` visibles; «Sin actividad», «No evaluado» y «0» separados. Cuando el estado de calendario y las funciones canónicas están disponibles, el carácter no evaluado se toma de la **misma elegibilidad de la métrica** que usa el motor; no introduce nuevo cálculo. Leyenda y KPI mensuales más claros. Calendarios de cinco/seis semanas preservados.
6. Modal Nueva/Editar operación: contexto de TP más compacto, retícula de campos responsiva y pie Guardar/Cancelar sticky; no cambia campo, handler, validación ni valores iniciales.
7. `styles.css`: overrides scoped para ambas apariencias y varias anchuras.

## Verificación técnica
- `npm run prebuild`, `npm run build`, CSP, integridad y protección de filtros: PASS.
- Test `verify-tr-vis-pr2-browser.mjs`: Dashboard con y sin toggle de 2/3; perfiles con `dashboard-span` original conservado; Operaciones con 19 celdas inalteradas y compacta recuperable; 45 registros divididos en 3 bloques con último 5/20; 42 días (6 semanas), ausencia de actividad, n=0 evaluables y cero; modal con campos y botones originales; ruta Laboratorio sin decoración: PASS.
- Regresiones Chromium Lotes 2–8 y PR1 (Dashboard/Registro, tema, filtros, columnas): PASS.
- La validación es sintética/automática; no sustituye los tres recorridos humanos.
- En una ejecución previa hubo foco intermitente de Lote 8 a ancho 500; la ejecución siguiente pasó sin editar esa funcionalidad.
- Checkpoint documental: no editar datos de usuario, no restaurar backup en producción.

## Pendientes para aceptar PR 2
- **2A** Dashboard → Operaciones: KPI, lectura de Equity y tamaño 2/3 opcional, cambio unidad/base, Vista compacta y vuelta a Vista completa, Ver/Editar.
- **2B** filtros → Calendario → Bloques: inventario completo filtros/columnas, periodo, seis semanas, bloque incompleto, detalles y curva; pruebas en claro/oscuro.
- **2C** Nueva/Editar operación (abrir/cancelar sin guardar), Dashboard personalizado existente, TP vacío. Comprobar formulario sin wizard, Sin clasificar, guardado/edición en fixture solo si afecta al formulario.
- Confirmar visualmente que el énfasis sin alterar el layout guardado es aceptable. Si se quiere una disposición 2/3 por defecto, decidirla explícitamente por perfil y sin pisar personalizaciones.
- Incidencias durante revisión se resuelven **en PR #119**, no se crean PR adicionales ni se fusiona sin autorización expresa.
