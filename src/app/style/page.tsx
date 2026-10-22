import "./jungle-ui.css";

// Unlisted reference page — not linked from nav anywhere, only reachable
// by typing /style directly. Renders a UI kit supplied as a finished
// static HTML/CSS file (not designed in this repo); this page's only job
// is to host that file's demo content inside the app. jungle-ui.css is
// that file's <style> block, copied verbatim and scoped to this route
// via the import above (Next.js only loads a page-local CSS import while
// that page is active, so it never reaches any other route). The two
// classes under "DEMO PAGE LAYOUT" at the bottom of that file are the
// only addition — they replace layout rules the original file defined in
// a second, editor-tool-specific <style> block that isn't needed here.
export const metadata = { title: "Style reference" };

export default function StylePage() {
  return (
    <>
      {/* React 19 hoists a <link> rendered anywhere in the tree into
          <head> itself — this is the font stack jungle-ui.css's
          var(--font-display)/var(--font-body) expect. The lint rule
          below is a Pages Router holdover (it wants fonts declared in
          _document.js, which doesn't exist in App Router); per-page
          hoisted <link> tags are the correct, documented App Router
          pattern, so this is a known false positive, not a real issue. */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;600;700&family=Chewy&family=Fredoka:wght@400;500;600;700&family=Lilita+One&family=Luckiest+Guy&family=Nunito+Sans:wght@400;600;700;800&family=Nunito:wght@400;600;700&family=Paytone+One&family=Titan+One&display=swap"
      />
      <div className="jui jui-page bg-jungle jui-demo-stage">
        <section className="paper">
          <h2 className="paper-title">Button Types</h2>
          <div className="paper-inner">
            <div className="row">
              <button type="button" className="btn btn-blue">
                blue
              </button>
              <button type="button" className="btn btn-sky">
                sky
              </button>
              <button type="button" className="btn btn-navy">
                navy
              </button>
              <button type="button" className="btn btn-green">
                green
              </button>
              <button type="button" className="btn btn-red">
                red
              </button>
              <button type="button" className="btn btn-orange">
                orange
              </button>
              <button type="button" className="btn btn-gold">
                gold
              </button>
              <button type="button" className="btn btn-purple">
                purple
              </button>
              <button type="button" className="btn btn-gray">
                gray
              </button>
              <button type="button" className="btn btn-cream">
                cream
              </button>
              <button type="button" className="btn btn-glass">
                glass
              </button>
            </div>
            <div className="row mt">
              <button type="button" className="btn btn-green btn-sm">
                Small
              </button>
              <button type="button" className="btn btn-green">
                Normal
              </button>
              <button type="button" className="btn btn-green btn-lg">
                Large
              </button>
              <button
                type="button"
                className="btn btn-green btn-round i-star"
                aria-label="Star"
              />
              <button
                type="button"
                className="btn btn-green btn-round i-gear"
                aria-label="Settings"
              />
            </div>
            <div className="jui-demo-states">
              <span className="sticky">Normal</span>
              <span className="sticky">Hover</span>
              <span className="sticky">Pressed</span>
              <span className="sticky">Disabled</span>
              <div>
                <button type="button" className="btn btn-green btn-ok">
                  Text
                </button>
              </div>
              <div>
                <button type="button" className="btn btn-green btn-ok is-hover">
                  Text
                </button>
              </div>
              <div>
                <button
                  type="button"
                  className="btn btn-green btn-ok is-pressed"
                >
                  Text
                </button>
              </div>
              <div>
                <button type="button" className="btn btn-green btn-ok" disabled>
                  Text
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="paper">
          <h2 className="paper-title">Frames &amp; Controls</h2>
          <div className="paper-inner">
            <div className="wood">
              <span className="wood-title">Title Text</span>
              <button
                type="button"
                className="btn btn-sky btn-round sm wood-close i-cross"
                aria-label="Close"
              />
              <div className="wood-body">
                Wood frame with a parchment body. Anything goes in here.
                <div className="wood-foot">
                  <button type="button" className="btn btn-green btn-ok">
                    Accept
                  </button>
                  <button type="button" className="btn btn-red btn-no">
                    Decline
                  </button>
                </div>
              </div>
            </div>

            <div className="row mt">
              <span className="chip">
                <span className="coin" />
                1,250
              </span>
              <span className="chip">
                <span className="coin gem" />
                48
              </span>
              <span className="plaque">Plaque</span>
              <span className="namebadge">Member Namebadge</span>
            </div>

            <div
              className="bar bar-green"
              style={{ "--value": "72%" } as React.CSSProperties}
            >
              <i />
              <b>72 / 100</b>
            </div>
            <div
              className="bar bar-striped"
              style={{ "--value": "45%" } as React.CSSProperties}
            >
              <i />
              <b>Loading…</b>
            </div>

            <div className="row mt">
              <label className="switch">
                <input type="checkbox" defaultChecked aria-label="Sound" />
                <span />
              </label>
              <label className="check">
                <input type="checkbox" defaultChecked />
                <i />
                Music
              </label>
              <label className="radio">
                <input type="radio" name="pr" defaultChecked />
                <i />
                Easy
              </label>
            </div>

            <input
              className="field"
              placeholder="Enter your name…"
              aria-label="Name"
            />

            <div className="mt">
              <div className="tabs">
                <span className="tab is-active">Items</span>
                <span className="tab">Pets</span>
                <span className="tab">Den</span>
              </div>
              <div
                className="wood-body"
                style={{ borderRadius: "0 12px 12px 12px" }}
              >
                <span className="slot">🍎</span>
                <span className="slot is-selected">🌟</span>
                <span className="slot rare">
                  💎<span className="count">x3</span>
                </span>
                <span className="slot epic">👑</span>
                <span className="slot is-locked">🎩</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
