import { requireAdmin } from "@/lib/admin";
import { GemPackageForm } from "../gem-package-form";
import { createGemPackage } from "../actions";

export default async function NewGemPackagePage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">New gem package</h2>
      <GemPackageForm action={createGemPackage} submitLabel="Create package" />
    </div>
  );
}
