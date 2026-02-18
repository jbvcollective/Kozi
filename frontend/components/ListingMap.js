"use client";

/**
 * Location section: heading and address only.
 */
export default function ListingMap({ property }) {
  const address = property?.location || "";
  if (!address) return null;

  return (
    <section className="animate-fade-in space-y-4 rounded-2xl border border-border bg-surface-elevated p-6" style={{ boxShadow: "var(--shadow-card)" }}>
      <h2 className="text-xl font-black tracking-tight text-foreground">Location</h2>
      <p className="text-foreground font-medium">{address}</p>
    </section>
  );
}
