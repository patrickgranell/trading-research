# Trading Research V4.1

V3 introduce **Trading Plans como entidad principal de investigación**.

## Arquitectura

- **Biblioteca global de contratos**: símbolo, tick size, valor del tick, comisión y moneda.
- **Trading Plans versionados**: cada plan mantiene sus propios setups, VD, NR, hipótesis, salidas discrecionales y estrategias de gestión.
- **Datasets aislados por plan**: operaciones, bloques e importaciones quedan vinculados a una versión concreta.
- **Clonado de versiones**: permite copiar la configuración de un plan sin copiar sus operaciones.
- **Importaciones Ankora trazables**: cada fichero crea un lote de importación y queda asociado al Trading Plan seleccionado.
- **Comparación rápida entre planes**: operaciones, win rate, expectancy, profit factor y drawdown.

## Despliegue Cloudflare

Build command:

```text
npm run build
```

Deploy command:

```text
npx wrangler deploy
```

Los datos siguen guardándose en `localStorage` mientras validamos la arquitectura. La persistencia multi-dispositivo, usuarios e imágenes se conectarán a Supabase después.


## V4 · Import Inspector
- Previsualización del TXT antes de confirmar.
- Mapa de columnas RAW → campos analíticos.
- Edición de Setup, VD, NR, hipótesis, contrato y estrategia antes de importar.
- Detección visual de posibles actualizaciones/duplicados por misma entrada.
- Auditoría posterior por lote de importación.
- Edición de la capa normalizada sin modificar el RAW original.


## V4.1 · Modales protegidos

- Pulsar sobre el fondo oscuro ya no cierra ninguna ventana modal.
- Se elimina el cierre accidental mediante la X del encabezado.
- Una ventana de edición solo se cierra mediante los botones explícitos del pie: Guardar, Cancelar, Cerrar, Confirmar, etc.
- Mantiene la misma clave de almacenamiento de V4 para no perder datos locales.
