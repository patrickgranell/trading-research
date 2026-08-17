# Trading Research V31.18 · Security Foundation I · User Content Boundary

Esta fase aborda la primera parte de la auditoría de seguridad de renderizado y formularios sin modificar las fórmulas financieras. A diferencia de las fases estructurales anteriores, V31.18 introduce un **delta mínimo y deliberado en `app.js`** para cerrar sinks concretos y dar nombres semánticos a los controles que ahora se leen con `FormData`.

## Cambios de seguridad

- `modalShell()` trata el título como **texto**, escapándolo en el propio sink. Esto cierra el caso concreto del título/caption del lightbox que antes podía llegar al HTML después de `decodeURIComponent()`.
- Los valores dinámicos que todavía se transportan dentro de handlers inline pasan por `inlineUriToken()`, que además codifica el apóstrofo. Esto evita usar `encodeURIComponent()` como si fuese un escape de JavaScript, cosa que no es cierta por defecto.
- Los editores principales de **Operaciones, Trading Plans, Contratos, Gestión de riesgo, Diario emocional, Reviews y Referencias visuales** leen sus campos mediante `FormData`. Los helpers `field/selectField/selectObjField` publican `name` además de `id`.
- Se añaden sondas locales de escaping, títulos de modal, tokens inline y FormData en `Configuración → Datos y seguridad`.
- `verify-security.mjs` hace obligatorias estas invariantes durante `npm run build`.

## Alcance explícito

Esta versión **no afirma haber eliminado todos los handlers inline**. El código histórico todavía contiene `onclick/onchange/oninput`; se mantienen por compatibilidad y aparecen como deuda explícita en el diagnóstico. La migración a delegación de eventos y una CSP estricta se hará por módulos en una fase posterior, en lugar de aplicar una sustitución global con riesgo de romper la UI. Tampoco se añade `DOMPurify`: los campos de usuario de esta aplicación no necesitan HTML enriquecido y la política preferida es renderizarlos como texto escapado.

## Guardia de regresión

Las 7 regiones financieras congeladas desde V31.10.4 permanecen byte-equivalentes según sus hashes. IndexedDB, Domain/UI Store, render parcial, borradores de sesión e imports atómicos siguen activos.

---

# Trading Research V31.17.1 · Structural Foundation III-B3.1a · Import Schema Closure

V31.17 detectó correctamente dos anomalías durante la primera validación real de Ankora: tras confirmar el lote quedaban mutaciones sin persistir en `setupDefinitions`/`vdDefinitions`, y al abrir Dashboard un plan reciente podía intentar crear `dashboardProfiles` durante el render. Además, el boundary no impedía que un `TRDomainStore.commit()` explícito anidado dentro de un comando mayor publicase una revisión intermedia.

## Corrección

- Toda importación durable (`Ankora` y `NinjaTrader Grid`) ejecuta la normalización de esquema **antes de cerrar el mismo `TRDomainStore.command()`**. Los Setup/VD detectados durante el import actualizan también sus definiciones enriquecidas dentro del único commit.
- `v311EnsureDashboardProfiles()` forma parte de la normalización durable, de modo que Dashboard deja de inicializar esos campos durante render.
- Un `TRDomainStore.commit()` llamado dentro de otro command boundary ya no puede publicar un segundo commit: participa en la transacción exterior.
- El histórico Tick sigue con `persist:false`, por lo que no normaliza ni modifica el dominio y debe mantener `Domain revision` sin cambios.
- No se modifica `app.js` ni ninguna fórmula financiera.

## Invariante de aceptación Ankora

Partiendo de un estado estable, confirmar un lote debe producir `Domain revision +1`, `Controlados +1`, `Legacy` sin aumento, `Mutaciones pendientes = 0`, `Estado = OK` y `efectos laterales de render = 0`. El último commit debe ser `import.ankora.commit`.

---

# Trading Research V31.17 · Structural Foundation III-B3.1 · Atomic Import Boundary

