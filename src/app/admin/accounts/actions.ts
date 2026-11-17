"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";

export type DeleteAccountState = { error: string } | null;

// Same admin_delete_account() RPC as the per-player /mod page's delete
// tool (see mod/actions.ts's deleteAccount) — this is just a second,
// easier-to-find entry point to the same thing: search by username
// instead of needing to already be on a specific player's staff page.
export async function deleteAccount(
  _prevState: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const { supabase, user } = await requireAdmin();

  const targetUserId = String(formData.get("target_user_id") ?? "");
  if (targetUserId.length === 0) {
    return { error: "Missing target player." };
  }

  const { error } = await supabase.rpc("admin_delete_account", {
    p_admin_user_id: user.id,
    p_target_user_id: targetUserId,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/admin/accounts");
}
