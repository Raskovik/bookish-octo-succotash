"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastOptions = { undo?: () => void };
type ToastItem = { id: number; message: string; undo?: () => void };

const ToastContext = createContext<((message: string, options?: ToastOptions) => void) | null>(null);

// Local to each admin page tree that wants it — sub-resource row edits
// (zone pool/item pool rows) save immediately and want an "Undo" toast
// right where the edit happened, same shape as the redesign package's
// prototype. Not global/site-wide; see src/app/pets/pets-app.tsx for
// this app's unrelated, separate toast pattern used elsewhere.
export function AdminToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback((message: string, options?: ToastOptions) => {
    const id = nextId.current++;
    setToasts((curr) => [...curr, { id, message, undo: options?.undo }]);
    setTimeout(() => setToasts((curr) => curr.filter((t) => t.id !== id)), options?.undo ? 8000 : 3500);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div id="toasts">
        {toasts.map((t) => (
          <div key={t.id} className="toast ok">
            <span>{t.message}</span>
            {t.undo ? (
              <button
                type="button"
                onClick={() => {
                  t.undo?.();
                  setToasts((curr) => curr.filter((x) => x.id !== t.id));
                }}
              >
                Undo
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useAdminToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useAdminToast must be used within AdminToastProvider");
  return ctx;
}
