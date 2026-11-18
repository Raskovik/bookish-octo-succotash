"use client";

import { useId, useMemo, useState } from "react";

export type PickerOption = {
  id: string;
  label: string;
  imageUrl?: string | null;
  // Carries extra data a parent might want back via onSelect (e.g. the
  // shop listing form's live description preview) — unused by this
  // component itself beyond passing it through.
  description?: string | null;
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
  onSelect,
}: {
  name: string;
  options: PickerOption[];
  placeholder?: string;
  // Pre-fills the "already picked" state — for editing a single
  // existing field (e.g. a shop listing's item/species), as opposed to
  // every other use of this component so far, which only ever adds new
  // entries to a list and so always starts empty.
  defaultSelected?: PickerOption | null;
  // Fires with the picked option (or null on "Change") — for a parent
  // that needs to react to the selection, e.g. the shop listing form's
  // live description preview.
  onSelect?: (option: PickerOption | null) => void;
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
      <div className="pick">
        <span className="lbl">Selected</span>
        <div className="in" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="hidden" name={name} value={selected.id} />
          {selected.imageUrl ? (
            <div className="th xs">
              {/* eslint-disable-next-line @next/next/no-img-element -- catalog thumbnails don't need next/image optimization here */}
              <img src={selected.imageUrl} alt="" />
            </div>
          ) : null}
          <span style={{ flex: 1, whiteSpace: "nowrap" }}>{selected.label}</span>
          <button
            type="button"
            className="lnk"
            onClick={() => {
              setSelected(null);
              setQuery("");
              onSelect?.(null);
            }}
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pick">
      <label htmlFor={inputId} className="lbl">
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
        className="in"
      />
      {isOpen ? (
        <ul className="pk-list">
          {matches.length === 0 ? (
            <li className="none">No matches</li>
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
                    onSelect?.(option);
                  }}
                >
                  {option.imageUrl ? (
                    <div className="th xs">
                      {/* eslint-disable-next-line @next/next/no-img-element -- catalog thumbnails don't need next/image optimization here */}
                      <img src={option.imageUrl} alt="" />
                    </div>
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
