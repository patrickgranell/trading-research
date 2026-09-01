# Supabase V10 · Remote Migration Gate

V31.24 remains **NO MERGE / NO PRODUCTION** until the remote Supabase project has the migration:

`supabase/migrations/202609010001_v31_24_cloud_v10.sql`

installed and the remote gate below passes.

## 1. Apply the migration

Run the exact versioned SQL file against the configured Supabase project using an administrative channel such as the Supabase SQL Editor or an authenticated migration workflow.

Do not edit the SQL ad hoc in the remote project. The repository copy is the audited source of truth.

The migration adds:

- `trading_workspace.master_library jsonb`;
- `public.apply_trading_workspace(text,jsonb)`;
- transaction-scoped user locking;
- CAS revision validation;
- atomic writes/deletes across the relational workspace tables;
- final workspace revision publication;
- execute permission only for `authenticated`.

## 2. Obtain a user session token

The probe requires a **normal authenticated user access token**, not a service-role token, because the RPC derives ownership from `auth.uid()`.

Keep all credentials outside the repository.

Required environment variables:

```text
TR_SUPABASE_URL
TR_SUPABASE_ANON_KEY
TR_SUPABASE_ACCESS_TOKEN
```

## 3. Run the non-destructive gate

```bash
npm run verify:remote:supabase-v10
```

The probe performs exactly two requests:

1. `GET /rest/v1/trading_workspace?select=master_library&limit=0`
   - resolves the new column;
   - returns zero rows;
   - performs no write.

2. `POST /rest/v1/rpc/apply_trading_workspace` with:
   ```json
   {"p_expected_revision":"","p_bundle":null}
   ```
   - the installed function must reject with `INVALID_WORKSPACE_BUNDLE`;
   - that validation occurs before advisory locking and before any DML;
   - the RPC transaction therefore performs zero durable writes.

Expected terminal result:

```text
Supabase V10 remote gate OK
 - trading_workspace.master_library: exposed
 - apply_trading_workspace(text,jsonb): installed + executable by authenticated user
 - null-bundle rejection: INVALID_WORKSPACE_BUNDLE
 - probe writes: 0
```

## 4. Release-gate interpretation

Only after the remote gate is green may the project state move from:

```text
REMOTE MIGRATION PENDING
```

to:

```text
REMOTE MIGRATION VERIFIED
```

This gate proves installation/exposure and authenticated execution of the audited RPC without mutating workspace data. The existing V10 fault-injection CI continues to prove CAS/transaction semantics in the repository implementation.

Until then the client remains intentionally fail-closed with `CLOUD_V10_RPC_REQUIRED`.
