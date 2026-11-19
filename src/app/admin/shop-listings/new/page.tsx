import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { ShopListingForm } from "../shop-listing-form";
import { createShopListing } from "../actions";

export default async function NewShopListingPage() {
  const { supabase } = await requireAdmin();

  const [{ data: items }, { data: species }] = await Promise.all([
    supabase.from("items").select("id, name, image_url, description").order("name"),
    supabase.from("species").select("id, name, image_url").order("name"),
  ]);

  return (
    <>
      <div className="crumbs">
        <Link href="/admin">Dashboard</Link>
        <i>/</i>
        <Link href="/admin/shop-listings">Shop listings</Link>
        <i>/</i>
        <span>New</span>
      </div>
      <div className="ph">
        <h1>New shop listing</h1>
      </div>
      <ShopListingForm
        action={createShopListing}
        itemOptions={(items ?? []).map((i) => ({ id: i.id, label: i.name, imageUrl: i.image_url, description: i.description }))}
        speciesOptions={(species ?? []).map((s) => ({ id: s.id, label: s.name, imageUrl: s.image_url }))}
        isNew
        cancelHref="/admin/shop-listings"
      />
    </>
  );
}
