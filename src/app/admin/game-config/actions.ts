"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";

export async function updateGameConfig(formData: FormData): Promise<void> {
  const { supabase } = await requireAdmin();

  const key = String(formData.get("key") ?? "");
  const valueRaw = String(formData.get("value") ?? "");
  const value = Number(valueRaw);
  if (key.length === 0 || !Number.isFinite(value)) return;

  await supabase.from("game_config").update({ value, updated_at: new Date().toISOString() }).eq("key", key);

  revalidatePath("/admin/game-config");
}
