"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Quote,
  SeparatorHorizontal,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Code,
  ALargeSmall,
  Palette,
  Eye,
  PenLine,
} from "lucide-react";
import { bbcodeToHtml } from "@/lib/bbcode";

/**
 * A classic forum-style BBCode editor: a plain textarea plus a toolbar
 * that wraps the current selection in BBCode tags. There's no WYSIWYG
 * rendering here and no separate "advanced" mode — the textarea is
 * always raw BBCode, so a player can type tags by hand instead of
 * clicking a button and gets the exact same result either way. The
 * textarea is uncontrolled (defaultValue, manipulated via ref) rather
 * than React state, matching how the browser's own text-editing already
 * works — the form reads its value straight off the DOM on submit.
 *
 * The Preview toggle renders bbcodeToHtml() (pure, safe to run in the
 * browser — it never touches the DOM or trusts anything beyond the
 * textarea's own text) against the current draft. The textarea stays
 * mounted (just hidden) while previewing, so switching back doesn't
 * lose anything.
 *
 * Nothing here is a security boundary. bbcodeToHtml() is what turns
 * whatever ends up in this textarea into safe HTML server-side too, on
 * submit — the toolbar and preview are purely conveniences.
 */
export function BBCodeEditor({
  name = "body",
  defaultValue = "",
  rows = 10,
  maxLength,
}: {
  name?: string;
  defaultValue?: string;
  rows?: number;
  maxLength?: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  function wrapSelection(open: string, close: string) {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart, selectionEnd, value } = el;
    const selected = value.slice(selectionStart, selectionEnd);
    el.value = value.slice(0, selectionStart) + open + selected + close + value.slice(selectionEnd);
    el.focus();
    if (selected.length > 0) {
      el.setSelectionRange(selectionStart + open.length, selectionStart + open.length + selected.length);
    } else {
      const cursor = selectionStart + open.length;
      el.setSelectionRange(cursor, cursor);
    }
  }

  function insertAtCursor(text: string) {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart, selectionEnd, value } = el;
    el.value = value.slice(0, selectionStart) + text + value.slice(selectionEnd);
    const cursor = selectionStart + text.length;
    el.focus();
    el.setSelectionRange(cursor, cursor);
  }

  function wrapList(ordered: boolean) {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart, selectionEnd, value } = el;
    const selected = value.slice(selectionStart, selectionEnd);
    const openTag = ordered ? "[list=1]" : "[list]";
    // Turn each selected line into its own [*] item; with nothing
    // selected, drop in one empty item ready to type into. This
    // replaces the selection outright (not via wrapSelection, which
    // would re-insert the original `selected` text a second time
    // in between).
    const body =
      selected.length > 0
        ? "\n" + selected.split("\n").map((line) => `[*]${line}`).join("\n") + "\n"
        : "\n[*]\n";
    const listMarkup = openTag + body + "[/list]";
    el.value = value.slice(0, selectionStart) + listMarkup + value.slice(selectionEnd);
    const cursor = selectionStart + listMarkup.length;
    el.focus();
    el.setSelectionRange(cursor, cursor);
  }

  function togglePreview() {
    if (previewHtml !== null) {
      setPreviewHtml(null);
      return;
    }
    setPreviewHtml(bbcodeToHtml(textareaRef.current?.value ?? ""));
  }

  const isPreviewing = previewHtml !== null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-stone-300 bg-stone-50 p-2">
        <div className={`flex flex-wrap items-center gap-1 ${isPreviewing ? "pointer-events-none opacity-40" : ""}`}>
          <ToolbarButton label="Bold" onClick={() => wrapSelection("[b]", "[/b]")}>
            <Bold size={17} />
          </ToolbarButton>
          <ToolbarButton label="Italic" onClick={() => wrapSelection("[i]", "[/i]")}>
            <Italic size={17} />
          </ToolbarButton>
          <ToolbarButton label="Underline" onClick={() => wrapSelection("[u]", "[/u]")}>
            <Underline size={17} />
          </ToolbarButton>
          <ToolbarButton label="Strikethrough" onClick={() => wrapSelection("[s]", "[/s]")}>
            <Strikethrough size={17} />
          </ToolbarButton>
          <Divider />
          <ToolbarButton label="Quote" onClick={() => wrapSelection("[quote]", "[/quote]")}>
            <Quote size={17} />
          </ToolbarButton>
          <ToolbarButton label="Code block" onClick={() => wrapSelection("[code]", "[/code]")}>
            <Code size={17} />
          </ToolbarButton>
          <ToolbarButton label="Horizontal rule" onClick={() => insertAtCursor("\n[hr]\n")}>
            <SeparatorHorizontal size={17} />
          </ToolbarButton>
          <Divider />
          <ToolbarButton label="Bullet list" onClick={() => wrapList(false)}>
            <List size={17} />
          </ToolbarButton>
          <ToolbarButton label="Numbered list" onClick={() => wrapList(true)}>
            <ListOrdered size={17} />
          </ToolbarButton>
          <Divider />
          {/* [left]/[right] float rather than just text-align — two
              adjacent [left]...[/left] blocks (say, an image then a
              paragraph) sit side by side instead of stacking, matching
              how Chicken Smoothie-style forums use them. See bbcode.ts. */}
          <ToolbarButton label="Float left" onClick={() => wrapSelection("[left]", "[/left]")}>
            <AlignLeft size={17} />
          </ToolbarButton>
          <ToolbarButton label="Center" onClick={() => wrapSelection("[center]", "[/center]")}>
            <AlignCenter size={17} />
          </ToolbarButton>
          <ToolbarButton label="Float right" onClick={() => wrapSelection("[right]", "[/right]")}>
            <AlignRight size={17} />
          </ToolbarButton>
          <Divider />
          <FontFamilyButton
            disabled={isPreviewing}
            onApply={(font) => wrapSelection(`[font="${font}"]`, "[/font]")}
          />
          <label className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-200">
            <ALargeSmall size={17} />
            <select
              aria-label="Font size"
              value=""
              disabled={isPreviewing}
              onChange={(e) => {
                const percent = e.target.value;
                e.target.value = "";
                if (percent) wrapSelection(`[size=${percent}]`, "[/size]");
              }}
              className="rounded border border-stone-300 bg-white text-xs"
            >
              <option value="" disabled />
              <option value="50">Tiny</option>
              <option value="85">Small</option>
              <option value="100">Normal</option>
              <option value="150">Large</option>
              <option value="200">Huge</option>
            </select>
          </label>
          <ColorPickerButton
            disabled={isPreviewing}
            onApply={(hex) => wrapSelection(`[color=${hex}]`, "[/color]")}
          />
        </div>

        <button
          type="button"
          onClick={togglePreview}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-100"
        >
          {isPreviewing ? (
            <>
              <PenLine size={16} />
              Write
            </>
          ) : (
            <>
              <Eye size={16} />
              Preview
            </>
          )}
        </button>
      </div>

      <textarea
        ref={textareaRef}
        name={name}
        defaultValue={defaultValue}
        rows={rows}
        maxLength={maxLength}
        placeholder="Write something..."
        hidden={isPreviewing}
        className="w-full rounded-md border border-stone-300 px-4 py-3 text-base leading-relaxed focus:outline-none"
      />

      {isPreviewing ? (
        <div className="min-h-[10rem] rounded-md border border-stone-300 bg-white px-4 py-3">
          {previewHtml.trim().length > 0 ? (
            <div className="forum-content text-base leading-relaxed" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          ) : (
            <p className="text-sm text-stone-400">Nothing to preview yet.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-stone-300" />;
}

function ToolbarButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded-md px-2.5 py-1.5 text-stone-700 hover:bg-stone-200"
    >
      {children}
    </button>
  );
}

// Shared shell for a toolbar button that opens a small confirm-style
// popover instead of acting immediately — used for anything where a
// live-updating control (dragging a color wheel, typing digits into a
// number field) would otherwise fire its change handler many times
// before the player has actually settled on a value. Click-outside-to-
// close matches nav-groups.tsx's dropdown.
function ToolbarPopover({
  label,
  icon,
  disabled,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-label={label}
        title={label}
        className="rounded-md px-2.5 py-1.5 text-stone-700 hover:bg-stone-200 disabled:opacity-40"
      >
        {icon}
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-10 mt-1 flex items-center gap-2 rounded-md border border-stone-300 bg-white p-2 shadow-lg">
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}

function PopoverApplyButtons({ onApply, onCancel }: { onApply: () => void; onCancel: () => void }) {
  return (
    <>
      <button
        type="button"
        onClick={onApply}
        className="rounded-md bg-green-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-600"
      >
        Apply
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-md border border-stone-300 px-2.5 py-1 text-xs text-stone-600 hover:bg-stone-100"
      >
        Cancel
      </button>
    </>
  );
}

// React fires onChange for a color input on every drag movement inside
// the native picker, not just once it's closed, so wiring wrapSelection
// straight to onChange was inserting a new [color] tag on every
// intermediate color the player dragged past. This keeps the
// drag-in-progress color as local draft state and only wraps the
// selection once, when Apply is clicked.
function ColorPickerButton({
  onApply,
  disabled,
}: {
  onApply: (hex: string) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("#000000");

  return (
    <ToolbarPopover label="Font color" icon={<Palette size={17} />} disabled={disabled}>
      {(close) => (
        <>
          <input
            aria-label="Choose a color"
            type="color"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-8 w-10 cursor-pointer rounded border border-stone-300 p-0"
          />
          <span className="font-mono text-xs text-stone-600">{draft}</span>
          <PopoverApplyButtons
            onApply={() => {
              onApply(draft);
              close();
            }}
            onCancel={close}
          />
        </>
      )}
    </ToolbarPopover>
  );
}

// A narrow icon-only trigger (unlike a <select>, which some browsers
// widen to fit its longest option even while closed — "Times New Roman"
// or "Comic Sans MS" made the old font-family control the widest thing
// on the toolbar). Each choice previews in its own typeface. Font names
// are a fixed, safe list; bbcode.ts's own FONT_RE would reject anything
// else regardless.
const FONT_CHOICES = [
  "Arial",
  "Georgia",
  "Times New Roman",
  "Courier New",
  "Verdana",
  "Trebuchet MS",
  "Comic Sans MS",
  "Impact",
  "cursive",
  "fantasy",
];

function FontFamilyButton({
  onApply,
  disabled,
}: {
  onApply: (font: string) => void;
  disabled?: boolean;
}) {
  return (
    <ToolbarPopover label="Font family" icon={<span className="text-sm font-semibold">Aa</span>} disabled={disabled}>
      {(close) => (
        <div className="flex w-44 flex-col">
          {FONT_CHOICES.map((font) => (
            <button
              key={font}
              type="button"
              onClick={() => {
                onApply(font);
                close();
              }}
              style={{ fontFamily: font }}
              className="rounded px-2.5 py-1.5 text-left text-sm text-stone-700 hover:bg-stone-100"
            >
              {font}
            </button>
          ))}
        </div>
      )}
    </ToolbarPopover>
  );
}
