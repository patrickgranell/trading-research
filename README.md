# Trading Research V31.8

## Sidebar organizada

V31.8 reorganiza el menú lateral sin cambiar rutas, datos ni comportamiento de los módulos.

### Nueva arquitectura

- **Dashboard** permanece como acceso directo.
- **Operativa**
  - Operaciones
  - Calendario
  - Diario emocional
- **Investigación**
  - Centro Research
  - Cambios
  - Laboratorio
  - Review & Notes
  - Biblioteca visual
- **Control y seguimiento**
  - Objetivos
  - Cumplimiento
  - Errores
  - Bloques
  - Informes
- **Datos y ejecución**
  - Calidad datos
  - Market Data
- **Plan y sistema**
  - Trading Plans
  - Configuración

### Comportamiento

- Los grupos funcionan como desplegables y reducen la altura ocupada por el menú.
- Al cambiar de módulo se abre automáticamente el grupo al que pertenece la vista actual.
- El grupo abierto se recuerda localmente.
- El contador de **Cambios** se conserva y también aparece en el encabezado de **Investigación** cuando el grupo está cerrado.
- El modo claro/oscuro y la tarjeta de versión se mantienen.
- No requiere cambios SQL.

### Herencia V31.7.1

- Aislamiento Replay / Sim / Live.
- Recorrido intratrade con velas OHLC de Last.
- P&L en ticks como vista auxiliar.
- Contraste corregido en modo oscuro.

## Build

```bash
npm run build
```
