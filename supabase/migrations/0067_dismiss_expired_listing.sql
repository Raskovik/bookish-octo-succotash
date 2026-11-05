-- Lets a seller clear a resolved (expired/cancelled) listing off their
-- own Expired tab once it's no longer useful to them there — the
-- "List again" flow calls this right after a successful relist, per
-- the design: relisting something removes its old expired entry
-- instead of leaving a stale duplicate behind. Sold listings are never
-- eligible (that tab is the seller's earnings record, not a todo list),
-- and this never touches another player's listings — same auth.uid()
-- re-check as every other marketplace write.
create function public.dismiss_listing(p_user_id uuid, p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized';
  end if;

  delete from public.marketplace_listings
  where id = p_listing_id
    and seller_id = p_user_id
    and status in ('expired', 'cancelled');

  if not found then
    raise exception 'Listing not found, not yours, or not resolved yet.';
  end if;
end;
$$;

revoke all on function public.dismiss_listing(uuid, uuid) from public;
grant execute on function public.dismiss_listing(uuid, uuid) to authenticated;
