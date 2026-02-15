"use client";

import { useRef, useEffect } from "react";
import Link from "next/link";
import { useSaved } from "@/context/SavedContext";

const HEART_ICON = "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z";

export default function SavedPopover({ open, onClose, anchorRef }) {
  const { savedIds } = useSaved();
  const panelRef = useRef(null);
  const count = savedIds.length;

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target) &&
        anchorRef?.current &&
        !anchorRef.current.contains(e.target)
      ) {
        onClose?.();
      }
    };
    const handleEscape = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" aria-hidden />
      <div
        ref={panelRef}
        className="fixed left-[100px] top-[120px] z-50 w-72 animate-fade-in rounded-2xl border border-border bg-primary py-6 shadow-xl"
        style={{ boxShadow: "var(--shadow-elevated)" }}
        role="dialog"
        aria-labelledby="saved-popover-title"
        aria-describedby="saved-popover-desc"
      >
        <div className="flex flex-col items-center px-6 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white/15">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-7 w-7 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={HEART_ICON} />
            </svg>
          </div>
          <h2 id="saved-popover-title" className="text-lg font-black uppercase tracking-tight text-white">
            Saved
          </h2>
          <p id="saved-popover-desc" className="mt-1 text-white/90">
            {count === 0
              ? "No saved listings yet."
              : count === 1
                ? "1 listing saved"
                : `${count} listings saved`}
          </p>
          <Link
            href="/saved"
            onClick={onClose}
            className="mt-5 inline-flex w-full items-center justify-center rounded-xl border-2 border-white/40 bg-white/10 px-6 py-3 font-bold text-white transition-premium hover:bg-white hover:text-primary"
          >
            View all
          </Link>
        </div>
      </div>
    </>
  );
}
