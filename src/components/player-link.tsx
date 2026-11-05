import Link from "next/link";

// Exported separately for the rare spot that needs the color but can't
// use <PlayerLink> itself — e.g. the /messages inbox, where the name
// links to the conversation, not the player's profile.
export function staffNameColorClass(isAdmin: boolean, isModerator: boolean): string {
  return isAdmin
    ? "text-blue-800 dark:text-blue-400"
    : isModerator
      ? "text-green-700 dark:text-green-400"
      : "";
}

/**
 * A player's display name, linked to their profile, colored to mark
 * staff status wherever a name is shown — moderator green, admin deep
 * blue (an admin is also a moderator, so the isAdmin check comes first).
 * Staff status is public info (see user_profiles, 0028_moderation_
 * round_two.sql) precisely so this can render anywhere, not just on
 * staff-only pages.
 */
export function PlayerLink({
  userDisplayId,
  name,
  isAdmin = false,
  isModerator = false,
  className = "",
}: {
  // The public display_id (see 0065_user_display_id.sql), not the
  // real uuid — profile URLs are keyed on that now.
  userDisplayId: number;
  name: string;
  isAdmin?: boolean;
  isModerator?: boolean;
  className?: string;
}) {
  const roleClass = staffNameColorClass(isAdmin, isModerator);

  return (
    <Link href={`/u/${userDisplayId}`} className={`${roleClass} ${className}`.trim()}>
      {name}
    </Link>
  );
}