V31.16.1 corrige la anomalía observada al validar `contract.update`: el handler histórico V31.9.2 lanzaba `v319SyncExecutionSetsToOperations()` sin `await`, de modo que la sincronización objetiva de filas NinjaTrader podía reanudarse después de cerrar el command boundary y publicar un segundo commit legacy.

## Cambio

- `contract.create/update` mantiene abierto su `TRDomainStore.command()` hasta que termina la cascada asíncrona NinjaTrader derivada del guardado.
- La función histórica no se modifica en `app.js`; el runtime sustituye temporalmente esa llamada por una solicitud diferida y después ejecuta/espera la sincronización dentro de la misma transacción.
- La propagación Ankora síncrona sigue dentro del mismo boundary como en V31.16.
- Resultado esperado al editar un contrato con operaciones importadas relacionadas: `Domain revision +1`, `Legacy` sin aumentar, `Controlados +1`, `Mutaciones pendientes = 0`, último commit `contract.update`.

La corrección responde al caso observado en V31.16 donde una edición produjo `Domain revision 3 → 5` y `Legacy/controlados 2/1 → 3/2`; el segundo commit era `legacy:v319SyncExecutionSetsToOperations`.

`app.js` permanece byte-idéntico a V31.12.1 y las regiones financieras congeladas siguen protegidas.

---

# Trading Research V31.16 · Structural Foundation III-B2 · Plan Configuration Command Boundary

V31.16 extiende el patrón transaccional validado en V31.15 al segundo gran bloque de dominio: **contratos y configuración durable del Trading Plan**. Se mantiene intacta la lógica histórica; el runtime la ejecuta dentro de comandos explícitos y coalesce sus `persist()` / `render()` en un único commit, un snapshot durable y un render final.

## Comandos migrados

- Contratos: `contract.create`, `contract.update`.
- Trading Plans: `plan.create`, `plan.update`, `plan.clone`, `plan.status.update`.
- Gestión: `plan.risk-strategy.create/update`, `plan.risk-rules.update`, `plan.config.reset`.
- Taxonomías: opciones Setup/VD/NR/salidas, hipótesis, taxonomía emocional, fichas enriquecidas de Setup/VD/Contexto y referencias visuales.
- Checklist: crear, editar, eliminar y reordenar reglas.
- Errores: crear, editar, eliminar y reordenar la taxonomía explícita.
- Objetivos: crear, editar, eliminar y activar/pausar.

Los comandos de Operaciones de V31.15 permanecen activos. Imports, restauraciones y Cloud no se migran en esta fase; se reservan para un boundary transaccional específico porque reemplazan o agregan conjuntos completos de datos.

## Invariante de aceptación

Una acción durable de este bloque debe incrementar `Domain revision` **como máximo una vez** si realmente modifica datos. `Legacy` no debe aumentar, `Controlados` debe aumentar en uno, `Mutaciones pendientes` debe quedar en 0 y `Estado` debe permanecer `OK`. Las solicitudes internas legacy de persistencia/render pueden ser varias: deben aparecer únicamente como coalescidas dentro del último comando.

Pruebas recomendadas: editar la comisión de un contrato y volver a dejarla como estaba después de verificar el commit; editar una hipótesis o regla de checklist; crear/editar un objetivo; y comprobar en Datos y seguridad el nombre del último comando y el `+1` de revisión.

`app.js` permanece byte-idéntico a V31.12.1 y las 7 regiones financieras congeladas desde V31.10.4 siguen protegidas por `npm run build`.

No requiere SQL nuevo.

---

# Trading Research V31.15 · Structural Foundation III-B1 · Operation Command Boundary

Esta fase inicia la migración real de comandos de Operaciones sin reescribir todavía la cadena histórica de negocio. El objetivo es que una acción de usuario produzca **un solo commit controlado**, aunque internamente los wrappers heredados sigan solicitando varias persistencias y renders.

## Qué cambia

