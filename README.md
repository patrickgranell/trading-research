# Trading Research V30.3 — MAE/MFE + Data Quality semántico

V30.3 parte de V30.2 y mantiene intactos Supabase, Conflict Guard V9.2 y todos los módulos existentes. Esta revisión no cambia la definición intratrade de MAE/MFE: aclara qué significa el estado de calidad de cada dato.

## Data Quality MAE/MFE

- **Medido / dato real**: observación utilizable en Exit Lab y estadísticas MAE/MFE. Un 0 ticks medido es un cero real.
- **No informado**: dato pendiente de revisar/medir; permanece en la cola de limpieza.
- **No recuperable / no evaluable**: la operación ya fue revisada, pero no existe una medición fiable. Sale de la cola, pero no entra en estadísticas MAE/MFE.
- La **cobertura utilizable** usa únicamente operaciones medidas.
- La **revisión resuelta** cuenta medidas + no recuperables/no evaluables.
- Marcar N/A/no recuperable **no aumenta** la cobertura utilizable ni el score MAE/MFE.
- Data Quality no valora si un MAE/MFE es bueno o malo; valora disponibilidad, recuperabilidad y coherencia del dato.

## Caché / versión

`index.html` carga `app.js` y `styles.css` con identificador V30.3 para evitar que el navegador reutilice una versión anterior tras desplegar. El cuadro lateral muestra V30.3.

## Base metodológica heredada de V30.2

V30.2 parte de V30.1 y conserva toda la base anterior: Supabase, Conflict Guard V9.2, snapshots, Dashboard configurable, Calendario, Research Grid, Exit Lab, Compliance, Estudios, Confianza estadística, Review & Notes, Objetivos, ayuda contextual, Monte Carlo, Risk & Stress Lab, Walk-Forward, Forward OOS, Data Quality Workbench, Quality-Aware Analytics, Research Decision Center y Change Tracking.

## Definición formal de MAE / MFE

Trading Research adopta una única definición para evitar mezclar excursiones reales con movimientos posteriores a la operación:

- **MFE real**: máxima excursión favorable del precio desde la entrada mientras todavía queda posición abierta.
- **MAE real**: máxima excursión adversa del precio desde la entrada mientras todavía queda posición abierta.
- La ventana de medición termina en la **salida final real** de la operación.
- Nunca se continúa midiendo MAE/MFE después de que la posición se haya cerrado.
- El dato primario se introduce como magnitud positiva en **ticks**.
- La equivalencia en **R** se calcula automáticamente a partir del riesgo inicial registrado.
- `0 ticks` marcado como `Medido` sigue siendo un dato real; `No informado` y `N/A` permanecen separados.

## Censura por la propia gestión

Un stop o un take profit pueden limitar lo que MAE/MFE llegan a observar:

- Si el stop cierra la posición, el MAE queda censurado por ese stop y no demuestra qué habría ocurrido con un stop más amplio.
- Si un TP fijo cierra toda la posición, el MFE queda censurado por ese objetivo y no demuestra qué habría ocurrido con un TP mayor.
- Esto no invalida MAE/MFE: mantiene su función estándar para estudiar el recorrido realmente soportado/capturado durante la operación.
- El problema contrafactual de ampliar stop o TP queda deliberadamente fuera de MAE/MFE y se investigará en un módulo específico posterior.

## Validaciones añadidas

- Se rechazan valores negativos en vez de corregirlos silenciosamente.
- Si MAE supera el stop inicial más amplio, Trading Research avisa y permite guardar solo si refleja una modificación real de la gestión.
- Si MFE supera el TP fijo más lejano, se genera el mismo tipo de aviso.
- Data Quality detecta estos casos como posibles incoherencias de gestión/dato.
- La ficha de operación indica cuándo la excursión queda censurada por el SL/TP inicial.
- Exit Lab muestra explícitamente que trabaja con la ventana `entrada → salida final real` y que no usa recorrido post-salida para justificar objetivos o stops más amplios.

## Change Tracking

Se conserva el fix de V30.1 para Forward OOS: el alta de una operación compara el progreso antes/después y crea el evento correspondiente si el sistema general no lo hubiese registrado. `Cambios` mantiene también `Comprobar ahora` y `Actualizar referencia` como acciones distintas.

## Archivos

El paquete mantiene exactamente seis archivos en la raíz:

- `index.html`
- `app.js`
- `styles.css`
- `package.json`
- `wrangler.jsonc`
- `README.md`

No requiere SQL nuevo.


## V31 · Market Data Foundation

- Nueva vista **Market Data** con biblioteca local de históricos.
- Importador de exportaciones NinjaTrader `Tick`, `Tick Replay`, `Minute` y `Day` separadas por `;`.
- Los timestamps de exportación NinjaTrader se interpretan como **UTC**.
- Los históricos pesados se almacenan en **IndexedDB local** y no forman parte del payload de Supabase/Conflict Guard.
- Mapeo del archivo a contrato/vencimiento de Trading Research.
- Cobertura automática operación × histórico y clasificación de precisión.
- Reconstrucción entrada → salida para MFE/MAE en ticks; la equivalencia en R se deriva del riesgo.
- Aplicación automática a la operación únicamente cuando hay datos Tick/Tick Replay y timestamps de entrada/salida con segundos.
- Datos de 1 minuto disponibles como diagnóstico, explícitamente no exactos por ambigüedad intrabar.
- Los formularios `datetime-local` admiten segundos para mejorar futuros cálculos tick.
- No altera Supabase ni el motor V9.2 Conflict Guard.
