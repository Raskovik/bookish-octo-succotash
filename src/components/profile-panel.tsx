import Link from "next/link";
import { bbcodeToHtml } from "@/lib/bbcode";
import { ProfileActions } from "@/components/profile-actions";
import type { PublicUserProfile } from "@/lib/supabase/types";

/**
 * The single profile page everyone sees — matches furgarden-design/
 * pages/profile.html's .pf-grid layout exactly. There is no separate
 * owner/visitor markup anymore: /profile and /u/[id] both render this
 * same component, just with a different `view`.
 *
 * Left out, since there's no data behind them: the friend badge/"friend"
 * and "pending" views (no friends feature exists — "Add friend" always
 * renders disabled rather than as a dead button for a fake state), and
 * the two decorative .bimg pet images flanking the bio (the handoff's
 * own README calls them "placeholder content" — nothing in this app
 * tracks "this player's two showcase pets"). The bio itself renders
 * through .forum-content (same as every other BBCode bio/post in the
 * app) rather than the mockup's centered-tagline .bio treatment, since
 * real bios run longer than the sample blurb and already need to
 * support headings/lists/quotes/images.
 */
export function ProfilePanel({
  profile,
  petCount,
  view,
  viewerSignedIn,
  viewerCanModerate,
}: {
  profile: PublicUserProfile;
  petCount: number;
  view: "owner" | "visitor" | "blocked";
  viewerSignedIn: boolean;
  viewerCanModerate: boolean;
}) {
  const joined = new Date(profile.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="panel profile" data-view={view}>
      <div className="pf-grid stretch tabs-l">
        <div className="pf-col">
          <section className="pc lt" aria-labelledby="pf-player">
            <h2 className="ltab" id="pf-player">
              Player
            </h2>
            <div className="idc-top">
              <div
                className="av-sq"
                role="img"
                aria-label={`${profile.display_name}'s avatar`}
                style={profile.avatar_url ? { backgroundImage: `url(${profile.avatar_url})` } : undefined}
              />
              <div>
                <h1 className="nm">{profile.display_name}</h1>
                <p>Joined {joined}</p>
                {viewerCanModerate && view !== "owner" ? (
                  <Link href={`/mod/players/${profile.id}`} className="mlink">
                    Report history (staff only)
                  </Link>
                ) : null}
              </div>
            </div>
            <ProfileActions
              initialView={view}
              profileId={profile.id}
              profileName={profile.display_name}
              viewerSignedIn={viewerSignedIn}
            />
          </section>

          <section className="pc lt dimmable" aria-labelledby="pf-stats">
            <h2 className="ltab" id="pf-stats">
              Player stats
            </h2>
            <div className="st-row">
              <span className="st">
                <span className="coin" />
                <b>{profile.coin_balance}</b>
              </span>
              <span className="st">
                <span className="coin gem" />
                <b>{profile.gem_balance}</b>
              </span>
              <span className="st">
                <span className="tile t-leaf sm i-paw" />
                Pets <b>{petCount} / {profile.den_size}</b>
              </span>
            </div>
          </section>

          <section className="pc lt dimmable" aria-labelledby="pf-stuff">
            <h2 className="ltab" id="pf-stuff">
              My stuff
            </h2>
            <div className="stuff">
              <Link className="btn btn-big" href={view === "owner" ? "/pets" : `/u/${profile.id}/pets`}>
                <i className="ic i-paw" aria-hidden="true" />
                Pets
              </Link>
              <Link className="btn btn-big" href={view === "owner" ? "/items" : `/u/${profile.id}/items`}>
                <i className="ic i-bag" aria-hidden="true" />
                Items
              </Link>
            </div>
          </section>
        </div>

        <div className="pf-col fill dimmable">
          <section className="pc lt bio-card" aria-labelledby="pf-bio">
            <h2 className="ltab" id="pf-bio">
              Bio
            </h2>
            {profile.bio ? (
              <div className="forum-content" dangerouslySetInnerHTML={{ __html: bbcodeToHtml(profile.bio) }} />
            ) : view === "owner" ? (
              <p>
                No bio yet.{" "}
                <Link href="/settings" className="mlink">
                  Add one
                </Link>
                .
              </p>
            ) : (
              <p>This player hasn&apos;t written a bio yet.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