- `saveOperationFromForm()` queda encapsulado como `operation.create` o `operation.update`.
- Todas las mutaciones históricas derivadas del mismo guardado (checklist, Data Quality, MFE/MAE, Research Changes, Execution Evidence y journal completion) se agrupan en **un único commit DomainStore**.
- Los múltiples `persist()` históricos del guardado se coalescen en **un único snapshot durable** del estado final.
- Los múltiples `render()` históricos del guardado se coalescen en **un único render final**.
- Abrir/editar una operación se clasifica como acción UI; si hay que cambiar de Trading Plan, reutiliza el commit controlado `plan.switch`.
- También pasan por comandos controlados: diario emocional, edición rápida de importadas, Data Quality Workbench y vincular/desvincular Execution Evidence.
- Datos y seguridad muestra número de comandos, persistencias/renders legacy coalescidos y el último comando ejecutado.

## Invariante de aceptación

Editar y guardar una operación debe incrementar `Domain revision` **una sola vez** para ese guardado y el último commit debe ser `operation.update` (o `operation.create` al crear una nueva). `Mutaciones pendientes` debe volver a 0. El contador de persistencias/renders coalescidos puede subir varias unidades: eso demuestra cuántas solicitudes legacy han quedado absorbidas por el command boundary.

No se añade una eliminación individual de operaciones porque V31.14.3 no tenía ese comando en la interfaz; la eliminación por lotes de importación se migrará en la fase de Imports para no introducir funcionalidad nueva durante el refactor.

`app.js` permanece byte-idéntico a V31.12.1 y las 7 regiones financieras protegidas siguen congeladas respecto a V31.10.4.

---

# Trading Research V31.14.3 · Structural Foundation III-A2

Esta versión corrige la última anomalía detectada durante la validación de V31.14.1: algunas vistas todavía podían inicializar campos de esquema durable al navegar, haciendo crecer `Domain revision` durante acciones puramente de UI.

## Cambios estructurales

- Normalización **eager** del esquema durable una vez por workspace hidratado, antes del primer render.
- Normalización de planes: taxonomías V8, checklist, estudios, confianza, reviews, objetivos, forward tests, calidad de datos y change tracking.
- La baseline de Research Changes deja de inicializarse perezosamente durante una navegación normal.
- Cambio de Trading Plan normaliza el plan destino dentro del commit controlado antes de renderizarlo.
- Detector explícito de **render side-effects**: `render()` debe ser una proyección de solo lectura. Si una vista intenta mutar el dominio durante su composición, Datos y seguridad pasa a `Revisar`.
- Persistencia del schema normalization usa el bridge durable directamente para no activar artificialmente el wrapper histórico de change tracking.
- Sin cambios en fórmulas financieras ni en `app.js`.

## Prueba de aceptación

Tras estabilizar la carga: `Mutaciones pendientes = 0` y `efectos laterales de render = 0`. Después de guardar una operación, Domain revision puede crecer. Al cambiar únicamente filtros, pestañas o parámetros What-if, debe crecer `UI revision` sin crecer `Domain revision`.

---

# Trading Research V31.14.1 · Structural Foundation III-A

Esta versión inicia la separación formal entre **estado durable de dominio** y **estado efímero de interfaz** sin modificar `app.js` ni las fórmulas financieras.

## DomainStore

- `state` se conserva compatible con el código histórico, pero queda envuelto en un **Proxy profundo** después de hidratar IndexedDB.
- Las mutaciones profundas dejan de ser invisibles: se registran rutas, número de cambios y momento de la última mutación.
- El boundary de persistencia agrupa los cambios pendientes en un **commit observable** y publica un evento a los suscriptores.
- Se introduce `TRDomainStore.commit(label, mutator)` para migrar comandos de forma incremental sin reescribir la aplicación de golpe.
- El cambio de Trading Plan ya usa un commit explícito como primer comando durable migrado.
- Descargas/restauraciones externas se serializan mediante un lock de reemplazo para que dos sustituciones completas del workspace no se solapen.

## UIStore

