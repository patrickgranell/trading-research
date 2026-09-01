-- Trading Research V31.24 · Cloud V10
-- Apply manually to the configured Supabase project before enabling V10 writes.
-- One RPC call = one PostgreSQL transaction. Any uncaught error rolls back every
-- child-table change and the workspace revision.

alter table public.trading_workspace
  add column if not exists master_library jsonb;

create or replace function public.apply_trading_workspace(
  p_expected_revision text,
  p_bundle jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_current_revision timestamptz;
  v_next_revision timestamptz := clock_timestamp();
  v_expected text := coalesce(p_expected_revision, '');
  v_exists boolean := false;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_bundle is null or jsonb_typeof(p_bundle) <> 'object' then
    raise exception 'INVALID_WORKSPACE_BUNDLE';
  end if;

  -- Serialize even first-write races where no trading_workspace row exists yet.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));

  select updated_at
    into v_current_revision
    from public.trading_workspace
   where user_id = v_user
   for update;
  v_exists := found;

  if v_exists then
    if v_expected = '' or v_current_revision::text <> v_expected then
      return jsonb_build_object(
        'ok', false,
        'conflict', true,
        'remote_revision', v_current_revision
      );
    end if;
  elsif v_expected <> '' then
    return jsonb_build_object(
      'ok', false,
      'conflict', true,
      'remote_revision', null
    );
  end if;

  -- Plans
  insert into public.trading_plans
    (user_id,id,family_name,name,version,status,updated_at,payload)
  select
    v_user,x.id,x.family_name,x.name,x.version,x.status,x.updated_at,x.payload
  from jsonb_to_recordset(coalesce(p_bundle->'plans','[]'::jsonb)) as x(
    id text,family_name text,name text,version text,status text,
    updated_at timestamptz,payload jsonb
  )
  on conflict (user_id,id) do update set
    family_name=excluded.family_name,
    name=excluded.name,
    version=excluded.version,
    status=excluded.status,
    updated_at=excluded.updated_at,
    payload=excluded.payload;

  delete from public.trading_plans t
   where t.user_id=v_user
     and not exists (
       select 1
       from jsonb_to_recordset(coalesce(p_bundle->'plans','[]'::jsonb)) as x(id text)
       where x.id=t.id
     );

  -- Instruments
  insert into public.trading_instruments
    (user_id,id,symbol,name,active,updated_at,payload)
  select
    v_user,x.id,x.symbol,x.name,x.active,x.updated_at,x.payload
  from jsonb_to_recordset(coalesce(p_bundle->'instruments','[]'::jsonb)) as x(
    id text,symbol text,name text,active boolean,
    updated_at timestamptz,payload jsonb
  )
  on conflict (user_id,id) do update set
    symbol=excluded.symbol,
    name=excluded.name,
    active=excluded.active,
    updated_at=excluded.updated_at,
    payload=excluded.payload;

  delete from public.trading_instruments t
   where t.user_id=v_user
     and not exists (
       select 1
       from jsonb_to_recordset(coalesce(p_bundle->'instruments','[]'::jsonb)) as x(id text)
       where x.id=t.id
     );

  -- Operations
  insert into public.trading_operations
    (user_id,id,trading_plan_id,entry_date,direction,setup,vd,nr,result,
     r_multiple,pnl_net,result_ticks,updated_at,payload)
  select
    v_user,x.id,x.trading_plan_id,x.entry_date,x.direction,x.setup,x.vd,x.nr,x.result,
    x.r_multiple,x.pnl_net,x.result_ticks,x.updated_at,x.payload
  from jsonb_to_recordset(coalesce(p_bundle->'operations','[]'::jsonb)) as x(
    id text,trading_plan_id text,entry_date timestamptz,direction text,
    setup text,vd text,nr text,result text,r_multiple double precision,
    pnl_net double precision,result_ticks double precision,
    updated_at timestamptz,payload jsonb
  )
  on conflict (user_id,id) do update set
    trading_plan_id=excluded.trading_plan_id,
    entry_date=excluded.entry_date,
    direction=excluded.direction,
    setup=excluded.setup,
    vd=excluded.vd,
    nr=excluded.nr,
    result=excluded.result,
    r_multiple=excluded.r_multiple,
    pnl_net=excluded.pnl_net,
    result_ticks=excluded.result_ticks,
    updated_at=excluded.updated_at,
    payload=excluded.payload;

  delete from public.trading_operations t
   where t.user_id=v_user
     and not exists (
       select 1
       from jsonb_to_recordset(coalesce(p_bundle->'operations','[]'::jsonb)) as x(id text)
       where x.id=t.id
     );

  -- Import batches
  insert into public.trading_import_batches
    (user_id,id,trading_plan_id,imported_at,updated_at,payload)
  select
    v_user,x.id,x.trading_plan_id,x.imported_at,x.updated_at,x.payload
  from jsonb_to_recordset(coalesce(p_bundle->'batches','[]'::jsonb)) as x(
    id text,trading_plan_id text,imported_at timestamptz,
    updated_at timestamptz,payload jsonb
  )
  on conflict (user_id,id) do update set
    trading_plan_id=excluded.trading_plan_id,
    imported_at=excluded.imported_at,
    updated_at=excluded.updated_at,
    payload=excluded.payload;

  delete from public.trading_import_batches t
   where t.user_id=v_user
     and not exists (
       select 1
       from jsonb_to_recordset(coalesce(p_bundle->'batches','[]'::jsonb)) as x(id text)
       where x.id=t.id
     );

  -- Opportunities
  insert into public.trading_opportunities
    (user_id,id,trading_plan_id,updated_at,payload)
  select
    v_user,x.id,x.trading_plan_id,x.updated_at,x.payload
  from jsonb_to_recordset(coalesce(p_bundle->'opportunities','[]'::jsonb)) as x(
    id text,trading_plan_id text,updated_at timestamptz,payload jsonb
  )
  on conflict (user_id,id) do update set
    trading_plan_id=excluded.trading_plan_id,
    updated_at=excluded.updated_at,
    payload=excluded.payload;

  delete from public.trading_opportunities t
   where t.user_id=v_user
     and not exists (
       select 1
       from jsonb_to_recordset(coalesce(p_bundle->'opportunities','[]'::jsonb)) as x(id text)
       where x.id=t.id
     );

  -- Publish workspace metadata and the new revision LAST. If anything above raises,
  -- PostgreSQL rolls back the entire function call and this revision never appears.
  insert into public.trading_workspace
    (user_id,current_plan_id,app_version,schema_version,updated_at,master_library)
  values
    (
      v_user,
      coalesce(p_bundle->>'currentPlanId',''),
      coalesce(p_bundle->>'appVersion','10.0.0'),
      coalesce((p_bundle->>'schemaVersion')::integer,1),
      v_next_revision,
      coalesce(p_bundle->'masterLibrary','{"schemaVersion":1,"items":[]}'::jsonb)
    )
  on conflict (user_id) do update set
    current_plan_id=excluded.current_plan_id,
    app_version=excluded.app_version,
    schema_version=excluded.schema_version,
    updated_at=excluded.updated_at,
    master_library=excluded.master_library;

  return jsonb_build_object(
    'ok', true,
    'conflict', false,
    'revision', v_next_revision
  );
end;
$$;

revoke all on function public.apply_trading_workspace(text,jsonb) from public;
grant execute on function public.apply_trading_workspace(text,jsonb) to authenticated;
