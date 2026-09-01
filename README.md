# Trading Research · V31.25 Reaudit Hardening

Trading Research es una aplicación local-first para registrar operaciones, analizar métricas, calibrar ejecuciones con Market Data de NinjaTrader y sincronizar el workspace con Supabase.

## Estado de release

- **Producción / `main`**: V31.24.0.
- **Rama de hardening / release candidate**: `v31.25-reaudit-hardening` · V31.25.0.
- **PR de trabajo**: V31.25 · Reaudit Hardening.
- La rama de hardening no debe promoverse a producción hasta que el **mismo SHA** tenga CI completo verde, preview Cloudflare correcta, smoke test y gate remoto Supabase V10 cuando corresponda.
- La versión visible de la rama candidata se promociona a V31.25.0 en este release candidate; producción continúa en V31.24.0 hasta merge y despliegue controlados.

## Arquitectura actual

### Persistencia y autoridad de estado

El workspace durable usa IndexedDB como autoridad primaria. `localStorage` no es una segunda fuente de verdad del workspace; se conserva únicamente para configuración pequeña, compatibilidad/migración y señales de bootstrap.

`state-runtime.js` separa el dominio durable de la UI efímera mediante `TRDomainStore` y `TRUIStore`. Las mutaciones profundas del dominio están observadas por Proxy y los comandos controlados coalescen persistencia y render.

La importación de Market Data publica `marketMeta` + `marketTicks` en una única transacción IndexedDB. Los imports de dominio y los reemplazos completos tienen boundaries explícitos.

### Event Boundary

Los handlers HTML se compilan en build a planes estructurados. El navegador no contiene tokenizer, parser, AST cache ni fallback de acciones a `globalThis`.

Las acciones se resuelven únicamente como propiedades propias de `TradingResearchActions`; los valores dinámicos viajan como slots JSON URI-encoded separados del plan ejecutable. Las Promise rechazadas por handlers asíncronos quedan observadas.

El build exige una segunda pasada idempotente: un bundle válido no puede contener programas legacy efectivos pendientes de compilar.

### Backup V2 y recovery

Backup V2 cubre:

- workspace;
- imágenes alcanzables;
- `marketMeta`;
- `marketTicks`;
- `execSets`;
- manifest con conteos, hashes y referencias esperadas.

Restore usa journal durable y fases recuperables. Si una restauración falla y queda un journal recuperable:

1. la UI queda bloqueada;
2. `TRDomainStore` y el Proxy de `state` rechazan mutaciones;
3. la persistencia durable normal queda bloqueada;
4. únicamente `backup.restore-v2*` puede atravesar el boundary;
5. un recovery exitoso o un abort seguro pre-Market elimina el journal y libera el lock;
6. un recovery fallido conserva journal + lock.

En una recarga, la UI se bloquea inmediatamente, pero el lock durable se adquiere después de terminar la hidratación del core para no bloquear el bootstrap de IndexedDB.

Gate permanente: `verify-restore-recovery-lock.mjs`.

### Market Data, Position Ledger e intratrade

El Position Ledger reconstruye scale-in, scale-out, salidas parciales, re-entry, reversals y aislamiento por cuenta + instrumento.

El P&L intratrade es position-aware: en cada tick se reconstruyen la cantidad abierta, el precio medio vigente, P&L realizado, P&L no realizado y P&L total. No se aplica retroactivamente el precio medio final a ticks anteriores a un scale-in.

La representación de memoria está separada de la resolución financiera:

- **Calibración**: escaneo exacto con memoria O(1) para el recorrido de cada trade.
- **Running P&L**: todas las observaciones se conservan como `Int32Array tickIndex` + `Float64Array pnlTicks`, reutilizando el histórico Tick bruto para Last/Bid/Ask.
- **Render**: el gráfico dibuja como máximo 1.500 puntos, pero cursor, MFE/MAE, extremos y resultados trabajan a resolución completa.
- **Exit Lab**: consume el histórico Tick bruto directamente para first-touch; no depende del downsample visual ni de la representación compacta de Running P&L.

