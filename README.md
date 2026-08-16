# Trading Research V31.8.1

## Sidebar compacta

Ajuste visual y de interacción sobre V31.8. No modifica rutas, datos ni módulos.

### Cambios

- El menú se apila desde arriba: las filas ya no se estiran para rellenar toda la altura disponible.
- Dashboard y encabezados de grupo usan rectángulos más compactos.
- Los elementos internos de cada desplegable también reducen altura y padding.
- El espacio sobrante queda libre en la parte inferior, en lugar de repartirse entre opciones.
- Los cinco grupos pueden permanecer abiertos simultáneamente; abrir uno ya no cierra los demás.
- El conjunto de grupos abiertos se recuerda localmente.
- Al navegar a una sección, su grupo se abre automáticamente sin cerrar los que ya estuvieran abiertos.
- Si todo el menú está desplegado y supera la altura disponible, el lateral conserva su scroll propio.

### Arquitectura heredada

- Dashboard
- Operativa
- Investigación
- Control y seguimiento
- Datos y ejecución
- Plan y sistema

### Herencia V31.7.1

- Aislamiento Replay / Sim / Live.
- Recorrido intratrade con velas OHLC de Last.
- P&L en ticks como vista auxiliar.
- Contraste corregido en modo oscuro.

No requiere cambios SQL.

## Build

```bash
npm run build
```
