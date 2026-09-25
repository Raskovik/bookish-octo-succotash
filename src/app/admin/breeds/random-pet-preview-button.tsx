"use client";

import { useState } from "react";
import { previewRandomBreedPet } from "./actions";

// Section 6 of the breeding spec doc: "a live preview that runs the same
// compositing function against a few sample trait combinations, so an
// admin can catch misaligned masks or bad color-region boundaries before
// they reach a player's screen." Each click rolls a fresh wild combo and
// composites it fresh — clicking a few times in a row is the "preview a
// few sample combinations" part.
export function RandomPetPreviewButton({ breedId }: { breedId: string }) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  async function handleClick() {
    setIsPending(true);
    setError(null);

    const result = await previewRandomBreedPet(breedId);

    setIsPending(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setImageUrl(result.imageUrl);
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="self-start rounded-md border border-green-300 px-3 py-2 text-sm hover:bg-green-100 disabled:opacity-60 dark:border-stone-700 dark:hover:bg-stone-800"
      >
        {isPending ? "Compositing…" : "Preview a random pet"}
      </button>
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- freshly-composited, cache-busted URL; next/image's optimizer would just add latency here
        <img src={imageUrl} alt="Random pet preview" className="h-40 w-40 rounded-lg border border-green-300 object-cover dark:border-stone-700" />
      ) : null}
    </div>
  );
}
