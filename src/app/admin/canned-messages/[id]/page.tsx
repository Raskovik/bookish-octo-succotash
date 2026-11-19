import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { CannedMessageForm } from "../canned-message-form";
import { updateCannedMessage } from "../actions";

export default async function EditCannedMessagePage(props: PageProps<"/admin/canned-messages/[id]">) {
  const { id } = await props.params;
  const { supabase } = await requireAdmin();

  const { data: message } = await supabase
    .from("canned_staff_messages")
    .select("id, label, body, is_active, sort_order, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!message) {
    notFound();
  }

  return (
    <>
      <div className="crumbs">
        <Link href="/admin">Dashboard</Link>
        <i>/</i>
        <Link href="/admin/canned-messages">Canned messages</Link>
        <i>/</i>
        <span>{message.label}</span>
      </div>
      <div className="ph">
        <h1>Edit canned message</h1>
      </div>
      <CannedMessageForm action={updateCannedMessage} message={message} submitLabel="Save changes" />
    </>
  );
}
