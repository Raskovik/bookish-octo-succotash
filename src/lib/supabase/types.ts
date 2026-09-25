export type UserRow = {
  id: string;
  google_sub: string | null;
  email: string;
  display_name: string;
  display_name_changed_at: string;
  avatar_url: string | null;
  bio: string | null;
  coin_balance: number;
  gem_balance: number;
  den_size: number;
  garden_rows: number;
  is_admin: boolean;
  is_moderator: boolean;
  starter_granted: boolean;
  created_at: string;
};

// is_admin/is_moderator are public here on purpose — see user_profiles in
// 0028_moderation_round_two.sql — so a colored staff name (PlayerLink)
// can render for anyone viewing it, not just staff.
export type PublicUserProfile = Pick<
  UserRow,
  "id" | "display_name" | "avatar_url" | "bio" | "created_at" | "is_admin" | "is_moderator"
>;

// Named rarity_tier in Postgres (renamed from pet_rarity once items also
// needed it — see 0005_items_and_inventory.sql). Kept as PetRarity here
// since that's what most call sites already import; ItemRarity is just an
// alias for the item-shaped call sites.
export type PetRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type ItemRarity = PetRarity;
export type ExpeditionStatus = "in_progress" | "awaiting_claim" | "completed";
export type ItemType = "ingredient" | "cosmetic" | "potion" | "seed" | "fertilizer";
export type PotionEffectType =
  | "duration_reduction"
  | "rarity_boost"
  | "item_find_boost"
  | "double_reward_chance";
export type BrewStatus = "in_progress" | "awaiting_claim" | "completed";
export type TradeStatus = "pending" | "completed" | "declined" | "cancelled";
export type TradeSide = "initiator" | "recipient";
export type ListingType = "pet" | "item";
export type ListingStatus = "active" | "sold" | "cancelled" | "expired";
export type ListingCurrency = "coins" | "gems";
// Allowed listing durations — validated server-side too (see
// 0019_marketplace_upgrades.sql), this is just for the sell form's
// dropdown.
export type ListingDurationDays = 1 | 3 | 7 | 14 | 30;

export type SpeciesRow = {
  id: string;
  name: string;
  rarity: PetRarity;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
};

export type PetGender = "male" | "female";

// See 0038_trait_breeding_schema.sql. species_id/color_variant are now
// nullable — a pet has EXACTLY one of species_id (legacy, pre-trait) or
// breed_id (every pet created from that migration forward), never both,
// never neither (pets_legacy_xor_trait). Use src/lib/pet-display.ts's
// helpers rather than reading species_id/breed_id directly at a display
// call site, so that fallback logic lives in exactly one place.
export type PetRow = {
  id: string;
  owner_id: string;
  species_id: string | null;
  color_variant: string | null;
  rarity: PetRarity;
  folder_id: string | null;
  custom_name: string | null;
  is_for_trade: boolean;
  // Player-written BBCode source, same convention as users.bio — set
  // only through set_pet_bio() (0034_pet_bio.sql), never a direct
  // client UPDATE (pets has never had one; see custom_name/folder_id).
  bio: string | null;
  breed_id: string | null;
  primary_color_id: string | null;
  secondary_color_id: string | null;
  tertiary_color_id: string | null;
  pattern_id: string | null;
  eye_type_id: string | null;
  gender: PetGender | null;
  // Cache column populated by src/lib/pet-compositor.ts shortly after a
  // trait-based pet is created — null in the brief gap before that runs,
  // and always null for a legacy (species_id-based) pet.
  composited_image_url: string | null;
  parent_a_id: string | null;
  parent_b_id: string | null;
  created_at: string;
};

export type PetFolderRow = {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
};

export type ZoneRow = {
  id: string;
  name: string;
  tier: number;
  description: string | null;
  image_url: string | null;
  unlock_requirement: string | null;
  is_tutorial: boolean;
  is_active: boolean;
  map_x: number | null;
  map_y: number | null;
  map_width: number | null;
  map_height: number | null;
  created_at: string;
};

// zone_pet_pool was dropped in 0038_trait_breeding_schema.sql — zones
// only ever grant items now (see zone_loot_table below); pets come from
// the starter grant/tutorial or breeding (0039/0040).

// ── Trait-based breeding (0038/0039/0040) ───────────────────────────────
// A separate, narrower 3-tier enum from PetRarity/ItemRarity — Flight-
// Rising-style "gene tiers," not a subset of the 5-tier rarity_tier.
export type TraitRarity = "common" | "uncommon" | "rare";

export type BreedRow = {
  id: string;
  name: string;
  description: string | null;
  rarity_weight: number;
  base_layer_url: string | null;
  mask_layer_url: string | null;
  is_active: boolean;
  created_at: string;
};

export type ColorRow = {
  id: string;
  name: string;
  hex_swatch: string;
  rarity_tier: TraitRarity;
  is_active: boolean;
  created_at: string;
};

export type PatternRow = {
  id: string;
  breed_id: string;
  name: string;
  rarity_tier: TraitRarity;
  layer_url: string | null;
  is_active: boolean;
  created_at: string;
};

export type EyeTypeRow = {
  id: string;
  breed_id: string;
  name: string;
  rarity_tier: TraitRarity;
  layer_url: string | null;
  is_active: boolean;
  created_at: string;
};

