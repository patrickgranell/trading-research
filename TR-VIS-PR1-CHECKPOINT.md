# Checkpoint TR-VIS PR 1 — 13/10/2026

## Referencias
- Repositorio: `patrickgranell/trading-research`
- Rama base: `main`, SHA inicial `3f325f657f95a5dc30fcc4098e43030e75db7bba` (Lote 8 integrado)
- Rama: `tr-vis-pr1-sistema-visual-20261013`
- PR de revisión: https://github.com/patrickgranell/trading-research/pull/118 (**draft**, no merge autorizado)
- Commit funcional y CI web aprobado: `bd6fedd03c0a2c5a639bf6a14a19337d389255a9`
- CI web: https://github.com/patrickgranell/trading-research/actions/runs/38396956243 (PASS)
- PR Desktop #117 permanece fuera de alcance.

## Paquetes implementados
- Roles visuales piloto página 24/32, panel 16/24, controles 14/20, ejes y metadatos 12.
- Ejes y leyendas: contraste comprobado sobre fondo real en ambos temas.
- SVG Equity de Dashboard: adaptación de `preserveAspectRatio="none"` a `xMidYMid meet`, sin alterar puntos ni escalas.
- Intratrade: corrección de fondo blanco accidental en modo oscuro; ejes legibles en ambos temas.
- Navegación: selector de TP fijo en columna y destinos desplazables sin alterar sus IDs, rutas o apertura guardada.
- Estado vacío del Centro: ausencia real de operaciones representada sin prioridad estadística; no cambia calidad ni otros motores.
- Nuevo gate estático `verify-tr-vis-pr1.mjs` integrado en build, prueba de Chromium `verify-tr-vis-pr1-browser.mjs` en CI; prueba heredada Lote 3 alineada con título «Estado del plan».

## Verificación web
CI `Validate Trading Research` PASS en `bd6fedd0`:
- npm prebuild/build, CSP, contratos: PASS;
- contraste estático del PR: PASS;
- Chromium del PR (SVG/temas/intratrade/vacío/scroll): PASS;
- Chromium Lotes 2–8, controles, filtros, comparaciones e iconos: PASS.
**Límites:** es smoke sintético y CI de regresión, no revisión visual humana en la aplicación completa. No hay despliegue preview ni certificación 1A/1B/1C aún.

## Decisión conjunta de arquitectura pendiente de revisión
Propuesta derivada del plan consolidado:
- **Operativa:** Operaciones, Bloques, Calendario. Biblioteca podría estar aquí si se prefiere una consulta orientada a operaciones; acceso desde Investigación en cualquier caso.
- **Investigación:** Laboratorio, Constructor de TP, acceso contextual a Biblioteca.
- **Seguimiento:** Estado del plan (destino `decision`), Cambios y alertas (`changes`), Hallazgos y decisiones (`review`), Objetivos, Revisión de ejecución, Informes.
- **Datos y ejecución:** Calidad de datos, Market Data (oculto solo en Backtesting).
- **Plan y sistema:** Trading Plans, acciones de plan cerca del selector. Configuración global al pie.
Mantener Diario emocional como módulo vertical único, con pestañas propias, y Revisión de ejecución con navegación interna. Sin duplicar accesos ni modificar IDs de ruta.

## Pendientes dentro de PR 1
- Decidir la composición conjunta del menú y la variante de marca (sin adelantar reposicionamientos).
- Integrar en este PR la ubicación aprobada; comprobar rutas, accesos contextuales y entornos.
- Revisar Unidad/Base/Gestión como grupos indivisibles, hover/focus/disabled y contrastes en contextos reales.
- Extender el patrón vacío/insuficiente si se verifica evidencia; no fabricar métricas.
- Recorridos humanos 1A, 1B y 1C sobre una preview de commit identificado; sin merge previo.
- Registrar inventario de filtros, campos y columnas antes/después y pendientes que no se puedan certificar.

## Autorización
No hay autorización de merge ni despliegue a producción. Mantener el mismo PR en borrador. Tras la decisión visual conjunta, continuar sobre la misma rama y repetir únicamente las regresiones afectadas además del build.

