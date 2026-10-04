import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { GemPackageForm } from "../gem-package-form";
import { updateGemPackage } from "../actions";

export default async function EditGemPackagePage(props: PageProps<"/admin/gem-packages/[id]">) {
  const { id } = await props.params;
  const { supabase } = await requireAdmin();

  const { data: gemPackage } = await supabase
    .from("gem_packages")
    .select("id, name, gem_amount, price_cents, is_active, sort_order, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!gemPackage) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">Edit gem package</h2>
      <GemPackageForm action={updateGemPackage} gemPackage={gemPackage} submitLabel="Save changes" />
    </div>
  );
}