export type ItemRow = {
  id: string;
  name: string;
  type: ItemType;
  rarity: ItemRarity;
  image_url: string | null;
  sell_value: number;
  // Coin price in the NPC shop (/shop) — see 0036_shop.sql. Null means
  // not for sale there; distinct from sell_value.
  shop_price: number | null;
  is_active: boolean;
  created_at: string;
};

export type UserInventoryRow = {
  user_id: string;
  item_id: string;
  quantity: number;
  is_for_trade: boolean;
};

export type ZoneLootTableRow = {
  zone_id: string;
  item_id: string;
  drop_weight: number;
};

export type PotionRecipeRow = {
  id: string;
  output_potion_item_id: string;
  effect_type: PotionEffectType;
  effect_magnitude: number;
  is_active: boolean;
  created_at: string;
};

export type PotionRecipeIngredientRow = {
  recipe_id: string;
  item_id: string;
  quantity_required: number;
};

// ── Gardening (0035_gardening.sql) ──────────────────────────────────────
export type GardenPlantRow = {
  id: string;
  name: string;
  image_stage1_url: string | null;
  image_stage2_url: string | null;
  image_stage3_url: string | null;
  image_stage4_url: string | null;
  produce_item_id: string | null;
  produce_quantity_min: number;
  produce_quantity_max: number;
  base_coin_yield: number;
  is_active: boolean;
  created_at: string;
};

export type SeedPlantRow = {
  seed_item_id: string;
  plant_id: string;
  drop_weight: number;
};

export type FertilizerEffectType = "grow_speed_boost" | "pest_deterrence" | "double_coin_chance";

export type FertilizerEffectRow = {
  item_id: string;
  effect_type: FertilizerEffectType;
  effect_magnitude: number;
};

export type GardenPlantingStatus = "growing" | "ready" | "wilted";

// See resolve_due_garden()/water_plant() for how next_water_needed_at and
// grow_completes_at combine to decide ready-vs-wilted — this row's raw
// timestamps, not a single "progress" field, are the source of truth;
// src/lib/garden.ts derives displayable stage/needsWater/etc. from them.
export type GardenPlantingRow = {
  id: string;
  user_id: string;
  plot_index: number;
  plant_id: string;
  fertilizer_item_id: string | null;
  status: GardenPlantingStatus;
  planted_at: string;
  total_duration_seconds: number;
  last_watered_at: string;
  next_water_needed_at: string;
  grow_completes_at: string;
  is_pest_affected: boolean;
  created_at: string;
};

// A planting joined with its plant's display info — what /garden actually
// renders per occupied plot.
export type GardenPlantingWithPlant = GardenPlantingRow & {
  plant: Pick<
    GardenPlantRow,
    "name" | "image_stage1_url" | "image_stage2_url" | "image_stage3_url" | "image_stage4_url"
  > | null;
};

// Written only by the log_admin_action() trigger (see
// 0009_admin_panel.sql), never inserted/updated from the app directly.
export type AdminAuditLogRow = {
  id: string;
  admin_user_id: string | null;
  action_type: "insert" | "update" | "delete";
  target_table: string;
  target_id: string;
  change_summary: unknown;
  created_at: string;
};

export type PotionBrewRow = {
  id: string;
  user_id: string;
  recipe_id: string;
  status: BrewStatus;
  started_at: string;
  resolves_at: string;
  created_at: string;
};

export type TradeRow = {
  id: string;
  initiator_id: string;
  recipient_id: string;
  status: TradeStatus;
  note: string | null;
  initiator_coins: number;
  initiator_gems: number;
  recipient_coins: number;
  recipient_gems: number;
  created_at: string;
  responded_at: string | null;
  resolved_at: string | null;
};

export type TradePetRow = {
  trade_id: string;
  side: TradeSide;
  pet_id: string;
};

export type TradeItemRow = {
  trade_id: string;
  side: TradeSide;
  item_id: string;
  quantity: number;
};

export type MarketplaceListingRow = {
  id: string;
  seller_id: string;
  buyer_id: string | null;
  listing_type: ListingType;
  price_coins: number | null;
  price_gems: number | null;
  status: ListingStatus;
  pet_id: string | null;
  pet_species_name: string | null;
  pet_species_image_url: string | null;
  pet_rarity: PetRarity | null;
  pet_custom_name: string | null;
  item_id: string | null;
  item_quantity: number | null;
  created_at: string;
  expires_at: string;
  sold_at: string | null;
};

export type ExpeditionRow = {
  id: string;
  user_id: string;
  pet_id: string;
  zone_id: string;
  status: ExpeditionStatus;
  is_tutorial: boolean;
  started_at: string;
  resolves_at: string;
  result_pet_id: string | null;
  result_item_id: string | null;
  pending_species_id: string | null;
  pending_item_id: string | null;
  created_at: string;
};

// Row types returned by hand-written joined `.select(...)` queries (e.g.
// pets embedded with their species). These aren't derived from the
// Database["public"]["Tables"] Relationships metadata below — that's kept
// minimal since this project hand-writes its types rather than running
// `supabase gen types`. Query call sites cast to these explicitly.
// species is null for a trait-based pet (breed_id set instead); breed is
// null for a legacy pet (species_id set instead) — see PetRow's comment.
// Use src/lib/pet-display.ts's petImageUrl()/petTypeName() rather than
// reading species/breed/composited_image_url directly at a display call
// site.
export type PetWithSpecies = Pick<
  PetRow,
  | "id"
  | "rarity"
  | "color_variant"
  | "folder_id"
  | "custom_name"
  | "is_for_trade"
  | "created_at"
  | "composited_image_url"
  | "gender"
