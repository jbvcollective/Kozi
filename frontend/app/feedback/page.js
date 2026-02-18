"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { supabase, hasSupabase } from "@/lib/supabase";
import RequireAuth from "@/components/RequireAuth";

const TABLE = "feedback_tickets";

function FeedbackPageContent() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [showThanks, setShowThanks] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    const sub = (subject || "").trim();
    const msg = (message || "").trim();
    if (!sub || !msg) {
      setError("Please enter a subject and message.");
      return;
    }
    if (!hasSupabase()) {
      setError("Feedback is not configured. Contact support.");
      return;
    }
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error: insertError } = await supabase.from(TABLE).insert({
      subject: sub,
      message: msg,
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
    });
    setSubmitting(false);
    if (insertError) {
      setError(insertError.message || "Failed to submit feedback.");
      return;
    }
    setSubject("");
    setMessage("");
    setShowThanks(true);
  }

  const thanksModal = showThanks && createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" aria-modal="true" role="dialog" aria-labelledby="thanks-title">
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={() => setShowThanks(false)} aria-hidden="true" />
      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-surface-elevated p-8 shadow-elevated text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 id="thanks-title" className="mt-4 text-xl font-bold text-foreground">Thank you</h2>
        <p className="mt-2 text-muted">Your feedback has been submitted. We’ll use it to improve.</p>
        <button
          type="button"
          onClick={() => setShowThanks(false)}
          className="mt-6 w-full rounded-xl bg-primary px-4 py-3 font-semibold text-white hover:opacity-90"
        >
          Done
        </button>
      </div>
    </div>,
    document.body
  );

  return (
    <div className="mx-auto max-w-2xl px-6 pt-20 pb-24 md:pt-14">
      <h1 className="text-2xl font-bold text-foreground md:text-3xl">Feedback</h1>
      <p className="mt-2 text-muted">Tell us what to fix or improve.</p>

      <form onSubmit={handleSubmit} className="mt-8 rounded-2xl border border-border bg-surface-elevated p-6 shadow-card">
        <label htmlFor="feedback-subject" className="block text-sm font-semibold text-foreground">Subject</label>
        <input
          id="feedback-subject"
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g. Search filter not working"
          className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          maxLength={200}
          disabled={submitting}
        />
        <label htmlFor="feedback-message" className="mt-4 block text-sm font-semibold text-foreground">Message</label>
        <textarea
          id="feedback-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe the issue or suggestion..."
          rows={4}
          className="mt-2 w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          maxLength={2000}
          disabled={submitting}
        />
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="mt-4 rounded-xl bg-primary px-6 py-3 font-semibold text-white transition-premium hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Submit feedback"}
        </button>
      </form>

      {thanksModal}
    </div>
  );
}

export default function FeedbackPage() {
  return (
    <RequireAuth>
      <FeedbackPageContent />
    </RequireAuth>
  );
}
