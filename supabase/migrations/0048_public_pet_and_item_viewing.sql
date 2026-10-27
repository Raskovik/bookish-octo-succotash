-- Lets any signed-in player browse another player's pets and items from
-- their profile (the unified profile page's "My stuff" Pets/Items
-- buttons, previously disabled with "not available yet" — see
-- 0047_public_player_stats.sql for the same "profiles are public now"
-- reasoning applied to the wallet stats shown there).
--
-- Additive SELECT policies, OR'd with the existing owner-only ones
-- (0002/0005) and the is_for_trade-only ones (0016) — this one has no
-- condition, so it supersedes is_for_trade for visibility purposes
-- (everything is now visible, not just for-trade stock); 0016's policy
-- is left in place rather than dropped, since nothing breaks by it
-- being redundant and this keeps the migration purely additive.
create policy "Pets are viewable by everyone"
  on public.pets for select
  to authenticated
  using (true);

create policy "Items are viewable by everyone"
  on public.user_inventory for select
  to authenticated
  using (quantity > 0);
