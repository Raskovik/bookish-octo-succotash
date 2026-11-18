import Link from "next/link";
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
    <>
      <div className="crumbs">
        <Link href="/admin">Admin</Link>
        <i>/</i>
        <span>Content filter</span>
      </div>
      <div className="ph">
        <h1>Content filter</h1>
      </div>
      <p className="desc" style={{ marginBottom: 14 }}>
        Blocks any submission — usernames, bios, pet names/bios, forum posts, DMs, trade notes, and more — that
        contains one of these words/phrases or links. Words/phrases match whole words only, so &ldquo;ass&rdquo;
        won&apos;t catch &ldquo;assassinate&rdquo; — but punctuation (&ldquo;a.s.s&rdquo;) and common leetspeak
        (&ldquo;a55&rdquo;) are still caught. Entries should be the plain word (e.g. &ldquo;fuck&rdquo;, not
        &ldquo;f*ck&rdquo;).
      </p>

      <section className="sub card" style={{ marginBottom: 20 }}>
        <div className="sh">
          <h2>Banned words &amp; phrases</h2>
        </div>
        <form action={addBannedPhrase} className="addrow" style={{ borderTop: 0 }}>
          <input name="phrase" required placeholder="New banned word or phrase" className="in" style={{ maxWidth: 280 }} />
          <button type="submit" className="btn pri">
            Add
          </button>
        </form>

        <div className="tw">
          <table className="tbl">
            <tbody>
              {(phrases ?? []).map((p) => (
                <tr key={p.id}>
                  <td>{p.phrase}</td>
                  <td className="act">
                    <form action={deleteBannedPhrase}>
                      <input type="hidden" name="id" value={p.id} />
                      <button type="submit" className="btn sm danger">
                        Remove
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {(phrases ?? []).length === 0 ? (
                <tr className="empty">
                  <td colSpan={2}>No banned phrases yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="sub card">
        <div className="sh">
          <h2>Banned links</h2>
          <p className="hint">
            A domain, like <code>spamsite.com</code> — matches that domain anywhere in the text, with or without
            http(s)://, www., or a path after it.
          </p>
        </div>
        <form action={addBannedDomain} className="addrow" style={{ borderTop: 0 }}>
          <input name="domain" required placeholder="New banned domain" className="in" style={{ maxWidth: 280 }} />
          <button type="submit" className="btn pri">
            Add
          </button>
        </form>

        <div className="tw">
          <table className="tbl">
            <tbody>
              {(domains ?? []).map((d) => (
                <tr key={d.id}>
                  <td>{d.domain}</td>
                  <td className="act">
                    <form action={deleteBannedDomain}>
                      <input type="hidden" name="id" value={d.id} />
                      <button type="submit" className="btn sm danger">
                        Remove
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {(domains ?? []).length === 0 ? (
                <tr className="empty">
                  <td colSpan={2}>No banned domains yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