- Se introduce un registro independiente para navegación, filtros de Operaciones, Market Data, Best Exit y el resto de estados de vista.
- `navigate()` y `setConfigTab()` ya pasan por `TRUIStore`.
- Los controles principales de Operaciones y Market Data se ejecutan dentro de acciones UI etiquetadas, conservando el código probado de V31.13.
- El runtime detecta también cambios UI legacy que todavía no se han migrado, permitiendo medir el progreso de la refactorización.

## Diagnóstico

`Configuración → Datos y seguridad` añade **Arquitectura de estado**, con revisión del dominio, commits observados, legacy/controlados, mutaciones pendientes, revisión UI, acciones UI/legacy y reemplazos completos de `state`. En estado normal, después de guardar una edición, **Mutaciones pendientes debe volver a 0**.

## Regresión

- `app.js` sigue byte por byte idéntico a V31.12.1.
- Las 7 regiones financieras permanecen idénticas a V31.10.4.
- IndexedDB, shell persistente, recuperación de borradores y Partial DOM siguen activos.

No requiere SQL nuevo.

---

# Trading Research V31.13 · Structural Foundation II-B

Esta versión continúa la refactorización estructural sobre V31.12.1 sin modificar `app.js` financiero.

## Cambios de render

- El shell/sidebar sigue montándose una sola vez por carga.
- En **Operaciones**, las llamadas internas a `render()` actualizan solo el hub de filtros y `#opsAnalyticsArea`; la búsqueda y los controles que ya eran incrementales siguen sin reconstruir `#view`.
- En **Market Data**, cambiar pestaña actualiza chrome/tabs/cuerpo por regiones; dentro de una misma pestaña se sustituye solo el cuerpo de Market Data.
- El **inspector tick a tick** no reemplaza el slider: actualiza únicamente el gráfico y la rejilla del inspector durante el arrastre.
- Datos y seguridad muestra contadores separados de **Full-view renders** y **Partial renders** para verificar el comportamiento.
- Se mantienen IndexedDB durable y la recuperación de borradores de operación tras F5/Ctrl+Shift+R.
- Las 7 regiones financieras protegidas permanecen idénticas a V31.10.4.

---

# Trading Research V31.12.1

## Structural Foundation II-A.1 · Recuperación de borradores tras recarga

V31.12.1 corrige una distinción importante detectada durante la validación de V31.12: conservar un formulario durante un **render interno** no puede conservarlo por sí solo durante un **F5 / Ctrl+Shift+R**, porque una recarga real destruye todo el DOM y toda la memoria JavaScript de la página.

### Qué cambia

- La última vista activa se conserva en `sessionStorage`, de modo que una recarga vuelve a la pantalla donde estabas en vez de regresar siempre al Dashboard.
- Mientras el editor de operaciones está abierto, sus controles se mantienen como **borrador temporal de sesión**.
- El borrador se actualiza en `input`, `change` y justo antes de abandonar/recargar la página.
- Tras F5 o Ctrl+Shift+R se reabre automáticamente el editor de la misma operación y se restauran campos, selects, checks, foco, selección del cursor y scroll del modal.
- El borrador recuperado **no se guarda como operación**: sigue requiriendo pulsar `Guardar operación`.
- `Cancelar` elimina el borrador. Un guardado correcto también lo elimina.
- Los archivos elegidos en `<input type=file>` no se pueden reconstruir tras una recarga por las restricciones de seguridad del navegador; si existían, el aviso de recuperación pide seleccionarlos de nuevo.
- Se conserva la protección anterior para renders internos de la misma vista y el shell persistente.

### Persistencia

El borrador usa `sessionStorage`, no el IndexedDB del workspace. Es deliberado: se trata de estado de interfaz temporal, pequeño y específico de la pestaña, no de datos financieros confirmados. El `state` y sus snapshots continúan en IndexedDB.

### Prueba recomendada

1. Abrir `Operaciones → Editar`.
2. Escribir una frase nueva en `Notas` sin guardar.
3. Pulsar F5. Debe volver a la misma vista, reabrir el editor y mostrar la frase acompañada de `Borrador recuperado tras la recarga`.
4. Repetir con Ctrl+Shift+R.
5. Pulsar `Cancelar`, volver a recargar y comprobar que el borrador ya no reaparece.
6. Repetir una tercera vez, pulsar `Guardar operación`, recargar y confirmar que el dato ya proviene del workspace durable, no del borrador.

