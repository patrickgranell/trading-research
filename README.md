# Trading Research V31.10.3

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
