# Trading Research V11.2 — Legibilidad y color de signos

Esta versión parte directamente de **V11.1 Biblioteca Simple**. Mantiene intactos el motor **V9.2 Conflict Guard**, Supabase, snapshots, Biblioteca Simple y Laboratorio Analítico Avanzado.

## Legibilidad

- Se aumenta de forma moderada la tipografía pequeña de tablas, filtros, ayudas, etiquetas, badges, fichas y gráficos.
- Los títulos y KPIs grandes conservan su tamaño y jerarquía.
- Se usan cifras tabulares en varias zonas para facilitar la comparación vertical.

## Regla de color numérico

Esta versión **no añade, elimina ni modifica signos numéricos**.

- Si un valor ya se muestra empezando por `+`, se pinta en verde.
- Si un valor ya se muestra empezando por `-` o `−`, se pinta en rojo.
- Si el valor no tiene signo, se deja exactamente como estaba.

Ejemplos:

- `+1.84R` → mismo texto, verde.
- `-1.16R` → mismo texto, rojo.
- `2 contratos` → permanece `2 contratos` y no recibe un `+` artificial.
- `40 ticks` → permanece sin cambios.

La lógica se aplica también a contenido que aparece dinámicamente, como modales o paneles que se vuelven a renderizar.

## Nube y datos

No requiere SQL nuevo ni cambia el esquema de Supabase. No se modifica Safe Sync, Conflict Guard, snapshots ni la estructura de los datos.

## Despliegue

Los 6 archivos deben permanecer en la raíz del repositorio:

- `index.html`
- `app.js`
- `styles.css`
- `package.json`
- `wrangler.jsonc`
- `README.md`
