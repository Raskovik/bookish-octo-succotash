import Image from "next/image";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import {
  ArrowLeft,
  Utensils,
  Coins,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { petImageUrl, petTypeName, petAgeLabel } from "@/lib/pet-display";
import { PetNameEditor } from "../pet-name-editor";
import { PetBioEditor } from "../pet-bio-editor";
import type { PetDetail } from "@/lib/supabase/types";

// A labeled box with a colored header bar — the shared shell for every
// sub-section (Information/Energy/Stats/Bio), so the page reads as a set
// of distinct cards rather than one undifferentiated block.
function Box({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border-2 border-green-200 dark:border-stone-800">
      <div className="flex items-center justify-between border-b-2 border-green-200 bg-green-50/70 px-3 py-1.5 dark:border-stone-800 dark:bg-stone-900/50">
        <p className="text-xs font-bold uppercase tracking-wide text-green-800 dark:text-green-300">
          {title}
        </p>
        {right}
      </div>
      {children}
    </div>
  );
}

function FactRow({
  label,
  value,
  striped,
}: {
  label: string;
  value: React.ReactNode;
  striped: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between px-3 py-1.5 text-sm ${striped ? "bg-green-50/70 dark:bg-stone-900/40" : ""}`}
    >
      <span className="font-semibold text-stone-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

// Buttons for systems that don't exist yet (stats/leveling, feeding, a
// quick-sell path). Shown so the layout reads complete rather than
// missing pieces, but disabled rather than silently doing nothing.
function ComingSoonButton({
  label,
  icon: Icon,
}: {
  label: string;
  icon: LucideIcon;
}) {
  return (
    <button
      type="button"
      disabled
      title="Coming soon"
      className="inline-flex items-center justify-center gap-1.5 rounded-full bg-green-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400 disabled:shadow-none dark:disabled:bg-stone-800 dark:disabled:text-stone-600"
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

// Owner-only, same as the /pets grid itself — pets has no public-viewing
// story yet (see /u/[id]'s "Browsing another player's pets isn't
// available yet"), so a pet that exists but belongs to someone else 404s
// exactly like one that doesn't exist at all, rather than leaking which
// case it is.
export default async function PetDetailPage(props: PageProps<"/pets/[petId]">) {
  const { petId } = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: petData }, { count: adventureCount }] = await Promise.all([
    supabase
      .from("pets")
      .select("id, custom_name, bio, created_at, species(name, image_url)")
      .eq("id", petId)
      .eq("owner_id", user.id)
      .maybeSingle(),
    supabase
      .from("expeditions")
      .select("*", { count: "exact", head: true })
      .eq("pet_id", petId)
      .eq("user_id", user.id),
  ]);

  if (!petData) {
    notFound();
  }

  const pet = petData as unknown as PetDetail;

  const facts = [
    { label: "Name", value: pet.custom_name ?? "Unnamed" },
    { label: "Species", value: petTypeName(pet) },
    { label: "Age", value: petAgeLabel(pet.created_at) },
    { label: "Adventures", value: adventureCount ?? 0 },
  ];

  return (
    <>
      {/* Font stack the Cancel/Post buttons below need — jungle-ui.css
          (see pet-bio-editor.tsx) uses var(--font-display), which falls
          back to system-ui without this, so the buttons still work, just
          not in the kit's intended font. See /style's own copy of this
          link for the same eslint-disable reasoning. */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;600;700&family=Chewy&family=Fredoka:wght@400;500;600;700&family=Lilita+One&family=Luckiest+Guy&family=Nunito+Sans:wght@400;600;700;800&family=Nunito:wght@400;600;700&family=Paytone+One&family=Titan+One&display=swap"
      />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-12">
        <Link
          href="/pets"
          className="flex w-fit items-center gap-1.5 text-sm text-stone-500 hover:underline"
        >
          <ArrowLeft size={14} />
          Back to pets
        </Link>

        <div className="overflow-hidden rounded-2xl border-2 border-green-300 bg-white/70 dark:border-stone-700 dark:bg-stone-950/40">
          {/* ── Level + name ─────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-green-200 bg-green-50/70 p-4 dark:border-stone-800 dark:bg-stone-900/50">
            <span
              title="Leveling isn't built yet"
              className="rounded-full border-2 border-green-200 bg-white px-3 py-1 text-xs font-bold text-stone-400 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-600"
            >
              Lv. —
            </span>
            <PetNameEditor
              userId={user.id}
              petId={pet.id}
              customName={pet.custom_name}
            />
          </div>

          {/* ── Portrait ─────────────────────────────────────────────────── */}
          <div className="flex justify-center border-b-2 border-green-200 bg-green-50/40 p-6 dark:border-stone-800 dark:bg-stone-900/30">
            {petImageUrl(pet) ? (
              <Image
                src={petImageUrl(pet)!}
                alt={petTypeName(pet)}
                width={240}
                height={240}
                className="h-56 w-56 rounded-lg object-cover sm:h-64 sm:w-64"
              />
            ) : (
              <div className="h-56 w-56 rounded-lg bg-green-100 dark:bg-stone-800 sm:h-64 sm:w-64" />
            )}
          </div>

          {/* ── Facts / stats / actions ──────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-[1fr_1.3fr_auto]">
            <Box title="Information">
              {facts.map((fact, i) => (
                <FactRow
                  key={fact.label}
                  label={fact.label}
                  value={fact.value}
                  striped={i % 2 === 1}
                />
              ))}
            </Box>

            <div className="flex flex-col gap-4">
              <Box
                title="Energy"
                right={
                  <span className="text-[11px] italic text-stone-400 dark:text-stone-600">
                    Coming soon
                  </span>
                }
              >
                <div className="p-3">
                  <div className="h-3 w-full overflow-hidden rounded-full bg-green-100 dark:bg-stone-800">
                    <div className="h-full w-full bg-green-300 dark:bg-stone-700" />
                  </div>
                </div>
              </Box>

              <Box
                title="Stats"
                right={
                  <span className="text-[11px] italic text-stone-400 dark:text-stone-600">
                    Coming soon
                  </span>
                }
              >
                <div className="grid grid-cols-3 gap-2 p-3 text-center text-sm">
                  {["ATK", "DEF", "STR"].map((stat) => (
                    <div key={stat}>
                      <p className="text-xs text-stone-500">{stat}</p>
                      <p className="font-bold text-stone-400 dark:text-stone-600">
                        —
                      </p>
                    </div>
                  ))}
                </div>
              </Box>
            </div>

            <div className="flex flex-row flex-wrap gap-2 sm:flex-col">
              <ComingSoonButton label="Feed" icon={Utensils} />
              <ComingSoonButton label="Sell" icon={Coins} />
              <ComingSoonButton label="Release" icon={LogOut} />
            </div>
          </div>

          {/* ── Bio ──────────────────────────────────────────────────────── */}
          <div className="p-5 pt-0">
            <PetBioEditor userId={user.id} petId={pet.id} bio={pet.bio} />
          </div>
        </div>
      </main>
    </>
  );
}
