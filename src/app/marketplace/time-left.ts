// Shared by the server-rendered browse page and its client panes — a
// plain function like this can be imported on both sides of the
// Server/Client Component boundary, unlike a function PASSED AS A PROP
// across that boundary (not serializable, throws at render time).
export function timeLeftLabel(expiresAt: string): { label: string; soon: boolean } {
  const msLeft = new Date(expiresAt).getTime() - Date.now();
  if (msLeft <= 0) return { label: "Expiring…", soon: true };
  const hours = Math.ceil(msLeft / (60 * 60 * 1000));
  if (hours < 24) return { label: `${hours} hour${hours === 1 ? "" : "s"} left`, soon: true };
  const days = Math.ceil(hours / 24);
  return { label: `${days} day${days === 1 ? "" : "s"} left`, soon: false };
}
