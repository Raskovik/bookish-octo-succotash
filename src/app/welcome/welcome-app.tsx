"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { uploadAvatar } from "@/lib/avatar-upload";

const NAME_PATTERN = /^[A-Za-z0-9_]{3,16}$/;
const PET_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 '-]{1,15}$/;
const AVATAR_SWATCHES = ["c0", "c1", "c2", "c3", "c4"] as const;
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"];

type Starter = { id: string; label: string; blurb: string; imageUrl: string };

// Confetti burst in the site colours, skipped for prefers-reduced-motion
// — same effect as the design's js/create-account.js confetti(), just
// ported to a React-friendly module-scope function instead of relying
// on a bundled script tag.
function fireConfetti() {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const canvas = document.createElement("canvas");
  canvas.className = "ob-confetti";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }
  const width = (canvas.width = window.innerWidth);
  const height = (canvas.height = window.innerHeight);
  const colors = ["#f58a12", "#ffb840", "#86c845", "#5fa32c", "#5cc6fb", "#2f93e2", "#ffd22e", "#fff9e8"];

  type Particle = { x: number; y: number; vx: number; vy: number; w: number; h: number; r: number; vr: number; c: string };
  const particles: Particle[] = [];
  for (let i = 0; i < 150; i++) {
    const left = i % 2 === 0;
    const angle = -Math.PI / 2 + (left ? 1 : -1) * (0.25 + Math.random() * 0.7);
    const v = 11 + Math.random() * 11;
    particles.push({
      x: left ? 0 : width,
      y: height * 0.78,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      w: 6 + Math.random() * 7,
      h: 4 + Math.random() * 6,
      r: Math.random() * 6,
      vr: (Math.random() - 0.5) * 0.4,
      c: colors[i % colors.length],
    });
  }

  let start: number | null = null;
  function frame(t: number) {
    if (start === null) start = t;
    const elapsed = t - start;
    ctx!.clearRect(0, 0, width, height);
    for (const p of particles) {
      p.vy += 0.32;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      ctx!.save();
      ctx!.translate(p.x, p.y);
      ctx!.rotate(p.r);
      ctx!.globalAlpha = Math.max(0, 1 - elapsed / 3600);
      ctx!.fillStyle = p.c;
      ctx!.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx!.restore();
    }
    if (elapsed < 3600) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}

