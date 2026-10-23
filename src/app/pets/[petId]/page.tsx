import Image from "next/image";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, Coins, LogOut, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { petImageUrl, petTypeName, petAgeLabel } from "@/lib/pet-display";
import { calcPetEnergy, MIN_ENERGY_TO_ADVENTURE } from "@/lib/pet-energy";
import { PetNameEditor } from "../pet-name-editor";
import { PetBioEditor } from "../pet-bio-editor";
import { FeedButton } from "../feed-button";
import type { PetDetail } from "@/lib/supabase/types";

// A labeled box with a colored header bar — the shared shell for every
// sub-section (Information/Energy/Stats/Bio), so the page reads as a set
// of distinct cards rather than one undifferentiated block.
function Box({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border-2 border-green-200 dark:border-stone-800">
      <div className="flex items-center justify-between border-b-2 border-green-200 bg-green-50/70 px-3 py-1.5 dark:border-stone-800 dark:bg-stone-900/50">
        <p className="text-xs font-bold uppercase tracking-wide text-green-800 dark:text-green-300">{title}</p>
        {right}
      </div>
      {children}
    </div>
  );
}

function FactRow({ label, value, striped }: { label: string; value: React.ReactNode; striped: boolean }) {
  return (
    <div
      className={`flex items-center justify-between px-3 py-1.5 text-sm ${striped ? "bg-green-50/70 dark:bg-stone-900/40" : ""}`}
    >
      <span className="font-semibold text-stone-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

// Buttons for systems that don't exist yet (leveling, a quick-sell
// path). Shown so the layout reads complete rather than missing
// pieces, but disabled rather than silently doing nothing.
function ComingSoonButton({ label, icon: Icon }: { label: string; icon: LucideIcon }) {
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
      .select(
        "id, custom_name, bio, level, roll_strength, roll_speed, roll_defence, last_fed_at, created_at, species(name, image_url)",
      )
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
  const energy = calcPetEnergy(pet.last_fed_at);
  const canAdventure = energy >= MIN_ENERGY_TO_ADVENTURE;

  const facts = [
    { label: "Name", value: pet.custom_name ?? "Unnamed" },
    { label: "Species", value: petTypeName(pet) },
    { label: "Age", value: petAgeLabel(pet.created_at) },
    { label: "Adventures", value: adventureCount ?? 0 },
  ];

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-12">
      <Link href="/pets" className="flex w-fit items-center gap-1.5 text-sm text-stone-500 hover:underline">
        <ArrowLeft size={14} />
        Back to pets
      </Link>

      <div className="overflow-hidden rounded-2xl border-2 border-green-300 bg-white/70 dark:border-stone-700 dark:bg-stone-950/40">
        {/* ── Level + name ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-green-200 bg-green-50/70 p-4 dark:border-stone-800 dark:bg-stone-900/50">
          <span className="rounded-full border-2 border-green-300 bg-white px-3 py-1 text-xs font-bold text-green-800 dark:border-stone-700 dark:bg-stone-900 dark:text-green-300">
            Lv. {pet.level}
          </span>
          <PetNameEditor userId={user.id} petId={pet.id} customName={pet.custom_name} />
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
              <FactRow key={fact.label} label={fact.label} value={fact.value} striped={i % 2 === 1} />
            ))}
          </Box>

          <div className="flex flex-col gap-4">
            <Box title="Energy" right={<span className="text-[11px] font-semibold text-stone-500">{Math.round(energy)}%</span>}>
              <div className="p-3">
                <div className="h-3 w-full overflow-hidden rounded-full bg-green-100 dark:bg-stone-800">
                  <div
                    className={`h-full transition-all ${canAdventure ? "bg-green-500" : "bg-amber-500"}`}
                    style={{ width: `${energy}%` }}
                  />
                </div>
                {!canAdventure ? (
                  <p className="mt-1.5 text-[11px] text-amber-700 dark:text-amber-400">
                    Too tired to adventure — needs {MIN_ENERGY_TO_ADVENTURE}% energy or more.
                  </p>
                ) : null}
              </div>
            </Box>

            <Box title="Stats">
              {/* Shows the raw birth roll (1-10), not the computed
                  Level x Rate x (Roll / 10) stat from lib/pet-combat.ts
                  — every pet is Level 1 with no leveling mechanic yet,
                  so the computed number is always a confusing fraction
                  (a roll of 8 reads as "1.6"). The roll is itself the
                  pet's real "how good is it" signal until leveling
                  exists to make the computed stat mean anything. */}
              <div className="grid grid-cols-3 gap-2 p-3 text-center text-sm">
                {[
                  { label: "STR", value: pet.roll_strength },
                  { label: "SPD", value: pet.roll_speed },
                  { label: "DEF", value: pet.roll_defence },
                ].map((stat) => (
                  <div key={stat.label}>
                    <p className="text-xs text-stone-500">{stat.label}</p>
                    <p className="font-bold">{stat.value}</p>
                  </div>
                ))}
              </div>
            </Box>
          </div>

          <div className="flex flex-row flex-wrap gap-2 sm:flex-col">
            <FeedButton userId={user.id} petId={pet.id} />
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
  );
}