Con el límite actual de 2.000.000 observaciones, las dos columnas intratrade ocupan 24.000.000 bytes (~22,9 MiB), además del dataset Tick bruto compartido.

Gate permanente: `verify-intratrade-memory.mjs`.

### Canonical Metrics

Las métricas canónicas se normalizan después de la hidratación durable. Un resultado ausente permanece ausente/null y no se degrada a cero.

La semántica de Profit Factor distingue:

- ganancias con cero pérdidas → `Infinity`;
- cero ganancias y cero pérdidas → `0`.

Operaciones pendientes no contaminan n, PF, expectancy ni win rate. Los consumidores analíticos principales comparten la misma semántica canónica.

### Blob Lifecycle

Las referencias durables se publican antes del garbage collection de blobs. Un fallo de persistencia revierte memoria y ejecuta cero GC; un fallo de GC posterior al commit deja un orphan recuperable, nunca una referencia viva apuntando a un blob ya eliminado.

Los diagnósticos fallan cerrado: `OK` exige cero fallos locales y cloud pendientes.

### Supabase Cloud V10

Las migraciones versionadas relevantes son:

- `supabase/migrations/202609010001_v31_24_cloud_v10.sql` — contrato transaccional V10;
- `supabase/migrations/20260901202021_v31_25_cloud_v10_acl_hardening.sql` — hardening de EXECUTE del RPC.

Cloud V10 usa `public.apply_trading_workspace(text,jsonb)` como boundary transaccional único para CAS + escrituras relacionales del workspace. La revisión se publica solo si la transacción completa tiene éxito. Si el RPC requerido no está disponible, el cliente falla cerrado; no existe fallback de escritura V9.2.

La verificación remota V31.25 detectó que el proyecto conservaba grants explícitos de `EXECUTE` para `anon` y `service_role` aunque `PUBLIC` ya estuviera revocado. El hardening posterior deja el ACL efectivo del RPC como `authenticated` únicamente; el guard interno `AUTH_REQUIRED` se mantiene como defensa adicional.

El gate remoto sigue siendo deliberadamente **manual** para la parte que requiere identidad de usuario. La instalación y el ACL se han comprobado contra el proyecto remoto real y deben poder repetirse antes de una promoción/release. Véase `SUPABASE_V10_REMOTE_GATE.md`.

No se deben almacenar tokens de usuario en el repositorio ni añadir un JWT de usuario a GitHub únicamente para convertir este control administrativo en un check automático.

### CSP y Style Boundary

El build genera la CSP y verifica sus hashes:

- `script-src-attr 'none'`;
- sin `unsafe-eval`;
- scripts propios autorizados por hashes SHA-256;
- SDK Supabase fijado a una versión concreta;
- `style-src-attr 'none'`;
- cero atributos `style` efectivos en el bundle.

Los estilos legacy de fuente se transforman a tokens `data-tr-style` durante build y se hidratan mediante el runtime dedicado.

## Reauditoría V31.25

La reauditoría no se acepta por autoridad: cada hallazgo se reproduce o se descarta contra el repositorio real.

| Hallazgo | Estado V31.25 |
| --- | --- |
| N01 · scale-in/out intratrade | Corregido y gateado |
| N02 · Canonical antes de hydration | Corregido y gateado |
| N03 · resultado null vs 0 | Corregido y gateado |
| N04 · Blob diagnostics OK invertido | Corregido y gateado |
| N05 · Ankora inválido → 0 | Corregido y gateado |
| D18 · CLI/build contract-map distinto | Corregido; etapa unificada |
| Restore recovery entre fallos | Corregido; write lock recuperable |
| D12 · memoria intratrade | Corregido sin pérdida de resolución |
| D04 · Event Boundary injection | Cerrado; no reabierto |
| D14 · Supabase V10 atomicidad | Cerrado; no reabierto |
| D17 · global-surface overclaim | Cerrado como overclaim |
| Remote Supabase gate | Verificado en producción; ACL V10 endurecido y probe con cero escrituras |
| README | Actualizado en esta ronda |

