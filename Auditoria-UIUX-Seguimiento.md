# Seguimiento de implementación · Auditoría UI/UX Astra

Documento de ejecución independiente del informe de auditoría original (88 evidencias, 26 fichas). Ninguna ficha se considera **cerrada** por el mero hecho de modificar código.

| Lote | Fichas | Estado | Validación |
| --- | --- | --- | --- |
| 0 · Tema claro | TR-UX-026 | Validado y autorizado para merge | Pruebas automatizadas y Chromium en ambos temas PASS; usuario confirmó Bloques, Perspectiva, Nueva operación, Calendario, Review & Notes y Salida en ambos temas |
| 1 · Contexto/estadística | 001, 004, 014, 024 | Sin iniciar | Pendiente |
| 2 · Configuración/recursos | 009, 010, 013 | Sin iniciar | Pendiente |
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
