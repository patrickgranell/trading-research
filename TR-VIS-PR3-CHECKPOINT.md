# TR-VIS PR 3 — Investigación y evidencia visual

Fecha: 14/10/2026. Rama: `tr-vis-pr3-investigacion-evidencia-20261014`. Base: `main` tras PR #119, merge `b9fb6a963c98d35d8f00cd7b82a44d2eba26145a`.

## Alcance aprobado para iniciar

Seis paquetes **dentro de un único PR en borrador**, no seis PR:
1. Laboratorio (TR-VIS-006): contexto y pestañas delante de filtros; filtros completos plegables; estado de muestra visible.
2. Constructor (TR-VIS-002): fuente → filtros → comparación original/resultante → crear derivado, campos en retícula.
3. Segmentación y Validación (TR-VIS-007): n/escala/insuficiencia separados del rendimiento; OOS, IC95, bootstrap solo con evidencia disponible.
4. Biblioteca visual (TR-VIS-008): captura completa y comparador 2/3/4, filtros secundarios.
5. Market Data: recorrido protagonista, requisitos compactos, Calibración/Vinculación/Recorrido/Best Exit sin pérdida.
6. Accesibilidad, inventarios de herramientas, categorías largas, estados vacíos y ambos temas.

## Invariantes

- No tocar métricas, cálculos, reglas de elegibilidad ni persistencia.
- Mantener todos los filtros y taxonomías, días de semana, estudios guardados, distribución de entornos; sin imponer Backtesting→Live.
- Market Data se mantiene excluido de Backtesting.
- No alterar lo cerrado en PR #1 y PR #2; no publicar en producción.
- No merge hasta autorización explícita del usuario.

## Decisión de composición inicial

Se conservarán las cinco pestañas de Laboratorio creadas en Astra Lote 6 (Resumen, Segmentación, Salidas, Validación, Riesgo). Se adelantará navegación y muestra frente a los filtros, reubicados en un único grupo desplegable que conserva controles y estado.

No se reescribirán los motores Market Data; se conservarán sus cuatro tareas y se priorizará la sección de recorrido sobre la introducción extensa.

## Recorridos conjuntos de aceptación

- 3A: Laboratorio, filtros plegables, cambiar herramienta, Segmentación y Validación (n, escala, OOS).
- 3B: Constructor, origen, filtros, diferencia de muestras y CTA de derivación; demostrar independencia.
- 3C: Biblioteca, ampliar y comparar 2/3/4 capturas; desde operación elegible acceder a Recorrido de Market Data.

## Checkpoint de ejecución

- Estado actual: inicio. Base identificada y rama creada.
- Se ha constatado que Astra Lote 6 ya ofrece cinco pestañas de Lab y cuatro de Market Data; no duplicarlas.
- Paquetes completados: ninguno.
- Pruebas realizadas: inspección estática de `build.mjs`, `astra-lote6-research-runtime.js`, `verify-astra-lote6-browser.mjs`; todavía no hay CI de PR 3.
- Inventario antes/después y despliegue: pendientes de fixture Chromium.
- Autorización de merge: **pendiente**.
- Siguiente acción: implementar reorganización no destructiva de Laboratorio, probar conservación de filtros y tab panels, luego seguir por Constructor/Validación, Biblioteca y Market Data.


## Checkpoint 01 — Implementación de investigación y evidencia (14/10/2026)

**Rama y PR:** `tr-vis-pr3-investigacion-evidencia-20261014`, [#120](https://github.com/patrickgranell/trading-research/pull/120), borrador. Base `main` tras merge `b9fb6a96`.

### Cambios implementados y pendientes de revisión visual

- **Laboratorio:** conserva cinco pestañas y los inputs originales; navegación/muestra visible antes de los filtros plegados. Unidad/base sigue visible cuando los filtros están cerrados. La sinopsis recoge controles activos incluidos taxonomías personalizadas, sin alterar el estado.
- **Constructor:** fuente claramente etiquetada, etiquetas encima de los campos, retícula alineada; opciones raw traducidas solo para visualización. Comparación de muestras precede a la única acción canónica «Crear TP derivado», que conserva identificador y comportamiento original.
- **Segmentación:** leyenda sobre escala local y n; aviso visual de celdas en el mínimo configurado por la matriz, independiente del signo. No se cambia la clasificación de rentabilidad ni la elegibilidad.
- **Validación:** OOS, confianza, Walk-Forward y simulaciones en ancho útil, con explicación diferenciada entre evidencia nueva y simulación. No se generan bandas bootstrap si no existen cuantiles.
- **Biblioteca:** filtros secundarios plegados, contadores compactos, capturas sin recorte (object-fit:contain) y comparador existente de 2–4 operaciones visible. Ninguna imagen se carga ni sobrescribe por este cambio.
- **Market Data:** preserva Calibración, Vinculación, Recorrido y Best Exit. Fuentes/requisitos en details; las advertencias críticas permanecen desplegadas. Operaciones de entornos elegibles con ejecución efectivamente vinculada disponen de acceso directo al Grid y fila exacta de su recorrido; las de Backtesting no lo ofrecen.

### Verificación y cobertura

- `verify-tr-vis-pr3-browser.mjs` añadido a CI para comprobar inventarios de filtros en Laboratorio, cinco herramientas, muestra/plegado, retícula del Constructor, comparaciones de dos/tres/cuatro operaciones usando **fixtures del navegador**, contexto Market Data y enlace a ejecución vinculada SIM.
- Suite histórica previa a los últimos retoques: [CI #38544644506](https://github.com/patrickgranell/trading-research/actions/runs/38544644506) **PASS**; revisión posterior del resumen de filtros y umbral visual de n pendiente de última CI.
- Los fixtures 2/3/4 prueban cantidad, estructura y presencia de imágenes, pero **NO certifican el aspecto de capturas reales** porque sus píxeles están en IndexedDB de sesiones concretas. Queda prueba visual 3C con contenido real o fixture de imagen completo y documentado.
- Sin cambios en motores de métricas, validación estadística, origen/derivación, operaciones, datos de mercado, persistencia y separación de entornos.
- Están pendientes los recorridos 3A, 3B y 3C del usuario y cualquier corrección detectada.

### Estado de continuidad

- **Paquetes implementados:** Laboratorio, Constructor, Segmentación, Validación, Biblioteca, Market Data.
- **Pendiente técnico:** última CI, comprobación de preview actualizado y revisión visual de capturas reales, temas y muestra vacía/poblada; auditoría de independencia de TP derivado sobre fixture controlado cuando aplique.
- **Autorización de merge:** NO concedida. **No merge ni producción.**
- **Siguiente acción:** confirmar CI de SHA `fa5a1e22`; entregar un solo preview y tres recorridos agrupados 3A/3B/3C. Si aparecen incidencias, resolverlas dentro de #120.
