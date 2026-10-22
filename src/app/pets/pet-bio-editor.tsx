"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BBCodeEditor } from "@/components/forums/bbcode-editor";
import { bbcodeToHtml } from "@/lib/bbcode";
import "@/app/style/jungle-ui.css";

const MAX_BIO_LENGTH = 2000;

// Same client-calls-the-RPC-directly pattern as PetNameEditor/
// ForTradeToggle/MoveToFolderSelect (pets has never had a client UPDATE
// policy — set_pet_bio(), 0034_pet_bio.sql, is the only writable path) —
// just with BBCodeEditor's own uncontrolled textarea/toolbar instead of
// a plain input, read via FormData on submit rather than a real page
// navigation, since there's nowhere else on this page to redirect to.
export function PetBioEditor({
  userId,
  petId,
  bio,
}: {
  userId: string;
  petId: string;
  bio: string | null;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);

    const value = String(new FormData(event.currentTarget).get("bio") ?? "");
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("set_pet_bio", {
      p_user_id: userId,
      p_pet_id: petId,
      p_bio: value,
    });

    setIsPending(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setIsEditing(false);
    router.refresh();
  }

  return (
    <div className="overflow-hidden rounded-lg border-2 border-green-200 dark:border-stone-800">
      <div className="flex items-center justify-between border-b-2 border-green-200 bg-green-50/70 px-3 py-1.5 dark:border-stone-800 dark:bg-stone-900/50">
        <p className="text-xs font-bold uppercase tracking-wide text-green-800 dark:text-green-300">
          Bio
        </p>
        {!isEditing ? (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-xs font-semibold text-green-800 hover:underline dark:text-green-300"
          >
            {bio ? "Edit" : "Add a bio"}
          </button>
        ) : null}
      </div>

      <div className="p-3">
        {isEditing ? (
          <form
            id="pet-bio-form"
            onSubmit={handleSubmit}
            className="flex flex-col gap-2"
          >
            <BBCodeEditor
              name="bio"
              defaultValue={bio ?? ""}
              rows={6}
              maxLength={MAX_BIO_LENGTH}
            />
            {error ? (
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            ) : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setError(null);
                }}
                className="btn btn-sky btn-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="btn btn-green btn-sm"
              >
                {isPending ? "Saving…" : "Post"}
              </button>
            </div>
          </form>
        ) : bio ? (
          <div
            className="forum-content text-sm text-stone-700 dark:text-stone-300"
            dangerouslySetInnerHTML={{ __html: bbcodeToHtml(bio) }}
          />
        ) : (
          <p className="text-sm italic text-stone-500">No bio yet.</p>
        )}
      </div>
    </div>
  );
}
