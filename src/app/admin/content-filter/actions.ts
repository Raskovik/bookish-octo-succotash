"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";

export async function addBannedPhrase(formData: FormData): Promise<void> {
  const { supabase } = await requireAdmin();

  const phrase = String(formData.get("phrase") ?? "").trim().toLowerCase();
  if (phrase.length === 0) return;

  await supabase.from("banned_phrases").insert({ phrase });

  revalidatePath("/admin/content-filter");
}

export async function deleteBannedPhrase(formData: FormData): Promise<void> {
  const { supabase } = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (id.length === 0) return;

  await supabase.from("banned_phrases").delete().eq("id", id);

  revalidatePath("/admin/content-filter");
}

export async function addBannedDomain(formData: FormData): Promise<void> {
  const { supabase } = await requireAdmin();

  const domain = String(formData.get("domain") ?? "").trim().toLowerCase();
  if (domain.length === 0) return;

  await supabase.from("banned_domains").insert({ domain });

  revalidatePath("/admin/content-filter");
}

export async function deleteBannedDomain(formData: FormData): Promise<void> {
  const { supabase } = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (id.length === 0) return;

  await supabase.from("banned_domains").delete().eq("id", id);

  revalidatePath("/admin/content-filter");
}
