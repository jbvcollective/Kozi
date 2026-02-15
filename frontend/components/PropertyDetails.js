"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { fetchListings, fetchSchoolsNear, fetchOpenHouseEvents } from "@/lib/api";
import { mapListingToProperty, formatBeds } from "@/lib/propertyUtils";
import { useSaved } from "@/context/SavedContext";
import { useAuth } from "@/context/AuthContext";
import { useChosenAgent } from "@/context/ChosenAgentContext";
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

export default function PropertyDetails({ property, isSaved, onToggleSave, onBack }) {
  const { savedIds, toggleSave } = useSaved();
  const { user, openAuthModal } = useAuth();
  const { chosenAgent, openChooseAgentModal } = useChosenAgent();
  const effectiveToggleSave = onToggleSave ?? toggleSave;
  const displayAgent = chosenAgent?.agentName ?? property?.listingAgent;
  const displayBrokerage = chosenAgent?.brokerage ?? property?.listingBrokerage;
  const displayAgentPhone = chosenAgent?.phone ?? property?.listingAgentPhone;
  const displayAgentEmail = chosenAgent?.email ?? property?.listingAgentEmail;
  const effectiveIsSaved = onToggleSave ? isSaved : savedIds.includes(property?.id);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState("facts");
  const [similarActive, setSimilarActive] = useState([]);
  const [similarSold, setSimilarSold] = useState([]);
  const [schoolsNearby, setSchoolsNearby] = useState([]);
  const [schoolsLoading, setSchoolsLoading] = useState(false);
  const [openHouseEvents, setOpenHouseEvents] = useState([]);

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
        ).slice(0, 3);
        const sold = all.filter(
          (p) => p.id !== property.id && (p.type || "") === (property.type || "") && p.status === "Sold"
        ).slice(0, 3);
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
    fetchSchoolsNear(lat, lng, 20)
      .then((list) => {
        if (!cancelled) setSchoolsNearby(list || []);
      })
      .catch(() => { if (!cancelled) setSchoolsNearby([]); })
      .finally(() => { if (!cancelled) setSchoolsLoading(false); });
    return () => { cancelled = true; };
  }, [property?.lat, property?.lng, property?.type]);

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
    <div className="mx-auto min-h-screen max-w-[1600px] animate-fade-in px-8 pb-32 pt-24 md:px-12">
      {/* Top Navigation Header */}
      <div className="mb-8 flex items-center justify-between border-b border-border pb-4">
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
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2 rounded-lg bg-surface px-3 py-1.5 border border-border">
            <span className="text-[9px] font-black uppercase tracking-widest text-muted">Listing ID</span>
            <span className="text-xs font-black text-foreground">{property.id.substring(0, 10)}</span>
          </div>
          {effectiveToggleSave && (
            <button
              type="button"
              onClick={() => effectiveToggleSave(property.id)}
              className={`flex items-center space-x-2 text-xs font-black uppercase tracking-widest transition-premium active:scale-95 ${effectiveIsSaved ? "text-error" : "text-muted hover:text-foreground"}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill={effectiveIsSaved ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              <span>{effectiveIsSaved ? "Saved" : "Save"}</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-12 lg:flex-row">
        {/* Main Content Column */}
        <div className="flex-grow space-y-12">
          {/* Hero Carousel */}
          <div className="group relative">
            <div className="relative h-[650px] w-full overflow-hidden rounded-3xl bg-surface shimmer-bg transition-premium" style={{ boxShadow: "var(--shadow-elevated)" }}>
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

          {/* Price Performance Section */}
          <section className="animate-fade-in card rounded-3xl border-border bg-surface-elevated p-10">
            <div className="flex flex-col items-center justify-between gap-10 md:flex-row">
              <div className="max-w-2xl flex-grow space-y-6">
                <div>
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.4em] text-orange-500">Price Performance</span>
                  <h2 className="text-4xl font-black tracking-tight">Market Positioning</h2>
                </div>
                <div className="relative pb-6 pt-10">
                  <div className="absolute left-0 top-[2.4rem] h-[2px] w-full bg-gray-100" />
                  <div className="relative z-10 flex items-start justify-between">
                    <div className="flex flex-col items-center text-center">
                      <div className={`h-4 w-4 rounded-full border-2 bg-white ${hasPriceDrop ? "border-gray-200" : "border-black"}`} />
                      <div className="mt-4 space-y-1">
                        <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Original</span>
                        <span className="block text-sm font-bold text-gray-300 line-through">
                          ${((property.originalPrice || property.price) ?? 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    {hasPriceDrop && (
                      <div className="mt-[-10px] flex flex-col items-center animate-bounce">
                        <div className="rounded-xl bg-orange-500 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-white shadow-xl">
                          -{savingsPercent}% Drop
                        </div>
                        <div className="mt-1 h-6 w-px bg-orange-500/30" />
                      </div>
                    )}
                    <div className="flex flex-col items-center text-center">
                      <div className="h-5 w-5 scale-125 rounded-full border-4 border-black bg-white shadow-xl" />
                      <div className="mt-4 space-y-1">
                        <span className="text-[9px] font-black uppercase tracking-widest text-black">Current</span>
                        <span className="block text-2xl font-black text-black">
                          ${(property.price ?? 0).toLocaleString()}
                          {property.priceIsMonthly && " /mo"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {hasPriceDrop && (
                <div className="w-full space-y-4 rounded-[2rem] border border-orange-100 bg-orange-50 p-8 text-center md:w-[280px]">
                  <span className="text-[10px] font-black uppercase tracking-widest text-orange-600/60">Price reduced</span>
                  <div className="flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                    <span className="text-5xl font-black tracking-tighter text-orange-600">${totalSavings.toLocaleString()}</span>
                  </div>
                  <p className="text-[11px] font-bold leading-tight text-orange-800/60">
                    Listed <span className="text-orange-600">{savingsPercent}%</span> below original. You save ${totalSavings.toLocaleString()}.
                  </p>
                  <div className="flex justify-center pt-4">
                    <div className="h-[2px] w-12 bg-orange-200" />
                  </div>
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

          {/* Listing History — HouseSigma-style: dates, price, event, full property details from Supabase */}
          <section className="animate-fade-in space-y-6">
            <div className="space-y-1">
              <h2 className="text-3xl font-black tracking-tight">Listing History</h2>
              <p className="text-sm font-medium text-gray-400">Buy/sell history for {property.location}. All data from listing.</p>
            </div>
            <div className="overflow-x-auto overflow-hidden rounded-2xl border border-border bg-surface-elevated" style={{ boxShadow: "var(--shadow-card)" }}>
              <table className="w-full min-w-[800px] text-left">
                <thead className="border-b border-border bg-surface">
                  <tr>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted">Date Start</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted">Date End</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted">Price</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted">Event</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted">Beds</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted">Baths</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted">Sqft</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted">Garage</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted">Listing ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
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
                        isCurrent: true,
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
                        isCurrent: false,
                      });
                    }
                    return rows.map((row, i) => (
                      <tr key={i} className="transition-premium hover:bg-surface/50">
                        <td className="px-4 py-3 text-sm font-bold text-foreground">{row.dateStart}</td>
                        <td className="px-4 py-3 text-sm font-bold text-foreground">{row.dateEnd}</td>
                        <td className="px-4 py-3 text-sm font-black text-foreground">
                          {property?.priceIsMonthly ? `$${Number(row.price).toLocaleString()}/mo` : `$${Number(row.price).toLocaleString()}`}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded px-2 py-0.5 text-[10px] font-black uppercase ${row.eventClass}`}>{row.event}</span>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-foreground">{row.beds}</td>
                        <td className="px-4 py-3 text-sm font-medium text-foreground">{row.baths}</td>
                        <td className="px-4 py-3 text-sm font-medium text-foreground">{row.sqft}</td>
                        <td className="px-4 py-3 text-sm font-medium text-foreground">{row.garage}</td>
                        <td className="px-4 py-3 font-mono text-sm font-medium text-muted">{row.listingId}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
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

          {/* Demographics — placeholder */}
          <section className="animate-fade-in space-y-4 border-t border-border pt-12">
            <h2 className="text-2xl font-black tracking-tight text-foreground">Demographics</h2>
            <p className="text-sm text-muted">Area demographics for this listing. Data will appear here when available.</p>
            <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-8 text-center text-sm text-muted">
              Demographics data (fill in next time)
            </div>
          </section>

          {/* Schools near this location — only for active residential (not commercial) */}
          {(() => {
            const type = String(property?.type ?? "").toLowerCase();
            const isResidential = !type.includes("commercial");
            if (!isResidential) return null;
            return (
          <section className="animate-fade-in space-y-6 border-t border-border pt-12">
            <h2 className="text-2xl font-black tracking-tight text-foreground">Schools near this location</h2>
            <p className="text-sm text-muted">Within 10 km of this listing (distance from listing latitude/longitude).</p>
            {schoolsLoading ? (
              <div className="flex items-center gap-3 text-muted">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-primary" />
                <span className="text-sm font-medium">Loading schools…</span>
              </div>
            ) : schoolsNearby.length === 0 ? (
              <div className="space-y-2 text-gray-500">
                <p>No schools found for this listing’s location.</p>
                <p className="text-sm">
                  In Supabase, add a table <code className="rounded bg-gray-100 px-1">school_locations</code> or <code className="rounded bg-surface px-1">schools</code> with columns: <code className="rounded bg-surface px-1">lat</code>, <code className="rounded bg-surface px-1">lng</code>, <code className="rounded bg-surface px-1">name</code> (and optional type, address, city, province). Run <code className="rounded bg-surface px-1">sql/schools.sql</code> or <code className="rounded bg-surface px-1">sql/school_locations_rls.sql</code> if you use RLS.
                </p>
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {schoolsNearby.map((school) => (
                  <li
                    key={school.id}
                    className="card flex flex-col rounded-2xl p-5 transition-premium hover:[box-shadow:var(--shadow-elevated)]"
                  >
                    <span className="font-bold text-foreground">{school.name}</span>
                    {school.type && (
                      <span className="mt-0.5 text-xs font-medium uppercase tracking-wider text-muted">{school.type}</span>
                    )}
                    {(school.address || school.city) && (
                      <span className="mt-1 text-sm text-muted">
                        {[school.address, school.city, school.province].filter(Boolean).join(", ")}
                      </span>
                    )}
                    {school.distance_km != null && (
                      <span className="mt-2 text-xs font-medium text-muted">{school.distance_km} km away</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
            );
          })()}

          {/* Similar listings */}
          {(similarActive.length > 0 || similarSold.length > 0) && (
            <section className="animate-fade-in space-y-10 border-t border-border pt-12">
              <div>
                <h2 className="text-3xl font-black tracking-tight text-foreground">Similar listings</h2>
                <p className="mt-1 font-medium text-muted">Matches by type from Lumina Unified.</p>
              </div>

              {similarActive.length > 0 && (
                <div>
                  <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted">Similar listings (active)</h3>
                  <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
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
                  <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
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

        {/* Sticky Action Sidebar */}
        <aside className="w-full lg:w-[400px]">
          <div className="sticky top-24 space-y-6">
            <div className="card rounded-2xl border-2 border-border bg-surface-elevated p-10 transition-premium hover:border-primary/30" style={{ boxShadow: "var(--shadow-elevated)" }}>
              <div className="mb-6">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted">{property.priceIsMonthly ? "Per month" : "List Price"}</span>
                <div className="text-5xl font-black tracking-tighter text-foreground">
                  ${(property.price ?? 0).toLocaleString()}
                  {property.priceIsMonthly && <span className="text-2xl font-bold text-muted">/mo</span>}
                </div>
                {!property.priceIsMonthly && hasPriceDrop && (
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-bold text-muted line-through">${property.originalPrice?.toLocaleString()}</span>
                    <span className="inline-flex items-center gap-1 rounded bg-accent-soft/50 px-2 py-0.5 text-xs font-black text-accent">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                      −${totalSavings.toLocaleString()} ({savingsPercent}%)
                    </span>
                  </div>
                )}
                <div className="mt-4 text-sm font-bold text-muted">{property.location}</div>
                <div className="mt-4 space-y-1 border-t border-border pt-4">
                  <p className="text-xs font-medium text-muted">
                    Brokerage chosen: <span className="font-bold text-foreground">{displayBrokerage || "—"}</span>
                  </p>
                  <p className="text-xs font-medium text-muted">
                    Listing agent: <span className="font-bold text-foreground">{displayAgent || "—"}</span>
                  </p>
                  {displayAgentPhone && (
                    <p className="text-xs font-medium text-muted">
                      <a href={`tel:${displayAgentPhone.replace(/\s/g, "")}`} className="font-bold text-primary hover:underline">
                        {displayAgentPhone}
                      </a>
                    </p>
                  )}
                  {displayAgentEmail && (
                    <p className="text-xs font-medium text-muted">
                      <a href={`mailto:${displayAgentEmail}`} className="font-bold text-primary hover:underline break-all">
                        {displayAgentEmail}
                      </a>
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    if (!user) openAuthModal();
                    else openChooseAgentModal();
                  }}
                  className="btn-primary w-full rounded-xl py-5 text-lg"
                >
                  Contact agent
                </button>
                {effectiveToggleSave && (
                  <button
                    type="button"
                    onClick={() => effectiveToggleSave(property.id)}
                    className={`flex w-full items-center justify-center space-x-3 rounded-xl border-2 py-5 text-lg font-black transition-premium active:scale-[0.98] ${effectiveIsSaved ? "border-error/30 bg-error/5 text-error" : "border-border text-foreground hover:border-primary"}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill={effectiveIsSaved ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    <span>{effectiveIsSaved ? "Saved" : "Save"}</span>
                  </button>
                )}
              </div>
            </div>
            <div className="card rounded-2xl border-border bg-surface p-8">
              <h3 className="mb-4 text-sm font-black uppercase tracking-[0.2em] text-foreground">Financial Insights</h3>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-muted">Monthly Estimate</span>
                  <span className="text-sm font-bold text-foreground">~${Math.round(calculateMonthly()).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-muted">Potential Rent</span>
                  <span className="text-sm font-bold text-foreground">$8,500/mo</span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
