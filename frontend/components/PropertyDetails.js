"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { fetchListings, fetchSchoolsNear, fetchTransitNear, fetchOpenHouseEvents } from "@/lib/api";
import { mapListingToProperty, formatBeds } from "@/lib/propertyUtils";
import { useSaved } from "@/context/SavedContext";
import { useAuth } from "@/context/AuthContext";
import { useChosenAgent } from "@/context/ChosenAgentContext";
import { useLinkedAgent } from "@/context/LinkedAgentContext";
import { useAgentPro } from "@/hooks/useAgentPro";
import { KEY_FACTS_ORDER, DETAILS_ORDER, LISTING_LABELS, formatListingValue } from "@/lib/listingSchema";
import PropertyCard from "./PropertyCard";
function FactRow({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2 text-sm transition-premium hover:border-primary/20">
      <span className="font-medium text-muted">{label}</span>
      <span className="text-right font-bold text-foreground">{value || "N/A"}</span>
    </div>
  );
}

function FloatingBoxContent({
  property,
  hasPriceDrop,
  totalSavings,
  savingsPercent,
  displayBrokerage,
  displayAgent,
  displayAgentPhone,
  displayAgentEmail,
  user,
  openAuthModal,
  openChooseAgentModal,
  effectiveToggleSave,
  effectiveIsSaved,
  calculateMonthly,
  isAgentOrBroker,
  hasAgentPro,
}) {
  const [showAgentProBanner, setShowAgentProBanner] = useState(false);
  return (
    <div className="space-y-0 pb-6">
      <div className="py-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted">{property?.priceIsMonthly ? "Per month" : "List price"}</span>
        <div className="mt-2 text-4xl font-bold tracking-tight text-foreground">
          ${(property?.price ?? 0).toLocaleString()}
          {property?.priceIsMonthly && <span className="text-xl font-semibold text-muted">/mo</span>}
        </div>
        {!property?.priceIsMonthly && hasPriceDrop && (
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm text-muted line-through">${property?.originalPrice?.toLocaleString()}</span>
            <span className="text-sm font-semibold text-accent">−${totalSavings?.toLocaleString()} ({savingsPercent}%)</span>
          </div>
        )}
        <p className="mt-4 text-base text-muted leading-snug">
          {property?.addressStreet ? (
            <>
              {property.addressStreet}
              {(property.addressCity || property.addressProvince || property.addressPostalCode) && (
                <span className="block mt-1 text-muted/90">
                  {[property.addressCity, property.addressProvince, property.addressPostalCode].filter(Boolean).join(", ")}
                </span>
              )}
            </>
          ) : (
            property?.location
          )}
        </p>
        {property?.id && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-surface px-3 py-1.5 border border-border">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">Listing ID</span>
            <span className="text-sm font-semibold text-foreground">{property.id.substring(0, 10)}</span>
          </p>
        )}
        <div className="mt-6 pt-6 border-t border-border/70">
          {(displayBrokerage || displayAgent || displayAgentPhone || displayAgentEmail) ? (
            <div className="space-y-2">
              {displayBrokerage && (
                <>
                  <p className="text-base font-semibold text-foreground">{displayBrokerage}</p>
                  <p className="text-sm text-muted">Brokerage</p>
                </>
              )}
              {displayAgent && !displayBrokerage && (
                <p className="text-base font-semibold text-foreground">{displayAgent}</p>
              )}
              <div className="space-y-1.5 pt-1">
                {displayAgentPhone && (
                  <p className="flex items-center gap-2 text-sm text-foreground">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <a href={`tel:${displayAgentPhone.replace(/\s/g, "")}`} className="hover:underline">{displayAgentPhone}</a>
                  </p>
                )}
                {displayAgentEmail && (
                  <p className="flex items-center gap-2 text-sm text-foreground">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <a href={`mailto:${displayAgentEmail}`} className="max-w-full truncate hover:underline">{displayAgentEmail}</a>
                  </p>
                )}
              </div>
              {displayAgent && displayBrokerage && (
                <p className="text-sm text-muted">Listing agent: {displayAgent}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted">Contact info not available.</p>
          )}
        </div>
        {/* Agent Pro upsell popup */}
        {showAgentProBanner && createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowAgentProBanner(false)}>
            <div className="relative mx-4 w-full max-w-sm rounded-2xl bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <button type="button" onClick={() => setShowAgentProBanner(false)} className="absolute right-4 top-4 text-muted hover:text-foreground transition-colors">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <svg className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-foreground">Subscribe to Agent Pro</h3>
                <p className="mt-2 text-sm text-muted leading-relaxed">Get your name on every listing and unlock Agent Pro features.</p>
                <a
                  href="/pricing"
                  className="btn-primary mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-base font-semibold shadow-md"
                >
                  View plans
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
                </a>
                <button type="button" onClick={() => setShowAgentProBanner(false)} className="mt-3 text-sm text-muted hover:text-foreground transition-colors">
                  Maybe later
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
        <div className="mt-6 space-y-3">
          {property?.location && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(property.location)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-border bg-surface py-4 text-base font-semibold text-foreground transition-colors hover:border-primary/50 hover:bg-surface/80"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              View on Google Maps
            </a>
          )}
          {isAgentOrBroker ? (
            hasAgentPro ? (
              <div className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-primary/30 bg-primary/5 py-4 text-base font-semibold text-primary">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                You're on Agent Pro
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAgentProBanner(true)}
                className="btn-primary w-full rounded-xl py-4 text-base font-semibold shadow-md"
              >
                Be the listing agent
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={() => {
                if (!user) openAuthModal();
                else openChooseAgentModal();
              }}
              className="btn-primary w-full rounded-xl py-4 text-base font-semibold shadow-md"
            >
              Contact agent
            </button>
          )}
          {effectiveToggleSave && (
            <button
              type="button"
              onClick={() => effectiveToggleSave(property?.id)}
              className={`flex w-full items-center justify-center gap-2 rounded-xl border-2 py-4 text-base font-semibold transition-colors ${effectiveIsSaved ? "border-error/30 bg-error/5 text-error" : "border-border text-foreground hover:border-primary/50 hover:bg-surface/80"}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill={effectiveIsSaved ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              {effectiveIsSaved ? "Saved" : "Save"}
            </button>
          )}
        </div>
      </div>
      <div className="border-t border-border/70 py-6">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted">Financial insights</h3>
        <div className="mt-3 space-y-2">
          <div className="flex justify-between text-base">
            <span className="text-muted">Monthly estimate</span>
            <span className="font-semibold text-foreground">~${Math.round(calculateMonthly?.() ?? 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-base">
            <span className="text-muted">Potential rent</span>
            <span className="font-semibold text-foreground">N/A</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PropertyDetails({ property, isSaved, onToggleSave, onBack }) {
  const { savedIds, toggleSave } = useSaved();
  const { user, openAuthModal } = useAuth();
  const { chosenAgent, openChooseAgentModal, openClaimAsAgentModal } = useChosenAgent();
  const { linkedAgent } = useLinkedAgent();
  const { hasAgentPro, selfAgentProfile } = useAgentPro();
  const isAgentOrBroker = user?.user_metadata?.user_type === "agent";
  const effectiveToggleSave = onToggleSave ?? toggleSave;
  // Only override with agent info when they have paid (Agent Pro); otherwise use listing's agent.
  const useLinkedAsAgent = linkedAgent?.hasAgentPro && linkedAgent?.name;
  const useChosenAsAgent = chosenAgent?.hasAgentPro && chosenAgent?.agentName;
  const useSelfAsAgent = hasAgentPro && selfAgentProfile?.name;
  const displayAgent = useLinkedAsAgent ? linkedAgent.name : useChosenAsAgent ? chosenAgent.agentName : useSelfAsAgent ? selfAgentProfile.name : property?.listingAgent;
  const displayBrokerage = useLinkedAsAgent ? linkedAgent.brokerage : useChosenAsAgent ? chosenAgent.brokerage : useSelfAsAgent ? selfAgentProfile.brokerage : property?.listingBrokerage;
  const displayAgentPhone = useLinkedAsAgent ? linkedAgent.phone : useChosenAsAgent ? chosenAgent.phone : useSelfAsAgent ? selfAgentProfile.phone : property?.listingAgentPhone;
  const displayAgentEmail = useLinkedAsAgent ? linkedAgent.email : useChosenAsAgent ? chosenAgent.email : useSelfAsAgent ? selfAgentProfile.email : property?.listingAgentEmail;
  const displayAgentPhoto = useLinkedAsAgent ? linkedAgent.profile_image_url : useSelfAsAgent ? selfAgentProfile.profile_image_url : undefined;
  const effectiveIsSaved = onToggleSave ? isSaved : savedIds.includes(property?.id);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState("facts");
  const [similarActive, setSimilarActive] = useState([]);
  const [similarSold, setSimilarSold] = useState([]);
  const [schoolsNearby, setSchoolsNearby] = useState([]);
  const [schoolsLoading, setSchoolsLoading] = useState(false);
  const [transitNearby, setTransitNearby] = useState([]);
  const [transitLoading, setTransitLoading] = useState(false);
  const [openHouseEvents, setOpenHouseEvents] = useState([]);
  const [mounted, setMounted] = useState(false);
  const [useDesktop, setUseDesktop] = useState(false);


  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setUseDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);


  const images = property?.images || [property?.image].filter(Boolean);
  const hasPriceDrop = property?.originalPrice && property?.originalPrice > property?.price;
  const totalSavings = hasPriceDrop ? property.originalPrice - property.price : 0;
  const savingsPercent = hasPriceDrop && property.originalPrice
    ? Math.round((totalSavings / property.originalPrice) * 100)
    : 0;

  const [downPayment, setDownPayment] = useState(() => Math.round((property?.price ?? 0) * 0.2));
  const [interestRate, setInterestRate] = useState(5.25);
  const [amortization, setAmortization] = useState(25);

  const monthlyRent = property?.priceIsMonthly ? (property?.price ?? 0) : 0;
  const [purchasePrice, setPurchasePrice] = useState(() => (monthlyRent > 0 ? Math.round(monthlyRent * 200) : 500000));
  const [downPaymentPct, setDownPaymentPct] = useState(20);
  const [propertyTaxMonthly, setPropertyTaxMonthly] = useState(328);
  const [maintenanceCost, setMaintenanceCost] = useState(0);
  const [rentalIncome, setRentalIncome] = useState(() => monthlyRent || 3054);
  const [interestRateCF, setInterestRateCF] = useState(5.25);
  const [amortizationCF, setAmortizationCF] = useState(25);

  const calculateMonthly = () => {
    const price = property?.price ?? 0;
    const principal = price - downPayment;
    const monthlyRate = interestRate / 100 / 12;
    const numberOfPayments = amortization * 12;
    if (monthlyRate === 0) return principal / numberOfPayments;
    const monthly =
      (principal * monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) /
      (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
    return Number.isNaN(monthly) ? 0 : monthly;
  };

  const pmi = (principal, annualRatePct, numMonths) => {
    if (principal <= 0 || numMonths <= 0) return 0;
    const r = annualRatePct / 100 / 12;
    if (r === 0) return principal / numMonths;
    return (principal * r * Math.pow(1 + r, numMonths)) / (Math.pow(1 + r, numMonths) - 1);
  };

  const cashFlowMortgagePayment = () =>
    pmi(purchasePrice * (1 - downPaymentPct / 100), interestRateCF, amortizationCF * 12);
  const cashFlowMonthlyPayment = () =>
    cashFlowMortgagePayment() + (propertyTaxMonthly || 0) + (maintenanceCost || 0);
  const cashFlowValue = () => (rentalIncome || 0) - cashFlowMonthlyPayment();
  const breakEvenDownPct = () => {
    const target = (rentalIncome || 0) - (propertyTaxMonthly || 0) - (maintenanceCost || 0);
    if (target <= 0) return 100;
    for (let pct = 0; pct <= 100; pct += 0.5) {
      const mp = pmi(purchasePrice * (1 - pct / 100), interestRateCF, amortizationCF * 12);
      if (mp <= target) return Math.round(pct * 10) / 10;
    }
    return 100;
  };
  const downPaymentAmount = () => Math.round((purchasePrice * downPaymentPct) / 100);

  useEffect(() => {
    if (property?.priceIsMonthly && property?.price != null) {
      setRentalIncome(property.price);
      setPurchasePrice((p) => (p <= 0 ? Math.round(property.price * 200) : p));
    }
  }, [property?.id, property?.priceIsMonthly, property?.price]);

  const nextImage = () => {
    setHeroLoaded(false);
    setActiveImageIndex((prev) => (prev + 1) % (images.length || 1));
  };

  const prevImage = () => {
    setHeroLoaded(false);
    setActiveImageIndex((prev) => (prev - 1 + (images.length || 1)) % (images.length || 1));
  };

  useEffect(() => {
    let cancelled = false;
    fetchListings()
      .then((rows) => {
        if (cancelled || !property?.id) return;
        const all = (rows || []).map(mapListingToProperty);
        const active = all.filter(
          (p) => p.id !== property.id && (p.type || "") === (property.type || "") && p.status !== "Sold"
        ).slice(0, 4);
        const sold = all.filter(
          (p) => p.id !== property.id && (p.type || "") === (property.type || "") && p.status === "Sold"
        ).slice(0, 4);
        setSimilarActive(active);
        setSimilarSold(sold);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [property?.id, property?.type]);

  useEffect(() => {
    let cancelled = false;
    const lat = property?.lat;
    const lng = property?.lng;
    const type = String(property?.type ?? "").toLowerCase();
    const isResidential = !type.includes("commercial");
    if (!isResidential || lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      setSchoolsNearby([]);
      return;
    }
    setSchoolsLoading(true);
    fetchSchoolsNear(lat, lng, 50)
      .then((list) => {
        if (!cancelled) setSchoolsNearby(list || []);
      })
      .catch(() => { if (!cancelled) setSchoolsNearby([]); })
      .finally(() => { if (!cancelled) setSchoolsLoading(false); });
    return () => { cancelled = true; };
  }, [property?.lat, property?.lng, property?.type]);

  useEffect(() => {
    let cancelled = false;
    const lat = property?.lat;
    const lng = property?.lng;
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      setTransitNearby([]);
      return;
    }
    setTransitLoading(true);
    fetchTransitNear(lat, lng, 30)
      .then((list) => { if (!cancelled) setTransitNearby(list || []); })
      .catch(() => { if (!cancelled) setTransitNearby([]); })
      .finally(() => { if (!cancelled) setTransitLoading(false); });
    return () => { cancelled = true; };
  }, [property?.lat, property?.lng]);

  useEffect(() => {
    let cancelled = false;
    if (!property?.id) return;
    fetchOpenHouseEvents()
      .then((list) => {
        if (cancelled) return;
        const forListing = (list || []).filter((e) => e.listing_key === property.id);
        setOpenHouseEvents(forListing);
      })
      .catch(() => { if (!cancelled) setOpenHouseEvents([]); });
    return () => { cancelled = true; };
  }, [property?.id]);

  const hasOpenHouse = (property.openHouse && property.openHouse.trim()) || openHouseEvents.length > 0;
  const listing = property?.listing || {};
  const hasValue = (v) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);
  const keyFactsEntries = KEY_FACTS_ORDER.filter((k) => hasValue(listing[k]));
  const detailsEntries = DETAILS_ORDER.filter((k) => hasValue(listing[k]));
  const formatEvent = (e) => {
    if (!e?.start_ts) return e?.remarks || null;
    try {
      const start = new Date(e.start_ts);
      const end = e.end_ts ? new Date(e.end_ts) : null;
      const day = start.toLocaleDateString("en-CA", { weekday: "short" });
      const startStr = start.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit", hour12: true });
      const endStr = end ? end.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit", hour12: true }) : null;
      return endStr ? `${day} ${startStr}–${endStr}` : `${day} ${startStr}`;
    } catch { return e.remarks || null; }
  };

  if (!property) return null;

  return (
    <div className="mx-auto min-h-screen max-w-[1600px] animate-fade-in px-4 sm:px-6 md:px-8 lg:px-12 pb-32 sm:pb-40 pt-24 sm:pt-6 md:pt-12 lg:pt-24 min-w-0">
      {/* Top bar: sticky so it stays visible when scrolling up and isn't covered by header */}
      <div className="sticky top-0 z-10 -mx-4 px-4 sm:-mx-6 sm:px-6 md:-mx-8 md:px-8 lg:-mx-12 lg:px-12 mb-8 flex items-center justify-between border-b border-border bg-background/95 backdrop-blur-sm py-3 sm:py-4">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="-ml-4 flex items-center space-x-3 rounded-xl px-4 py-2 text-muted transition-premium hover:bg-surface hover:text-foreground group"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-xs font-black uppercase tracking-[0.2em]">Back to Results</span>
          </button>
        ) : (
          <Link
            href="/explore"
            className="-ml-4 flex items-center space-x-3 rounded-xl px-4 py-2 text-muted transition-premium hover:bg-surface hover:text-foreground group"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-xs font-black uppercase tracking-[0.2em]">Back to Results</span>
          </Link>
        )}
      </div>

      <div className="flex flex-col gap-12 lg:flex-row">
        {/* Main content — leave room for fixed sidebar when portaled on desktop */}
        <div className="min-w-0 flex-1 space-y-12 lg:pr-[416px]">
          {/* Hero Carousel */}
          <div className="group relative">
            <div className="relative h-[320px] sm:h-[420px] md:h-[550px] lg:h-[650px] w-full overflow-hidden rounded-2xl sm:rounded-3xl bg-surface shimmer-bg transition-premium" style={{ boxShadow: "var(--shadow-elevated)" }}>
              {images[activeImageIndex] ? (
                <img
                  src={images[activeImageIndex]}
                  alt={`${property.title} - Image ${activeImageIndex + 1}`}
                  className={`h-full w-full object-cover transition-all duration-700 ${heroLoaded ? "opacity-100" : "opacity-0"}`}
                  onLoad={() => setHeroLoaded(true)}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-gray-400">No photo</div>
              )}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-8 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); prevImage(); }}
                  className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-foreground backdrop-blur-xl transition-premium hover:bg-white active:scale-95"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); nextImage(); }}
                  className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-foreground backdrop-blur-xl transition-premium hover:bg-white active:scale-95"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              {images.length > 0 && (
                <div className="absolute bottom-10 right-10 flex items-center space-x-4">
                  <div className="rounded-2xl border border-white/10 bg-black/80 px-6 py-3 text-sm font-black text-white backdrop-blur-md">
                    {activeImageIndex + 1} / {images.length}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Price History Section */}
          <section className="animate-fade-in space-y-4">
            <h2 className="text-base font-semibold text-foreground">Price History</h2>
            <div className="divide-y divide-border rounded-2xl border border-border bg-surface-elevated overflow-hidden">
              {/* Current price row */}
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {hasPriceDrop ? "Price Reduced" : (property?.status || "Listed")}
                    </p>
                    {(() => {
                      const listing = property?.listing || {};
                      const raw = listing.originalEntryTimestamp ?? listing.listingContractDate;
                      if (!raw) return null;
                      try {
                        const d = new Date(raw);
                        if (isNaN(d.getTime())) return null;
                        return <p className="text-xs text-muted mt-0.5">{d.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })}</p>;
                      } catch { return null; }
                    })()}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">
                    ${(property?.price ?? 0).toLocaleString()}{property?.priceIsMonthly ? "/mo" : ""}
                  </p>
                  {hasPriceDrop && (
                    <p className="text-xs font-medium text-orange-500 mt-0.5">−${totalSavings.toLocaleString()} ({savingsPercent}%)</p>
                  )}
                </div>
              </div>
              {/* Original price row (only shown if there was a price drop) */}
              {hasPriceDrop && property?.originalPrice && (
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="h-2 w-2 rounded-full bg-border shrink-0" />
                    <p className="text-sm text-muted">Listed</p>
                  </div>
                  <p className="text-sm text-muted line-through">
                    ${property.originalPrice.toLocaleString()}{property?.priceIsMonthly ? "/mo" : ""}
                  </p>
                </div>
              )}
            </div>
          </section>

          {hasOpenHouse && (
            <section className="animate-fade-in space-y-4 rounded-2xl border border-border bg-surface p-8">
              <h2 className="text-xl font-black tracking-tight text-foreground">Open house</h2>
              {openHouseEvents.length > 0 ? (
                <ul className="space-y-2">
                  {openHouseEvents.map((e) => (
                    <li key={e.id} className="flex items-center gap-2 text-sm font-medium text-gray-900">
                      <span className="h-2 w-2 rounded-full bg-green-500" />
                      {formatEvent(e) || e.remarks || "Scheduled"}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm font-medium text-gray-700">{property.openHouse}</p>
              )}
              <Link href="/open-houses" className="inline-block text-xs font-black uppercase tracking-widest text-muted transition-premium hover:text-primary">
                View all open houses →
              </Link>
            </section>
          )}

          {/* Listing History */}
          <section className="animate-fade-in space-y-4">
            <h2 className="text-base font-semibold text-foreground">Listing History</h2>
            {(() => {
              const listing = property?.listing || {};
              const formatDate = (val) => {
                if (!val) return "—";
                try {
                  const d = new Date(val);
                  return isNaN(d.getTime()) ? String(val) : d.toISOString().slice(0, 10);
                } catch { return "—"; }
              };
              const dateStart = formatDate(listing.originalEntryTimestamp ?? listing.listingContractDate);
              const dateEnd = formatDate(listing.expirationDate);
              const rows = [
                {
                  dateStart: dateStart !== "—" ? dateStart : "—",
                  dateEnd: dateEnd,
                  price: property?.price ?? 0,
                  event: hasPriceDrop ? "Price Reduced" : (property?.status || "Active"),
                  eventClass: hasPriceDrop ? "bg-orange-100 text-orange-600" : "bg-green-100 text-green-600",
                  beds: formatBeds(property),
                  baths: property?.baths ?? "—",
                  sqft: property?.sqft != null ? property.sqft.toLocaleString() : "—",
                  garage: property?.parking ?? "—",
                  listingId: property?.id ? property.id.substring(0, 10).toUpperCase() : "—",
                },
              ];
              if (hasPriceDrop && property?.originalPrice) {
                rows.push({
                  dateStart: "—",
                  dateEnd: "—",
                  price: property.originalPrice,
                  event: "Listed",
                  eventClass: "bg-gray-100 text-muted",
                  beds: formatBeds(property),
                  baths: property?.baths ?? "—",
                  sqft: property?.sqft != null ? property.sqft.toLocaleString() : "—",
                  garage: property?.parking ?? "—",
                  listingId: property?.id ? property.id.substring(0, 10).toUpperCase() : "—",
                });
              }
              return (
                <>
                  {/* Mobile: stacked cards */}
                  <div className="space-y-3 sm:hidden">
                    {rows.map((row, i) => (
                      <div key={i} className="rounded-2xl border border-border bg-surface-elevated p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            {property?.priceIsMonthly ? `$${Number(row.price).toLocaleString()}/mo` : `$${Number(row.price).toLocaleString()}`}
                          </span>
                          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${row.eventClass}`}>{row.event}</span>
                        </div>
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          <div><dt className="text-xs text-muted">Date Start</dt><dd className="font-medium text-foreground">{row.dateStart}</dd></div>
                          <div><dt className="text-xs text-muted">Date End</dt><dd className="font-medium text-foreground">{row.dateEnd}</dd></div>
                          <div><dt className="text-xs text-muted">Beds</dt><dd className="font-medium text-foreground">{row.beds}</dd></div>
                          <div><dt className="text-xs text-muted">Baths</dt><dd className="font-medium text-foreground">{row.baths}</dd></div>
                          <div><dt className="text-xs text-muted">Sqft</dt><dd className="font-medium text-foreground">{row.sqft}</dd></div>
                          <div><dt className="text-xs text-muted">Garage</dt><dd className="font-medium text-foreground">{row.garage}</dd></div>
                          <div className="col-span-2"><dt className="text-xs text-muted">Listing ID</dt><dd className="font-mono text-xs text-muted">{row.listingId}</dd></div>
                        </dl>
                      </div>
                    ))}
                  </div>
                  {/* Desktop: table */}
                  <div className="hidden sm:block overflow-x-auto rounded-2xl border border-border bg-surface-elevated">
                    <table className="w-full min-w-[600px] text-left">
                      <thead className="border-b border-border">
                        <tr>
                          {["Date Start","Date End","Price","Event","Beds","Baths","Sqft","Garage","Listing ID"].map((h) => (
                            <th key={h} className="px-4 py-3 text-xs font-medium text-muted">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {rows.map((row, i) => (
                          <tr key={i} className="hover:bg-surface/50 transition-colors">
                            <td className="px-4 py-3 text-sm text-foreground">{row.dateStart}</td>
                            <td className="px-4 py-3 text-sm text-foreground">{row.dateEnd}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-foreground">
                              {property?.priceIsMonthly ? `$${Number(row.price).toLocaleString()}/mo` : `$${Number(row.price).toLocaleString()}`}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${row.eventClass}`}>{row.event}</span>
                            </td>
                            <td className="px-4 py-3 text-sm text-foreground">{row.beds}</td>
                            <td className="px-4 py-3 text-sm text-foreground">{row.baths}</td>
                            <td className="px-4 py-3 text-sm text-foreground">{row.sqft}</td>
                            <td className="px-4 py-3 text-sm text-foreground">{row.garage}</td>
                            <td className="px-4 py-3 font-mono text-xs text-muted">{row.listingId}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}
          </section>

          {/* Tabs Section */}
          <section className="border-t border-border pt-8">
            <div className="no-scrollbar mb-8 flex space-x-12 overflow-x-auto border-b border-border">
              {[
                { id: "facts", label: "Key Facts" },
                { id: "details", label: "Details" },
                { id: property?.priceIsMonthly ? "cashflow" : "mortgage", label: property?.priceIsMonthly ? "Cash Flow Analysis" : "Mortgage Calculator" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative whitespace-nowrap pb-4 text-sm font-black uppercase tracking-[0.2em] transition-premium ${activeTab === tab.id ? "text-foreground" : "text-muted hover:text-foreground"}`}
                >
                  {tab.label}
                  {activeTab === tab.id && <div className="absolute bottom-0 left-0 h-0.5 w-full rounded-t-full bg-primary" />}
                </button>
              ))}
            </div>

            <div className="animate-fade-in">
              {activeTab === "facts" && (
                <div className="space-y-10">
                  <div className="grid grid-cols-1 gap-x-20 gap-y-12 md:grid-cols-2">
                    <div className="space-y-4">
                      {keyFactsEntries.length === 0 ? (
                        <p className="text-sm text-muted">No key facts data for this listing.</p>
                      ) : (
                        keyFactsEntries.map((key) => {
                          const val = listing[key];
                          const display = key === "virtualTourURLUnbranded" && typeof val === "string" && val.startsWith("http")
                            ? <a href={val} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">View virtual tour</a>
                            : formatListingValue(key, val);
                          return display != null ? <FactRow key={key} label={(LISTING_LABELS[key] || key) + ":"} value={display} /> : null;
                        })
                      )}
                    </div>
                    <div className="space-y-2 border-l border-border pl-10">
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted">Description</span>
                        <div className="flex-grow bg-border h-px" />
                      </div>
                      <p className="whitespace-pre-line border-l-4 border-primary/10 py-2 pl-6 text-lg font-medium italic leading-relaxed text-muted">
                        {listing.publicRemarks || property.description || "No public remarks available for this property."}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "details" && (
                <div className="space-y-12">
                  <h3 className="text-xl font-black tracking-tight">Details</h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {detailsEntries.length === 0 ? (
                      <p className="text-sm text-muted">No details data for this listing.</p>
                    ) : (
                      detailsEntries.map((key) => {
                        const val = listing[key];
                        const display = key === "virtualTourURLUnbranded" && typeof val === "string" && val.startsWith("http")
                          ? <a href={val} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">View virtual tour</a>
                          : formatListingValue(key, val);
                        return display != null ? <FactRow key={key} label={(LISTING_LABELS[key] || key) + ":"} value={display} /> : null;
                      })
                    )}
                  </div>
                </div>
              )}

              {activeTab === "cashflow" && property?.priceIsMonthly && (
                <div className="space-y-12 rounded-2xl border border-border bg-surface p-10">
                  <h3 className="text-2xl font-black tracking-tight text-foreground">Cash Flow Analysis</h3>
                  <div className="flex flex-col gap-12 lg:flex-row">
                    <div className="flex-grow space-y-8">
                      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider text-muted">Mortgage Payment</span>
                          <p className="mt-1 text-2xl font-black text-foreground">${Math.round(cashFlowMortgagePayment()).toLocaleString()}</p>
                        </div>
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider text-muted">Monthly Payment</span>
                          <p className="mt-1 text-2xl font-black text-foreground">${Math.round(cashFlowMonthlyPayment()).toLocaleString()}</p>
                        </div>
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider text-muted">Break Even Down Payment</span>
                          <p className="mt-1 text-2xl font-black text-foreground">{breakEvenDownPct()}%</p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">Property value (purchase price)</label>
                          <div className="flex rounded-xl border border-border bg-surface-elevated overflow-hidden">
                            <span className="flex items-center bg-border px-4 text-muted">$</span>
                            <input type="number" min={0} step={1000} value={purchasePrice} onChange={(e) => setPurchasePrice(Number(e.target.value) || 0)} className="w-full px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
                          </div>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">Property Tax (Monthly)</label>
                          <div className="flex rounded-xl border border-border bg-surface-elevated overflow-hidden">
                            <span className="flex items-center bg-border px-4 text-muted">$</span>
                            <input type="number" min={0} step={10} value={propertyTaxMonthly} onChange={(e) => setPropertyTaxMonthly(Number(e.target.value) || 0)} className="w-full px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
                          </div>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">Maintenance Cost</label>
                          <div className="flex rounded-xl border border-border bg-surface-elevated overflow-hidden">
                            <span className="flex items-center bg-border px-4 text-muted">$</span>
                            <input type="number" min={0} step={50} value={maintenanceCost} onChange={(e) => setMaintenanceCost(Number(e.target.value) || 0)} className="w-full px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
                          </div>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">Rental Income</label>
                          <div className="flex rounded-xl border border-border bg-surface-elevated overflow-hidden">
                            <span className="flex items-center bg-border px-4 text-muted">$</span>
                            <input type="number" min={0} step={50} value={rentalIncome} onChange={(e) => setRentalIncome(Number(e.target.value) || 0)} className="w-full px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
                          </div>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">Down Payment</label>
                          <div className="flex gap-3">
                            <div className="flex flex-1 rounded-xl border border-border bg-surface-elevated overflow-hidden">
                              <span className="flex items-center bg-border px-4 text-muted">$</span>
                              <input type="number" min={0} step={1000} value={downPaymentAmount()} readOnly className="w-full px-4 py-3 text-foreground bg-transparent" />
                            </div>
                            <div className="flex w-24 rounded-xl border border-border bg-surface-elevated overflow-hidden">
                              <input type="number" min={0} max={100} step={1} value={downPaymentPct} onChange={(e) => setDownPaymentPct(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} className="w-full px-2 py-3 text-center text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
                              <span className="flex items-center pr-2 text-muted text-sm">%</span>
                            </div>
                          </div>
                          <input type="range" min={0} max={100} step={1} value={downPaymentPct} onChange={(e) => setDownPaymentPct(Number(e.target.value))} className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-lg bg-border transition-premium [direction:ltr]" style={{ background: `linear-gradient(to right, var(--color-primary) 0%, var(--color-primary) ${downPaymentPct}%, var(--color-border) ${downPaymentPct}%, var(--color-border) 100%)` }} />
                        </div>
                      </div>
                    </div>
                    <div className="flex w-full flex-col items-center justify-center lg:w-[320px]">
                      <div className="relative h-64 w-64 flex flex-col items-center justify-center">
                        <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="45" fill="none" stroke="var(--color-border)" strokeWidth="8" />
                          <circle
                            cx="50"
                            cy="50"
                            r="45"
                            fill="none"
                            stroke={cashFlowValue() >= 0 ? "var(--color-primary)" : "rgb(239,68,68)"}
                            strokeWidth="8"
                            strokeDasharray={`${282.7 * Math.min(1, Math.abs(cashFlowValue()) / 4000)} 282.7`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="relative text-center">
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted">Cash Flow</span>
                          <p className={`text-3xl font-black tracking-tight ${cashFlowValue() >= 0 ? "text-primary" : "text-red-500"}`}>
                            ${cashFlowValue() >= 0 ? "" : "-"}${Math.abs(Math.round(cashFlowValue())).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "mortgage" && !property?.priceIsMonthly && (
                <div className="space-y-12 rounded-2xl border border-border bg-surface p-10">
                  <div className="flex flex-col gap-16 md:flex-row">
                    <div className="flex-grow space-y-10">
                      <div className="space-y-4">
                        <div className="flex items-end justify-between">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Down Payment</label>
                          <span className="text-2xl font-black">
                            ${downPayment.toLocaleString()} ({Math.round((downPayment / (property.price || 1)) * 100)}%)
                          </span>
                        </div>
                        <input
                          type="range"
                          min={Math.round((property.price ?? 0) * 0.05)}
                          max={Math.round((property.price ?? 0) * 0.9)}
                          step={1000}
                          value={downPayment}
                          onChange={(e) => setDownPayment(Number(e.target.value))}
                          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-border transition-premium accent-primary"
                        />
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-end justify-between">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Interest Rate</label>
                          <span className="text-2xl font-black">{interestRate}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.1"
                          max="15"
                          step="0.1"
                          value={interestRate}
                          onChange={(e) => setInterestRate(parseFloat(e.target.value))}
                          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-border transition-premium accent-primary"
                        />
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-end justify-between">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Amortization</label>
                          <span className="text-2xl font-black">{amortization} Years</span>
                        </div>
                        <input
                          type="range"
                          min="5"
                          max="30"
                          step="5"
                          value={amortization}
                          onChange={(e) => setAmortization(parseInt(e.target.value, 10))}
                          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-border transition-premium accent-primary"
                        />
                      </div>
                    </div>
                    <div className="flex w-full flex-col items-center justify-center space-y-4 rounded-2xl bg-primary p-10 text-center text-white transition-premium hover:[box-shadow:var(--shadow-hover)] md:w-[350px]" style={{ boxShadow: "var(--shadow-elevated)" }}>
                      <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/50">Estimated Monthly</span>
                      <div className="text-6xl font-black tracking-tighter">${Math.round(calculateMonthly()).toLocaleString()}</div>
                      <p className="max-w-[200px] text-[10px] font-bold uppercase tracking-widest text-white/50">
                        Principal and interest only. Subject to credit approval.
                      </p>
                      <button type="button" className="btn-secondary mt-6 w-full rounded-xl border-white/30 bg-white/10 py-4 text-sm font-black uppercase tracking-widest text-white hover:bg-white hover:text-primary">
                        Get Pre-Approved
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Demographics, Schools, Transit — Coming Soon */}
          <section className="animate-fade-in space-y-8 border-t border-border pt-12">
            {[
              { title: "Demographics", desc: "Area demographics and population insights." },
              { title: "Schools Nearby", desc: "Elementary, high schools, colleges, and universities near this listing." },
              { title: "Transit Nearby", desc: "Subway, bus, train, and light rail stations near this listing." },
            ].map((item) => (
              <div key={item.title} className="flex items-center justify-between rounded-2xl border border-border bg-surface/50 px-6 py-5">
                <div>
                  <h3 className="text-base font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-0.5 text-sm text-muted">{item.desc}</p>
                </div>
                <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">Coming soon</span>
              </div>
            ))}
          </section>

          {/* Mobile: price, agent, actions and financial insights before similar listings */}
          <div className="block lg:hidden">
            <FloatingBoxContent
              property={property}
              hasPriceDrop={hasPriceDrop}
              totalSavings={totalSavings}
              savingsPercent={savingsPercent}
              displayBrokerage={displayBrokerage}
              displayAgent={displayAgent}
              displayAgentPhone={displayAgentPhone}
              displayAgentEmail={displayAgentEmail}
              user={user}
              openAuthModal={openAuthModal}
              openChooseAgentModal={openChooseAgentModal}
              effectiveToggleSave={effectiveToggleSave}
              effectiveIsSaved={effectiveIsSaved}
              calculateMonthly={calculateMonthly}
              isAgentOrBroker={isAgentOrBroker}
              hasAgentPro={hasAgentPro}
            />
          </div>

          {/* Similar listings */}
          {(similarActive.length > 0 || similarSold.length > 0) && (
            <section className="animate-fade-in space-y-10 border-t border-border pt-12">
              <div>
                <h2 className="text-3xl font-black tracking-tight text-foreground">Similar listings</h2>
                <p className="mt-1 font-medium text-muted">Similar listings by type from our database.</p>
              </div>

              {similarActive.length > 0 && (
                <div>
                  <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted">Similar listings (active)</h3>
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-4 w-full min-w-0">
                    {similarActive.map((p) => (
                      <div key={p.id} className="origin-top transition-premium hover:scale-[1.02]">
                        <PropertyCard
                          property={p}
                          href={`/listings/${p.id}`}
                          isSaved={savedIds.includes(p.id)}
                          onToggleSave={effectiveToggleSave}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {similarSold.length > 0 && (
                <div>
                  <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted">Similar sold</h3>
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-4 w-full min-w-0">
                    {similarSold.map((p) => (
                      <div key={p.id} className="origin-top transition-premium hover:scale-[1.02]">
                        <PropertyCard
                          property={p}
                          href={`/listings/${p.id}`}
                          isSaved={savedIds.includes(p.id)}
                          onToggleSave={effectiveToggleSave}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        {/* Desktop: render sidebar in portal so it stays fixed and follows scroll */}
        {mounted && useDesktop && typeof document !== "undefined" && createPortal(
          <aside
            aria-label="Listing price and contact"
            className="fixed right-12 top-20 z-[9999] w-[400px] max-h-[calc(100vh-5rem)] overflow-y-auto rounded-2xl border border-border bg-white shadow-[0_4px_24px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.04)] py-8 px-8 sidebar-panel-scroll"
          >
            <FloatingBoxContent
              property={property}
              hasPriceDrop={hasPriceDrop}
              totalSavings={totalSavings}
              savingsPercent={savingsPercent}
              displayBrokerage={displayBrokerage}
              displayAgent={displayAgent}
              displayAgentPhone={displayAgentPhone}
              displayAgentEmail={displayAgentEmail}
              user={user}
              openAuthModal={openAuthModal}
              openChooseAgentModal={openChooseAgentModal}
              effectiveToggleSave={effectiveToggleSave}
              effectiveIsSaved={effectiveIsSaved}
              calculateMonthly={calculateMonthly}
              isAgentOrBroker={isAgentOrBroker}
              hasAgentPro={hasAgentPro}
            />
          </aside>,
          document.body
        )}
        {/* Mobile: FloatingBoxContent is rendered above (before similar listings). Desktop only: in-flow fallback when portal not yet mounted. */}
        {(!mounted || !useDesktop) && (
          <aside className="hidden w-full shrink-0 lg:block lg:w-[400px] lg:self-start" aria-label="Listing price and contact">
            <FloatingBoxContent
              property={property}
              hasPriceDrop={hasPriceDrop}
              totalSavings={totalSavings}
              savingsPercent={savingsPercent}
              displayBrokerage={displayBrokerage}
              displayAgent={displayAgent}
              displayAgentPhone={displayAgentPhone}
              displayAgentEmail={displayAgentEmail}
              user={user}
              openAuthModal={openAuthModal}
              openChooseAgentModal={openChooseAgentModal}
              effectiveToggleSave={effectiveToggleSave}
              effectiveIsSaved={effectiveIsSaved}
              calculateMonthly={calculateMonthly}
              isAgentOrBroker={isAgentOrBroker}
              hasAgentPro={hasAgentPro}
            />
          </aside>
        )}
      </div>
    </div>
  );
}
