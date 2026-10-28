import type { NextConfig } from "next";
import { execSync } from "node:child_process";

// A short, always-current build identifier for the footer (see
// SiteFooter) — the commit actually being deployed, with no manual
// version bumping. Vercel sets VERCEL_GIT_COMMIT_SHA on every build
// automatically (README: "automatic deploys" on every push), so this
// updates itself on every push with zero extra wiring; `git` itself is
// the fallback for local dev or a non-Vercel build.
function getBuildSha(): string {
  const vercelSha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (vercelSha) return vercelSha.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "dev";
  }
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_SHA: getBuildSha(),
  },
  images: {
    remotePatterns: [
      // Google account avatars, used as the default avatar for new users.
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      // Supabase Storage, used for uploaded pet/item art in later phases.
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/**" },
      // placehold.co, used for placeholder species/zone/item art until
      // real art assets exist.
      { protocol: "https", hostname: "placehold.co" },
    ],
  },
};

export default nextConfig;
