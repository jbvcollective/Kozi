"use client";

import { useState } from "react";

// PropertyType / PropertySubType from listings_unified idx/vow (Canadian MLS / PropTx)
const propertyTypes = [
  "Detached",
  "Semi-Detached",
  "Condo Apartment",
  "Condo Townhouse",
  "Freehold Townhouse",
  "Townhouse",
  "Commercial",
  "Duplex",
  "Triplex",
  "Multiplex",
  "Mobile",
  "Farm",
  "Modernist",
  "Luxury Estates",
];

const filterGroups = [
  { id: "listingType", title: "Listing Type", options: ["For Sale", "For Rent"] },
  { id: "price", title: "Price", options: ["Under $500K", "Under $1M", "$1M - $2M", "$2M - $5M", "$5M - $10M", "$10M+"] },
  { id: "beds", title: "Bedrooms", options: ["Studio", "1+", "2+", "3+", "4+", "5+"] },
  { id: "baths", title: "Bathrooms", options: ["1+", "1.5+", "2+", "3+", "4+"] },
  { id: "sqft", title: "Square Footage", options: ["Under 1,000", "1,000 - 2,000", "2,000 - 3,000", "3,000 - 5,000", "5,000+"] },
  { id: "amenities", title: "Amenities", options: ["Pool", "Parking", "Garage", "Gym", "Waterfront", "Guest House", "Concierge", "Smart Home"] },
  { id: "status", title: "Status", options: ["Active", "New", "Price Reduced", "Sold Conditional", "New Construction"] },
];

function priceLabelToRange(label) {
  if (!label) return {};
  if (label === "Under $500K") return { maxPrice: 500_000 };
  if (label === "Under $1M") return { maxPrice: 1_000_000 };
  if (label === "$1M - $2M") return { minPrice: 1_000_000, maxPrice: 2_000_000 };
  if (label === "$2M - $5M") return { minPrice: 2_000_000, maxPrice: 5_000_000 };
  if (label === "$5M - $10M") return { minPrice: 5_000_000, maxPrice: 10_000_000 };
  if (label === "$10M+") return { minPrice: 10_000_000 };
  return {};
}

function bedsLabelToMin(label) {
  if (!label) return null;
  const m = label.match(/^(\d+)\+/);
  if (m) return Number(m[1]);
  if (label === "Studio") return 0;
  return null;
}

function bathsLabelToMin(label) {
  if (!label) return null;
  const m = label.match(/^([\d.]+)\+/);
  if (m) return Number(m[1]);
  return null;
}

function sqftLabelToRange(label) {
  if (!label) return {};
  if (label === "Under 1,000") return { maxSqft: 1000 };
  if (label === "1,000 - 2,000") return { minSqft: 1000, maxSqft: 2000 };
  if (label === "2,000 - 3,000") return { minSqft: 2000, maxSqft: 3000 };
  if (label === "3,000 - 5,000") return { minSqft: 3000, maxSqft: 5000 };
  if (label === "5,000+") return { minSqft: 5000 };
  return {};
}

export default function FilterSidebar({ isVisible, onFilterChange }) {
  const [openSections, setOpenSections] = useState(["listingType", "price", "beds", "baths"]);
  const [selected, setSelected] = useState({
    propertyType: null,
    listingType: null,
    price: null,
    beds: null,
    baths: null,
    sqft: null,
    amenities: [],
    status: null,
  });

  const toggleSection = (id) => {
    setOpenSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleOptionClick = (groupId, option) => {
    const isMulti = groupId === "amenities";
    setSelected((prev) => {
      const next = { ...prev };
      if (groupId === "propertyType") {
        next.propertyType = prev.propertyType === option ? null : option;
      } else if (isMulti) {
        next.amenities = prev.amenities.includes(option)
          ? prev.amenities.filter((a) => a !== option)
          : [...prev.amenities, option];
      } else {
        const current = prev[groupId];
        next[groupId] = current === option ? null : option;
      }
      if (onFilterChange) {
        const priceRange = priceLabelToRange(next.price);
        const bedsMin = bedsLabelToMin(next.beds);
        const bathsMin = bathsLabelToMin(next.baths);
        const sqftRange = sqftLabelToRange(next.sqft);
        const forRent = next.listingType === "For Rent";
        const forSale = next.listingType === "For Sale";
        onFilterChange({
          minPrice: priceRange.minPrice ?? null,
          maxPrice: priceRange.maxPrice ?? null,
          beds: bedsMin,
          baths: bathsMin,
          minSqft: sqftRange.minSqft ?? null,
          maxSqft: sqftRange.maxSqft ?? null,
          type: next.propertyType || null,
          listingType: next.listingType || null,
          forRent: forRent || null,
          forSale: forSale || null,
          priceLabel: next.price,
          bedsLabel: next.beds,
          bathsLabel: next.baths,
          sqftLabel: next.sqft,
          amenities: next.amenities,
          statusLabel: next.status,
        });
      }
      return next;
    });
  };

  if (!isVisible) return null;

  return (
    <aside className="w-64 flex-shrink-0 pr-12 hidden md:block">
      <div className="space-y-1 mb-10">
        {propertyTypes.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => handleOptionClick("propertyType", cat)}
            className={`block w-full text-left py-2 px-3 rounded-lg text-[15px] font-medium transition-premium ${selected.propertyType === cat ? "text-primary font-bold bg-primary/5" : "text-muted hover:text-foreground hover:bg-surface"}`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="space-y-4 border-t border-border pt-6">
        {filterGroups.map((group) => (
          <div key={group.id} className="border-b border-border pb-4">
            <button
              type="button"
              onClick={() => toggleSection(group.id)}
              className="flex items-center justify-between w-full group py-2 rounded-lg hover:bg-surface transition-premium"
            >
              <span className="text-[15px] font-medium text-foreground">{group.title}</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-4 w-4 text-muted transition-premium ${openSections.includes(group.id) ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {openSections.includes(group.id) && (
              <div className="mt-4 space-y-2 animate-fade-in">
                {group.options.map((option) => {
                  const isSelected =
                    group.id === "amenities"
                      ? selected.amenities.includes(option)
                      : selected[group.id] === option;
                  return (
                    <label key={option} className="flex items-center space-x-3 cursor-pointer group py-1">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.preventDefault();
                          handleOptionClick(group.id, option);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleOptionClick(group.id, option);
                          }
                        }}
                        className={`w-5 h-5 border rounded-md flex items-center justify-center transition-premium group-hover:border-primary ${
                          isSelected ? "border-primary bg-primary" : "border-border"
                        }`}
                      >
                        {isSelected ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <div className="w-2 h-2 bg-primary rounded-sm opacity-0 group-hover:opacity-30" />
                        )}
                      </div>
                      <span className="text-sm font-normal text-foreground group-hover:text-primary">{option}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
