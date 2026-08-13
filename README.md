# Trading Research V1

Primera versión funcional para validar el flujo de registro y análisis de operaciones.

## Archivos

Todos los archivos están en la raíz para facilitar la subida manual a GitHub:

- `index.html`
- `app.js`
- `styles.css`
- `package.json`
- `wrangler.jsonc`
- `README.md`

## Despliegue en Cloudflare Workers

El proyecto usa Static Assets. No necesita comando de build.

Deploy command:

```text
npx wrangler deploy
```

En esta V1 los datos se guardan en el navegador (localStorage). Supabase se conectará después de validar el flujo funcional.
