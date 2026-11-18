-- 0077's normalize_for_filter stripped ALL whitespace (not just
-- punctuation) before matching, so a short banned word like "ass"
-- would also match inside "assassinate", "classic", "brass", etc. —
-- the classic "Scunthorpe problem". Fixes that by keeping banned-
-- PHRASE matching (banned_phrases) at real word boundaries: strip
-- punctuation (so "a.s.s" / "a-s-s" still normalize to "ass"), but
-- collapse whitespace down to single spaces instead of removing it,
-- then match with \m/\M (Postgres regex word-start/word-end) instead
-- of a plain substring search. "ass" alone no longer matches inside
-- "assassinate"; "a.s.s" still gets caught since the punctuation
-- between the letters is gone, leaving one word with real boundaries
-- on each side.
--
-- Trade-off, stated plainly: a fully space-separated evasion like
-- "f u c k" no longer matches, since each letter is now its own
-- "word" with real boundaries around it. That's accepted on purpose —
-- the old all-whitespace-stripped approach traded a rare, easy-to-
-- type-around evasion for wrongly blocking ordinary words, which is a
-- worse trade (a filter that blocks "assassinate" or "classic" erodes
-- trust fast; a filter a troll can dodge by spacing out every letter
-- is just mildly inconvenient for them, and anyone determined enough
-- to type "f u c k" has effectively said it anyway).
--
-- banned_domains is untouched by this: link matching stays a plain
-- substring check (not word-boundary) since a domain inside a URL is
-- rarely space-separated from the rest of the text ("bit.ly/xyz" has
-- no word boundary between "bitly" and "xyz" once punctuation is
-- stripped) — it still benefits from the whitespace-preserving change
-- below, it just doesn't need \m/\M.
create or replace function public.normalize_for_filter(p_text text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    regexp_replace(
      translate(lower(p_text), '01345789@$!|', 'oieastbgasii'),
      '[^a-z0-9\s]+', '', 'g'
    ),
    '\s+', ' ', 'g'
  );
$$;

-- normalize_for_filter's output is always just lowercase letters,
-- digits and single spaces (every other character was already
-- stripped above) — safe to splice straight into a regex with no
-- escaping needed, there's nothing left that's a regex metacharacter.
create or replace function public.assert_clean_text(p_text text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_normalized text;
  v_hit boolean;
begin
  if p_text is null or trim(p_text) = '' then
    return;
  end if;

  v_normalized := public.normalize_for_filter(p_text);
  if v_normalized = '' then
    return;
  end if;

  select exists (
    select 1 from public.banned_phrases
    where public.normalize_for_filter(phrase) <> ''
      and v_normalized ~ ('\m' || public.normalize_for_filter(phrase) || '\M')
  ) into v_hit;
  if v_hit then
    raise exception 'That text contains a word or phrase that isn''t allowed.';
  end if;

  select exists (
    select 1 from public.banned_domains
    where position(public.normalize_for_filter(domain) in v_normalized) > 0
  ) into v_hit;
  if v_hit then
    raise exception 'That text contains a link that isn''t allowed.';
  end if;
end;
$$;