> & {
  species: Pick<SpeciesRow, "name" | "image_url"> | null;
  breed: Pick<BreedRow, "name"> | null;
};

// Everything PetWithSpecies has, plus bio — shown on /pets/[petId].
export type PetDetail = PetWithSpecies & Pick<PetRow, "bio">;

// Everything PetDetail has, plus the resolved trait panel — shown only on
// /pets/[petId], never the grid (too much joined data to fetch per card).
// Each trait is null for a legacy pet (no breed_id) or an unset slot
// (tertiary_color_id is often intentionally null).
export type PetDetailWithTraits = PetDetail & {
  primaryColor: Pick<ColorRow, "name" | "hex_swatch" | "rarity_tier"> | null;
  secondaryColor: Pick<ColorRow, "name" | "hex_swatch" | "rarity_tier"> | null;
  tertiaryColor: Pick<ColorRow, "name" | "hex_swatch" | "rarity_tier"> | null;
  pattern: Pick<PatternRow, "name" | "rarity_tier"> | null;
  eyeType: Pick<EyeTypeRow, "name" | "rarity_tier"> | null;
  parentA: Pick<PetRow, "id" | "custom_name"> | null;
  parentB: Pick<PetRow, "id" | "custom_name"> | null;
};

// See 0040_breeding.sql. Reuses BrewStatus's exact 3 values (in_progress
// -> awaiting_claim -> completed) rather than a near-identical new enum.
export type BreedingAttemptRow = {
  id: string;
  user_id: string;
  pet_a_id: string;
  pet_b_id: string;
  status: BrewStatus;
  started_at: string;
  resolves_at: string;
  pending_breed_id: string | null;
  pending_primary_color_id: string | null;
  pending_secondary_color_id: string | null;
  pending_tertiary_color_id: string | null;
  pending_pattern_id: string | null;
  pending_eye_type_id: string | null;
  pending_gender: PetGender | null;
  result_pet_id: string | null;
  created_at: string;
};

// A breedable pet as shown on /breeding's pet picker — enough to check
// eligibility (breed_id/gender) and display it.
export type BreedablePet = Pick<PetRow, "id" | "custom_name" | "gender" | "composited_image_url"> & {
  breed: Pick<BreedRow, "id" | "name"> | null;
};

// The player's one active (in_progress or awaiting_claim) breeding
// attempt, if any — mirrors ActiveBrewSummary's shape/role.
export type ActiveBreedingAttempt = Pick<BreedingAttemptRow, "id" | "status" | "resolves_at" | "pet_a_id" | "pet_b_id">;

// The revealed egg contents for an awaiting_claim breeding attempt —
// fetched only once resolved, so the result stays a surprise until then
// (same idea as ExpeditionRewardReveal).
export type EggReveal = {
  pending_gender: PetGender | null;
  breed: Pick<BreedRow, "name"> | null;
  primaryColor: Pick<ColorRow, "name" | "hex_swatch" | "rarity_tier"> | null;
  secondaryColor: Pick<ColorRow, "name" | "hex_swatch" | "rarity_tier"> | null;
  tertiaryColor: Pick<ColorRow, "name" | "hex_swatch" | "rarity_tier"> | null;
  pattern: Pick<PatternRow, "name" | "rarity_tier"> | null;
  eyeType: Pick<EyeTypeRow, "name" | "rarity_tier"> | null;
};

// A stack in the player's inventory, as shown on /items.
export type ItemWithQuantity = {
  quantity: number;
  is_for_trade: boolean;
  item: Pick<ItemRow, "id" | "name" | "image_url" | "rarity" | "type"> | null;
};

// A pet another player has marked for_trade, as shown on /trades/browse
// and in the "their pets" tab of the trade picker modal — never exposes
// anything beyond what the for-trade RLS policy (0016) already makes
// visible to any signed-in player (folder_id is deliberately left out;
// it's not for-trade-relevant and it's the new owner's to set anyway
// once a trade completes).
export type ForTradePet = Pick<PetRow, "id" | "rarity" | "custom_name"> & {
  ownerId: string;
  ownerName: string;
  speciesName: string;
  imageUrl: string | null;
};

export type ForTradeItem = {
  itemId: string;
  ownerId: string;
  ownerName: string;
  name: string;
  imageUrl: string | null;
  rarity: ItemRarity;
  type: ItemType;
  quantity: number;
};

export type ExpeditionWithZone = Pick<
  ExpeditionRow,
  "id" | "status" | "is_tutorial" | "resolves_at"
> & {
  zones: Pick<ZoneRow, "name" | "description" | "image_url"> | null;
};

// A user's own not-yet-completed (in_progress or awaiting_claim)
// expedition, for cross-referencing against the explorable-zones map:
// which zones/pets are currently busy, and what to show as each hotspot's
// badge. The sent pet stays "busy" and the zone stays locked through
// awaiting_claim too — it isn't free until the reward is claimed.
export type ActiveExpeditionSummary = Pick<
  ExpeditionRow,
  "id" | "pet_id" | "zone_id" | "resolves_at" | "status"
>;

