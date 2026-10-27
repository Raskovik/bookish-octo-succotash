-- Extends user_profiles (0028_moderation_round_two.sql) with coin_balance,
-- gem_balance and den_size. The unified player-profile page (the "no
-- separate public/private profile" redesign) shows every player's
-- wallet and pet-slot usage to any viewer, not just themselves —
-- a deliberate reversal of that view's original comment calling
-- currency/den_size "never needed publicly before now". New columns
-- appended after the existing ones, per CREATE OR REPLACE VIEW's
-- column-order rule (same note 0028 itself left for the next person).
create or replace view public.user_profiles as
  select id, display_name, avatar_url, bio, created_at, is_admin, is_moderator,
         coin_balance, gem_balance, den_size
  from public.users;
