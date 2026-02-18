"use client";

import { useState, useEffect } from "react";
import { addVipDeal, removeVipDeal } from "@/lib/api";

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&q=80&w=800";

export default function VIPDeals({ deals = [], isAgent = false, onRefresh, chosenAgent }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [offer, setOffer] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [error, setError] = useState(null);
  const [addSuccess, setAddSuccess] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);

  const hasChosenAgent = chosenAgent?.agentName != null && chosenAgent.agentName !== "";
  const hasAgentId = !!chosenAgent?.agentId;

  useEffect(() => {
    if (!addSuccess) return;
    const t = setTimeout(() => setAddSuccess(false), 5000);
    return () => clearTimeout(t);
  }, [addSuccess]);

  async function handleAdd(e) {
    e.preventDefault();
    setError(null);
    setAddSuccess(false);
    const t = title?.trim();
    const o = offer?.trim();
    if (!t || !o) {
      setError("Title and offer are required.");
      return;
    }
    setAdding(true);
    const { error: err } = await addVipDeal({
      title: t,
      description: description?.trim() || undefined,
      offer: o,
      image_url: imageUrl?.trim() || undefined,
      link_url: linkUrl?.trim() || undefined,
      coupon_code: couponCode?.trim() || undefined,
    });
    setAdding(false);
    if (err) {
      setError(err.message ?? "Failed to add.");
      return;
    }
    setTitle("");
    setDescription("");
    setOffer("");
    setImageUrl("");
    setLinkUrl("");
    setCouponCode("");
    setAddSuccess(true);
    if (onRefresh) onRefresh();
  }

  async function handleRemove(dealId) {
    setError(null);
    setConfirmRemoveId(null);
    setRemoving(dealId);
    const { error: err } = await removeVipDeal(dealId);
    setRemoving(null);
    if (err) setError(err.message ?? "Failed to remove.");
    else if (onRefresh) onRefresh();
  }

  if (isAgent) {
    return (
      <div className="mx-auto max-w-[1600px] animate-fade-in px-4 sm:px-6 md:px-8 lg:px-12 pb-24 sm:pb-32 pt-20 md:pt-12 lg:pt-24 min-w-0">
        <header className="mb-10 border-b border-border pb-8">
          <h1 className="text-3xl font-bold text-foreground md:text-4xl">VIP Deals</h1>
          <p className="mt-2 text-muted">Share discounts, coupons, and perks with your clients. Users who choose you will see these.</p>
        </header>

        <section className="mb-10 rounded-2xl border border-border bg-surface-elevated p-6">
          <h2 className="text-lg font-bold text-foreground">Add a deal</h2>
          <p className="mt-1 text-sm text-muted">e.g. restaurant discount, store coupon, exclusive access.</p>
          <form onSubmit={handleAdd} className="mt-4 space-y-4">
            {addSuccess && (
              <p className="rounded-xl bg-green-100 px-4 py-3 text-sm font-semibold text-green-800" role="status">
                Done. Your deal has been added.
              </p>
            )}
            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>
            )}
            <div>
              <label htmlFor="vip-title" className="block text-sm font-semibold text-foreground">Title <span className="text-red-500">*</span></label>
              <input
                id="vip-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 20% off at Le Bernardin"
                className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                disabled={adding}
              />
            </div>
            <div>
              <label htmlFor="vip-offer" className="block text-sm font-semibold text-foreground">Offer <span className="text-red-500">*</span></label>
              <input
                id="vip-offer"
                type="text"
                value={offer}
                onChange={(e) => setOffer(e.target.value)}
                placeholder="e.g. Complimentary tasting for two"
                className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                disabled={adding}
              />
            </div>
            <div>
              <label htmlFor="vip-description" className="block text-sm font-semibold text-foreground">Description (optional)</label>
              <textarea
                id="vip-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Details, terms, or how to redeem"
                rows={2}
                className="mt-1 w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                disabled={adding}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="vip-image" className="block text-sm font-semibold text-foreground">Image URL (optional)</label>
                <input
                  id="vip-image"
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  disabled={adding}
                />
              </div>
              <div>
                <label htmlFor="vip-link" className="block text-sm font-semibold text-foreground">Link (optional)</label>
                <input
                  id="vip-link"
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="Where to redeem or learn more"
                  className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  disabled={adding}
                />
              </div>
            </div>
            <div>
              <label htmlFor="vip-coupon" className="block text-sm font-semibold text-foreground">Coupon / promo code (optional)</label>
              <input
                id="vip-coupon"
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                placeholder="e.g. AGENT20"
                className="mt-1 w-full max-w-xs rounded-xl border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                disabled={adding}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={adding || !title?.trim() || !offer?.trim()} className="rounded-xl bg-primary px-6 py-3 font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {adding ? "Adding…" : "Add deal"}
            </button>
          </form>
        </section>

        <section className={`relative ${confirmRemoveId ? "min-h-[320px]" : ""}`} aria-label="Your VIP deals">
          <h2 className="text-xl font-bold text-foreground">Your VIP deals</h2>
          {deals.length === 0 ? (
            <p className="mt-4 text-muted">No deals yet. Add one above.</p>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {deals.map((deal) => (
                <div key={deal.id} className="flex flex-col rounded-2xl border border-border bg-surface-elevated overflow-hidden">
                  <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                    <img
                      src={deal.image_url || DEFAULT_IMAGE}
                      alt={deal.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex-1 p-4">
                    <h3 className="font-bold text-foreground">{deal.title}</h3>
                    <p className="mt-1 text-primary font-semibold">{deal.offer}</p>
                    {deal.description && <p className="mt-2 text-sm text-muted line-clamp-2">{deal.description}</p>}
                    {deal.coupon_code && <p className="mt-2 text-sm font-mono rounded bg-surface px-2 py-1 inline-block">Code: {deal.coupon_code}</p>}
                  </div>
                  <div className="p-4 pt-0">
                    <button
                      type="button"
                      onClick={() => setConfirmRemoveId(deal.id)}
                      disabled={removing === deal.id}
                      className="w-full rounded-xl border border-red-200 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {removing === deal.id ? "Removing…" : "Remove"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {confirmRemoveId && (
            <div
              className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-black/50 backdrop-blur-sm min-h-[280px]"
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-remove-title"
              aria-describedby="confirm-remove-desc"
              onClick={() => setConfirmRemoveId(null)}
            >
              <div
                className="mx-4 w-full max-w-sm rounded-2xl border border-border bg-surface-elevated p-6 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 id="confirm-remove-title" className="text-lg font-bold text-foreground">Remove this VIP deal?</h2>
                <p id="confirm-remove-desc" className="mt-2 text-sm text-muted">This cannot be undone. The deal will no longer appear for your clients.</p>
                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmRemoveId(null)}
                    className="flex-1 rounded-xl border-2 border-border py-2.5 font-semibold text-foreground hover:bg-surface"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(confirmRemoveId)}
                    disabled={removing === confirmRemoveId}
                    className="flex-1 rounded-xl bg-red-600 py-2.5 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {removing === confirmRemoveId ? "Removing…" : "Remove"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    );
  }

  if (!hasChosenAgent) {
    return (
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 md:px-8 lg:px-12 pb-24 sm:pb-32 pt-20 md:pt-12 lg:pt-24 min-w-0">
        <header className="mb-10 border-b border-border pb-8">
          <h1 className="text-3xl font-bold text-foreground md:text-4xl">VIP Deals</h1>
          <p className="mt-2 text-muted">Exclusive discounts and perks from your agent.</p>
        </header>
        <div className="rounded-2xl border border-border bg-surface-elevated p-12 text-center">
          <p className="text-muted">Choose an agent from the list to see their VIP deals here.</p>
        </div>
      </div>
    );
  }

  if (!hasAgentId) {
    return (
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 md:px-8 lg:px-12 pb-24 sm:pb-32 pt-20 md:pt-12 lg:pt-24 min-w-0">
        <header className="mb-10 border-b border-border pb-8">
          <h1 className="text-3xl font-bold text-foreground md:text-4xl">VIP Deals</h1>
          <p className="mt-2 text-muted">Exclusive discounts and perks from {chosenAgent.agentName}.</p>
        </header>
        <div className="rounded-2xl border border-border bg-surface-elevated p-12 text-center">
          <p className="text-muted">Your agent doesn’t have any VIP deals listed yet.</p>
        </div>
      </div>
    );
  }

  if (deals.length === 0) {
    return (
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 md:px-8 lg:px-12 pb-24 sm:pb-32 pt-20 md:pt-12 lg:pt-24 min-w-0">
        <header className="mb-10 border-b border-border pb-8">
          <h1 className="text-3xl font-bold text-foreground md:text-4xl">VIP Deals</h1>
          <p className="mt-2 text-muted">Exclusive discounts and perks from {chosenAgent.agentName}.</p>
        </header>
        <div className="rounded-2xl border border-border bg-surface-elevated p-12 text-center">
          <p className="text-muted">Your agent has no VIP deals right now.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] animate-fade-in px-4 sm:px-6 md:px-8 lg:px-12 pb-24 sm:pb-32 pt-20 md:pt-12 lg:pt-24 min-w-0">
      <header className="mb-10 border-b border-border pb-8">
        <h1 className="text-3xl font-bold text-foreground md:text-4xl">VIP Deals</h1>
        <p className="mt-2 text-muted">Exclusive discounts and perks from {chosenAgent.agentName}.</p>
      </header>

      <section>
        <div className="flex flex-col justify-between border-b border-border pb-4 md:flex-row md:items-baseline">
          <h2 className="text-xl font-bold text-foreground">Privé perks</h2>
          <span className="text-sm text-muted">{deals.length} deal{deals.length !== 1 ? "s" : ""}</span>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {deals.map((deal) => {
            const link = deal.link_url?.trim();
            const Wrapper = link ? "a" : "div";
            const wrapperProps = link ? { href: link, target: "_blank", rel: "noopener noreferrer", className: "flex flex-col rounded-2xl border border-border bg-surface-elevated overflow-hidden hover:border-primary/50 transition-colors" } : { className: "flex flex-col rounded-2xl border border-border bg-surface-elevated overflow-hidden" };
            return (
              <Wrapper key={deal.id} {...wrapperProps}>
                <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                  <img
                    src={deal.image_url || DEFAULT_IMAGE}
                    alt={deal.title}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex-1 p-5">
                  <h3 className="font-bold text-foreground">{deal.title}</h3>
                  <p className="mt-1 text-primary font-semibold">{deal.offer}</p>
                  {deal.description && <p className="mt-2 text-sm text-muted">{deal.description}</p>}
                  {deal.coupon_code && (
                    <p className="mt-3 font-mono text-sm rounded-lg bg-surface px-3 py-2 border border-border">
                      Code: <span className="font-bold">{deal.coupon_code}</span>
                    </p>
                  )}
                </div>
                {link && (
                  <div className="px-5 pb-5">
                    <span className="text-sm font-medium text-primary">View offer →</span>
                  </div>
                )}
              </Wrapper>
            );
          })}
        </div>
      </section>
    </div>
  );
}
