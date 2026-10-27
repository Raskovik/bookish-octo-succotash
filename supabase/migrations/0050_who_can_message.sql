-- Direct-message privacy setting from the edit-profile page. The design
-- itself offers three choices (everyone/friends/nobody); "friends" is
-- dropped here since there's no friends feature to attach it to yet —
-- only "everyone" and "nobody" are real.
alter table public.users
  add column who_can_message text not null default 'everyone'
  check (who_can_message in ('everyone', 'nobody'));

comment on column public.users.who_can_message is
  'DM privacy — "nobody" blocks new messages from other players through the normal compose path. send_staff_message() (0029) writes dm_messages directly as a security definer function, bypassing the INSERT policy entirely, so automated/moderator staff messages always get through regardless of this setting.';

-- Public via user_profiles (0028/0047) so a visitor's profile page can
-- grey out the Message button before they even try, rather than only
-- finding out from a rejected insert.
create or replace view public.user_profiles as
  select id, display_name, avatar_url, bio, created_at, is_admin, is_moderator,
         coin_balance, gem_balance, den_size, who_can_message
  from public.users;

-- Same "additive, OR'd" shape as every other policy addition in this
-- app: re-create the insert policy with one more condition rather than
-- adding a second permissive policy, since this one genuinely narrows
-- (not widens) who can insert — two OR'd policies can only ever add
-- permission, never remove it.
drop policy "Participants can send messages" on public.dm_messages;
create policy "Participants can send messages"
  on public.dm_messages for insert
  with check (
    sender_id = auth.uid()
    and not public.user_has_active_ban(sender_id, 'dm')
    and exists (
      select 1 from public.dm_conversations c
      where c.id = conversation_id
        and auth.uid() in (c.user_one_id, c.user_two_id)
        and not public.user_has_active_ban(
          case when c.user_one_id = sender_id then c.user_two_id else c.user_one_id end,
          'dm'
        )
        -- Reads through user_profiles (public SELECT grant), not users
        -- directly — "Users can view own row" (0001) would otherwise
        -- silently filter this subquery down to nothing whenever the
        -- recipient isn't the sender themselves, the same "inline RLS-
        -- restricted subquery becomes a no-op" trap 0032's comment on
        -- is_blocked_by() already warns about for a security definer
        -- function; the view sidesteps it the same way that does.
        and (
          select who_can_message from public.user_profiles
          where id = case when c.user_one_id = sender_id then c.user_two_id else c.user_one_id end
        ) <> 'nobody'
    )
  );
