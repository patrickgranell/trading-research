# Seguimiento de implementación · Auditoría UI/UX Astra

Documento de ejecución independiente del informe de auditoría original (88 evidencias, 26 fichas). Ninguna ficha se considera **cerrada** por el mero hecho de modificar código.

| Lote | Fichas | Estado | Validación |
| --- | --- | --- | --- |
| 0 · Tema claro | TR-UX-026 | Integrado en main · PR #101 · PASS | Pruebas automatizadas y Chromium en ambos temas PASS; usuario confirmó Bloques, Perspectiva, Nueva operación, Calendario, Review & Notes y Salida en ambos temas |
| 1 · Contexto/estadística | 001, 004, 014, 024 | En desarrollo · PR #102 borrador | Pruebas automáticas en curso; validación funcional agrupada pendiente |
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
- [x] Merge autorizado, integrado en `main` por PR #101 el 9 de octubre de 2026; verificación post-merge PASS.

**Criterio de cierre:** contrastes AA en casos de texto normales sobre fondos representativos (incluidos extremos del degradado), ambas apariencias funcionales y legibles, sin cambios de comportamiento ni cálculo. El test CSS es una comprobación de paleta y selectores, no una certificación universal de accesibilidad.

**Restricción de alcance Lote 0:** no se intervinieron cálculos, datos, operaciones ni configuración persistente.

## Lote 1 — TR-UX-001, 004, 014, 024 (PR #102, SIN MERGE)

**Estados:** código implementado en rama; criterios de aceptación originales pendientes de certificación completa. No aplicar una ficha como cerrada antes de completar las pruebas y recibir la validación del usuario.

- **001 · Contexto analítico estable:** componente discreto en encabezados analíticos, con plan/versión, entorno y capas mezcladas expresamente, registros, cerradas, elegibles, motivo de exclusión, unidad/base y filtros/alcance. Comparaciones por grupos conservan TP/versión (los grupos no fusionan operaciones).
- **004 · Estados:** distinguir muestra vacía, sin resultados por filtros, sin cierre, n insuficiente, N/A y cero medido. En Backtesting el diario emocional es optativo, no se utiliza como requisito de cobertura ni rebaja el score; con 0 operaciones el score no se califica. Corregir lectura de deriva sin observaciones suficientes.
- **014 · Elegibilidad:** el ejemplo 124/123 es una pendiente sin cierre; mostrar denominadores distintos y no rotular «fuera del filtro». Builder: el MAX DD era sensible al orden diferente de muestras original/filtrada; se alinea el orden temporal sin tocar la fórmula. Plan migrado y Bloques mostrarán tanto registros como cerradas elegibles.
- **024 · NaN:** V18 calculaba IC con Student-t y Wilson, pero el override canónico posterior descartaba esos campos; recuperar estimador original exclusivamente para la muestra canónica cerrada/finita. n=0/1 sigue sin IC t; un n>=2 con datos válidos tendrá CI finito.

**Regresiones instrumentadas:** n=123, n=5, n=0, pendiente sin cierre, resultado flat=0, plan ajeno, intervalo de Wilson y t, diferencia de orden en DD, score de Backtesting, inyección de runtime en bundle CSP.

**Pendiente de validación usuario (una sola sesión):** comprobar en un plan poblado como prova1, en Plan migrado/Bloques, en Constructor sin filtros y filtro pending, y en Report Builder/Laboratorio IC95 (más un plan/muestra vacía). Confirmar en ambos temas. El usuario no debe repetir auditoría de Lote 0.

**No iniciado:** Lotes 2–6; MFE/MAE en ticks agregados permanece como cambio funcional separado.
