import { requireAdmin } from "@/lib/admin";
import { addBannedPhrase, deleteBannedPhrase, addBannedDomain, deleteBannedDomain } from "./actions";

// Admin-only. The actual enforcement lives in the database (see
// 0077_content_filter.sql — assert_clean_text()/enforce_text_filter(),
// attached as a trigger on every free-text column in the app). This
// page is just CRUD for the two lists those triggers check against —
// adding or removing an entry here takes effect immediately, no
// deploy needed.
export default async function AdminContentFilterPage() {
  const { supabase } = await requireAdmin();

  const [{ data: phrases }, { data: domains }] = await Promise.all([
    supabase.from("banned_phrases").select("id, phrase").order("phrase"),
    supabase.from("banned_domains").select("id, domain").order("domain"),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Content filter</h2>
        <p className="text-sm text-stone-500">
          Blocks any submission — usernames, bios, pet names/bios, forum posts, DMs, trade notes, and more —
          that contains one of these words/phrases or links. Matching ignores spacing, punctuation and common
          leetspeak substitutions, so entries should be the plain word (e.g. &ldquo;fuck&rdquo;, not
          &ldquo;f*ck&rdquo;). Short fragments can also match inside unrelated words (e.g. banning
          &ldquo;ass&rdquo; would also catch &ldquo;assassin&rdquo;) — prefer whole words.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Banned words &amp; phrases</h3>
        <form action={addBannedPhrase} className="flex gap-2">
          <input
            name="phrase"
            required
            placeholder="New banned word or phrase"
            className="flex-1 max-w-xs rounded-md border border-green-300 px-3 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-900"
          />
          <button
            type="submit"
            className="rounded-md bg-green-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
          >
            Add
          </button>
        </form>

        <div className="overflow-hidden rounded-lg border border-green-200 dark:border-stone-800">
          <table className="w-full text-sm">
            <tbody>
              {(phrases ?? []).map((p) => (
                <tr key={p.id} className="border-t border-green-200 dark:border-stone-800">
                  <td className="px-4 py-2">{p.phrase}</td>
                  <td className="px-4 py-2 text-right">
                    <form action={deleteBannedPhrase}>
                      <input type="hidden" name="id" value={p.id} />
                      <button
                        type="submit"
                        className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                      >
                        Remove
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {(phrases ?? []).length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-6 text-center text-stone-500">
                    No banned phrases yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Banned links</h3>
        <p className="text-sm text-stone-500">
          A domain, like <code>spamsite.com</code> — matches that domain anywhere in the text, with or without
          http(s)://, www., or a path after it.
        </p>
        <form action={addBannedDomain} className="flex gap-2">
          <input
            name="domain"
            required
            placeholder="New banned domain"
            className="flex-1 max-w-xs rounded-md border border-green-300 px-3 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-900"
          />
          <button
            type="submit"
            className="rounded-md bg-green-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
          >
            Add
          </button>
        </form>

        <div className="overflow-hidden rounded-lg border border-green-200 dark:border-stone-800">
          <table className="w-full text-sm">
            <tbody>
              {(domains ?? []).map((d) => (
                <tr key={d.id} className="border-t border-green-200 dark:border-stone-800">
                  <td className="px-4 py-2">{d.domain}</td>
                  <td className="px-4 py-2 text-right">
                    <form action={deleteBannedDomain}>
                      <input type="hidden" name="id" value={d.id} />
                      <button
                        type="submit"
                        className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                      >
                        Remove
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {(domains ?? []).length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-6 text-center text-stone-500">
                    No banned domains yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
