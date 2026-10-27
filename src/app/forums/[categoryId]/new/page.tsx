import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewThreadForm } from "./new-thread-form";

export default async function NewThreadPage(props: PageProps<"/forums/[categoryId]/new">) {
  const { categoryId } = await props.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: category } = await supabase
    .from("forum_categories")
    .select("id, name, is_active")
    .eq("id", categoryId)
    .maybeSingle();

  if (!category || !category.is_active) {
    notFound();
  }

  // Parent categories with subcategories are pure dividers — see
  // 0023_forum_category_no_direct_posts.sql, the real backstop (RLS
  // itself rejects the insert too). This just avoids showing a form
  // that would only fail on submit.
  const { count: childCount } = await supabase
    .from("forum_categories")
    .select("id", { count: "exact", head: true })
    .eq("parent_id", categoryId);
  if ((childCount ?? 0) > 0) {
    redirect(`/forums/${categoryId}`);
  }

  return (
    <main id="main">
      <div className="sheet">
        <div className="panel flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New thread</h1>
        <p className="text-sm text-stone-500">in {category.name}</p>
      </div>
      <NewThreadForm categoryId={category.id} />
        </div>
      </div>
    </main>
  );
}
