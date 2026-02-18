"use client";

import { useState } from "react";

const DEFAULT_SECTIONS = [
  {
    title: "Preferences",
    items: [
      { id: "darkMode", label: "Dark Mode", description: "Switch to a darker interface", active: false },
      { id: "mapView", label: "Map View", description: "Show map by default in search", active: true },
    ],
  },
  {
    title: "Notifications",
    items: [
      { id: "priceAlerts", label: "Price Alerts", description: "Get notified when prices drop", active: true },
      { id: "newListings", label: "New Listings", description: "Daily summary of new matches", active: true },
    ],
  },
];

export default function Settings({ embedded = false }) {
  const [sections, setSections] = useState(DEFAULT_SECTIONS);

  const toggleItem = (sectionTitle, itemId) => {
    setSections((prev) =>
      prev.map((section) =>
        section.title === sectionTitle
          ? {
              ...section,
              items: section.items.map((item) =>
                item.id === itemId ? { ...item, active: !item.active } : item
              ),
            }
          : section
      )
    );
  };

  const content = (
    <div className={embedded ? "space-y-8" : "grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-12"}>
      {sections.map((section) => (
        <section key={section.title}>
          <h2 className="mb-5 text-[11px] font-bold uppercase tracking-widest text-muted">
            {section.title}
          </h2>
          <div className="space-y-3">
            {section.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-foreground">{item.label}</h3>
                  <p className="mt-0.5 text-sm leading-snug text-muted">{item.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleItem(section.title, item.id)}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${item.active ? "bg-primary" : "bg-border"}`}
                  aria-label={`${item.label}: ${item.active ? "on" : "off"}`}
                >
                  <span
                    className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-200 ${item.active ? "translate-x-5" : "translate-x-0"}`}
                  />
                </button>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );

  if (embedded) {
    return (
      <div className="rounded-2xl border border-border bg-surface/50 p-6 shadow-sm lg:p-8">
        <h2 className="mb-6 text-2xl font-black tracking-tight text-foreground">Settings</h2>
        {content}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl animate-fade-in px-8 pb-32 pt-24 md:px-12">
      <h1 className="mb-12 text-4xl font-black text-foreground">Settings</h1>
      {content}
    </div>
  );
}
