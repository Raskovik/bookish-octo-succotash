"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { blockPlayer, unblockPlayer, submitReport } from "@/lib/report-actions";
import { sendMessageToUser } from "@/app/messages/actions";

const REPORT_REASONS: { value: string; label: string }[] = [
  { value: "harassment", label: "Harassment or bullying" },
  { value: "inappropriate_content", label: "Inappropriate avatar or bio" },
  { value: "scam", label: "Scamming or unfair trading" },
  { value: "spam", label: "Spam or advertising" },
  { value: "other", label: "Something else" },
];

/**
 * The action buttons + dialogs on a player's profile (matches
 * furgarden-design/pages/profile.html's .acts/.foot-strip + the
 * message/block/report <dialog>s). Unlike the handoff's js/profile.js,
 * this isn't loaded at all here — every bit of behavior it covered
 * (open/close dialogs, dispatch an action, flip the view, show a toast)
 * is just React state, so there's nothing left for a separate vanilla
 * script to manage or get out of sync with (same reasoning as
 * NotificationBell not using furgarden.js's cosmetic mark-read path).
 *
 * Each dialog calls its server action directly from the submit handler
 * (via startTransition) rather than useActionState + an effect watching
 * the result — closing the dialog/flipping the view is a real side
 * effect, and belongs where the action's outcome is actually known
 * (the transition callback), not in a passive effect reacting to state.
 *
 * Friending isn't a real feature yet (no friends table), so "friend"/
 * "pending" are left out entirely rather than built as dead buttons —
 * "Add friend" always renders disabled. Message/Report/Block are real:
 * they call the same server actions the rest of the app already uses.
 */
