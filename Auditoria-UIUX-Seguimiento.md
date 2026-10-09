# Seguimiento de implementación · Auditoría UI/UX Astra

Documento de ejecución independiente del informe de auditoría original (88 evidencias, 26 fichas). Ninguna ficha se considera **cerrada** por el mero hecho de modificar código.

| Lote | Fichas | Estado | Validación |
| --- | --- | --- | --- |
| 0 · Tema claro | TR-UX-026 | Validado y autorizado para merge | Pruebas automatizadas y Chromium en ambos temas PASS; usuario confirmó Bloques, Perspectiva, Nueva operación, Calendario, Review & Notes y Salida en ambos temas |
| 1 · Contexto/estadística | 001, 004, 014, 024 | Sin iniciar | Pendiente |
| 2 · Configuración/recursos | 009, 010, 013 | Implementado en rama PR #106 · sin merge | CI, build CSP, Chromium claro/oscuro PASS; certificación funcional del usuario pendiente |
| 3 · Navegación | 002, 006, 011, 017 | Sin iniciar | Pendiente |
| 4 · Controles/accesibilidad | 005, 015, 016, 020, 021, 022 | Sin iniciar | Pendiente |
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


## Lote 2 — TR-UX-009, 010 y 013 · PR #106 (sin merge)

**Base:** main. Solo presentación de Configuración. E24/E30/E33/E34/E35/E38 y fichas originales consultadas antes de editar.

- **009, ámbitos reales:** gestión, riesgo, checklist, errores, taxonomías y cuestionario emocional se conservan por TP/versión. Instrumentos/contratos y plantillas viven en recursos compartidos; la galería visual consulta referencias **propias del TP**, sin presentarlas falsamente como globales. Aplicación y datos contiene Backup/Restauración y conexión. Las perspectivas globales dentro de Emocional se señalan como compartidas; no cambian de propietario. Tres grupos compactos + subnavegación contextual sustituyen a la cuadrícula simultánea de once accesos.
- **010, seguridad:** datos muestra acceso a copia primero, luego persistencia/integridad; diagnósticos completos conservados en soporte avanzado. Nube prioriza sincronización/estado, cuenta y snapshots antes de conexión avanzada. Enlaces cruzados, sin duplicar comandos. No se almacena fecha de última copia/exportación de backup: se informa explícitamente en lugar de inventarla. Previsualización, restauración, Backup V2, journal y durable flush permanecen en su código original.
- **013, ficha única:** Taxonomías muestra listado de categorías y solo un panel de valores a la vez, con su ficha modal original. Referencias visuales se deriva de definiciones y visualReferences del mismo TP: filtro de categoría, búsqueda, imágenes LONG/SHORT, históricos, un acceso a ficha canónica; las capturas reales de operaciones no se mezclan.
- **Compatibilidad:** se preservaron app.js, IDs, relaciones, esquema, almacenamiento y módulos ajenos al lote. Cambio build-only del contrato de presentación manteniendo render:config; bundle en script CSP-hashed existente, sin script externo.
- **Pruebas:** prebuild + build completo + 19 hashes CSP; prueba Chromium con 3 ámbitos, editor por TP, consulta/edición canónica, copias primero, enlaces Nube/Datos y apariencia claro/oscuro. No se han ejecutado restauraciones reales ni operaciones destructivas.

**Pendiente:** una única revisión funcional visual del usuario en preview; merge solo tras autorización expresa.
