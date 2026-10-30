import { requireAdmin } from "@/lib/admin";
import { ShopListingForm } from "../shop-listing-form";
import { createShopListing } from "../actions";

export default async function NewShopListingPage() {
  const { supabase } = await requireAdmin();

  const [{ data: items }, { data: species }] = await Promise.all([
    supabase.from("items").select("id, name, image_url").eq("is_active", true).order("name"),
    supabase.from("species").select("id, name, image_url").eq("is_active", true).order("name"),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">New shop listing</h2>
      <ShopListingForm
        action={createShopListing}
        itemOptions={(items ?? []).map((i) => ({ id: i.id, label: i.name, imageUrl: i.image_url }))}
        speciesOptions={(species ?? []).map((s) => ({ id: s.id, label: s.name, imageUrl: s.image_url }))}
        submitLabel="Create listing"
      />
    </div>
  );
}
