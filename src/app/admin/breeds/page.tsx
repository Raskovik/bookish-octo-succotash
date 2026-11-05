import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { addBreed, renameBreed } from "./actions";

export default async function AdminBreedsPage() {
  const { supabase } = await requireAdmin();

  const { data: breeds } = await supabase.from("breeds").select("id, name").order("name");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Breeds</h2>
        <p className="text-sm text-stone-500">
          The lineart/animal group a model belongs to (Cat, Dog, …) — pick one per model on the{" "}
          <Link href="/admin/species" className="underline">
            Models
          </Link>{" "}
          page.
        </p>
      </div>

      <form action={addBreed} className="flex gap-2">
        <input
          name="name"
          required
          placeholder="New breed name"
          className="flex-1 max-w-xs rounded-md border border-green-300 px-3 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
        <button
          type="submit"
          className="rounded-md bg-green-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
        >
          Add breed
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-green-200 dark:border-stone-800">
        <table className="w-full text-sm">
          <thead className="bg-green-100 text-left text-xs uppercase tracking-wide text-stone-500 dark:bg-stone-900">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(breeds ?? []).map((breed) => (
              <tr key={breed.id} className="border-t border-green-200 dark:border-stone-800">
                <td className="px-4 py-2">
                  <form action={renameBreed} className="flex items-center gap-2">
                    <input type="hidden" name="breed_id" value={breed.id} />
                    <input
                      name="name"
                      defaultValue={breed.name}
                      required
                      className="rounded-md border border-green-300 px-2 py-1 text-sm dark:border-stone-700 dark:bg-stone-900"
                    />
                    <button
                      type="submit"
                      className="rounded-md border border-green-300 px-2 py-1 text-xs hover:bg-green-100 dark:border-stone-700 dark:hover:bg-stone-800"
                    >
                      Rename
                    </button>
                  </form>
                </td>
                <td></td>
              </tr>
            ))}
            {(breeds ?? []).length === 0 ? (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-stone-500">
                  No breeds yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
