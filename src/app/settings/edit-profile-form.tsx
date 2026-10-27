"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { BBCodeEditor } from "@/components/forums/bbcode-editor";
import { updateProfileSettings } from "./actions";
import type { WhoCanMessage } from "@/lib/supabase/types";

const MAX_BIO_LENGTH = 2000;
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

// Avatar + "who can message me" + bio, saved together as one "Save
// changes" action — matches the design's single <form id="ef-form">
// (username is the one section that lives outside this, see
// UsernameCard). Returns success/error and stays on the page (a toast,
// not a redirect) rather than reusing the old updateProfile() action's
// bounce back to /profile.
//
// The bio editor itself is the existing, unmodified BBCodeEditor (same
// toolbar/preview used by every forum post and pet bio in the app) —
// not the design's own .bb-bar/.bb-btn markup. Reskinning it was out of
// scope here: BBCodeEditor is shared by pages that haven't been
// converted to this theme, and restyling it only on this page would've
// meant forking the component or rippling a visual change into forum
// threads, pet bios, and site news editing that nobody asked to change.
// It'll look like the old Tailwind toolbar sitting in an otherwise
// themed page until that shared component gets its own pass.
export function EditProfileForm({
  usernameCard,
  profileUrl,
  avatarUrl,
  bio,
  whoCanMessage,
}: {
  usernameCard: React.ReactNode;
  profileUrl: string;
  avatarUrl: string | null;
  bio: string;
  whoCanMessage: WhoCanMessage;
}) {
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function say(text: string) {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }

  function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setAvatarError(null);
    if (!file) return;
    if (!AVATAR_TYPES.includes(file.type)) {
      setAvatarError("Please choose a PNG, JPEG, WebP or GIF image.");
      event.target.value = "";
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setAvatarError("That image is too big. The limit is 2 MB.");
      event.target.value = "";
      return;
    }
    setAvatarPreview(URL.createObjectURL(file));
    setRemoveAvatar(false);
  }

  function handleRemoveAvatar() {
    if (fileInputRef.current) fileInputRef.current.value = "";
    setAvatarPreview(null);
    setAvatarError(null);
    setRemoveAvatar(true);
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateProfileSettings(null, formData);
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      say("Changes saved.");
    });
  }

  const avatarShown = avatarPreview ?? (removeAvatar ? null : avatarUrl);

  return (
    <form action={handleSubmit} className="ef">
      <div className="pf-grid stretch tabs-l">
        <div className="pf-col">
          {usernameCard}

          <section className="pc lt" aria-labelledby="ef-av-h">
            <h2 className="ltab" id="ef-av-h">
              Avatar
            </h2>
            <div className="ef-av-row">
              <div
                className="av-sq ef-av"
                role="img"
                aria-label="Your avatar"
                style={avatarShown ? { backgroundImage: `url(${avatarShown})` } : undefined}
              />
              <div className="ef-av-btns">
                <label className="btn btn-sm btn-orange ef-file">
                  Change avatar
                  <input
                    ref={fileInputRef}
                    type="file"
                    name="avatar"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={handleAvatarChange}
                  />
                </label>
                {avatarShown ? (
                  <button className="btn btn-sm btn-cream" type="button" onClick={handleRemoveAvatar}>
                    Remove avatar
                  </button>
                ) : null}
              </div>
            </div>
            <input type="hidden" name="remove_avatar" value={removeAvatar ? "1" : "0"} />
            <p className="ef-hint">PNG, JPEG, WebP or GIF. Up to 2 MB. Shown as a square.</p>
            {avatarError ? (
              <p className="ef-error" role="alert">
                {avatarError}
              </p>
            ) : null}
          </section>

          <section className="pc lt" aria-labelledby="ef-priv-h">
            <h2 className="ltab" id="ef-priv-h">
              Messages
            </h2>
            {/* The design also offers "allow friend requests" and an
                "only friends" messaging option — both dropped, since
                there's no friends feature yet for either to attach to. */}
            <fieldset className="field">
              <legend>Who can message me</legend>
              <div className="choices">
                <label>
                  <input type="radio" name="who_can_message" value="everyone" defaultChecked={whoCanMessage === "everyone"} />
                  <span>Everyone</span>
                </label>
                <label>
                  <input type="radio" name="who_can_message" value="nobody" defaultChecked={whoCanMessage === "nobody"} />
                  <span>
                    No one
                    <small>Nobody can send you messages. Staff messages still reach you.</small>
                  </span>
                </label>
              </div>
            </fieldset>
          </section>
        </div>

        <div className="pf-col fill">
          <section className="pc lt" aria-labelledby="ef-bio-h">
            <h2 className="ltab" id="ef-bio-h">
              Bio
            </h2>
            <BBCodeEditor name="bio" defaultValue={bio} rows={10} maxLength={MAX_BIO_LENGTH} />
            <p className="ef-hint">Uses the same BBCode as forum posts: bold, colours, sizes, lists, links and more.</p>
          </section>
        </div>
      </div>

      {error ? (
        <p className="ef-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="ef-actions">
        <Link className="ef-view" href={profileUrl}>
          &laquo; Back to my profile
        </Link>
        <span className="ef-btns">
          <Link className="btn btn-cream" href={profileUrl}>
            Cancel
          </Link>
          <button className="btn btn-leaf" type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Save changes"}
          </button>
        </span>
      </div>

      <div className={toast ? "toast show" : "toast"} role="status" aria-live="polite">
        {toast}
      </div>
    </form>
  );
}