### Guardia de regresión

`app.js` permanece byte por byte igual a V31.12. Las 7 huellas financieras congeladas desde V31.10.4 siguen siendo obligatorias en `npm run build`.

No requiere SQL nuevo.

---

# Trading Research V31.12

## Structural Foundation II-A · Shell persistente + router central

Esta versión continúa la refactorización estructural sin modificar la lógica financiera. V31.11 ya movió el workspace a IndexedDB; V31.12 cambia el coordinador de render para que la aplicación deje de destruir sidebar, selector de plan, apariencia y shell completo en cada actualización.

### Qué cambia

- Se introduce `structural-runtime.js` como primer módulo de runtime separado del histórico `app.js`.
- El shell completo se monta una sola vez por carga normal.
- `render()` pasa a usar un router central de 18 vistas y sustituye únicamente `#view`.
- La sidebar se sincroniza de forma incremental: vista activa, grupo abierto, selector de Trading Plan, tema y contador de Cambios.
- Si un render de la misma vista ocurre mientras el usuario está escribiendo en un input/textarea/select, se conserva el valor del formulario, el foco, la selección del cursor y la posición de scroll.
- Se mantienen los hooks de hidratación de imágenes y ayuda contextual.
- `Configuración → Datos y seguridad` añade un diagnóstico del motor de render. En una sesión normal `Shell mounts` debe permanecer en **1** aunque navegues o cambies filtros.

### Qué NO cambia todavía

- Las vistas internas siguen regenerando su propio `#view` completo. La siguiente etapa migrará módulos concretos (Operaciones, Dashboard, Market Data, etc.) a renders parciales.
- Los handlers inline históricos siguen existiendo. Se eliminarán progresivamente cuando cada vista tenga su controlador delegado.
- No cambia ningún cálculo financiero, persistencia, Market Data, Best Exit ni SQL.

### Prueba recomendada

1. Recargar y comprobar `Configuración → Datos y seguridad`: IndexedDB debe seguir en `OK` y el motor de render debe indicar `Shell persistente`, `Shell mounts = 1`.
2. Navegar por Dashboard → Operaciones → Market Data → Bloques → Configuración. `Shell mounts` debe seguir siendo 1 mientras `Renders de vista` aumenta.
3. Abrir una vista con un campo de texto, escribir sin guardar y provocar un render de esa misma vista (por ejemplo mediante una actualización secundaria compatible). El foco y texto no deben desaparecer.
4. Revisar Dashboard, Bloques y Best Exit para confirmar que las métricas siguen idénticas.

### Guardia de regresión

`npm run build` conserva las 7 huellas financieras congeladas desde V31.10.4 y añade verificaciones del nuevo runtime: router central, shell persistente y continuidad de inputs.

No requiere SQL nuevo.

---

# Trading Research V31.11

## Structural Foundation I · Persistencia durable

Esta versión inicia la refactorización estructural sin añadir ni modificar lógica financiera. El objetivo de V31.11 es sacar el workspace principal y los snapshots grandes de `localStorage` y convertir IndexedDB en la persistencia primaria.

### Qué cambia

- `state` se migra automáticamente a IndexedDB (`tradingResearchCoreV1`).
- Los snapshots locales de seguridad pasan al mismo motor durable, en un store separado.
- Las escrituras se serializan en una cola para evitar carreras entre guardados consecutivos.
- `localStorage` deja de almacenar el workspace completo tras confirmar la migración; se conserva para configuración pequeña y como fallback explícito si IndexedDB no puede inicializarse antes de migrar.
- Si una escritura falla, la aplicación muestra un aviso persistente y un `alert` una sola vez por sesión: no puede aparentar que el guardado fue correcto.
- Si el navegador ya fue migrado pero IndexedDB no puede abrirse, la aplicación entra en modo de protección y no presenta un workspace vacío como si fuese real.
- La primera carga después de instalar V31.11 puede mostrar brevemente `Cargando workspace…` mientras se confirma la migración.
- `Configuración → Datos y seguridad` muestra el motor activo, último guardado, snapshots y estado de persistencia.

