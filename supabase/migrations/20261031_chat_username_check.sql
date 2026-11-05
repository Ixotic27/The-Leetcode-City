-- 066 let any signed-in user insert chat under any username (including "SYSTEM").
-- Chat names are the user's GitHub login, or the GitHub/LeetCode login of a building they
-- claimed. user_metadata is writable by the user (auth.updateUser), so the GitHub login comes
-- from auth.identities instead, read through a definer function.
create or replace function public.chat_names_for(uid uuid)
returns setof text
language sql stable security definer set search_path = ''
as $$
  select lower(i.identity_data ->> 'user_name') from auth.identities i
    where i.user_id = uid and i.provider = 'github' and i.identity_data ->> 'user_name' is not null
  union
  select lower(d.github_login) from public.developers d where d.claimed_by = uid
  union
  select lower(d.lc_username) from public.developers d where d.claimed_by = uid and d.lc_username is not null
$$;

revoke all on function public.chat_names_for(uuid) from public;
grant execute on function public.chat_names_for(uuid) to authenticated;

drop policy if exists "Allow authenticated users to insert chat" on public.arcade_chat_messages;

-- Server announcements post as SYSTEM with the service role, which bypasses RLS.
create policy "Allow authenticated users to insert chat" on public.arcade_chat_messages
  for insert to authenticated with check (
    auth.uid() = user_id
    and lower(username) <> 'system'
    and lower(username) in (select public.chat_names_for(auth.uid()))
  );
