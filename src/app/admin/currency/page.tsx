import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { CurrencyGrantForm } from "./currency-grant-form";
import { CurrencyIcon } from "@/components/currency-icon";

export default async function AdminCurrencyPage() {
  const { supabase, user } = await requireAdmin();

  const { data: profile } = await supabase
    .from("users")
    .select("coin_balance, gem_balance")
    .eq("id", user.id)
    .single();

  return (
    <>
      <div className="crumbs">
        <Link href="/admin">Admin</Link>
        <i>/</i>
        <span>Currency</span>
      </div>
      <div className="ph">
        <h1>Currency (testing)</h1>
      </div>
      <p className="desc" style={{ marginBottom: 14 }}>
        Grant coins or gems to your own account for testing. There&apos;s no real-money purchase flow yet — that&apos;s
        a later module — and no way from here (or anywhere in the app) to affect any account but your own.
      </p>

      <div className="stat">
        <div>
          <CurrencyIcon kind="coin" />
          <span>
            <b>{profile?.coin_balance ?? 0}</b>
            <span>Coins</span>
          </span>
        </div>
        <div>
          <CurrencyIcon kind="gem" />
          <span>
            <b>{profile?.gem_balance ?? 0}</b>
            <span>Gems</span>
          </span>
        </div>
      </div>

      <CurrencyGrantForm />
    </>
  );
}
