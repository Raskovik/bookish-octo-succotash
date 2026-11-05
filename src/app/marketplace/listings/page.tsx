import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadListings } from "../load-listings";
import { ListingsApp } from "./listings-app";

export default async function MyListingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await supabase.rpc("resolve_expired_listings");

  const { data: idRows } = await supabase
    .from("marketplace_listings")
    .select("id")
    .or(`seller_id.eq.${user.id},buyer_id.eq.${user.id}`);

  const listings = await loadListings(
    supabase,
    (idRows ?? []).map((r) => r.id),
  );

  return <ListingsApp userId={user.id} listings={listings} />;
}
