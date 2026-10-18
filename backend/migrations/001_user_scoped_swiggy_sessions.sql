create table if not exists public.resolveai_swiggy_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  access_token_ciphertext text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.resolveai_swiggy_tokens enable row level security;
revoke all on table public.resolveai_swiggy_tokens from anon, authenticated;
grant select, insert, update, delete on table public.resolveai_swiggy_tokens to service_role;

create table if not exists public.resolveai_swiggy_oauth_states (
  state text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  verifier_ciphertext text not null,
  created_at timestamptz not null default now()
);

alter table public.resolveai_swiggy_oauth_states enable row level security;
revoke all on table public.resolveai_swiggy_oauth_states from anon, authenticated;
grant select, insert, update, delete on table public.resolveai_swiggy_oauth_states to service_role;

create or replace function public.consume_resolveai_swiggy_oauth_state(p_state text)
returns table (user_id uuid, verifier_ciphertext text, created_at timestamptz)
language sql
security definer
set search_path = ''
as $$
  delete from public.resolveai_swiggy_oauth_states as oauth_state
  where oauth_state.state = p_state
  returning oauth_state.user_id, oauth_state.verifier_ciphertext, oauth_state.created_at;
$$;

revoke all on function public.consume_resolveai_swiggy_oauth_state(text) from public, anon, authenticated;
grant execute on function public.consume_resolveai_swiggy_oauth_state(text) to service_role;
