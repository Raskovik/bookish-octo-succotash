// Shared between src/proxy.ts (checks for this cookie) and
// app/lockdown/actions.ts (sets it after a correct code). The value is
// an opaque marker, not the access code itself or anything derived from
// it — a visitor manually crafting a cookie would need to guess this
// exact string, not just reuse the 4-digit code they might have seen
// shared somewhere.
export const DEV_LOCKDOWN_COOKIE_NAME = "furgarden_dev_access";
export const DEV_LOCKDOWN_COOKIE_VALUE = "granted-8f2a1c";
