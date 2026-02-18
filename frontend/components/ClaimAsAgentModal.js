"use client";

export default function ClaimAsAgentModal({ onClose, onConfirm, loading }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="claim-agent-modal-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl border border-border bg-surface-elevated p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-muted hover:bg-surface hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary mb-6 mx-auto">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        </div>

        <h2 id="claim-agent-modal-title" className="text-xl font-black tracking-tight text-foreground text-center mb-2">
          Confirm payment
        </h2>
        <p className="text-sm text-muted text-center mb-6">
          By confirming, you&apos;ll be set as your own listing agent. Your name, brokerage, and contact info will appear on listings and be saved to your account.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border-2 border-border py-3.5 font-bold text-foreground hover:bg-surface transition-premium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="btn-primary flex-1 rounded-xl py-3.5 font-black disabled:opacity-60"
          >
            {loading ? "Saving…" : "Yes, I've paid"}
          </button>
        </div>
      </div>
    </div>
  );
}
