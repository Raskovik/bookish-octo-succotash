-- Fixes create_pet_listing (0019_marketplace_upgrades.sql), which still
-- `join`s pets to species — an INNER join, so listing any trait-based
-- pet (species_id null, breed_id set — see 0038_trait_breeding_schema.sql)
-- currently fails outright with "Pet not found." Marketplace listings
-- already snapshot flat name/image_url/rarity columns rather than living
-- FKs, so the fix is entirely inside this function: resolve the name/
-- image from breeds+composited_image_url when species_id is null,
-- falling back to species otherwise (same coalesce this project's own
-- petImageUrl()/petTypeName() TS helpers use). No listing-display code
-- needs to change — it already just reads the flat snapshot columns.
create or replace function public.create_pet_listing(
  p_seller_id uuid,
  p_pet_id uuid,
  p_price_coins integer,
  p_price_gems integer,
  p_duration_days integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing_id uuid;
  v_name text;
  v_image_url text;
  v_rarity public.rarity_tier;
  v_custom_name text;
begin
  if auth.uid() is distinct from p_seller_id then
    raise exception 'Not authorized';
  end if;

  if p_duration_days not in (1, 3, 7, 14, 30) then
    raise exception 'Invalid listing duration.';
  end if;

  if coalesce(p_price_coins, 0) <= 0 and coalesce(p_price_gems, 0) <= 0 then
    raise exception 'Set a coin price, a gem price, or both — at least 1.';
  end if;
  if p_price_coins is not null and p_price_coins <= 0 then
    raise exception 'Coin price must be at least 1.';
  end if;
  if p_price_gems is not null and p_price_gems <= 0 then
    raise exception 'Gem price must be at least 1.';
  end if;

  if exists (
    select 1 from public.marketplace_listings
    where pet_id = p_pet_id and status = 'active'
  ) then
    raise exception 'That pet is already listed.';
  end if;

  select
    coalesce(b.name, s.name),
    coalesce(p.composited_image_url, s.image_url),
    p.rarity,
    p.custom_name
  into v_name, v_image_url, v_rarity, v_custom_name
  from public.pets p
  left join public.species s on s.id = p.species_id
  left join public.breeds b on b.id = p.breed_id
  where p.id = p_pet_id and p.owner_id = p_seller_id;

  if not found then
    raise exception 'Pet not found.';
  end if;

  insert into public.marketplace_listings (
    seller_id, listing_type, price_coins, price_gems, expires_at,
    pet_id, pet_species_name, pet_species_image_url, pet_rarity, pet_custom_name
  )
  values (
    p_seller_id, 'pet', p_price_coins, p_price_gems, now() + (p_duration_days || ' days')::interval,
    p_pet_id, v_name, v_image_url, v_rarity, v_custom_name
  )
  returning id into v_listing_id;

  return v_listing_id;
end;
$$;
