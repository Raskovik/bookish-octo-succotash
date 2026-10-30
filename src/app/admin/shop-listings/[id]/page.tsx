import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { ShopListingForm } from "../shop-listing-form";
import { updateShopListing } from "../actions";

export default async function EditShopListingPage(props: PageProps<"/admin/shop-listings/[id]">) {
  const { id } = await props.params;
  const { supabase } = await requireAdmin();

  const [{ data: listing }, { data: items }, { data: species }] = await Promise.all([
    supabase
      .from("shop_listings")
      .select(
        "id, section, listing_type, item_id, species_id, description, price_coins, price_gems, is_new, ends_at, is_active, sort_order, created_at, items(name, image_url), species(name, image_url)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("items").select("id, name, image_url").eq("is_active", true).order("name"),
    supabase.from("species").select("id, name, image_url").eq("is_active", true).order("name"),
  ]);

  if (!listing) {
    notFound();
  }

  const targetItem = listing.items as unknown as { name: string; image_url: string | null } | null;
  const targetSpecies = listing.species as unknown as { name: string; image_url: string | null } | null;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">Edit shop listing</h2>
      <ShopListingForm
        action={updateShopListing}
        listing={listing}
        itemOptions={(items ?? []).map((i) => ({ id: i.id, label: i.name, imageUrl: i.image_url }))}
        speciesOptions={(species ?? []).map((s) => ({ id: s.id, label: s.name, imageUrl: s.image_url }))}
        defaultItem={
          listing.item_id && targetItem ? { id: listing.item_id, label: targetItem.name, imageUrl: targetItem.image_url } : null
        }
        defaultSpecies={
          listing.species_id && targetSpecies
            ? { id: listing.species_id, label: targetSpecies.name, imageUrl: targetSpecies.image_url }
            : null
        }
        submitLabel="Save changes"
      />
    </div>
  );
}
