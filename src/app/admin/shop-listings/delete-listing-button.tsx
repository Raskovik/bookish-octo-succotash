"use client";

import { useRouter } from "next/navigation";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { deleteShopListing } from "./actions";

export function DeleteListingButton({ listingId, listingName }: { listingId: string; listingName: string }) {
  const router = useRouter();

  return (
    <ConfirmButton
      label="Delete"
      title="Delete this listing?"
      body={`"${listingName}" will stop showing in the shop immediately. This can't be undone.`}
      confirmLabel="Delete"
      danger
      className="lnk red"
      onConfirm={async () => {
        const fd = new FormData();
        fd.set("listing_id", listingId);
        await deleteShopListing(fd);
        router.refresh();
      }}
    />
  );
}
