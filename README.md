# Trading Research V30.2 — MAE/MFE intratrade en ticks

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
