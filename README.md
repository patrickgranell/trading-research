# Trading Research V9 — Supabase Cloud Sync

V9 conserva toda la funcionalidad estable de V8.1 y añade persistencia segura con Supabase.

## Novedades

- Nueva pestaña **Configuración → Nube**.
- Project URL + **Publishable key** (nunca Secret/service_role en el navegador).
- Supabase Auth con email/contraseña.
- Sincronización de:
  - workspace,
  - Trading Plans,
  - contratos,
  - operaciones,
  - importaciones,
  - oportunidades.
- Imágenes en bucket privado `trading-images`.
- RLS por `auth.uid()` para aislar los datos de cada usuario.
- Subida manual, descarga manual y auto-sync opcional.
- Las imágenes pueden cargarse desde IndexedDB local o desde Supabase mediante URL firmada.
- El backup `.trbackup` sigue funcionando y puede incluir imágenes cloud aunque no estén descargadas localmente.

## Antes de usar la nube

1. Ejecuta `supabase-schema-v9.sql` en Supabase SQL Editor.
2. Copia la **Publishable key** desde Supabase → Settings → API Keys.
3. En Trading Research abre **Configuración → Nube**.
4. Guarda URL/key, crea o inicia sesión.
5. En el dispositivo principal pulsa **Subir local → Supabase**.

## Despliegue Cloudflare

Build: `npm run build`

Deploy: `npx wrangler deploy`
