-- Supabase Vault secrets (like the Gemini API key) live in the `vault`
-- schema, which PostgREST doesn't expose by default. This SECURITY DEFINER
-- function lets an Edge Function's service-role client read a named secret
-- via RPC instead. Only service_role can call it.
create or replace function public.get_vault_secret(secret_name text)
returns text
language sql
security definer
set search_path = public, vault
as $$
  select decrypted_secret from vault.decrypted_secrets where name = secret_name;
$$;

revoke execute on function public.get_vault_secret(text) from public;
revoke execute on function public.get_vault_secret(text) from anon;
revoke execute on function public.get_vault_secret(text) from authenticated;
grant execute on function public.get_vault_secret(text) to service_role;
