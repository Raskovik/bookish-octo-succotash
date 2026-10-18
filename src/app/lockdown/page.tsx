import { LockdownForm } from "./lockdown-form";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LockdownPage(props: PageProps<"/lockdown">) {
  const searchParams = await props.searchParams;
  const next = first(searchParams.next) ?? "/";

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Sorry, this site can only be accessed by developers.
        </h1>
        <p className="text-stone-600 dark:text-stone-400">Enter developer code.</p>
      </div>
      <LockdownForm next={next} />
    </main>
  );
}