// The revealed reward for a single awaiting_claim expedition, fetched
// only when the player explicitly opens the claim popup — deliberately
// not part of the map's initial data load, so the reward stays a
// surprise until then. Item-only — zones no longer grant pets (see
// 0038_trait_breeding_schema.sql).
export type ExpeditionRewardReveal = {
  pending_item_id: string | null;
  items: Pick<ItemRow, "name" | "image_url" | "rarity"> | null;
};

// What claim_expedition_reward returns — an optional bonus item from a
// double_reward_chance potion. Never a pet (see ExpeditionRewardReveal).
export type ClaimExpeditionResult = {
  bonus_kind?: "item";
  bonus_name?: string;
  bonus_image_url?: string | null;
};

// What expand_den returns after a successful purchase.
export type ExpandDenResult = {
  new_den_size: number;
  coins_spent: number;
};

export type ExpandGardenResult = {
  new_garden_rows: number;
  coins_spent: number;
};

// What buy_shop_item returns — see 0036_shop.sql.
export type BuyShopItemResult = {
  item_id: string;
  quantity: number;
  total_cost: number;
  new_coin_balance: number;
};

// A shop item as shown on /shop — the catalog item plus the player's
// current owned quantity, so the page can show "you have 3" without a
// second round trip (same idea as RecipeIngredientWithStock).
export type ShopItem = Pick<ItemRow, "id" | "name" | "image_url" | "rarity" | "type"> & {
  shopPrice: number;
  quantityOwned: number;
};

// What harvest_plot() returns — either nothing (a wilted plant) or what
// was granted for a ready one. produce_item_id/quantity are absent when
// the plant has no produce_item_id configured (coins-only crop).
export type HarvestResult =
  | { wilted: true }
  | { coins: number; produce_item_id?: string; quantity?: number };

// What admin_grant_self_currency returns — the admin's new balances.
export type AdminCurrencyGrantResult = {
  coin_balance: number;
  gem_balance: number;
};

// What change_display_name returns — see 0014_unique_display_names.sql.
export type ChangeDisplayNameResult = {
  display_name: string;
  gem_balance: number;
  next_change_available_at: string;
};

// What respond_to_trade returns — see 0015_trading.sql.
export type RespondToTradeResult = {
  status: "declined" | "completed";
};

// What buy_listing returns — see 0018_marketplace.sql (0019 added the
// currency choice). "unavailable" means the seller could no longer
// deliver, or the listing expired — buy_listing resolves the listing's
// status itself in that case (cancelled/expired) and returns this
// rather than raising, since an exception would roll back that update
// along with everything else in the call.
export type BuyListingResult =
  | { status: "sold"; currency: ListingCurrency; price: number }
  | { status: "unavailable"; reason: string };

// A zone's pool preview ("what you might get") — item-only now that
// zones no longer grant pets (see 0038_trait_breeding_schema.sql;
// pick_weighted_zone_reward draws from zone_loot_table alone).
export type ZonePoolEntry = {
  id: string;
  name: string;
  image_url: string | null;
  rarity: ItemRarity;
};

// A recipe as shown on /brewing: the output potion, its ingredients (each
// with the player's current owned quantity resolved server-side, so the
// UI can show "2 / 3" without a second round trip), and whether the
// player currently has enough of everything to brew it.
export type RecipeIngredientWithStock = {
  item: Pick<ItemRow, "id" | "name" | "image_url" | "rarity"> | null;
  quantityRequired: number;
  quantityOwned: number;
};

export type RecipeWithDetails = Pick<
  PotionRecipeRow,
  "id" | "effect_type" | "effect_magnitude" | "is_active"
> & {
  potion: Pick<ItemRow, "id" | "name" | "image_url" | "rarity"> | null;
  ingredients: RecipeIngredientWithStock[];
  canBrew: boolean;
};

// A potion sitting in the player's inventory, offered as an option when
// starting an expedition.
export type OwnedPotion = {
  itemId: string;
  name: string;
  image_url: string | null;
  quantity: number;
};

// A crafting ingredient sitting in the player's inventory, offered as an
// option when filling a brewing slot.
export type OwnedIngredient = {
  itemId: string;
  name: string;
  image_url: string | null;
  rarity: ItemRarity;
  quantity: number;
};

// One pet or item line on one side of a trade, resolved with display
// details for the trade detail page.
export type TradePetLine = {
  side: TradeSide;
  petId: string;
  speciesName: string;
  imageUrl: string | null;
  rarity: PetRarity;
  customName: string | null;
};

export type TradeItemLine = {
  side: TradeSide;
  itemId: string;
  name: string;
  imageUrl: string | null;
  quantity: number;
};

// A trade with both participants' display names resolved, as shown on
// /trades (the inbox list) and /trades/[id] (the detail page).
export type TradeWithParticipants = Pick<
  TradeRow,
  | "id"
  | "status"
  | "note"
  | "initiator_coins"
  | "initiator_gems"
  | "recipient_coins"
  | "recipient_gems"
  | "created_at"
  | "resolved_at"
> & {
  initiatorId: string;
  recipientId: string;
  initiatorName: string;
  recipientName: string;
  pets: TradePetLine[];
  items: TradeItemLine[];
};

