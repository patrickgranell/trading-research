-- Trading Research V31.25 · Cloud V10 ACL hardening
-- Mirrors the production migration applied through Supabase MCP.
-- The V10 RPC is SECURITY DEFINER by design, but must not be callable by
-- unauthenticated or service roles. auth.uid() remains an in-function guard.

revoke execute on function public.apply_trading_workspace(text,jsonb)
  from PUBLIC, anon, service_role;

grant execute on function public.apply_trading_workspace(text,jsonb)
  to authenticated;