export function WelcomeApp({
  email,
  initialDisplayName,
  starters,
}: {
  email: string;
  initialDisplayName: string | null;
  starters: Starter[];
}) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const accountAlreadyDone = initialDisplayName !== null;
  const [screen, setScreen] = useState(accountAlreadyDone ? 1 : 0);
  const [finalName, setFinalName] = useState(initialDisplayName ?? "");

  const [name, setName] = useState("");
  const [avChoice, setAvChoice] = useState<(typeof AVATAR_SWATCHES)[number] | "upload">("c0");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountPending, startAccountTransition] = useTransition();

  const [petId, setPetId] = useState<string | null>(null);
  const [petName, setPetName] = useState("");
  const [petError, setPetError] = useState<string | null>(null);
  const [petPending, startPetTransition] = useTransition();
  const [wonPet, setWonPet] = useState<Starter | null>(null);
  const [wonPetName, setWonPetName] = useState("");

  useEffect(() => {
    if (screen === 2) fireConfetti();
  }, [screen]);

  const trimmedName = name.trim();
  const nameValid = NAME_PATTERN.test(trimmedName);
  const nameMessage = trimmedName.length === 0 ? "" : nameValid ? `${trimmedName} looks good!` : "3 to 16 letters, numbers or underscores.";

  const trimmedPetName = petName.replace(/\s+/g, " ").trim();
  const petNameValid = trimmedPetName.length === 0 || PET_NAME_PATTERN.test(trimmedPetName);

  function handleAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setAvatarError(null);
    if (!file) return;
    if (!AVATAR_TYPES.includes(file.type)) {
      setAvatarError("Use a PNG, JPG or WebP under 2 MB.");
      e.target.value = "";
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setAvatarError("Use a PNG, JPG or WebP under 2 MB.");
      e.target.value = "";
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setAvChoice("upload");
  }

  function handleCreateAccount() {
    if (!nameValid || !agreed || accountPending) return;
    setAccountError(null);
    startAccountTransition(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setAccountError("You've been signed out. Please sign in again.");
        return;
      }

      let avatarUrl: string | null = `/img/avatars/paw-${avChoice === "upload" ? "c0" : avChoice}.svg`;
      if (avChoice === "upload") {
        if (!avatarFile) {
          setAccountError("Choose a picture to upload, or pick one of the paw options.");
          return;
        }
        try {
          avatarUrl = (await uploadAvatar(supabase, user.id, avatarFile)) ?? avatarUrl;
        } catch (uploadError) {
          setAccountError(uploadError instanceof Error ? uploadError.message : "Could not upload that picture.");
          return;
        }
      }

      const { error } = await supabase.rpc("create_player_account", {
        p_user_id: user.id,
        p_display_name: trimmedName,
        p_avatar_url: avatarUrl,
        p_agreed: agreed,
      });

      if (error) {
        setAccountError(error.message);
        return;
      }

      setFinalName(trimmedName);
      setScreen(1);
    });
  }

  function handleAdopt() {
    if (!petId || !petNameValid || petPending) return;
    setPetError(null);
    startPetTransition(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setPetError("You've been signed out. Please sign in again.");
        return;
      }

      const { error } = await supabase.rpc("adopt_starter_pet", {
        p_user_id: user.id,
        p_species_id: petId,
        p_custom_name: trimmedPetName.length > 0 ? trimmedPetName : null,
      });

      if (error) {
        setPetError(error.message);
        return;
      }

      const chosen = starters.find((s) => s.id === petId) ?? null;
      setWonPet(chosen);
      setWonPetName(trimmedPetName.length > 0 ? trimmedPetName : (chosen?.label ?? ""));
      setScreen(2);
    });
  }

  const selectedStarter = starters.find((s) => s.id === petId) ?? null;

  return (
    <div className="ob" data-mode="page">
      <ol className="ob-steps" aria-label="Setup progress">
        <li className={screen > 0 ? "is-done" : screen === 0 ? "is-current" : undefined} aria-current={screen === 0 ? "step" : undefined}>
          Account
        </li>
        <li className={screen > 1 ? "is-done" : screen === 1 ? "is-current" : undefined} aria-current={screen === 1 ? "step" : undefined}>
          First pet
        </li>
        <li className={screen === 2 ? "is-current" : undefined} aria-current={screen === 2 ? "step" : undefined}>
          Adventure
        </li>
      </ol>

      {screen === 0 ? (
        <div className="ob-screen">
          <h1 tabIndex={-1}>Welcome to Furgarden!</h1>
          <p className="ob-lead">First, let&rsquo;s set up your account.</p>
          <p className="ob-who">
            <span>
              <b>G</b>Signed in with Google as {email}
            </span>
          </p>
          <div className="ob-two">
            <section className="ob-sec" aria-labelledby="ob-h1">
              <h2 id="ob-h1">
                <span>1</span>Pick a username
              </h2>
              <p>This is the name other players see on your profile, the forums and the marketplace.</p>
              <div className="ef">
                <div className="field">
                  <label htmlFor="ob-name">Username</label>
                  <input
                    type="text"
                    id="ob-name"
                    maxLength={20}
                    autoComplete="username"
                    spellCheck={false}
                    placeholder="e.g. Penapiller"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    aria-invalid={trimmedName.length > 0 && !nameValid}
                  />
                  <p className={`ob-msg ${trimmedName.length === 0 ? "" : nameValid ? "ok" : "bad"}`} role="status" aria-live="polite">
                    {nameMessage}
                  </p>
                </div>
              </div>
              <ul className="ob-rules">
                <li>3 to 16 letters, numbers or underscores.</li>
                <li>It can&rsquo;t be changed later.</li>
              </ul>
            </section>
            <section className="ob-sec" aria-labelledby="ob-h2">
              <h2 id="ob-h2">
                <span>2</span>Choose a picture
              </h2>
              <p>You can change it any time in Edit Profile.</p>
              <div className="ob-pic">
                <div
                  className={`ob-big ${avChoice !== "upload" ? avChoice : ""}`}
                  role="img"
                  aria-label="Your picture, preview"
                  style={avChoice === "upload" && avatarPreview ? { backgroundImage: `url(${avatarPreview})` } : undefined}
                />
                <div>
                  <div className="ob-opts" role="radiogroup" aria-label="Picture choices">
                    {AVATAR_SWATCHES.map((swatch, i) => (
                      <label className="ob-opt" key={swatch}>
                        <input
                          type="radio"
                          name="av"
                          value={swatch}
                          checked={avChoice === swatch}
                          onChange={() => setAvChoice(swatch)}
                        />
                        <span className={swatch} role="img" aria-label={`Paw picture ${i + 1}`} />
                      </label>
                    ))}
                    <label className="ob-opt">
                      <input type="radio" name="av" value="up" hidden checked={avChoice === "upload"} readOnly />
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="ob-file"
                        accept="image/png,image/jpeg,image/webp"
                        aria-label="Upload your own picture"
                        onChange={handleAvatarFileChange}
                      />
                      <span className="up">Upload</span>
                    </label>
                  </div>
                  <p className={`ob-msg ${avatarError ? "bad" : ""}`} role="status" aria-live="polite">
                    {avatarError}
                  </p>
                  <p className="ob-note">PNG, JPG or WebP, up to 2 MB.</p>
                </div>
              </div>
            </section>
          </div>
          <div className="ob-actions">
            <div>
              <label className="ob-agree">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                <span>
                  I&rsquo;m at least 13 years old and I agree to the <Link href="/rules">Rules</Link> and{" "}
                  <Link href="/rules#terms">Terms of Service</Link>.
                </span>
              </label>
              <p className="ob-msg" role="status" aria-live="polite">
                {accountError ?? (!nameValid || !agreed ? "Still to do: pick a username, agree to the Rules and Terms." : "All set!")}
              </p>
            </div>
            <button type="button" className="btn btn-orange" disabled={!nameValid || !agreed || accountPending} onClick={handleCreateAccount}>
              {accountPending ? "Creating…" : "Create account"}
            </button>
          </div>
        </div>
      ) : null}

      {screen === 1 ? (
        <div className="ob-screen">
          <h1 tabIndex={-1}>Choose your first pet</h1>
          <p className="ob-lead">
            Your account is ready! Now pick a companion.
            <small>Tap a pet to see it up close and give it a name. You&rsquo;ll be able to adopt more later.</small>
          </p>
          <section className="ob-sec" aria-label="First pet">
            <div className="ob-pets" role="radiogroup" aria-label="First pet">
              {starters.map((s) => (
                <label className="ob-pet" key={s.id}>
                  <input type="radio" name="pet" value={s.id} checked={petId === s.id} onChange={() => setPetId(s.id)} />
                  <span>
                    {s.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- fixed-size preview thumbnail, same as expeditions-app.tsx's PetPicture
                      <img src={s.imageUrl} alt="" width={84} height={84} />
                    ) : null}
                    <span>
                      <b>{s.label}</b>
                      <small>{s.blurb}</small>
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {selectedStarter ? (
              <div className="ob-prev">
                <div className="ob-pv">
                  {/* eslint-disable-next-line @next/next/no-img-element -- big preview, re-mounts per selection for the pop-in animation */}
                  <img src={selectedStarter.imageUrl} alt={selectedStarter.label} width={210} height={210} />
                </div>
                <div>
                  <h3>{selectedStarter.label}</h3>
                  <p>{selectedStarter.blurb}</p>
                  <div className="ef">
                    <div className="field">
                      <label htmlFor="ob-pname">
                        Name your pet <span className="tag">optional</span>
                      </label>
                      <input
                        type="text"
                        id="ob-pname"
                        maxLength={16}
                        autoComplete="off"
                        spellCheck={false}
                        placeholder={`Leave blank to keep the name ${selectedStarter.label}`}
                        value={petName}
                        onChange={(e) => setPetName(e.target.value)}
                        aria-invalid={!petNameValid}
                      />
                      <p className={`ob-msg ${petNameValid ? "" : "bad"}`} role="status" aria-live="polite">
                        {petError ?? (petNameValid ? "You can rename your pet later." : "2 to 16 letters, numbers, spaces, hyphens or apostrophes.")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
          <div className="ob-foot">
            <span className="ob-sp" />
            <button type="button" className="btn btn-leaf" disabled={!petId || !petNameValid || petPending} onClick={handleAdopt}>
              {petPending ? "Adopting…" : petId ? `Adopt ${trimmedPetName || selectedStarter?.label}` : "Choose a pet"}
            </button>
          </div>
        </div>
      ) : null}

      {screen === 2 ? (
        <div className="ob-screen">
          <div className="ob-win">
            {wonPet ? (
              // eslint-disable-next-line @next/next/no-img-element -- celebration art, not a Next-managed asset list
              <img className="ob-pp" src={wonPet.imageUrl} alt={wonPet.label} width={170} height={170} />
            ) : null}
            <h1 tabIndex={-1}>
              Welcome, <span>{finalName}</span>!
            </h1>
            <p>
              <span>{wonPetName}</span> is your first pet.
            </p>
          </div>
          <section className="ob-adv" aria-labelledby="ob-ah">
            {/* eslint-disable-next-line @next/next/no-img-element -- static sitewide map thumbnail, same path used on /expeditions */}
            <img src="/img/expeditions/map.webp" alt="" width={190} height={126} />
            <div>
              <h3 id="ob-ah">
                Send <span>{wonPetName}</span> on a first adventure
              </h3>
              <p>
                Explore the islands and see what <span>{wonPetName}</span> brings back.
              </p>
              <Link className="btn btn-orange" href="/expeditions">
                Open the map
              </Link>
              <Link className="ob-later" href="/">
                Maybe later
              </Link>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
