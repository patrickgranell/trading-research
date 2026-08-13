# Trading Research V3

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
