import { requireAdmin } from "@/lib/admin";
import { BreedForm } from "../breed-form";
import { createBreed } from "../actions";

export default async function NewBreedPage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">New breed</h2>
      <BreedForm action={createBreed} submitLabel="Create breed" />
    </div>
  );
}
