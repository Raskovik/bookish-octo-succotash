import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { CannedMessageForm } from "../canned-message-form";
import { createCannedMessage } from "../actions";

export default async function NewCannedMessagePage() {
  await requireAdmin();

  return (
    <>
      <div className="crumbs">
        <Link href="/admin">Admin</Link>
        <i>/</i>
        <Link href="/admin/canned-messages">Canned messages</Link>
        <i>/</i>
        <span>New</span>
      </div>
      <div className="ph">
        <h1>New canned message</h1>
      </div>
      <CannedMessageForm action={createCannedMessage} submitLabel="Create message" />
    </>
  );
}
