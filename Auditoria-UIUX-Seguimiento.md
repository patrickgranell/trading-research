# Seguimiento de implementación · Auditoría UI/UX Astra

Documento de ejecución independiente del informe de auditoría original (88 evidencias, 26 fichas). Ninguna ficha se considera **cerrada** por el mero hecho de modificar código.

| Lote | Fichas | Estado | Validación |
| --- | --- | --- | --- |
| 0 · Tema claro | TR-UX-026 | Validado y autorizado para merge | Pruebas automatizadas y Chromium en ambos temas PASS; usuario confirmó Bloques, Perspectiva, Nueva operación, Calendario, Review & Notes y Salida en ambos temas |
| 1 · Contexto/estadística | 001, 004, 014, 024 | TR-UX-024 integrada parcialmente en #103; resto de Lote 1 en #102 (WIP) | Requiere reconciliar 001/004/014, validar UI y aprobar cierre |
| 2 · Configuración/recursos | 009, 010, 013 | Cerrado, validado y fusionado · PR #106 | Usuario aprobó; merge squash 9c77c9ea; CI PASS |
| 3 · Navegación | 002, 006, 011, 017 | Cerrado y fusionado · PR #107 + #108 | Certificación usuario, navegación vertical sin duplicaciones y Chromium PASS |
| 4 · Controles/accesibilidad | 005, 015, 016, 020, 021, 022 | Implementado en rama PR #111 · sin merge | Build/Chromium, comprobación final agrupada usuario pendiente |
| 5 · Operaciones/planes/imágenes | 003, 007, 012, 023 | Sin iniciar | Pendiente |
| 6 · Laboratorio/informes/Market Data | 008, 018, 019, 025 | Sin iniciar | Pendiente |

## TR-UX-026 — E80, E81, E84, E85, E86, E87

- [x] Corrección limitada a tema claro: par fondo/borde/texto del detalle de Bloques, incluidos valores neutros.
- [x] Superficie y degradado compatibles con Perspectiva: cita, autor, fuente, contexto, contador y botón Configurar biblioteca.
- [x] Contraste de etiquetas del formulario Nueva operación y textos secundarios de Review/Calendario.
- [x] Oscurecer tono ámbar de Salida en gráfico de velas, ejecución y Best Exit (incluida leyenda), en **ambos temas**: el lienzo del gráfico es blanco en claro y oscuro (observación del usuario).
- [x] Mantener resto de reglas del tema oscuro, badges y componentes de ayuda/tooltip E82/E83/E88; única excepción intencional en oscuro: «Salida» sobre gráfico blanco.
- [x] Revisión visual del usuario: Bloques en claro/oscuro, Perspectiva claro, Nueva operación, Calendario y Review & Notes.
- [x] Market Data «Salida» en tema claro: mejora confirmada por usuario.
- [x] «Salida» de Market Data en tema oscuro confirmado por usuario. Misma anotación de alto contraste en claro y oscuro sobre fondo blanco; pruebas de contrastes y estilos computados superadas.
- [x] Autorización expresa del usuario para merge (9 de octubre de 2026); ficha validada funcionalmente, cierre de integración supeditado al merge y verificación de `main`.

**Criterio de cierre:** contrastes AA en casos de texto normales sobre fondos representativos (incluidos extremos del degradado), ambas apariencias funcionales y legibles, sin cambios de comportamiento ni cálculo. El test CSS es una comprobación de paleta y selectores, no una certificación universal de accesibilidad.

**Restricción de alcance:** no se han intervenido cálculos, datos, operaciones, configuración persistente ni los lotes 1–6.


## Lote 2 — TR-UX-009, 010 y 013 · PR #106 (fusionada y certificada)

**Base:** main. Solo presentación de Configuración. E24/E30/E33/E34/E35/E38 y fichas originales consultadas antes de editar.

