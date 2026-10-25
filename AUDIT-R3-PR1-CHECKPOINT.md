# Auditoría revisión 3 · PR 1 · Filtros comunes, vistas y OOS

Fecha: 25/10/2026 · Europe/Madrid
Base: main `141aec5` (merge PR #121), paquete web 31.29.0.
Rama: `audit-r3/pr1-global-filters`.

## Alcance y decisiones

AR-30 es la primera intervención. Agrupa AR-07 (conteos), AR-14 (Lun–Dom), AR-29 (dimensiones) y la retirada de filtros locales de AR-03. Una sola revisión del usuario al completar el PR. No hacer merge sin su validación.

- Un panel superpuesto arriba a la derecha; cerrar/Escape conserva la selección y devuelve foco.
- Selección por TP/versión/entorno; conservada al navegar y recargar. Las vistas guardadas reutilizan `savedStudies`; las hipótesis reutilizan `forwardTests`. No migración ni duplicación de operaciones.
- Operaciones y análisis gráfico, Laboratorio, Dashboard y Calendario comparten muestra. Biblioteca añade un filtro de tipo de imagen que no modifica equity.
- Constructor conserva una receta por contexto del origen, con resultados/límites R netos. Puede guardar vistas o congelar una hipótesis del origen sin sustituir los filtros del TP activo.
- Configuración, planes, fuentes de Market Data, sesiones/objetivos/hallazgos e informes mantienen su alcance propio, indicado junto al acceso. Sus filtros de entidad se trasladan como controles contextuales al panel; editar configuración no pasa a afectar solo al subconjunto.
- Unidad/base comunes en los recorridos de operaciones y su análisis. Rangos de R heredan base; Constructor conserva R neta. Conteo de filtros separado de política de gestión.
- Los mandos analíticos (ejes, métrica, escenarios y ventanas) permanecen junto a su herramienta. OOS sigue después de Riesgo.

## Cambios técnicos

`shared-filters-model.js`: normalización, firma y contexto de la selección.
`shared-filters-runtime.js`: panel, consumidores, preferencias locales por contexto, vistas/OOS y foco.
`shared-filters-build-transform.mjs`: puente acotado a la receta existente del Constructor y base del widget de últimas operaciones.
`render-closure-runtime.js`: suscripción antes/después del render; se conserva la entrada canónica y su diagnóstico.
`taxonomy-runtime.js`: contrato de lectura de filtros/opciones sin normalizar ni mutar el TP en cada consulta.
Adaptadores previos del Dashboard: muestra y base comunes también al ajustar el tamaño de la equity.

Corrección descubierta al validar OOS: una prueba cerrada con cero IDs finales debe seguir vacía al añadirse datos. Se conserva la definición y el esquema anteriores.

## Evidencia reproducible

- `npm run build`: prebuild, contratos, CSP y guardas de ocho regiones financieras.
- `node verify-shared-filters-model.mjs`: conteos, firmas equivalentes, aislamiento TP/versión/entorno e independencia de snapshots.
- `CHROME_BIN=<Chromium> node verify-shared-filters-browser.mjs`: app compilada, perfil desechable; ocho registros (incluye pendiente), guardado/recuperación, nueva operación OOS con filtro de trabajo contrario, cierre vacío, receta, cambio de TP, imagen contextual, unidades/base, foco, temas oscuro/claro, 1366×900 y 1920×1080 y reapertura real del mismo perfil.
- Pruebas de navegador anteriores siguen cubriendo registro, columnas, lotes, derivación independiente, teclado, presentación, Market Data, comparación de imágenes e informes. Las expectativas de ubicación del filtro se actualizan al panel común.

Los datos se generan solo en perfiles de prueba. No se han restaurado datos del usuario ni manipulado producción. El Excel de Edgewonk no se presenta como prueba del importador Ankora. La prueba de importación y enriquecimiento sigue en PR 2 (AR-24).

## Estado de continuidad

CP-01: repositorio y base actuales identificados; muestra reproducible pertinente al PR 1 preparada. La certificación de otros recorridos/datasets continúa en sus lotes.
CP-02: contrato de filtros documentado arriba.
CP-03/04: implementados y comprobados. Build completo PASS; 22 regresiones anteriores de navegador PASS y prueba nueva del panel PASS en ambos temas y resoluciones, incluida reapertura real. Preparación Desktop 0.7.0 y controles nativos PASS; no equivale a certificación de instalación Windows.
Validación del usuario, merge y despliegue de producción: pendientes.

Siguiente acción: publicar esta rama y presentar un único PR de revisión con su versión de prueba. Guardar enlace y commit de entrega en la ruta de trabajo principal. Tras validación y merge, seguir con PR 2 (CP-05/06).
