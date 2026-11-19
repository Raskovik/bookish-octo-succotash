"use client";

import { useRouter } from "next/navigation";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { deleteShopListing } from "./actions";

export function DeleteListingButton({
  listingId,
  listingName,
  className = "lnk red",
  redirectTo,
}: {
  listingId: string;
  listingName: string;
  className?: string;
  // Edit page usage: the record is gone after deleting, so navigate away
  // instead of refreshing the (now 404) page it was on.
  redirectTo?: string;
}) {
  const router = useRouter();

  return (
    <ConfirmButton
      label="Delete"
      title="Delete this listing?"
      body={`"${listingName}" will stop showing in the shop immediately. This can't be undone.`}
      confirmLabel="Delete"
      danger
      className={className}
      onConfirm={async () => {
        const fd = new FormData();
        fd.set("listing_id", listingId);
        await deleteShopListing(fd);
        if (redirectTo) router.push(redirectTo);
        else router.refresh();
      }}
    />
  );
}
