create table if not exists public.resolveai_complaints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  complaint_text text not null check (char_length(complaint_text) between 1 and 4000),
  language text not null default 'en',
  platform text not null default 'unknown',
  issue text not null default 'unknown',
  requested_action text not null default 'unknown',
  status text not null default 'in_progress' check (status in ('in_progress', 'solved')),
  created_at timestamptz not null default now()
);

create index if not exists resolveai_complaints_user_created_idx
  on public.resolveai_complaints (user_id, created_at desc);

alter table public.resolveai_complaints enable row level security;
revoke all on table public.resolveai_complaints from anon, authenticated;
grant select, insert, update, delete on table public.resolveai_complaints to authenticated;

create policy "Users can read their own complaints"
  on public.resolveai_complaints for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own complaints"
  on public.resolveai_complaints for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own complaints"
  on public.resolveai_complaints for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own complaints"
  on public.resolveai_complaints for delete to authenticated
  using ((select auth.uid()) = user_id);
