# Trading Research V31.9.1

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


## V31.9.1 · Comisión desde la biblioteca de contratos

- Las operaciones NinjaTrader usan la comisión round-turn configurada en `Configuración → Contratos`, aunque el CSV no incluya una comisión útil.
- El contrato se resuelve por símbolo raíz: por ejemplo `MCL 08-26` coincide con `MCL`.
- La comisión se aplica a Replay, Sim y Live y se multiplica por la cantidad ejecutada.
- El P&L neto se recalcula como P&L bruto menos comisión.
- Las operaciones NinjaTrader ya creadas en V31.9 se corrigen automáticamente al arrancar mediante la sincronización existente; no hace falta reimportar el Grid.
- Al editar los campos cualitativos de una operación NinjaTrader, la sincronización vuelve a imponer los datos objetivos del fill y su comisión para que no se pierdan.

No requiere cambios SQL.
