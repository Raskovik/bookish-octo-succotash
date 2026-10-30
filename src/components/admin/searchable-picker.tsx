"use client";

import { useId, useMemo, useState } from "react";

export type PickerOption = {
  id: string;
  label: string;
  imageUrl?: string | null;
};

/**
 * A search-to-select field that still submits as a plain hidden input —
 * drops into an existing native `<form action={serverAction}>` (in a
 * Server Component) without needing to convert the whole form to a
 * client component. Filters `options` by label as you type; picking one
 * swaps the search box for the selection ("Change" reopens it). Used
 * anywhere an admin picks one species/item out of a catalog that can
 * grow past what a plain <select> stays usable for (zone pet pool, zone
 * loot table, recipe ingredients).
 */
export function SearchablePicker({
  name,
  options,
  placeholder = "Search…",
  defaultSelected = null,
}: {
  name: string;
  options: PickerOption[];
  placeholder?: string;
  // Pre-fills the "already picked" state — for editing a single
  // existing field (e.g. a shop listing's item/species), as opposed to
  // every other use of this component so far, which only ever adds new
  // entries to a list and so always starts empty.
  defaultSelected?: PickerOption | null;
}) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PickerOption | null>(defaultSelected);
  const [isOpen, setIsOpen] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q.length === 0 ? options : options.filter((o) => o.label.toLowerCase().includes(q));
    return pool.slice(0, 20);
  }, [query, options]);

  if (selected) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-stone-500">Selected</span>
        <div className="flex items-center gap-2 rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900">
          <input type="hidden" name={name} value={selected.id} />
          {selected.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- catalog thumbnails don't need next/image optimization here
            <img src={selected.imageUrl} alt="" className="h-5 w-5 rounded" />
          ) : null}
          <span className="flex-1 whitespace-nowrap">{selected.label}</span>
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setQuery("");
            }}
            className="text-xs text-stone-500 hover:underline"
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-xs text-stone-500">
        Search
      </label>
      <input
        id={inputId}
        type="text"
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
        autoComplete="off"
        className="w-56 rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
      />
      {isOpen ? (
        <ul className="absolute top-full z-10 mt-1 max-h-56 w-56 overflow-y-auto rounded-md border border-green-200 bg-white shadow-lg dark:border-stone-800 dark:bg-stone-900">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-stone-500">No matches</li>
          ) : (
            matches.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  // Fires before the input's onBlur would close the list.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setSelected(option);
                    setIsOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-green-100 dark:hover:bg-stone-800"
                >
                  {option.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- catalog thumbnails don't need next/image optimization here
                    <img src={option.imageUrl} alt="" className="h-5 w-5 rounded" />
                  ) : null}
                  {option.label}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
