"use client";

import { useState } from "react";

/**
 * File upload (with live preview) + a URL fallback used only when no
 * file is attached — the one shape every admin image field in this app
 * already used inline (species-form.tsx, item-form.tsx, …), pulled out
 * once for the redesign instead of copy-pasted again. The server action
 * reading this still does its own `formData.get(fileFieldName)` /
 * `formData.get(urlFieldName)` — this component is presentational only.
 */
export function ImageField({
  fileFieldName,
  urlFieldName,
  defaultUrl,
  label = "Image",
}: {
  fileFieldName: string;
  urlFieldName: string;
  defaultUrl?: string | null;
  label?: string;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-3">
        {previewUrl || defaultUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- previewUrl is a local blob: URL, which next/image can't optimize
          <img
            src={previewUrl ?? defaultUrl!}
            alt=""
            className="h-16 w-16 rounded border border-green-300 object-cover dark:border-stone-700"
          />
        ) : (
          <div className="h-16 w-16 rounded border border-dashed border-green-300 dark:border-stone-700" />
        )}
        <div className="flex flex-col gap-1">
          <input
            name={fileFieldName}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(e) => {
              const file = e.target.files?.[0];
              setPreviewUrl(file ? URL.createObjectURL(file) : null);
            }}
            className="text-sm"
          />
          <p className="text-xs text-stone-500">PNG, JPEG, WebP, or GIF.</p>
        </div>
      </div>
      <label className="mt-1 text-xs text-stone-500">
        Or paste an image web address instead (used only if no file is uploaded above)
        <input
          name={urlFieldName}
          defaultValue={defaultUrl ?? ""}
          placeholder="https://…"
          className="mt-1 block w-full rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
      </label>
    </div>
  );
}