## Verificación local y CI

Requisito: Node.js 24.

Prebuild completo:

```bash
npm run prebuild
```

Build completo:

```bash
npm run build
```

`prebuild` ejecuta verificadores de seguridad, Event Boundary, Canonical Metrics, Supabase contract, Market Data, Position Ledger, memoria intratrade, Blob Lifecycle, Backup/Restore, Recovery Lock, Storage Authority, CSP, estilos, render closure, source consolidation y freeze estructural/financiero.

`build` genera `dist/` y vuelve a verificar el artefacto empaquetado, CSP, Style Boundary y consolidación final.

Las ocho regiones financieras protegidas están congeladas por SHA-256 en `financial-regression-baseline.json`. Un cambio intencional exige:

1. red gate o reproducción de la propiedad;
2. prueba funcional específica;
3. revisión del delta exacto;
4. obtención del SHA-256 nuevo;
5. rebaseline únicamente de las regiones deliberadamente modificadas;
6. CI completo verde.

No se rebaselina una freeze para “hacer pasar” el CI.

## Gate remoto Supabase V10

El gate no destructivo se ejecuta fuera del CI estándar con credenciales aportadas por entorno:

```text
TR_SUPABASE_URL
TR_SUPABASE_ANON_KEY
TR_SUPABASE_ACCESS_TOKEN
```

```bash
npm run verify:remote:supabase-v10
```

El access token debe pertenecer a un usuario autenticado normal, porque el RPC deriva ownership desde `auth.uid()`. El probe realiza un GET de cero filas y una llamada RPC con bundle nulo que debe abortar con `INVALID_WORKSPACE_BUNDLE` antes de lock/DML.

Los secretos nunca se imprimen y no deben persistirse en el repositorio.

## Protocolo de promoción

Un candidato de release solo puede promoverse cuando:

1. el PR está basado en el `main` previsto;
2. el head exacto tiene `npm run prebuild` y `npm run build` verdes en CI;
3. Cloudflare ha desplegado preview del **mismo SHA**;
4. se ha ejecutado el smoke test necesario sobre esa preview;
5. el gate remoto Supabase V10 está verde para el entorno de producción cuando el release lo requiere;
6. la versión visible se promociona de forma deliberada;
7. solo entonces se hace merge controlado y despliegue de producción.

Las previews de una rama de hardening no convierten esa rama en producción.

## Archivos clave

- `app.js`: aplicación histórica + lógica Market Data/analytics.
- `state-runtime.js`: DomainStore/UIStore, atomic imports y mutation boundary.
- `backup-v2-runtime.js`: backup/restore/journal/recovery.
- `event-runtime.js`: dispatcher estructurado en navegador.
- `structured-event-transform.mjs`: compilador build-time de handlers.
- `canonical-metrics-runtime.js`: semántica financiera canónica.
- `blob-lifecycle-runtime.js`: reachability + GC local/cloud.
- `cloud-v10-runtime.js`: cliente Cloud V10 fail-closed.
- `exit-lab-runtime.js`: first-touch Tick para escenarios de salida.
- `build.mjs`: pipeline de empaquetado.
- `financial-regression-baseline.json`: freeze de regiones financieras.
- `verify-*.mjs`: gates permanentes.
- `SUPABASE_V10_REMOTE_GATE.md`: procedimiento del gate remoto.
- `BUILD.md`: comandos de build/deploy.

## Principio de mantenimiento

Los verificadores no son prueba por sí solos. Cuando una auditoría cuestiona una propiedad, la secuencia esperada es:

```text
reproducción
→ red gate
→ corrección mínima
→ verifier permanente
→ CI
→ artefacto real
→ preview
→ prueba runtime/remota cuando proceda
→ promoción controlada
```

El historial detallado de fases anteriores permanece disponible en Git y en los PRs; este README describe la arquitectura y los gates vigentes, no un changelog acumulativo.