// A marketplace listing with the seller/buyer names resolved (same
// user_profiles-lookup pattern as TradeWithParticipants — `users` only
// lets a player see their own row) and, for item listings, the item
// catalog details joined in. One shape covers both listing types —
// listingType says which of the pet*/item* fields are populated — so
// /marketplace/browse and /marketplace/mine can render mixed lists
// without two parallel types.
export type MarketplaceListing = Pick<
  MarketplaceListingRow,
  | "id"
  | "listing_type"
  | "status"
  | "price_coins"
  | "price_gems"
  | "pet_id"
  | "pet_species_name"
  | "pet_species_image_url"
  | "pet_rarity"
  | "pet_custom_name"
  | "item_quantity"
  | "created_at"
  | "expires_at"
  | "sold_at"
> & {
  sellerId: string;
  sellerName: string;
  buyerId: string | null;
  buyerName: string | null;
  itemId: string | null;
  itemName: string | null;
  itemImageUrl: string | null;
  itemRarity: ItemRarity | null;
  itemType: ItemType | null;
};

// The player's one active (in_progress or awaiting_claim) brew, if any —
// there's only one brewing stand, so at most one of these exists per
// player at a time.
export type ActiveBrewSummary = Pick<PotionBrewRow, "id" | "status" | "resolves_at"> & {
  potionName: string;
  potionImageUrl: string | null;
};

// A zone as shown on the expeditions map, with its pool preview resolved
// server-side.
export type ExplorableZone = Pick<
  ZoneRow,
  | "id"
  | "name"
  | "tier"
  | "description"
  | "image_url"
  | "map_x"
  | "map_y"
  | "map_width"
  | "map_height"
> & {
  pool: ZonePoolEntry[];
};

// See 0026_direct_messages.sql — user_one_id/user_two_id are canonically
// ordered (not "sender/recipient"), and last_message_*/*_last_read_at
// are denormalized onto the row by sync_dm_conversation_on_message().
export type DmConversationRow = {
  id: string;
  user_one_id: string;
  user_two_id: string;
  last_message_at: string;
  last_message_body: string | null;
  last_message_sender_id: string | null;
  user_one_last_read_at: string | null;
  user_two_last_read_at: string | null;
  created_at: string;
};

export type DmMessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

// A conversation as shown on /messages — the "other" participant resolved
// relative to the signed-in viewer (whichever of user_one/user_two isn't
// them), plus whether the viewer has unread messages in it.
export type DmConversationSummary = Pick<
  DmConversationRow,
  "id" | "last_message_at" | "last_message_body"
> & {
  otherUserId: string;
  otherUserName: string;
  otherUserAvatarUrl: string | null;
  otherUserIsAdmin: boolean;
  otherUserIsModerator: boolean;
  lastMessageIsMine: boolean;
  isUnread: boolean;
};

// A message as shown on /messages/[conversationId] — sender name resolved,
// same user_profiles-lookup pattern as forum posts. isFromStaffAccount is
// specifically the Staff pseudo-account (STAFF_USER_ID) — the automated
// "your report was received" notice — distinct from senderIsAdmin/
// senderIsModerator, which mark a real staff member's own account (e.g.
// a warning DM they sent themselves).
export type DmMessageWithSender = Pick<DmMessageRow, "id" | "body" | "created_at"> & {
  senderId: string;
  senderName: string;
  senderIsAdmin: boolean;
  senderIsModerator: boolean;
  isFromStaffAccount: boolean;
};

