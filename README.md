# Trading Research V31.9

## NinjaTrader Grid → Operaciones

Esta versión mantiene la sidebar compacta V31.8.1 y conecta de forma explícita la capa de ejecución de NinjaTrader con el registro normal de Operaciones.

### Cambios

- Cada trade cerrado de un Grid NinjaTrader importado crea una operación normal en el Trading Plan activo.
- La operación nace con los datos objetivos disponibles: fecha/hora, contrato, dirección, cantidad, precio de entrada/salida, resultado en ticks y, si existe histórico Tick asociado, MFE/MAE.
- Setup, VD, NR, hipótesis, contexto H4 y régimen de gestión quedan vacíos y marcados como pendientes para completar manualmente.
- El origen se muestra como NinjaTrader · Replay / Sim / Live.
- Replay, Sim y Live continúan aislados en Market Data. Una operación Ankora o manual que no exista en el Grid no aparece por arte de magia en Market Data.
- Los Grids ya importados en V31.8.1 se migran al arrancar y crean sus filas faltantes sin obligar a reimportar el CSV.
- Se usa una huella estable de ejecuciones para evitar duplicar operaciones si se vuelve a importar el mismo Grid.
- Si ya existe una operación preparada como Pendiente NinjaTrader con un match muy alto, no se crea un duplicado: se conserva el flujo de revisión/vinculación.
- Al editar una operación creada desde NinjaTrader se conserva su Execution Evidence.

### Nota de métricas

Mientras una operación NinjaTrader no tenga régimen/riesgo inicial asignado, su columna R se muestra como «—» en el registro. Los ticks y los fills sí son evidencia objetiva desde el momento de la importación.

No requiere cambios SQL.

## Build

```bash
npm run build
```
