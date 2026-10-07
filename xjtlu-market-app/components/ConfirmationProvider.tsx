"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";

type Request = { message: string; resolve: (answer: boolean) => void };
const ConfirmationContext = createContext<
  (message: string) => Promise<boolean>
>(async () => false);
export const useConfirmation = () => useContext(ConfirmationContext);
export default function ConfirmationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [request, setRequest] = useState<Request | null>(null);
  const current = useRef<Request | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  function finish(answer: boolean) {
    current.current?.resolve(answer);
    current.current = null;
    dialog.current?.close();
    setRequest(null);
  }
  function confirm(message: string) {
    // A second click must not replace an unresolved confirmation.
    if (current.current) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      const next = { message, resolve };
      current.current = next;
      setRequest(next);
    });
  }
  useEffect(() => {
    if (!request) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [request]);
  useEffect(() => {
    const cancel = () => finish(false);
    window.addEventListener("uuse-account", cancel);
    return () => {
      window.removeEventListener("uuse-account", cancel);
      current.current?.resolve(false);
    };
  }, []);
  return (
    <ConfirmationContext.Provider value={confirm}>
      {children}
      <dialog
        ref={dialog}
        className="confirmation-dialog"
        aria-labelledby="confirmation-title"
        aria-describedby="confirmation-message"
        onCancel={(e) => {
          e.preventDefault();
          finish(false);
        }}
      >
        <h2 id="confirmation-title">确认操作</h2>
        <p id="confirmation-message">{request?.message}</p>
        <div className="form-actions">
          <button
            type="button"
            className="secondary"
            autoFocus
            onClick={() => finish(false)}
          >
            <X size={16} />
            取消
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => finish(true)}
          >
            <Check size={16} />
            确认
          </button>
        </div>
      </dialog>
    </ConfirmationContext.Provider>
  );
}
