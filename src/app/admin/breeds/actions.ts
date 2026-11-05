"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";

export async function addBreed(formData: FormData) {
  const { supabase } = await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  if (name.length === 0) return;

  await supabase.from("breeds").insert({ name });

  revalidatePath("/admin/breeds");
}

export async function renameBreed(formData: FormData) {
  const { supabase } = await requireAdmin();

  const breedId = String(formData.get("breed_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (breedId.length === 0 || name.length === 0) return;

  await supabase.from("breeds").update({ name }).eq("id", breedId);

  revalidatePath("/admin/breeds");
  revalidatePath("/admin/species");
}
