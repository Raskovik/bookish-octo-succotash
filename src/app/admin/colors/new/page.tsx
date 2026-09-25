import { requireAdmin } from "@/lib/admin";
import { ColorForm } from "../color-form";
import { createColor } from "../actions";

export default async function NewColorPage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">New color</h2>
      <ColorForm action={createColor} submitLabel="Create color" />
    </div>
  );
}
