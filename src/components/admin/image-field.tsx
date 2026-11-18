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
    <div className="fld">
      <span className="lbl">{label}</span>
      <div className="imgf">
        {previewUrl || defaultUrl ? (
          <div className="th lg">
            {/* eslint-disable-next-line @next/next/no-img-element -- previewUrl is a local blob: URL, which next/image can't optimize */}
            <img src={previewUrl ?? defaultUrl!} alt="" />
          </div>
        ) : (
          <div className="th lg dash" />
        )}
        <div className="imgc">
          <input
            name={fileFieldName}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(e) => {
              const file = e.target.files?.[0];
              setPreviewUrl(file ? URL.createObjectURL(file) : null);
            }}
          />
          <p className="hint">PNG, JPEG, WebP, or GIF.</p>
          <div className="row">
            <label className="hint" htmlFor={`${urlFieldName}-url`}>
              Or paste an image web address instead (used only if no file is uploaded above)
            </label>
          </div>
          <input id={`${urlFieldName}-url`} name={urlFieldName} defaultValue={defaultUrl ?? ""} placeholder="https://…" className="in" />
        </div>
      </div>
    </div>
  );
}
