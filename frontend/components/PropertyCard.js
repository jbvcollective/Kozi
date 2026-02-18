"use client";

import { useState } from "react";
import Link from "next/link";
import { formatBeds, formatDaysOnMarket } from "@/lib/propertyUtils";
import { prefetchListingById } from "@/lib/api";
import { useChosenAgent } from "@/context/ChosenAgentContext";
import { useLinkedAgent } from "@/context/LinkedAgentContext";
import { useAgentPro } from "@/hooks/useAgentPro";

export default function PropertyCard({ property, isSaved, onToggleSave, onClick, href }) {
  const { chosenAgent } = useChosenAgent();
  const { linkedAgent } = useLinkedAgent();
  const { hasAgentPro, selfAgentProfile } = useAgentPro();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  // Only override with agent info when they have paid (Agent Pro); otherwise use listing's agent.
  const useLinkedAsAgent = linkedAgent?.hasAgentPro && linkedAgent?.name;
  const useChosenAsAgent = chosenAgent?.hasAgentPro && chosenAgent?.agentName;
  const useSelfAsAgent = hasAgentPro && selfAgentProfile?.name;
  const displayAgent = useLinkedAsAgent ? linkedAgent.name : useChosenAsAgent ? chosenAgent.agentName : useSelfAsAgent ? selfAgentProfile.name : property.listingAgent;
  const displayBrokerage = useLinkedAsAgent ? linkedAgent.brokerage : useChosenAsAgent ? chosenAgent.brokerage : useSelfAsAgent ? selfAgentProfile.brokerage : property.listingBrokerage;

  const images = property.images || [property.image].filter(Boolean);
  const currentImage = images[currentImageIndex] || images[0] || property.image;
  const isReduced = property.originalPrice && property.price < property.originalPrice;
  const reductionAmount = isReduced ? property.originalPrice - property.price : 0;
  const reductionPercent = isReduced && property.originalPrice
    ? Math.round((reductionAmount / property.originalPrice) * 100)
    : 0;

  const handleSave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onToggleSave) onToggleSave(property.id);
  };

  const nextImage = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setImageLoaded(false);
    setCurrentImageIndex((prev) => (prev + 1) % (images.length || 1));
  };

  const prevImage = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setImageLoaded(false);
    setCurrentImageIndex((prev) => (prev - 1 + (images.length || 1)) % (images.length || 1));
  };

  const content = (
    <>
      {/* Full-Width Photo Gallery – fixed aspect for consistent card width/height */}
      <div className="relative aspect-[3/2] shrink-0 overflow-hidden bg-surface shimmer-bg">
        {currentImage ? (
          <img
            src={currentImage}
            alt={property.title || property.location}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            className={`h-full w-full object-cover transition-premium duration-700 group-hover:scale-[1.04] ${imageLoaded ? "opacity-100" : "opacity-0"}`}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400">No photo</div>
        )}

        {/* Navigation Overlays: visible on touch (mobile), hover on desktop */}
        {images.length > 1 && (
          <div className="absolute inset-0 flex items-center justify-between px-2 sm:px-4 opacity-100 sm:opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={prevImage}
              className="rounded-full bg-white/20 min-h-[44px] min-w-[44px] flex items-center justify-center p-2.5 sm:p-3 text-white backdrop-blur-xl transition-premium hover:bg-white hover:text-foreground active:scale-95"
              aria-label="Previous photo"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={nextImage}
              className="rounded-full bg-white/20 min-h-[44px] min-w-[44px] flex items-center justify-center p-2.5 sm:p-3 text-white backdrop-blur-xl transition-premium hover:bg-white hover:text-foreground active:scale-95"
              aria-label="Next photo"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}

        {/* Badges: price drop and open house only (no status) */}
        <div className="pointer-events-none absolute left-4 top-4 flex flex-col gap-2">
          {isReduced && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-orange-600 shadow-sm backdrop-blur-md">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              −${reductionAmount.toLocaleString()} ({reductionPercent}%)
            </span>
          )}
          {property.openHouse && (
            <span className="rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-green-700 shadow-sm backdrop-blur-md">
              {property.openHouse.length > 32 ? `${property.openHouse.slice(0, 32)}…` : property.openHouse}
            </span>
          )}
        </div>

        {/* Favorite Button */}
        {onToggleSave && (
          <div className="absolute right-4 top-4 z-10">
            <button
              type="button"
              onClick={handleSave}
              className={`rounded-full p-3 backdrop-blur-xl transition-premium active:scale-90 ${isSaved ? "bg-error text-white" : "bg-white/30 text-white hover:bg-white hover:text-error"}`}
              aria-label={isSaved ? "Unsave" : "Save"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill={isSaved ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>
          </div>
        )}

        {/* Listing ID overlay */}
        {property.id && (
          <div className="absolute bottom-4 left-4 rounded-lg bg-black/40 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-white/70 backdrop-blur-md">
            ID: {property.id.substring(0, 8)}
          </div>
        )}
      </div>

      {/* Content Section – fixed min height so all cards align in grid */}
      <div className="flex min-h-[240px] flex-col space-y-5 p-8">
        <div className="space-y-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-4xl font-black tracking-tighter text-foreground">
              ${(property.price ?? 0).toLocaleString()}
              {property.priceIsMonthly && <span className="text-lg font-bold text-muted">/mo</span>}
            </span>
            {isReduced && (
              <>
                <span className="text-sm font-bold text-muted line-through">
                  ${property.originalPrice.toLocaleString()}
                  {property.priceIsMonthly && <span className="text-muted">/mo</span>}
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-orange-50 px-2 py-0.5 text-xs font-black text-orange-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                  −{reductionPercent}%
                </span>
              </>
            )}
          </div>
          <p className="min-h-[4.25rem] text-lg font-bold leading-tight text-foreground break-words line-clamp-4" title={property.location}>{property.location}</p>
        </div>

        {/* Quick Stats Bar: housing = Beds, Baths, Garage; rentals = Beds, Baths, Sqft */}
        <div className="no-scrollbar flex items-center space-x-3 overflow-x-auto border-y border-border py-4">
          <div className="flex items-center space-x-1 whitespace-nowrap">
            <span className="text-sm font-black text-foreground">{formatBeds(property)}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Beds</span>
          </div>
          <span className="text-sm text-border">·</span>
          <div className="flex items-center space-x-1 whitespace-nowrap">
            <span className="text-sm font-black text-foreground">{property.baths ?? "—"}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Baths</span>
          </div>
          <span className="text-sm text-border">·</span>
          {property.priceIsMonthly ? (
            <div className="flex items-center space-x-1 whitespace-nowrap">
              <span className="text-sm font-black text-foreground">
                {property.livingAreaRange
                  ? (property.livingAreaRange.includes("sq ft") ? property.livingAreaRange : `${property.livingAreaRange} sq ft`)
                  : (property.sqft != null && property.sqft > 0) ? property.sqft.toLocaleString() : "—"}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Sqft</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1 whitespace-nowrap">
              <span className="text-sm font-black text-foreground">{property.parking ?? "—"}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Garage</span>
            </div>
          )}
        </div>

        {/* Secondary Info: type, list office, DOM */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="rounded bg-surface px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-muted">
              {property.type || "Property"}
            </span>
            <span
              className={
                formatDaysOnMarket({ listedAt: property.listedAt, daysOnMarket: property.daysOnMarket }) === "Just Listed"
                  ? "rounded-md bg-emerald-500/15 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-400"
                  : "rounded-md bg-amber-500/12 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
              }
              title="Days on market"
            >
              {formatDaysOnMarket({ listedAt: property.listedAt, daysOnMarket: property.daysOnMarket })}
            </span>
          </div>
          {(displayAgent || displayBrokerage) && (
            <div className="flex flex-col gap-0.5">
              {displayAgent && (
                <p className="text-[11px] font-bold text-error truncate" title={displayAgent}>
                  {displayAgent}
                </p>
              )}
              {displayBrokerage && (
                <p className="text-[10px] font-medium text-muted truncate" title={displayBrokerage}>
                  {displayBrokerage}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );

  const className =
    "group animate-fade-in flex h-full min-h-[520px] cursor-pointer flex-col overflow-hidden card card-hover border-border bg-surface-elevated transition-premium";

  const handlePrefetch = () => {
    if (property?.id && href?.startsWith?.("/listings/")) prefetchListingById(property.id);
  };

  if (href) {
    return (
      <Link href={href} className={className} onMouseEnter={handlePrefetch} onFocus={handlePrefetch}>
        {content}
      </Link>
    );
  }

  return (
    <div
      className={className}
      onClick={() => onClick?.(property)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.(property);
        }
      }}
    >
      {content}
    </div>
  );
}
