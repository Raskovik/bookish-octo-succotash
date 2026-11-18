import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * Uploads an admin-picked image file to the game-images bucket (see
 * 0010_game_image_storage.sql) at a stable path — folder/id.ext, always
 * upsert:true — so re-uploading for the same row overwrites its one file
 * rather than accumulating orphans. Returns the new public URL (with a
 * cache-busting query param, since the path itself doesn't change on
 * re-upload) or null if no file was provided.
 */
export async function uploadGameImage(
  supabase: SupabaseClient<Database>,
  folder: "items" | "species" | "forums" | "zones",
  id: string,
  file: File | null,
): Promise<string | null> {
  if (!file || file.size === 0) return null;

  const extension = EXTENSION_BY_MIME_TYPE[file.type];
  if (!extension) {
    throw new Error(`Unsupported image type: ${file.type || "unknown"}. Use PNG, JPEG, WebP, or GIF.`);
  }

  const path = `${folder}/${id}.${extension}`;
  const { error } = await supabase.storage.from("game-images").upload(path, file, {
    upsert: true,
    contentType: file.type,
  });

  if (error) {
    throw new Error(`Image upload failed: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("game-images").getPublicUrl(path);

  return `${publicUrl}?v=${Date.now()}`;
}