### Guardia de regresión

`npm run build` ejecuta primero una verificación estructural. El build falla si:

- reaparece una escritura directa de `state` a `localStorage`;
- desaparece el bootstrap IndexedDB;
- cambia cualquiera de 7 regiones financieras críticas congeladas respecto a V31.10.4 (`riskCalc`, calibración Market Data, recorrido intratrade, cronología y Best Exit).

Esto no sustituye las pruebas visuales/manuales, pero impide que esta fase de almacenamiento modifique accidentalmente los cálculos que ya estaban validados.

### Prueba recomendada tras desplegar

1. Abrir V31.11 y comprobar que siguen presentes los planes, las 10 operaciones y los datos de Market Data.
2. Recargar la página completamente. Todo debe seguir idéntico; esta segunda carga ya debe venir desde IndexedDB.
3. Ir a `Configuración → Datos y seguridad` y comprobar `IndexedDB · durable` y `Estado OK`.
4. Editar un campo cualitativo de una operación, guardar y recargar para verificar persistencia.
5. Revisar Dashboard, Bloques y dos operaciones de Best Exit para confirmar que métricas y curvas no han cambiado.

No requiere SQL nuevo.

---

## NinjaTrader Grid → Operaciones

Esta versión mantiene la sidebar compacta V31.8.1 y conecta de forma explícita la capa de ejecución de NinjaTrader con el registro normal de Operaciones.

### Cambios

- Cada trade cerrado de un Grid NinjaTrader importado crea una operación normal en el Trading Plan activo.
- La operación nace con los datos objetivos disponibles: fecha/hora, contrato, dirección, cantidad, precio de entrada/salida, resultado en ticks y, si existe histórico Tick asociado, MFE/MAE.
- Setup, VD, NR, hipótesis, contexto H4 y régimen de gestión quedan vacíos y marcados como pendientes para completar manualmente.
- El origen se muestra como NinjaTrader · Replay / Sim / Live.
- Replay, Sim y Live continúan aislados en Market Data. Una operación Ankora o manual que no exista en el Grid no aparece por arte de magia en Market Data.
- Los Grids ya importados en V31.8.1 se migran al arrancar y crean sus filas faltantes sin obligar a reimportar el CSV.
- Se usa una huella estable de ejecuciones para evitar duplicar operaciones si se vuelve a importar el mismo Grid.
- Si ya existe una operación preparada como Pendiente NinjaTrader con un match muy alto, no se crea un duplicado: se conserva el flujo de revisión/vinculación.
- Al editar una operación creada desde NinjaTrader se conserva su Execution Evidence.

### Nota de métricas

Mientras una operación NinjaTrader no tenga régimen/riesgo inicial asignado, su columna R se muestra como «—» en el registro. Los ticks y los fills sí son evidencia objetiva desde el momento de la importación.

No requiere cambios SQL.

## Build

```bash
npm run build
```


## V31.9.1 · Comisión desde la biblioteca de contratos

- Las operaciones NinjaTrader usan la comisión round-turn configurada en `Configuración → Contratos`, aunque el CSV no incluya una comisión útil.
- El contrato se resuelve por símbolo raíz: por ejemplo `MCL 08-26` coincide con `MCL`.
- La comisión se aplica a Replay, Sim y Live y se multiplica por la cantidad ejecutada.
- El P&L neto se recalcula como P&L bruto menos comisión.
- Las operaciones NinjaTrader ya creadas en V31.9 se corrigen automáticamente al arrancar mediante la sincronización existente; no hace falta reimportar el Grid.
- Al editar los campos cualitativos de una operación NinjaTrader, la sincronización vuelve a imponer los datos objetivos del fill y su comisión para que no se pierdan.

No requiere cambios SQL.


