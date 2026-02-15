"use client";

import { useState } from "react";

function getAddress(row) {
  if (row.UnparsedAddress) return row.UnparsedAddress;
  const parts = [row.StreetNumber, row.StreetName, row.StreetDirSuffix, row.StreetSuffix].filter(Boolean);
  const street = parts.join(" ").trim();
  const city = row.City || row.Municipality;
  const prov = row.StateOrProvince || row.Province;
  const pc = row.PostalCode;
  return [street, city, prov, pc].filter(Boolean).join(", ") || row.ListingKey || "—";
}

const STATUS_STYLES = {
  Active: "bg-black/40 text-white",
  Sold: "bg-gray-400 text-white",
  "Deal Fell Through": "bg-red-600 text-white animate-pulse shadow-lg",
  "Price Reduced": "bg-orange-500 text-white",
  New: "bg-green-600 text-white",
};

export default function ListingCard({ listing, index, isSaved, onToggleSave, onClick }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);

  const id = listing.listing_key || listing.ListingKey || "";
  const images = listing.photos || [];
  const priceNum = Number(listing.ListPrice);
  const originalPriceNum = Number(listing.OriginalListPrice || listing.PreviousListPrice);
  const price = !isNaN(priceNum) && priceNum > 0 ? priceNum : null;
  const originalPrice = !isNaN(originalPriceNum) && originalPriceNum > 0 ? originalPriceNum : null;
  const isReduced = originalPrice != null && price != null && price < originalPrice;
  const reductionAmount = isReduced ? originalPrice - price : 0;

  const status = (listing.StandardStatus || listing.MlsStatus || listing.ListingContractStatus || "Active").trim();
  const statusClass = STATUS_STYLES[status] || STATUS_STYLES.Active;

  const location = getAddress(listing);
  const beds = listing.BedroomsTotal ?? listing.BedroomsAboveGrade ?? "—";
  const baths = listing.BathroomsTotalInteger ?? "—";
  const sqft = listing.BuildingAreaTotal != null ? Number(listing.BuildingAreaTotal) : null;
  const parking = listing.ParkingSpaces ?? listing.GarageParkingSpaces ?? listing.ParkingTotal ?? "—";
  const type = [listing.PropertyType, listing.PropertySubType].filter(Boolean).join(" · ") || "Property";
  const daysOnMarket = listing.DaysOnMarket != null ? parseInt(listing.DaysOnMarket, 10) : null;
  const daysLabel = daysOnMarket === 0 || daysOnMarket === null ? "Just Listed" : `${daysOnMarket}d ago`;

  const currentImage = images[currentImageIndex] || images[0];

  const handleSave = (e) => {
    e.stopPropagation();
    if (onToggleSave) onToggleSave(id);
  };

  const nextImage = (e) => {
    e.stopPropagation();
    setImageLoaded(false);
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = (e) => {
    e.stopPropagation();
    setImageLoaded(false);
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleClick = () => {
    if (onClick) onClick(listing);
  };

  return (
    <div
      className="animate-fade-in group flex cursor-pointer flex-col overflow-hidden rounded-[2rem] border border-gray-100 bg-white transition-all duration-500 hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.15)]"
      style={{ animationDelay: `${(index ?? 0) * 75}ms` }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleClick(); } }}
    >
      {/* Full-Width Photo Gallery */}
      <div className="relative aspect-[3/2] overflow-hidden bg-gray-50 shimmer-bg">
        {currentImage ? (
          <img
            src={currentImage}
            alt={location}
            loading="lazy"
            referrerPolicy="no-referrer"
            onLoad={() => setImageLoaded(true)}
            className={`h-full w-full object-cover transition-all duration-1000 group-hover:scale-110 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
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
              className="rounded-full bg-white/20 p-3 text-white backdrop-blur-xl transition-all hover:bg-white hover:text-black"
              aria-label="Previous photo"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={nextImage}
              className="rounded-full bg-white/20 p-3 text-white backdrop-blur-xl transition-all hover:bg-white hover:text-black"
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
          {isReduced && status !== "Price Reduced" && (
            <span className="rounded-full bg-white/90 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-red-600 shadow-sm backdrop-blur-md">
              Drop: -${reductionAmount.toLocaleString()}
            </span>
          )}
        </div>

        {/* Favorite Button */}
        {onToggleSave && (
          <div className="absolute right-4 top-4 z-10">
            <button
              type="button"
              onClick={handleSave}
              className={`rounded-full p-3 backdrop-blur-xl transition-all active:scale-90 ${isSaved ? "bg-red-500 text-white shadow-xl" : "bg-white/30 text-white hover:bg-white hover:text-red-500"}`}
              aria-label={isSaved ? "Unsave" : "Save"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill={isSaved ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>
          </div>
        )}

        {/* Listing ID overlay */}
        {id && (
          <div className="absolute bottom-4 left-4 rounded-lg bg-black/40 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-white/70 backdrop-blur-md">
            ID: {id.substring(0, 8)}
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="flex flex-col space-y-5 p-8">
        <div className="space-y-1">
          <div className="flex items-baseline space-x-2">
            {price != null ? (
              <>
                <span className="text-4xl font-black tracking-tighter text-black">
                  ${price.toLocaleString()}
                </span>
                {originalPrice != null && originalPrice > price && (
                  <span className="text-sm font-bold text-gray-300 line-through">
                    ${originalPrice.toLocaleString()}
                  </span>
                )}
              </>
            ) : (
              <span className="text-lg font-bold text-gray-500">
                {listing.ListPriceUnit ? "Price on request" : "—"}
              </span>
            )}
          </div>
          <p className="truncate text-lg font-bold leading-tight text-gray-900">{location}</p>
        </div>

        {/* Quick Stats Bar */}
        <div className="no-scrollbar flex items-center space-x-3 overflow-x-auto border-y border-gray-50 py-4">
          <div className="flex items-center space-x-1 whitespace-nowrap">
            <span className="text-sm font-black text-black">{beds}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Beds</span>
          </div>
          <span className="text-sm text-gray-200">·</span>
          <div className="flex items-center space-x-1 whitespace-nowrap">
            <span className="text-sm font-black text-black">{baths}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Baths</span>
          </div>
          <span className="text-sm text-gray-200">·</span>
          <div className="flex items-center space-x-1 whitespace-nowrap">
            <span className="text-sm font-black text-black">{sqft != null ? sqft.toLocaleString() : "—"}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Sqft</span>
          </div>
          <span className="text-sm text-gray-200">·</span>
          <div className="flex items-center space-x-1 whitespace-nowrap">
            <span className="text-sm font-black text-black">{parking}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Pkg</span>
          </div>
        </div>

        {/* Secondary Info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="rounded bg-gray-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-gray-400">
              {type}
            </span>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">
            {daysLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
