"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { uploadAvatar, deleteAvatarFiles } from "@/lib/avatar-upload";
import type { WhoCanMessage } from "@/lib/supabase/types";

// Keep in sync with MAX_BIO_LENGTH in ./bio-card.tsx.
const MAX_BIO_LENGTH = 2000;

export type UpdateProfileSettingsState = { error: string } | { success: true } | null;

// Everything on the edit-profile page except the username (that's its
// own immediate action, called directly from UsernameCard — see the
// RPC comment there for why). One combined save: bio, avatar,
// remove_avatar, who_can_message. Unlike the old updateProfile() this
// replaced, this returns a result instead of redirecting — the new
// page stays put and shows a toast on success (matches the design's
// own js/edit-profile.js), rather than bouncing back to the profile.
export async function updateProfileSettings(
  _prevState: UpdateProfileSettingsState,
  formData: FormData,
): Promise<UpdateProfileSettingsState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // `users.bio` stores raw BBCode source, same as forum_posts.body_raw —
  // unlike forum posts there's no separate rendered column here, since a
  // profile page only ever needs to render one bio at a time (not a page
  // of them), so bbcodeToHtml() just runs fresh on every read instead
  // (see /profile and /u/[id]).
  const bioRaw = formData.get("bio");
  const bio = typeof bioRaw === "string" ? bioRaw.trim() : "";
  if (bio.length > MAX_BIO_LENGTH) {
    return { error: `Bio must be ${MAX_BIO_LENGTH} characters or fewer.` };
  }

  const whoCanMessageRaw = formData.get("who_can_message");
  if (whoCanMessageRaw !== "everyone" && whoCanMessageRaw !== "nobody") {
    return { error: "Invalid messaging preference." };
  }
  const whoCanMessage: WhoCanMessage = whoCanMessageRaw;

  const removeAvatar = formData.get("remove_avatar") === "1";

  // avatarUrl stays undefined (column untouched) when no new file was
  // picked and removal wasn't requested — same "only touch what the
  // player actually changed" reasoning as the action this replaced.
  let avatarUrl: string | undefined;
  if (removeAvatar) {
    await deleteAvatarFiles(supabase, user.id);
  } else {
    const avatarFile = formData.get("avatar");
    if (avatarFile instanceof File && avatarFile.size > 0) {
      try {
        avatarUrl = (await uploadAvatar(supabase, user.id, avatarFile)) ?? undefined;
      } catch (uploadError) {
        return {
          error: uploadError instanceof Error ? uploadError.message : "Could not upload avatar.",
        };
      }
    }
  }

  const { error } = await supabase
    .from("users")
    .update({
      bio: bio.length > 0 ? bio : null,
      who_can_message: whoCanMessage,
      ...(removeAvatar ? { avatar_url: null } : {}),
      ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
    })
    .eq("id", user.id);

  if (error) {
    return { error: "Could not save your changes. Please try again." };
  }

  revalidatePath("/settings");
  revalidatePath(`/u/${user.id}`);
  return { success: true };
}
