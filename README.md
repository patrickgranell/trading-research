# Trading Research V11.3 — Dashboard multiuidad y reset de gráficos

Esta versión parte de **V11.2 Legibilidad corregida** y mantiene intactos Supabase, V9.2 Conflict Guard, snapshots, Biblioteca Simple y Laboratorio Analítico Avanzado.

## Dashboard

El Dashboard incorpora un selector de unidad:

- `R`
- `Ticks`
- `US$`

El selector recalcula sin modificar datos:

- Expectancy
- Drawdown
- Equity acumulada y curva
- MFE medio
- MAE medio
- Profit Factor sobre la unidad seleccionada

Operaciones, Win rate y Bloques siguen siendo conteos/porcentajes y no cambian de unidad.

MFE y MAE se almacenan originalmente en R. Para mostrarlos en ticks o US$, la aplicación los convierte usando el riesgo registrado en cada operación (`riskTickExposure` / `riskUsd`).

## Gráficos interactivos de Operaciones

Las selecciones ya no quedan atrapadas:

- En el mapa de calor Día × Hora, un clic aísla una celda.
- Volver a pulsar la misma celda la desactiva.
- Cuando existe una selección aparece `Restablecer selección`.
- En Desglose interactivo ocurre lo mismo con Setup, VD, NR, Hipótesis, Estrategia, Dirección, Contrato, Origen, Resultado o Mes.
- El botón de restablecimiento elimina solo la selección de ese gráfico y conserva el resto de filtros.
- `Limpiar filtros` continúa disponible para borrar todos los filtros de Operaciones.

## Legibilidad y signos

Se conserva la regla de V11.2 corregida: la aplicación no inventa signos. Solo colorea de verde los valores cuyo texto ya comienza por `+` y de rojo los que ya comienzan por `-`/`−`.

## Nube y despliegue

No requiere SQL nuevo ni cambios en Supabase.

Los 6 archivos deben permanecer en la raíz del repositorio:

- `index.html`
- `app.js`
- `styles.css`
- `package.json`
- `wrangler.jsonc`
- `README.md`