## V31.9.2 · Ankora usa la misma biblioteca de contratos

- Las operaciones importadas desde Ankora resuelven el símbolo raíz del contrato contra `Configuración → Contratos` (por ejemplo `MCL 08-26` → `MCL`).
- La biblioteca global pasa a ser la fuente de `tick value` y comisión round-turn también para Ankora.
- Se recalculan P&L bruto, comisión y P&L neto usando cantidad × comisión por contrato.
- Las operaciones Ankora ya existentes se corrigen automáticamente al arrancar; no hace falta reimportar el TXT.
- Al editar tick value o comisión de un contrato, las operaciones importadas de Ankora y las filas autoimportadas de NinjaTrader se resincronizan.
- Las operaciones manuales permanecen fuera de esta resincronización automática.

No requiere cambios SQL.


## V31.9.3 · Equity cronológica

- La curva de equity del Dashboard deja de usar el orden de inserción/importación del array de operaciones.
- Ankora, NinjaTrader y operaciones manuales se mezclan por la fecha/hora real del fill de entrada (`entryDate`; en NinjaTrader se prioriza `Execution Evidence.entryDate`).
- Si dos operaciones tienen la misma entrada, se desempata por salida y luego por ID estable.
- La curva arranca visualmente en 0 antes del primer trade.
- El drawdown del Dashboard se calcula sobre esa misma secuencia cronológica.
- El registro de Operaciones puede seguir mostrándose de más reciente a más antiguo: eso es solo presentación y no altera la secuencia de la equity.
- Mantiene el backfill de comisiones/tick value de V31.9.2 para Ankora y NinjaTrader.

No requiere cambios SQL.


## V31.9.4 · Cronología canónica de gráficos
- Toda curva acumulativa y todo MDD/MDU se calcula en el orden real del fill de entrada.
- Execution Evidence tiene prioridad temporal sobre el orden de creación/importación.
- Bloques de 20 trades se forman cronológicamente.
- Equity de Dashboard, Operaciones, Bloques e Informes parte visualmente de 0.
- Simulador de gestión y Exit Lab conservan el emparejamiento operación a operación en el mismo orden temporal.
- Heatmaps, histogramas, distribuciones y recorrido intratrade no se fuerzan a una secuencia artificial porque su eje ya representa otra magnitud.

## V31.10 · Best Exit / What-if intratrade

- Market Data añade una cuarta fase: **Best Exit / What-if**.
- Reutiliza exactamente la misma ventana calibrada entrada → salida real; no usa datos post-cierre.
- El recorrido de precio sigue siendo Last. Para analizar una salida hipotética se usa el lado marketable del quote: **Bid para cerrar un LONG y Ask para cerrar un SHORT**.
- Muestra fill real, máximo y peor quote de salida observado, gap/giveback, captura del máximo, tiempo hasta el máximo y tiempo posterior hasta el cierre.
- Incluye salidas por tiempo (25/50/75 % de la duración real), TP fijo parametrizable y una regla de giveback/trailing parametrizable.
- El TP solo se considera alcanzado si el quote de salida cruza el nivel y presupone una orden límite resting.
- Las salidas por tiempo y giveback son benchmarks a Bid/Ask y no modelan slippage, latencia, cola ni parciales.
- El «máximo cotizable» se presenta explícitamente como benchmark hindsight, no como una regla operativa.

No requiere cambios SQL.


## V31.10.1 · Ajuste microestructural Best Exit

- Corrige los escenarios no ejecutados para que `null` no se renderice como 0t / `undefined`.
- Separa explícitamente el máximo **marketable** (Bid/Ask) del fill real pasivo.
- Un TP límite resting puede considerarse observado si Last negoció el nivel; la cola no se modela y se etiqueta como tal.
- El mapa lateral sigue siendo estrictamente marketable (Bid/Ask).
- Evita porcentajes >100% engañosos cuando un fill pasivo supera el mejor cierre marketable observado.


## V31.10.2 · Semántica del delta de salida

