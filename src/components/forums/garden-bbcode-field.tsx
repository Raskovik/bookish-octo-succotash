"use client";

import { useRef, useState } from "react";
import { bbcodeToHtml } from "@/lib/bbcode";

/**
 * BBCode composer for the forum reply/new-thread/edit-post forms, styled
 * to match the Jungle design's own .gedit/.gb-bar/.gb-b/.gb-pv toolbar —
 * the same classes pet-panel.tsx's bio editor and pets-app.tsx's dialogs
 * already use, rather than the old Tailwind BBCodeEditor (still used by
 * the settings/admin pages that haven't been ported to this theme yet).
 *
 * A hidden input (not the textarea itself) carries the actual form
 * field: when previewing, the textarea unmounts, and a form field that
 * only exists while not-previewing would silently drop the post body on
 * submit.
 */
export function GardenBBCodeField({
  name = "body",
  defaultValue = "",
  maxLength,
  placeholder = "Write something...",
}: {
  name?: string;
  defaultValue?: string;
  maxLength?: number;
  placeholder?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [preview, setPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function wrapSelection(open: string, close: string) {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart, selectionEnd, value: current } = el;
    const selected = current.slice(selectionStart, selectionEnd);
    const next = current.slice(0, selectionStart) + open + selected + close + current.slice(selectionEnd);
    setValue(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(selectionStart + open.length, selectionStart + open.length + selected.length);
    });
  }

  function insertAtCursor(text: string) {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart, selectionEnd, value: current } = el;
    const next = current.slice(0, selectionStart) + text + current.slice(selectionEnd);
    const cursor = selectionStart + text.length;
    setValue(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <div className="gedit">
      <input type="hidden" name={name} value={value} />
      <div className="gb-bar" role="toolbar" aria-label="Formatting">
        <button type="button" className="gb-b" title="Bold" aria-label="Bold" disabled={preview} onClick={() => wrapSelection("[b]", "[/b]")}>
          B
        </button>
        <button type="button" className="gb-b" title="Italic" aria-label="Italic" disabled={preview} onClick={() => wrapSelection("[i]", "[/i]")}>
          I
        </button>
        <button type="button" className="gb-b" title="Underline" aria-label="Underline" disabled={preview} onClick={() => wrapSelection("[u]", "[/u]")}>
          U
        </button>
        <button type="button" className="gb-b" title="Strikethrough" aria-label="Strikethrough" disabled={preview} onClick={() => wrapSelection("[s]", "[/s]")}>
          S
        </button>
        <button type="button" className="gb-b" title="Quote" aria-label="Quote" disabled={preview} onClick={() => wrapSelection("[quote]", "[/quote]")}>
          &#8220;&#8221;
        </button>
        <button type="button" className="gb-b" title="Code block" aria-label="Code block" disabled={preview} onClick={() => wrapSelection("[code]", "[/code]")}>
          &lt;/&gt;
        </button>
        <button type="button" className="gb-b" title="Bullet list" aria-label="Bullet list" disabled={preview} onClick={() => insertAtCursor("\n[list]\n[*]\n[/list]\n")}>
          &#8226;
        </button>
        <button type="button" className="gb-b" title="Align left" aria-label="Align left" disabled={preview} onClick={() => wrapSelection("[left]", "[/left]")}>
          &#8676;
        </button>
        <button type="button" className="gb-b" title="Centre" aria-label="Centre" disabled={preview} onClick={() => wrapSelection("[center]", "[/center]")}>
          &#8596;
        </button>
        <button type="button" className="gb-b" title="Align right" aria-label="Align right" disabled={preview} onClick={() => wrapSelection("[right]", "[/right]")}>
          &#8677;
        </button>
        <button type="button" className="gb-b" title="Link" aria-label="Link" disabled={preview} onClick={() => wrapSelection("[url=https://]", "[/url]")}>
          &#128279;
        </button>
        <button type="button" className="gb-b pv" aria-pressed={preview} onClick={() => setPreview((v) => !v)}>
          {preview ? "Keep editing" : "Preview"}
        </button>
      </div>
      {preview ? (
        <div className="bbcode gb-pv" dangerouslySetInnerHTML={{ __html: bbcodeToHtml(value) }} />
      ) : (
        <textarea
          ref={textareaRef}
          maxLength={maxLength}
          aria-label="Post body"
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      )}
    </div>
  );
}