- **009, ámbitos reales:** gestión, riesgo, checklist, errores, taxonomías y cuestionario emocional se conservan por TP/versión. Instrumentos/contratos y plantillas viven en recursos compartidos; la galería visual consulta referencias **propias del TP**, sin presentarlas falsamente como globales. Aplicación y datos contiene Backup/Restauración y conexión. Las perspectivas globales dentro de Emocional se señalan como compartidas; no cambian de propietario. Tres grupos compactos + subnavegación contextual sustituyen a la cuadrícula simultánea de once accesos.
- **010, seguridad:** datos muestra acceso a copia primero, luego persistencia/integridad; diagnósticos completos conservados en soporte avanzado. Nube prioriza sincronización/estado, cuenta y snapshots antes de conexión avanzada. Enlaces cruzados, sin duplicar comandos. No se almacena fecha de última copia/exportación de backup: se informa explícitamente en lugar de inventarla. Previsualización, restauración, Backup V2, journal y durable flush permanecen en su código original.
- **013, ficha única:** Taxonomías muestra listado de categorías y solo un panel de valores a la vez, con su ficha modal original. Referencias visuales se deriva de definiciones y visualReferences del mismo TP: filtro de categoría, búsqueda, imágenes LONG/SHORT, históricos, un acceso a ficha canónica; las capturas reales de operaciones no se mezclan.
- **Compatibilidad:** se preservaron app.js, IDs, relaciones, esquema, almacenamiento y módulos ajenos al lote. Cambio build-only del contrato de presentación manteniendo render:config; bundle en script CSP-hashed existente, sin script externo.
- **Pruebas:** prebuild + build completo + 19 hashes CSP; prueba Chromium con 3 ámbitos, editor por TP, consulta/edición canónica, copias primero, enlaces Nube/Datos y apariencia claro/oscuro. No se han ejecutado restauraciones reales ni operaciones destructivas.

**Pendiente:** una única revisión funcional visual del usuario en preview; merge solo tras autorización expresa.


## Lote 3 — TR-UX-002, 006, 011 y 017 · PR #107 (sin merge)

**Evidencias consultadas:** E05 (Dashboard activo falso/scroll), E06/E07/E39/E40 (rutas emocionales y prerrequisitos), E03/E12/E18/E28 (vocabulario), E17/E37 (Cumplimiento y Errores). Dependencias: contexto 001, cobertura 004, ámbitos 009; sin alterar objetos ni cálculos.

**Mapa de nombres canónicos (solo presentación):**
- Investigación: Centro Research / Research Decision Center → **Centro de investigación**; Cambios / Research Alerts & Change Tracking → **Cambios y alertas**; Review & Notes → **Hallazgos y decisiones**.
- Revisión: Mistakes Analysis / Errores → **Análisis de errores**; Cumplimiento conserva su identidad.
- Diario: Dashboard → **Resumen**, Sesiones, Registro emocional, Confianza, Rachas, Deriva, Perspectiva, Revisión semanal. Notas y Constancias quedan en Registro; la Biblioteca de Perspectiva, en Perspectiva.
- Códigos de estado visibles win/loss/pending/unclassified → Ganadora/Perdedora/Pendiente/Sin clasificar en etiquetas u opciones; valores/IDs guardados intactos.

**002:** Dashboard activo correcto en shell persistente, aria-current en destino final, ancestro secundario, sidebar vertical sin scroll horizontal, Apariencia compacta; conserva TP.
**006:** ocho enlaces locales; Definir entorno abre el editor existente del TP; revisión de grupo lleva a Trading Plans; Abrir sesiones directo; retorno al Diario si el TP sigue válido; Backtesting excluido.
**011:** un mapa de nombres canónicos en menú y títulos, códigos legibles sin cambiar los almacenados.
**017:** decisión: destinos hermanos Cumplimiento/Análisis de errores, unidos por navegación local compacta. Metodología larga plegable cuando procede. Coberturas, denominadores, evaluación y snapshots separados.

**Implementación:** adaptador de presentación aislado astra-lote3-navigation-runtime.js dentro del script CSP-hashed actual. app.js, structural-runtime.js, emotional-journal-runtime.js y persistencia sin modificación. Sin merge.
**Verificación:** compilación, 19 hashes CSP y suite Chromium de rutas, bloqueo Backtesting, retorno, ancho, selección activa y claro/oscuro; sin acciones destructivas.

**Pendiente:** comprobación funcional conjunta del usuario, luego autorización expresa de merge.