export type ForumCategoryRow = {
  id: string;
  parent_id: string | null;
  name: string;
  description: string | null;
  icon_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

export type ForumThreadRow = {
  id: string;
  category_id: string;
  author_id: string;
  title: string;
  is_pinned: boolean;
  is_locked: boolean;
  reply_count: number;
  view_count: number;
  created_at: string;
  last_post_at: string;
};

export type ForumPostRow = {
  id: string;
  thread_id: string;
  author_id: string;
  body_raw: string;
  body_html: string;
  created_at: string;
  edited_at: string | null;
  edit_count: number;
  last_edited_by: string | null;
  is_hidden: boolean;
  hidden_at: string | null;
};

// A top-level forum category with its subcategories nested — how /forums
// and the admin category list both want the two-level hierarchy shaped,
// rather than a flat list callers re-group themselves.
export type ForumCategoryWithChildren = ForumCategoryRow & {
  children: ForumCategoryRow[];
};

// A thread as shown on a category page's thread list — author name
// resolved (via user_profiles, same pattern as TradeWithParticipants),
// nothing else joined in since posts are fetched separately per-thread.
export type ForumThreadListItem = Pick<
  ForumThreadRow,
  "id" | "title" | "is_pinned" | "is_locked" | "reply_count" | "view_count" | "created_at" | "last_post_at"
> & {
  authorId: string;
  authorName: string;
  authorIsAdmin: boolean;
  authorIsModerator: boolean;
};

// A post as shown on a thread page — author name/avatar resolved, plus
// the last editor's raw id/name/role (NOT a pre-decided display string —
// PostCard itself decides whether to show the real name or "a moderator"/
// "an admin", since that depends on comparing lastEditedById to authorId,
// which the type shouldn't need to know about).
export type ForumPostWithAuthor = Pick<
  ForumPostRow,
  "id" | "body_raw" | "body_html" | "created_at" | "edited_at" | "edit_count" | "is_hidden" | "hidden_at"
> & {
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  authorIsAdmin: boolean;
  authorIsModerator: boolean;
  lastEditedById: string | null;
  lastEditorName: string | null;
  lastEditorIsAdmin: boolean;
  lastEditorIsModerator: boolean;
};

export type ReportTargetType = "user" | "forum_post" | "dm_message";
export type ReportCategory = "spam" | "harassment" | "inappropriate_content" | "scam" | "other";
// "escalated" added in 0032_simple_report_handling.sql — "send this to
// an admin instead of handling it myself." Not access-controlled (any
// staff member can still act on an escalated report, same as any other —
// reports' UPDATE policy is untouched); it's an organizational status,
// not a lock.
export type ReportStatus = "open" | "escalated" | "resolved" | "dismissed";

// See 0027_moderation.sql / 0028_moderation_round_two.sql — exactly one
// of target_user_id/target_post_id/target_message_id is set, per
// target_type (enforced by a check constraint, not just convention).
// target_post_id/target_message_id can still go null later without
// changing target_type — the reported content was deleted, but the
// report itself (and its resolution) survives as history.
export type ReportRow = {
  id: string;
  reporter_id: string;
  target_type: ReportTargetType;
  target_user_id: string | null;
  target_post_id: string | null;
  target_message_id: string | null;
  // Snapshotted at report-filing time (see snapshot_report_target_
  // author(), 0028_moderation_round_two.sql) — stay populated even after
  // target_post_id/target_message_id go null on deletion, so a report
  // never loses its link to the player who authored the content.
  target_post_author_id: string | null;
  target_message_sender_id: string | null;
  category: ReportCategory;
  details: string | null;
  status: ReportStatus;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  // Restored in 0033_claiming_and_note_edits.sql — which staff member is
  // actively working this, separate from resolved_by (who closed it).
  // Any staff member can claim or unclaim any report; there's no "only
  // the claimant can unclaim" lock.
  claimed_by: string | null;
  claimed_at: string | null;
  created_at: string;
};

// A report as shown in /mod/reports (and /mod/players/[userId]) —
// reporter name and the target (whichever applies) resolved to something
// displayable, so the queue doesn't have to join per-row in the UI.
export type ReportWithDetails = Pick<
  ReportRow,
  "id" | "target_type" | "category" | "details" | "status" | "resolved_at" | "resolution_note" | "created_at"
> & {
  reporterId: string;
  reporterName: string;
  targetUserId: string | null;
  targetUserName: string | null;
  targetPostId: string | null;
  targetPostBody: string | null;
  targetPostAuthorId: string | null;
  targetPostAuthorName: string | null;
  targetThreadId: string | null;
  targetCategoryId: string | null;
  targetMessageId: string | null;
  targetMessageBody: string | null;
  targetMessageSenderId: string | null;
  targetMessageSenderName: string | null;
  targetMessageConversationId: string | null;
  resolvedByName: string | null;
  claimedById: string | null;
  claimedByName: string | null;
};

export type CannedStaffMessageRow = {
  id: string;
  label: string;
  body: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

export type BanType = "dm" | "sales" | "forums" | "account";

// See 0029_bans_and_staff_fixes.sql — a player can hold several of these
// at once, each independent. lifted_at stays null for a ban that simply
// ran out the clock; an early end (a staff member reversing it) is the
// only thing that sets lifted_at/lifted_by.
export type BanRow = {
  id: string;
  user_id: string;
  ban_type: BanType;
  reason: string | null;
  issued_by: string;
  issued_at: string;
  expires_at: string;
  lifted_at: string | null;
  lifted_by: string | null;
  created_at: string;
};

// A ban as shown on /mod/players/[userId] — issuer name resolved, same
// resolved-details pattern as ReportWithDetails.
export type BanWithIssuer = Pick<
  BanRow,
  "id" | "ban_type" | "reason" | "issued_at" | "expires_at" | "lifted_at"
> & {
  issuedByName: string;
};

// See 0032_simple_report_handling.sql — self-service, one-directional
// (blocking someone stops THEM from DMing you, not the reverse).
export type BlockRow = {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
};

// Private, staff-only, dated and attributed — shown on the report-
// handling page for context on a player's history. Separate from
// reports.resolution_note (the one-line "why this was closed").
export type PlayerNoteRow = {
  id: string;
  user_id: string;
  author_id: string;
  body: string;
  // Null until the first edit — set in 0033_claiming_and_note_edits.sql,
  // which also lets the author (only) edit body. A note has exactly one
  // author, so there's no "someone else edited this" case to track.
  edited_at: string | null;
  created_at: string;
};

export type PlayerNoteWithAuthor = Pick<PlayerNoteRow, "id" | "body" | "created_at" | "edited_at"> & {
  authorId: string;
  authorName: string;
};

type TableOf<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      users: TableOf<
        UserRow,
        Partial<UserRow> & { id: string; email: string },
        Partial<Omit<UserRow, "id">>
      >;
      species: TableOf<SpeciesRow, Partial<SpeciesRow> & { name: string }>;
      pets: TableOf<PetRow, Partial<PetRow> & { owner_id: string; rarity: PetRarity }>;
      pet_folders: TableOf<
        PetFolderRow,
        Partial<PetFolderRow> & { owner_id: string; name: string }
      >;
      zones: TableOf<ZoneRow, Partial<ZoneRow> & { name: string }>;
      breeds: TableOf<BreedRow, Partial<BreedRow> & { name: string }>;
      colors: TableOf<ColorRow, Partial<ColorRow> & { name: string; hex_swatch: string }>;
      patterns: TableOf<PatternRow, Partial<PatternRow> & { breed_id: string; name: string }>;
      eye_types: TableOf<EyeTypeRow, Partial<EyeTypeRow> & { breed_id: string; name: string }>;
      items: TableOf<ItemRow, Partial<ItemRow> & { name: string }>;
      user_inventory: TableOf<
        UserInventoryRow,
        Partial<UserInventoryRow> & { user_id: string; item_id: string }
      >;
      zone_loot_table: TableOf<ZoneLootTableRow>;
      potion_recipes: TableOf<PotionRecipeRow, Partial<PotionRecipeRow> & { output_potion_item_id: string; effect_type: PotionEffectType }>;
      potion_recipe_ingredients: TableOf<PotionRecipeIngredientRow>;
      potion_brews: TableOf<
        PotionBrewRow,
        Partial<PotionBrewRow> & { user_id: string; recipe_id: string; resolves_at: string }
      >;
      expeditions: TableOf<
        ExpeditionRow,
        Partial<ExpeditionRow> & {
          user_id: string;
          pet_id: string;
          zone_id: string;
          resolves_at: string;
        }
      >;
      breeding_attempts: TableOf<
        BreedingAttemptRow,
        Partial<BreedingAttemptRow> & { user_id: string; pet_a_id: string; pet_b_id: string; resolves_at: string }
      >;
      admin_audit_log: TableOf<AdminAuditLogRow>;
      trades: TableOf<TradeRow>;
      trade_pets: TableOf<TradePetRow>;
      trade_items: TableOf<TradeItemRow>;
      marketplace_listings: TableOf<MarketplaceListingRow>;
      forum_categories: TableOf<ForumCategoryRow, Partial<ForumCategoryRow> & { name: string }>;
      forum_threads: TableOf<
        ForumThreadRow,
        Partial<ForumThreadRow> & { category_id: string; author_id: string; title: string }
      >;
      forum_posts: TableOf<
        ForumPostRow,
        Partial<ForumPostRow> & {
          thread_id: string;
          author_id: string;
          body_raw: string;
          body_html: string;
        }
      >;
      dm_conversations: TableOf<DmConversationRow>;
      dm_messages: TableOf<
        DmMessageRow,
        Partial<DmMessageRow> & { conversation_id: string; sender_id: string; body: string }
      >;
      reports: TableOf<
        ReportRow,
        Partial<ReportRow> & { reporter_id: string; target_type: ReportTargetType; category: ReportCategory }
      >;
      canned_staff_messages: TableOf<
        CannedStaffMessageRow,
        Partial<CannedStaffMessageRow> & { label: string; body: string }
      >;
      blocks: TableOf<BlockRow, Partial<BlockRow> & { blocker_id: string; blocked_id: string }>;
      player_notes: TableOf<
        PlayerNoteRow,
        Partial<PlayerNoteRow> & { user_id: string; author_id: string; body: string }
      >;
      bans: TableOf<
        BanRow,
        Partial<BanRow> & { user_id: string; ban_type: BanType; issued_by: string; expires_at: string }
      >;
      garden_plants: TableOf<GardenPlantRow, Partial<GardenPlantRow> & { name: string }>;
      seed_plants: TableOf<SeedPlantRow, Partial<SeedPlantRow> & { seed_item_id: string; plant_id: string }>;
      fertilizer_effects: TableOf<
        FertilizerEffectRow,
        Partial<FertilizerEffectRow> & { item_id: string; effect_type: FertilizerEffectType; effect_magnitude: number }
      >;
      garden_plantings: TableOf<GardenPlantingRow>;
    };
    Views: {
      user_profiles: {
        Row: PublicUserProfile;
        Relationships: [];
      };
    };
    Functions: {
      grant_starter_pet_and_tutorial: {
        Args: { p_user_id: string };
        Returns: null;
      };
      resolve_due_expeditions: {
        Args: { p_user_id: string };
        Returns: null;
      };
      start_expedition: {
        Args: {
          p_user_id: string;
          p_pet_id: string;
          p_zone_id: string;
          p_potion_item_id?: string | null;
        };
        Returns: string;
      };
      claim_expedition_reward: {
        Args: {
          p_user_id: string;
          p_expedition_id: string;
          p_keep: boolean;
        };
        Returns: ClaimExpeditionResult;
      };
      set_pet_composited_image: {
        Args: { p_user_id: string; p_pet_id: string; p_image_url: string };
        Returns: null;
      };
      roll_wild_color: {
        Args: Record<string, never>;
        Returns: string;
      };
      roll_wild_pattern: {
        Args: { p_breed_id: string };
        Returns: string;
      };
      roll_wild_eye_type: {
        Args: { p_breed_id: string };
        Returns: string;
      };
      roll_wild_traits: {
        Args: { p_breed_id: string };
        // A SQL function `returns table (...)` is set-returning at the
        // wire level even though this always produces exactly one row —
        // typed as an array so `.rpc(...).single()` (used at both call
        // sites) narrows correctly, same as any other RPC returning
        // `setof`/`table`.
        Returns: {
          primary_color_id: string | null;
          secondary_color_id: string | null;
          tertiary_color_id: string | null;
          pattern_id: string | null;
          eye_type_id: string | null;
        }[];
      };
      start_brew: {
        Args: {
          p_user_id: string;
          p_recipe_id: string;
        };
        Returns: string;
      };
      resolve_due_brews: {
        Args: { p_user_id: string };
        Returns: null;
      };
      claim_brew: {
        Args: {
          p_user_id: string;
          p_brew_id: string;
        };
        Returns: null;
      };
      start_breeding: {
        Args: { p_user_id: string; p_pet_a_id: string; p_pet_b_id: string };
        Returns: string;
      };
      resolve_due_breeding: {
        Args: { p_user_id: string };
        Returns: null;
      };
      claim_egg: {
        Args: { p_user_id: string; p_attempt_id: string; p_keep: boolean };
        Returns: string | null;
      };
      expand_den: {
        Args: { p_user_id: string };
        Returns: ExpandDenResult;
      };
      expand_garden: {
        Args: { p_user_id: string };
        Returns: ExpandGardenResult;
      };
      plant_seed: {
        Args: {
          p_user_id: string;
          p_plot_index: number;
          p_seed_item_id: string;
          p_fertilizer_item_id?: string | null;
        };
        Returns: string;
      };
      water_plant: {
        Args: { p_user_id: string; p_planting_id: string };
        Returns: null;
      };
      resolve_due_garden: {
        Args: { p_user_id: string };
        Returns: null;
      };
      harvest_plot: {
        Args: { p_user_id: string; p_planting_id: string };
        Returns: HarvestResult;
      };
      buy_shop_item: {
        Args: { p_user_id: string; p_item_id: string; p_quantity?: number };
        Returns: BuyShopItemResult;
      };
      admin_grant_self_currency: {
        Args: {
          p_admin_user_id: string;
          p_coin_delta: number;
          p_gem_delta: number;
        };
        Returns: AdminCurrencyGrantResult;
      };
      move_pet_to_folder: {
        Args: {
          p_user_id: string;
          p_pet_id: string;
          p_folder_id: string | null;
        };
        Returns: null;
      };
      rename_pet: {
        Args: {
          p_user_id: string;
          p_pet_id: string;
          p_name: string;
        };
        Returns: null;
      };
      set_pet_bio: {
        Args: {
          p_user_id: string;
          p_pet_id: string;
          p_bio: string;
        };
        Returns: null;
      };
      change_display_name: {
        Args: {
          p_user_id: string;
          p_new_name: string;
        };
        Returns: ChangeDisplayNameResult;
      };
      create_trade: {
        Args: {
          p_initiator_id: string;
          p_recipient_id: string;
          p_pet_ids: string[];
          p_item_ids: string[];
          p_item_quantities: number[];
          p_coins: number;
          p_gems: number;
          p_note: string | null;
          p_requested_pet_ids?: string[];
          p_requested_item_ids?: string[];
          p_requested_item_quantities?: number[];
          p_requested_coins?: number;
          p_requested_gems?: number;
        };
        Returns: string;
      };
      respond_to_trade: {
        Args: {
          p_user_id: string;
          p_trade_id: string;
          p_accept: boolean;
          p_pet_ids?: string[];
          p_item_ids?: string[];
          p_item_quantities?: number[];
          p_coins?: number;
          p_gems?: number;
        };
        Returns: RespondToTradeResult;
      };
      cancel_trade: {
        Args: {
          p_user_id: string;
          p_trade_id: string;
        };
        Returns: null;
      };
      set_pet_for_trade: {
        Args: {
          p_user_id: string;
          p_pet_id: string;
          p_is_for_trade: boolean;
        };
        Returns: null;
      };
      set_item_for_trade: {
        Args: {
          p_user_id: string;
          p_item_id: string;
          p_is_for_trade: boolean;
        };
        Returns: null;
      };
      set_folder_pets_for_trade: {
        Args: {
          p_user_id: string;
          p_folder_id: string | null;
          p_is_for_trade: boolean;
        };
        Returns: null;
      };
      create_pet_listing: {
        Args: {
          p_seller_id: string;
          p_pet_id: string;
          p_price_coins: number | null;
          p_price_gems: number | null;
          p_duration_days: ListingDurationDays;
        };
        Returns: string;
      };
      create_item_listing: {
        Args: {
          p_seller_id: string;
          p_item_id: string;
          p_quantity: number;
          p_price_coins: number | null;
          p_price_gems: number | null;
          p_duration_days: ListingDurationDays;
        };
        Returns: string;
      };
      cancel_listing: {
        Args: {
          p_user_id: string;
          p_listing_id: string;
        };
        Returns: null;
      };
      resolve_expired_listings: {
        Args: Record<string, never>;
        Returns: null;
      };
      increment_thread_view_count: {
        Args: { p_thread_id: string };
        Returns: null;
      };
      buy_listing: {
        Args: {
          p_buyer_id: string;
          p_listing_id: string;
          p_currency: ListingCurrency;
        };
        Returns: BuyListingResult;
      };
      get_or_create_dm_conversation: {
        Args: { p_user_id: string; p_other_user_id: string };
        Returns: string;
      };
      mark_dm_conversation_read: {
        Args: { p_user_id: string; p_conversation_id: string };
        Returns: null;
      };
      send_staff_message: {
        Args: { p_target_user_id: string; p_body: string };
        Returns: string;
      };
      user_has_active_ban: {
        Args: { p_user_id: string; p_ban_type: BanType };
        Returns: boolean;
      };
      is_blocked_by: {
        Args: { p_blocked_id: string; p_blocker_id: string };
        Returns: boolean;
      };
    };
  };
};
