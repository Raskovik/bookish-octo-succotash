import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { ShopListingForm } from "../shop-listing-form";
import { updateShopListing } from "../actions";
import { DeleteListingButton } from "../delete-listing-button";

export default async function EditShopListingPage(props: PageProps<"/admin/shop-listings/[id]">) {
  const { id } = await props.params;
  const { supabase } = await requireAdmin();

  const [{ data: listing }, { data: items }, { data: species }] = await Promise.all([
    supabase
      .from("shop_listings")
      .select(
        "id, section, listing_type, item_id, species_id, description, price_coins, price_gems, starts_at, ends_at, sort_order, created_at, items(name, image_url), species(name, image_url)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("items").select("id, name, image_url, description").order("name"),
    supabase.from("species").select("id, name, image_url").order("name"),
  ]);

  if (!listing) {
    notFound();
  }

  const targetItem = listing.items as unknown as { name: string; image_url: string | null } | null;
  const targetSpecies = listing.species as unknown as { name: string; image_url: string | null } | null;
  const name = targetItem?.name ?? targetSpecies?.name ?? "Edit listing";

  return (
    <>
      <div className="crumbs">
        <Link href="/admin">Dashboard</Link>
        <i>/</i>
        <Link href="/admin/shop-listings">Shop listings</Link>
        <i>/</i>
        <span>{name}</span>
      </div>
      <div className="ph">
        <h1>{name}</h1>
      </div>
      <ShopListingForm
        action={updateShopListing}
        listing={listing}
        itemOptions={(items ?? []).map((i) => ({ id: i.id, label: i.name, imageUrl: i.image_url, description: i.description }))}
        speciesOptions={(species ?? []).map((s) => ({ id: s.id, label: s.name, imageUrl: s.image_url }))}
        defaultItem={
          listing.item_id && targetItem ? { id: listing.item_id, label: targetItem.name, imageUrl: targetItem.image_url } : null
        }
        defaultSpecies={
          listing.species_id && targetSpecies
            ? { id: listing.species_id, label: targetSpecies.name, imageUrl: targetSpecies.image_url }
            : null
        }
        isNew={false}
        cancelHref="/admin/shop-listings"
        deleteSlot={
          <DeleteListingButton
            listingId={listing.id}
            listingName={name}
            className="btn danger"
            redirectTo="/admin/shop-listings"
          />
        }
      />
    </>
  );
}