## UX-104 · Registro de Operaciones (integración acumulativa)

Se integra la mejora comprobada en PR #105 sobre el estado fusionado de Lotes 0, 2 y 3: columnas Fecha/Hora entrada y salida en lugar de Bloque en el registro, pendientes sin cierre visibles en ámbar y salida «—». Sin cambios en Bloques, persistencia, estadísticas ni operaciones. CI/Chromium y user QA pendientes en la versión acumulada.

## Lote 1 · integración parcial segura (#103)

Se integra únicamente la recuperación de IC95 desde la misma muestra canónica cerrada y elegible (TR-UX-024), más el test de regresión n=123/124 y subconjuntos. El indicador ámbar y visualización de pendientes está ya integrado desde #105; no se copian estilos de resultado obsoletos ni se duplican. **No se declara cerrado el Lote 1**: TR-UX-001/004/014 y reconciliación de denominadores/estados requieren implementación y prueba coherente; #102 sigue siendo un prototipo de presentación con frágiles mutaciones posrender, no apto para merge directo.


## Lote 4 — Sistema visual, controles y accesibilidad · PR #111 (sin merge)

**Fuente**: fichas TR-UX-005/015/016/020/021/022 y evidencias E02, E04, E13, E22, E30, E35, E42, E44–46, E54/56, E76/77, E79/83/85. Dependencias de Lotes 0, 2, 3 verificadas.

- **005**: escala de lectura compartida (13px texto de definiciones, 12px ayudas); botones info con min-hit 30px; segmented sin wrap por opción; Research Grid bajo n no pierde opacidad, resalta advertencia con borde; referencia Inicio 0 → fin resultado + periodo junto a curvas Bloques; respeta SVG y cálculos. Temas claro/oscuro.
- **015**: nombres de acciones más precisos. Limpiar dataset es un enlace a calidad, no elimina datos: se presenta como Revisar calidad del dataset. Guardar plantilla = Guardar en biblioteca. Actualizar referencia de comparación del TP y Borrar historial de cambios del TP distinguen mantenimiento. Confirmaciones existentes de eliminación intactas.
- **016**: corregidos nombres accesibles de eliminar × en registros y diálogos, intercambio Research Grid, ayudas específicas de Máx. ganancia y pérdida sin confundir con media, ayuda junto al cero en límites de riesgo, contador seleccionado de galería sincronizado con Comparar. Corregido caso de aviso de plan nuevo al editar, cuando exista en el diálogo. Campo sin label recupera nombre de etiqueta visual. Códigos guardados intactos.
- **020**: navegación local de Preguntas del TP, Categorías del TP y Biblioteca de perspectivas global, sin repetir el menú lateral. Búsqueda por texto de autor/contexto y filtro de estado; selector + una ficha de las existentes, con todos los botones originales. Cambiar de subvista no persiste ni reestructura elementos. Las citas originales mantienen su diseño destacado en Diario y Dashboard.
- **021**: Glosario abre solo un modal. El detalle Qué significa/Para qué sirve se inserta dentro del mismo, conserva DOM del buscador, valor, filtros y posición. Volver a resultados sin nueva consulta. Ayudas directas conservadas.
- **022**: foco al primer campo/título, aria-labelledby, navegación Tab/Shift+Tab confinada al diálogo activo, retorno al disparador si existe, Escape cierra ayuda de lectura, al cancelar un formulario modificado se confirma descarte; caso sin modificaciones se cierra directamente. El motor original de guardado y restauración no se altera.
- **Arquitectura**: un adaptador Lote 4 y tokens CSS; ningún cambio en app.js ni en schemas/persistencia, estadísticas, operaciones, Nube o backup. Fuente/producción empaquetadas dentro del script CSP-hashed existente.
- **Pruebas**: verificación bundle CSP 19 hashes, verificación sintaxis, CI web, Chromium con navegación emocional, galería, detalle Glosario sin apilar, teclado/glosario y Nueva operación (descartar cambios), claro/oscuro; suite de regresión Lotes 0/2/3 y Operaciones.
- **Pendiente**: certificación funcional única del usuario; sin autorización no se fusiona. Bloques a Operativa y visibilidad del menú por entorno fuera de alcance.
