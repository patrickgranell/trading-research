# Seguimiento de implementación · Auditoría UI/UX Astra

Documento de ejecución independiente del informe de auditoría original (88 evidencias, 26 fichas). Ninguna ficha se considera **cerrada** por el mero hecho de modificar código.

| Lote | Fichas | Estado | Validación |
| --- | --- | --- | --- |
| 0 · Tema claro | TR-UX-026 | Implementado en rama; pendiente aceptación funcional | Contraste automatizado y build/CI; revisión comparativa de usuario pendiente |
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
- [x] Oscurecer tono ámbar de Salida en gráfico de velas, ejecución y Best Exit (incluida leyenda), sin alterar semántica.
- [x] Mantener reglas existentes de tema oscuro, badges y componentes de ayuda/tooltip E82/E83/E88.
- [ ] Revisión visual real en preview: Bloque 07 en claro/oscuro, cita 1/18 en claro/oscuro, etiquetas del formulario, metadatos de Review/Calendario, Salida en gráfico, foco, disabled.
- [ ] Autorización expresa del usuario para merge y cierre de ficha.

**Criterio de cierre:** contrastes AA en casos de texto normales sobre fondos representativos (incluidos extremos del degradado), ambas apariencias funcionales y legibles, sin cambios de comportamiento ni cálculo. El test CSS es una comprobación de paleta y selectores, no una certificación universal de accesibilidad.

**Restricción de alcance:** no se han intervenido cálculos, datos, operaciones, configuración persistente ni los lotes 1–6.
