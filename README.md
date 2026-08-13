# Trading Research V8 — Setups, VD y Contexto visual integrado

## Novedades principales

- **Setups enriquecidos desde Configuración**
  - cada setup puede tener:
    - nombre,
    - timeframes,
    - descripción/checklist,
    - **imagen LONG**, 
    - **imagen SHORT**.

- **VD enriquecidas**
  - cada VD puede tener:
    - nombre,
    - timeframes,
    - descripción,
    - imagen de referencia.

- **Nuevo apartado de Contexto**
  - permite definir contextos como:
    - EB Norm,
    - EA Norm,
    - Impulso,
    - Retroceso,
  - con:
    - descripción,
    - especificaciones,
    - timeframes,
    - imagen de ejemplo.

- **Referencias visuales mejor expuestas**
  - la pestaña visual ahora muestra una galería más clara de:
    - Setups,
    - VD,
    - Contextos,
  - y conserva referencias legacy de la versión anterior.

- **Formulario de operación mejorado**
  - el campo **Contexto H4** ya puede apoyarse en los contextos configurados.

- **Compatibilidad con datos anteriores**
  - los planes existentes se migran en cliente a la nueva estructura visual sin perder operaciones.

## Persistencia

- Las imágenes siguen guardándose localmente en **IndexedDB**.
- La metadata sigue viviendo en el estado local del proyecto.

## Despliegue

Build:
```bash
npm run build
```

Deploy:
```bash
npx wrangler deploy
```