export function ProfileActions({
  initialView,
  profileId,
  profileName,
  viewerSignedIn,
}: {
  initialView: "owner" | "visitor" | "blocked";
  profileId: string;
  profileName: string;
  viewerSignedIn: boolean;
}) {
  const [view, setView] = useState(initialView);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function say(text: string) {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }

  const msgDialogRef = useRef<HTMLDialogElement>(null);
  const msgFormRef = useRef<HTMLFormElement>(null);
  const blockDialogRef = useRef<HTMLDialogElement>(null);
  const reportDialogRef = useRef<HTMLDialogElement>(null);
  const reportFormRef = useRef<HTMLFormElement>(null);

  const [msgError, setMsgError] = useState<string | null>(null);
  const [blockError, setBlockError] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [isMsgPending, startMsgTransition] = useTransition();
  const [isBlockPending, startBlockTransition] = useTransition();
  const [isUnblockPending, startUnblockTransition] = useTransition();
  const [isReportPending, startReportTransition] = useTransition();

  function handleSendMessage(formData: FormData) {
    setMsgError(null);
    startMsgTransition(async () => {
      const result = await sendMessageToUser(null, formData);
      if (result && "error" in result) {
        setMsgError(result.error);
        return;
      }
      msgDialogRef.current?.close();
      say(`Message sent to ${profileName}.`);
    });
  }

  function handleBlock(formData: FormData) {
    setBlockError(null);
    startBlockTransition(async () => {
      const result = await blockPlayer(null, formData);
      if (result && "error" in result) {
        setBlockError(result.error);
        return;
      }
      blockDialogRef.current?.close();
      setView("blocked");
      say(`${profileName} is blocked.`);
    });
  }

  function handleUnblock(formData: FormData) {
    startUnblockTransition(async () => {
      const result = await unblockPlayer(null, formData);
      if (result && "error" in result) {
        say(result.error);
        return;
      }
      setView("visitor");
      say(`${profileName} is unblocked.`);
    });
  }

  function handleReport(formData: FormData) {
    setReportError(null);
    startReportTransition(async () => {
      const result = await submitReport(null, formData);
      if (result && "error" in result) {
        setReportError(result.error);
        return;
      }
      reportDialogRef.current?.close();
      say("Report sent. Thank you.");
    });
  }

  if (view === "owner") {
    return (
      <div className="idc-act">
        <div className="acts">
          <Link className="btn btn-sm btn-cream" href="/settings">
            Edit profile
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="idc-act">
        <div className="acts">
          {view === "blocked" ? (
            <>
              <span className="blockednote">You blocked this player.</span>
              <form action={handleUnblock}>
                <input type="hidden" name="blocked_id" value={profileId} />
                <button className="btn btn-sm btn-cream" type="submit" disabled={isUnblockPending}>
                  {isUnblockPending ? "Unblocking…" : "Unblock"}
                </button>
              </form>
            </>
          ) : (
            <>
              <button className="btn btn-sm btn-leaf" type="button" disabled title="Friending isn't available yet">
                Add friend
              </button>
              {viewerSignedIn ? (
                <button
                  className="btn btn-sm"
                  type="button"
                  onClick={() => {
                    msgFormRef.current?.reset();
                    setMsgError(null);
                    msgDialogRef.current?.showModal();
                  }}
                >
                  Message
                </button>
              ) : (
                <Link className="btn btn-sm" href="/login" title="Sign in to send a message">
                  Message
                </Link>
              )}
            </>
          )}
        </div>
      </div>

      <div className="foot-strip">
        <span />
        <span className="fs-r">
          {viewerSignedIn ? (
            <button
              className="mlink"
              type="button"
              onClick={() => {
                reportFormRef.current?.reset();
                setReportError(null);
                reportDialogRef.current?.showModal();
              }}
            >
              Report
            </button>
          ) : (
            <Link className="mlink" href="/login" title="Sign in to report a player">
              Report
            </Link>
          )}
          {view !== "blocked" ? (
            <>
              <span className="dot">&bull;</span>
              <button
                className="mlink red"
                type="button"
                onClick={() => {
                  setBlockError(null);
                  blockDialogRef.current?.showModal();
                }}
              >
                Block
              </button>
            </>
          ) : null}
        </span>
      </div>

      <dialog className="fg" ref={msgDialogRef} aria-labelledby="dlg-msg-t">
        <h2 className="frame-title" id="dlg-msg-t">
          <span>
            Message <span className="nm">{profileName}</span>
          </span>
        </h2>
        <form ref={msgFormRef} action={handleSendMessage}>
          <input type="hidden" name="user_id" value={profileId} />
          <div className="fg-body">
            <label htmlFor="msg-text">Your message</label>
            <textarea id="msg-text" name="text" maxLength={500} required placeholder="Write something kind..." />
            <p className="fg-hint">This goes to their inbox. Please follow the site rules.</p>
            {msgError ? (
              <p className="fg-hint" style={{ color: "#a3281a" }}>
                {msgError}
              </p>
            ) : null}
          </div>
          <div className="fg-foot">
            <button className="btn btn-sm btn-cream" type="button" onClick={() => msgDialogRef.current?.close()}>
              Cancel
            </button>
            <button className="btn btn-sm btn-orange" type="submit" disabled={isMsgPending}>
              {isMsgPending ? "Sending…" : "Send message"}
            </button>
          </div>
        </form>
      </dialog>

      <dialog className="fg danger" ref={blockDialogRef} aria-labelledby="dlg-block-t">
        <h2 className="frame-title" id="dlg-block-t">
          <span>Block {profileName}?</span>
        </h2>
        <form action={handleBlock}>
          <input type="hidden" name="blocked_id" value={profileId} />
          <div className="fg-body">
            <p style={{ margin: 0 }}>If you block this player:</p>
            <ul>
              <li>They can&apos;t message you, send trade offers or friend requests.</li>
              <li>Their forum posts are hidden from you.</li>
              <li>They aren&apos;t told. You can unblock them any time from this page.</li>
            </ul>
            {blockError ? (
              <p className="fg-hint" style={{ color: "#a3281a" }}>
                {blockError}
              </p>
            ) : null}
          </div>
          <div className="fg-foot">
            <button
              className="btn btn-sm btn-cream"
              type="button"
              onClick={() => blockDialogRef.current?.close()}
            >
              Cancel
            </button>
            <button className="btn btn-sm btn-red" type="submit" disabled={isBlockPending}>
              {isBlockPending ? "Blocking…" : "Block player"}
            </button>
          </div>
        </form>
      </dialog>

      <dialog className="fg" ref={reportDialogRef} aria-labelledby="dlg-report-t">
        <h2 className="frame-title" id="dlg-report-t">
          <span>Report {profileName}</span>
        </h2>
        <form ref={reportFormRef} action={handleReport}>
          <input type="hidden" name="target_type" value="user" />
          <input type="hidden" name="target_id" value={profileId} />
          <div className="fg-body">
            <fieldset className="reasons">
              <legend>What are you reporting this player for?</legend>
              {REPORT_REASONS.map((reason) => (
                <label key={reason.value}>
                  <input type="radio" name="category" value={reason.value} required />
                  {reason.label}
                </label>
              ))}
            </fieldset>
            <label htmlFor="report-details">
              More details <span className="opt">(optional)</span>
            </label>
            <textarea
              id="report-details"
              name="details"
              maxLength={500}
              placeholder="Tell the moderators what happened..."
            />
            <p className="fg-hint">Reports go to the moderators. The player is not told who reported them.</p>
            {reportError ? (
              <p className="fg-hint" style={{ color: "#a3281a" }}>
                {reportError}
              </p>
            ) : null}
          </div>
          <div className="fg-foot">
            <button
              className="btn btn-sm btn-cream"
              type="button"
              onClick={() => reportDialogRef.current?.close()}
            >
              Cancel
            </button>
            <button className="btn btn-sm btn-orange" type="submit" disabled={isReportPending}>
              {isReportPending ? "Sending…" : "Send report"}
            </button>
          </div>
        </form>
      </dialog>

      <div className={toast ? "toast show" : "toast"} role="status" aria-live="polite">
        {toast}
      </div>
    </>
  );
}
