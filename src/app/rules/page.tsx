// Placeholder — nothing in this app linked to /rules before the
// account-setup flow's agreement checkbox (see welcome-app.tsx) needed
// somewhere real for "Rules" and "Terms of Service" to point to. Fill
// this in with the site's actual rules/ToS copy when it's written; the
// #terms anchor below is what /rules#terms on that checkbox jumps to.
export default function RulesPage() {
  return (
    <main id="main">
      <div className="sheet">
        <div className="panel flex flex-col gap-6">
          <section className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Rules</h1>
            <p className="text-stone-600 dark:text-stone-400">
              Be kind, don&rsquo;t cheat, and don&rsquo;t ruin the game for other players. The full rules are
              still being written — check back soon.
            </p>
          </section>
          <section id="terms" className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold tracking-tight">Terms of Service</h2>
            <p className="text-stone-600 dark:text-stone-400">
              This is a hobby project, not a finished legal document. A real Terms of Service will go here.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
