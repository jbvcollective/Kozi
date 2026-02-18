"use client";

import { CATEGORIES } from "@/constants/categories";

/**
 * @param {string} activeCategory - Category id (e.g. "all", "new", "value", "luxury", "commercial")
 * @param {(id: string) => void} onSelectCategory
 */
export default function CategoryBar({ activeCategory, onSelectCategory }) {
  return (
    <div className="w-full bg-surface-elevated border-b border-border py-2 md:py-2.5 sm:py-3 lg:py-4 px-2 sm:px-4 md:px-5 lg:px-6 overflow-x-auto no-scrollbar sticky top-14 md:top-0 z-30 transition-premium -ms-2 ps-2 sm:ms-0 sm:ps-0" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-2 sm:gap-4 md:gap-6 lg:gap-8 xl:gap-10 max-w-7xl mx-auto min-w-max">
        {CATEGORIES.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelectCategory(category.id)}
            className={`flex flex-col items-center justify-center min-h-[44px] sm:min-h-0 space-y-1 sm:space-y-2 group transition-premium rounded-lg py-2 px-2 sm:px-3 shrink-0 ${
              activeCategory === category.id ? "opacity-100" : "opacity-60 hover:opacity-100"
            }`}
          >
            <div className={`transition-premium group-hover:scale-105 ${activeCategory === category.id ? "text-primary" : "text-muted"}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={category.icon} />
              </svg>
            </div>
            <span className={`text-xs font-bold tracking-tight ${activeCategory === category.id ? "text-foreground" : "text-muted"}`}>
              {category.label}
            </span>
            <div className={`h-0.5 w-full bg-primary rounded-full transition-premium ${activeCategory === category.id ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"}`} />
          </button>
        ))}
      </div>
    </div>
  );
}
