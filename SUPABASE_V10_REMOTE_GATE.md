# Supabase V10 · Remote Release Gate

## Estado

La migración V10 versionada:

`supabase/migrations/202609010001_v31_24_cloud_v10.sql`

fue instalada y verificada contra el proyecto Supabase real durante el cierre de V31.24.

Este documento **no significa que la migración esté pendiente**. Define un gate remoto repetible que debe volver a ejecutarse cuando una promoción/release necesite certificar que el entorno remoto objetivo sigue exponiendo exactamente el contrato esperado.

El gate remoto es deliberadamente **manual**. No forma parte del CI estándar porque requiere un JWT de usuario autenticado y no se deben almacenar tokens de usuario en el repositorio ni añadirlos a GitHub únicamente para automatizar este control administrativo.

El cliente Cloud V10 permanece fail-closed: si el RPC requerido no existe o no es utilizable, la escritura no cae silenciosamente a V9.2.

## 1. Source of truth

El SQL auditado es:

`supabase/migrations/202609010001_v31_24_cloud_v10.sql`

No edites la función ad hoc en el proyecto remoto. Si una migración futura cambia el contrato, debe existir primero como archivo versionado en el repositorio y pasar sus gates de source/transaction semantics.

La migración V10 instala:

- `trading_workspace.master_library jsonb`;
- `public.apply_trading_workspace(text,jsonb)`;
- lock de usuario con alcance transaccional;
- validación CAS de revisión;
- escrituras/deletes relacionales dentro de una única transacción;
- publicación de la revisión solo después del éxito de la transacción;
- permiso de ejecución para `authenticated`.

## 2. Credenciales efímeras

El probe necesita un **access token de un usuario autenticado normal**, no un service-role token, porque el RPC deriva ownership desde `auth.uid()`.

Las credenciales se aportan exclusivamente mediante variables de entorno:

```text
TR_SUPABASE_URL
TR_SUPABASE_ANON_KEY
TR_SUPABASE_ACCESS_TOKEN
```

No deben:

- escribirse en archivos versionados;
- imprimirse en logs;
- añadirse al README;
- convertirse en GitHub secrets únicamente para este gate si eso supone almacenar un JWT de usuario de larga duración.

El script redacta cadenas largas en respuestas de error como defensa adicional, pero la protección principal es no persistir los secretos.

## 3. Ejecutar el gate no destructivo

```bash
npm run verify:remote:supabase-v10
```

El gate realiza exactamente dos requests.

### Probe A · columna V10

```text
GET /rest/v1/trading_workspace?select=master_library&limit=0
```

Propiedad certificada:

- PostgREST puede resolver `master_library`;
- se solicitan cero filas;
- no existe escritura.

### Probe B · RPC V10

```text
POST /rest/v1/rpc/apply_trading_workspace
```

Payload deliberadamente inválido:

```json
{"p_expected_revision":"","p_bundle":null}
```

Resultado esperado:

`INVALID_WORKSPACE_BUNDLE`

La migración auditada valida ese bundle antes del advisory lock, `SELECT FOR UPDATE` y cualquier DML. La llamada aborta su transacción y deja **cero escrituras durables**.

Resultado terminal esperado:

```text
Supabase V10 remote gate OK
 - trading_workspace.master_library: exposed
 - apply_trading_workspace(text,jsonb): installed + executable by authenticated user
 - null-bundle rejection: INVALID_WORKSPACE_BUNDLE
 - probe writes: 0
```

## 4. Qué demuestra y qué no demuestra

Un gate verde demuestra para el entorno remoto consultado en ese momento:

- la columna V10 está expuesta;
- el RPC existe y está expuesto;
- un usuario autenticado puede ejecutarlo;
- la implementación rechaza el bundle nulo con el contrato esperado;
- ese probe concreto no escribe datos.

No sustituye:

- los gates locales de atomicidad/CAS;
- el fault-injection del repositorio;
- la verificación de la migración SQL versionada;
- una prueba funcional de sincronización real cuando un release la requiera.

Esas propiedades se certifican por separado en CI mediante los verificadores V10.

## 5. Interpretación como release gate

Antes de promover un candidato que dependa de Cloud V10:

1. usa el SHA candidato ya certificado por CI;
2. comprueba la preview Cloudflare del mismo SHA;
3. ejecuta este gate contra el proyecto Supabase de producción con credenciales efímeras;
4. conserva únicamente el resultado del gate, nunca el token;
5. si falla, la promoción queda bloqueada;
6. si pasa, puede registrarse:

```text
REMOTE MIGRATION VERIFIED
```

con la fecha/SHA de la promoción correspondiente.

La verificación realizada durante V31.24 prueba el estado remoto de aquel cierre; **no debe reutilizarse indefinidamente como sustituto de una comprobación remota futura**.

## 6. Fallos esperados

El gate falla cerrado si:

- falta alguna variable de entorno;
- `master_library` no se puede resolver;
- el RPC no existe o no está en el schema cache;
- el token no representa a un usuario autenticado;
- el caller no puede ejecutar el RPC;
- el bundle nulo tiene una respuesta distinta de `INVALID_WORKSPACE_BUNDLE`;
- el RPC acepta inesperadamente el bundle nulo.

No existe interpretación de “warning pero continuar” para una promoción que requiera Cloud V10.
