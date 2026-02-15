"use client";

import { useState } from "react";
import Link from "next/link";
import { formatBeds } from "@/lib/propertyUtils";
import { prefetchListingById } from "@/lib/api";
import { useChosenAgent } from "@/context/ChosenAgentContext";

const STATUS_STYLES = {
  Active: "bg-black/40 text-white",
  Sold: "bg-gray-400 text-white",
  "Deal Fell Through": "bg-red-600 text-white animate-pulse shadow-lg",
  "Price Reduced": "bg-orange-500 text-white",
  New: "bg-green-600 text-white",
};

export default function PropertyCard({ property, isSaved, onToggleSave, onClick, href }) {
  const { chosenAgent } = useChosenAgent();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const displayBrokerage = chosenAgent?.brokerage ?? property.listingBrokerage;

  const images = property.images || [property.image].filter(Boolean);
  const currentImage = images[currentImageIndex] || images[0] || property.image;
  const status = property.status || "Active";
  const isReduced = property.originalPrice && property.price < property.originalPrice;
  const reductionAmount = isReduced ? property.originalPrice - property.price : 0;
  const reductionPercent = isReduced && property.originalPrice
    ? Math.round((reductionAmount / property.originalPrice) * 100)
    : 0;
  const statusClass = STATUS_STYLES[status] || STATUS_STYLES.Active;

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
      {/* Full-Width Photo Gallery */}
      <div className="relative aspect-[3/2] overflow-hidden bg-surface shimmer-bg">
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

        {/* Navigation Overlays */}
        {images.length > 1 && (
          <div className="absolute inset-0 flex items-center justify-between px-4 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={prevImage}
              className="rounded-full bg-white/20 p-3 text-white backdrop-blur-xl transition-premium hover:bg-white hover:text-foreground"
              aria-label="Previous photo"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={nextImage}
              className="rounded-full bg-white/20 p-3 text-white backdrop-blur-xl transition-premium hover:bg-white hover:text-foreground"
              aria-label="Next photo"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}

        {/* Status Badge */}
        <div className="pointer-events-none absolute left-4 top-4 flex flex-col gap-2">
          <span className={`rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm backdrop-blur-md ${statusClass}`}>
            {status}
          </span>
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

      {/* Content Section */}
      <div className="flex flex-col space-y-5 p-8">
        <div className="space-y-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-4xl font-black tracking-tighter text-foreground">
              ${(property.price ?? 0).toLocaleString()}
              {property.priceIsMonthly && <span className="text-lg font-bold text-muted">/mo</span>}
            </span>
            {!property.priceIsMonthly && isReduced && (
              <>
                <span className="text-sm font-bold text-muted line-through">
                  ${property.originalPrice.toLocaleString()}
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-orange-50 px-2 py-0.5 text-xs font-black text-orange-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                  −${reductionAmount.toLocaleString()} ({reductionPercent}%)
                </span>
              </>
            )}
          </div>
          <p className="truncate text-lg font-bold leading-tight text-foreground">{property.location}</p>
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
                {property.sqft != null ? property.sqft.toLocaleString() : "—"}
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
            <span className="text-[10px] font-black uppercase tracking-widest text-muted">
              {property.daysOnMarket === 0 || property.daysOnMarket == null ? "Just Listed" : `${property.daysOnMarket}d ago`}
            </span>
          </div>
          {displayBrokerage && (
            <p className="text-[10px] font-medium text-muted truncate" title={displayBrokerage}>
              {displayBrokerage}
            </p>
          )}
        </div>
      </div>
    </>
  );

  const className =
    "group animate-fade-in flex cursor-pointer flex-col overflow-hidden card card-hover border-border bg-surface-elevated transition-premium";

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