## Incidencias visuales aportadas durante la revisión — actualización del PR 1
- Captura de Market Data (tema oscuro): históricos y Grid de calibración se veían blancos. Causa confirmada en `styles.css`: `.md-dataset` y `.md-cal-controls` heredaban `var(--card2,#fff)` sin token `--card2` definido. Corrección scoped para modo oscuro en `styles.css`; conserva blanco en tema claro, acciones, datos y estados de selección.
- Se solicita que «+ Nueva operación» e «Importar Ankora» estén **solo en Operaciones**. Se centralizan en la presentación de rutas en `astra-lote3-navigation-runtime.js` sin eliminar los handlers ni crear CTA alternativos. Se preservan botones de Personalizar y otras acciones. Se aplica a Dashboard, Bloques, Biblioteca y cualquier otro destino no-Operaciones; se conservan los originales en Operaciones.
- Regresiones añadidas a `verify-tr-vis-pr1.mjs` y `verify-tr-vis-pr1-browser.mjs`, con comprobación real de estilos calculados en Chromium para superficies de Market Data dark/light y presencia/ausencia de CTA por ruta.
- Commit con validación web PASS: `df0c7b2cfa8e3b8be3ca7808c9811e71a2b68f07`; https://github.com/patrickgranell/trading-research/actions/runs/38415029879

### Pendientes informados anteriormente y aún NO cerrados
- Personalizador Dashboard: alineación de flechas y cuadrados/checkboxes; todavía sin corrección ni revisión visual humana.
- «3 Operaciones» en Dashboard frente a «10 visibles» en Registro: requiere investigar alcance/universo efectivo en datos de prueba; no alterar fórmula ni contar de otra forma por extrapolación.
- Columnas configurables (orden, mostrar/ocultar) en listado de operaciones: petición funcional a especificar e incluir en PR 2 si procede; no introducida silenciosamente en el PR 1.
- Comprobación visual humana en la preview y organización del menú del PR 1 siguen pendientes.

No hay autorización de merge ni despliegue en producción. Preview de rama se mantiene en la URL comunicada por Cloudflare; verificar el SHA realmente desplegado antes de dar una nueva prueba al usuario.

## Seguimiento 13/10/2026 · TR-VIS-PR1-01 / 02
- **TR-VIS-PR1-01 — Personalizador desalineado:** CSS scoped en `styles.css` para cada `.modal .dashboard-config-row`. El nombre y checkbox ocupan una línea, y select y flechas comparten otra con altura, ancho y alineación definidos. Comprobación Chromium de doce filas y tres columnas de 760px, sin solapes/desbordamientos, PASS. Pendiente verificación visual del usuario en la preview.
- **TR-VIS-PR1-02 — 3 vs 10 operaciones:** el modelo actual alimenta Dashboard desde `currentOps()` y Operaciones desde `filteredOps()`, derivado de `currentOps()`. Se añadió `verify-tr-vis-pr1-counts-browser.mjs` ejecutado en Chromium sobre `dist/index.html` con aislamiento de perfil: se crean diez operaciones para el mismo Trading Plan (3 ganancias y 7 pérdidas), y se valida Dashboard KPI **10** / win rate **30%** / Registro sin filtros **10 filas**. Prueba PASS. **La discrepancia concreta de la captura (3 vs 10) NO ha sido reproducida ni explicada** con los datos de sesión del usuario; no se alteraron cálculos ni base de datos. Conservar como incidencia abierta hasta revalidar en su preview con los datos reales.
- Cambio correctivo incorporado en mismo PR, sin otros PR/merges. `Market Data` dark/theme y botones de registro exclusivos de Operaciones corregidos previamente. Columnas movibles/visibles: backlog.
- **CI completo PASS** en commit `100eaf244991a7d3b0053543443f72807343b6b3`: https://github.com/patrickgranell/trading-research/actions/runs/38417706330
- **Cloudflare confirmó despliegue de la rama a ese commit** (comentario en PR #118): https://tr-vis-pr1-sistema-visual-20261013-trading-research.tradingresearch.workers.dev
- PR sigue en borrador, sin merge. No se considera certificado hasta revisión visual, aclaración de la discrepancia del usuario y cierre conjunto del menú.