- Corrige el signo del KPI que compara el fill ejecutado con el mejor cierre marketable.
- El KPI pasa a llamarse **Δ fill vs marketable** y se calcula como `fill real - máximo marketable`.
- Un valor positivo significa que el fill real fue mejor que el benchmark Bid/Ask; un valor negativo significa que quedó por debajo.
- Homogeneiza la terminología visual a **máximo marketable** en el gráfico y la ayuda contextual.

No requiere cambios SQL.


## V31.10.3 · Escala útil y retención del máximo

- El TP hipotético no fuerza ya la escala vertical del gráfico cuando no fue alcanzado. Una operación que solo se movió entre, por ejemplo, -10t y +8t deja de quedar comprimida por un TP +20t ajeno al recorrido observado.
- Si el TP está fuera del rango observado se indica en la cabecera del gráfico como `no observado; fuera de escala`; el escenario sigue disponible en la tabla inferior.
- `Eficiencia de salida` pasa a `Retención del máximo`: si hubo MFE marketable positivo y la operación termina en pérdida, muestra 0% en vez de porcentajes negativos difíciles de interpretar.
- Si nunca existió beneficio marketable positivo, la retención se muestra como `—` porque no hay máximo favorable que capturar.
- Si un fill pasivo supera al mejor cierre marketable, se conserva la lectura en ticks de ventaja frente al benchmark Bid/Ask.

No requiere cambios SQL.


## V31.10.4 · Semántica temporal y benchmark marketable

- `Tiempo en beneficio marketable` se calcula por duración real (milisegundos), no por porcentaje de muestras/ticks.
- `Máximo marketable` pasa a `Mejor cierre marketable`, más claro cuando el mejor cierre sigue siendo negativo.
- Si un fill límite pasivo supera el benchmark Bid/Ask, la tarjeta se denomina `Ventaja pasiva` en vez de mostrar ticks bajo `Retención del máximo`.
- Sin cambios en la ventana temporal: ningún escenario usa datos posteriores al fill real.


## V31.14.1 · Semantic Mutation Boundary

Corrige la instrumentación de DomainStore: los normalizadores históricos que reconstruyen arrays/objetos con contenido idéntico ya no generan falsos `pending mutations`. El estado `OK` exige ahora cero mutaciones pendientes. Los commits explícitos mantienen su etiqueta durante el boundary de persistencia para agrupar también las normalizaciones/research tracking derivadas del mismo comando. No cambia `app.js` ni ninguna fórmula financiera.


## V31.14.3 · Read-only Render Boundary
- render() ya no llama a v30EnsureBaselineLocal; la baseline se prepara en el boundary de dominio.
- Escrituras legacy durante render se journalizan y revierten antes de salir de la composición.
- Persistencias solicitadas durante render se suprimen y se diagnostican.
- Las reasignaciones semánticamente idénticas son también no-op referenciales.
- contractEconomics de Ankora deja de refrescar updatedAt cuando no cambió la economía real.


## V31.17 · Structural Foundation III-B3.1 · Atomic Import Boundary

- Ankora `confirmImportPreview` y `deleteImportBatch` se publican como comandos controlados (`import.ankora.commit` / `import.ankora.delete`).
- NinjaTrader Grid se ejecuta como `import.ninjatrader.executions`: las mutaciones Journal quedan en un único commit de dominio.
- Las escrituras de `marketMeta`, `marketTicks` y `execSets` se stagean; los lectores ven el candidato y el commit final usa una sola transacción IndexedDB sobre los stores afectados.
- El histórico Tick (`import.ninjatrader.market`) no incrementa Domain revision porque vive en Market Data, pero metadata + ticks se publican atómicamente.
- Si una importación falla antes del commit, el workspace en memoria vuelve al snapshot previo y los writes de Market Data no se publican; si ya se publicaron y una fase posterior falla, se intenta rollback compensatorio.
- Datos y seguridad muestra importaciones confirmadas/rollback y escrituras externas agrupadas.
- `app.js` continúa congelado; Restore y Cloud quedan fuera de esta subfase.
