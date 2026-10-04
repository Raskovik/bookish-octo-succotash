"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";

export type GemPackageFormState = { error: string } | null;

function readGemPackageFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const gemAmountRaw = String(formData.get("gem_amount") ?? "");
  const priceDollarsRaw = String(formData.get("price_dollars") ?? "");
  const isActive = formData.get("is_active") === "on";
  const sortOrderRaw = String(formData.get("sort_order") ?? "0");
  const sortOrder = Number.parseInt(sortOrderRaw, 10);

  if (name.length === 0) return { ok: false as const, error: "Name can't be empty." };
  if (name.length > 80) return { ok: false as const, error: "Name must be 80 characters or fewer." };

  const gemAmount = Number.parseInt(gemAmountRaw, 10);
  if (!Number.isInteger(gemAmount) || gemAmount <= 0) {
    return { ok: false as const, error: "Gem amount must be a positive whole number." };
  }

  // Priced in dollars in the form (friendlier to type than cents), stored
  // in cents — Stripe's own smallest-unit convention, see 0045_gem_purchases.sql.
  const priceDollars = Number.parseFloat(priceDollarsRaw);
  if (!Number.isFinite(priceDollars) || priceDollars <= 0) {
    return { ok: false as const, error: "Price must be a positive dollar amount." };
  }
  const priceCents = Math.round(priceDollars * 100);

  return {
    ok: true as const,
    fields: {
      name,
      gem_amount: gemAmount,
      price_cents: priceCents,
      is_active: isActive,
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
    },
  };
}

export async function createGemPackage(
  _prevState: GemPackageFormState,
  formData: FormData,
): Promise<GemPackageFormState> {
  const { supabase } = await requireAdmin();

  const parsed = readGemPackageFields(formData);
  if (!parsed.ok) return { error: parsed.error };

  const { error } = await supabase.from("gem_packages").insert(parsed.fields);
  if (error) {
    return { error: `Could not create gem package: ${error.message}` };
  }

  revalidatePath("/admin/gem-packages");
  revalidatePath("/gems");
  redirect("/admin/gem-packages");
}

export async function updateGemPackage(
  _prevState: GemPackageFormState,
  formData: FormData,
): Promise<GemPackageFormState> {
  const { supabase } = await requireAdmin();

  const packageId = String(formData.get("package_id") ?? "");
  if (packageId.length === 0) return { error: "Missing package id." };

  const parsed = readGemPackageFields(formData);
  if (!parsed.ok) return { error: parsed.error };

  const { error } = await supabase.from("gem_packages").update(parsed.fields).eq("id", packageId);
  if (error) {
    return { error: `Could not save gem package: ${error.message}` };
  }

  revalidatePath("/admin/gem-packages");
  revalidatePath("/gems");
  redirect("/admin/gem-packages");
}
