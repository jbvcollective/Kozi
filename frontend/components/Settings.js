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
    <div className="space-y-12">
      {sections.map((section) => (
        <section key={section.title}>
          <h2 className="mb-6 text-xs font-bold uppercase tracking-widest text-muted">
            {section.title}
          </h2>
          <div className="space-y-4">
            {section.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-2xl border border-border bg-surface p-6"
              >
                <div>
                  <h3 className="font-bold text-foreground">{item.label}</h3>
                  <p className="text-sm text-muted">{item.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleItem(section.title, item.id)}
                  className={`relative h-6 w-12 shrink-0 rounded-full transition-colors ${item.active ? "bg-primary" : "bg-border"}`}
                  aria-label={`${item.label}: ${item.active ? "on" : "off"}`}
                >
                  <div
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${item.active ? "left-7" : "left-1"}`}
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
      <div className="mt-12">
        <h2 className="mb-8 text-2xl font-black tracking-tight text-foreground">Settings</h2>
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
