"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { fetchListings, fetchOpenHouseEvents } from "@/lib/api";
import { mapListingToProperty, formatBeds } from "@/lib/propertyUtils";
import { haversineKm } from "@/lib/geo";
import PropertyMap from "@/components/PropertyMap";
import Loading from "@/components/Loading";
import RequireAuth from "@/components/RequireAuth";
import { useAuth } from "@/context/AuthContext";
import { useChosenAgent } from "@/context/ChosenAgentContext";

const DEFAULT_CENTER = { lat: 43.6532, lng: -79.3832 };

/** Format open_house_events row for display (from Supabase). */
function formatOpenHouseEvent(event) {
  if (!event || !event.start_ts) return null;
  try {
    const start = new Date(event.start_ts);
    const end = event.end_ts ? new Date(event.end_ts) : null;
    const day = start.toLocaleDateString("en-CA", { weekday: "short" });
    const startStr = start.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit", hour12: true });
    const endStr = end ? end.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit", hour12: true }) : null;
    return endStr ? `Open ${day} ${startStr}–${endStr}` : `Open ${day} ${startStr}`;
  } catch {
    return event.remarks || "Open house";
  }
}

/** Build display label for a property: prefer Supabase events, then property.openHouse from feed. */
function getOpenHouseLabel(property, eventsByListing) {
  const events = eventsByListing[property.id] || [];
  if (events.length > 0) {
    return events.map(formatOpenHouseEvent).filter(Boolean).join(" · ") || "Open house";
  }
  return property.openHouse || null;
}

export default function OpenHousesPage() {
  return (
    <RequireAuth>
      <OpenHousesPageContent />
    </RequireAuth>
  );
}

function OpenHousesPageContent() {
  const { user } = useAuth();
  const { openChooseAgentModal, openClaimAsAgentModal } = useChosenAgent();
  const isAgentOrBroker = user?.user_metadata?.user_type === "agent";
  const [listings, setListings] = useState([]);
  const [openHouseEvents, setOpenHouseEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchListings(), fetchOpenHouseEvents()])
      .then(([rows, events]) => {
        if (cancelled) return;
        const mapped = (rows || []).map(mapListingToProperty);
        setListings(mapped);
        setOpenHouseEvents(events || []);
      })
      .catch(() => {
        if (!cancelled) {
          setListings([]);
          setOpenHouseEvents([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setUserLocation(DEFAULT_CENTER);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        setLocationError("Location not available");
        setUserLocation(DEFAULT_CENTER);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 }
    );
  }, []);

  const eventsByListing = useMemo(() => {
    const map = {};
    (openHouseEvents || []).forEach((e) => {
      if (!e.listing_key) return;
      if (!map[e.listing_key]) map[e.listing_key] = [];
      map[e.listing_key].push(e);
    });
    return map;
  }, [openHouseEvents]);

  const withDistance = useMemo(() => {
    const center = userLocation || DEFAULT_CENTER;
    const withOpenHouse = listings.filter((p) => {
      const events = eventsByListing[p.id] || [];
      const fromFeed = p.openHouse;
      const hasOpenHouse = events.length > 0 || (fromFeed && fromFeed.trim());
      if (!hasOpenHouse) return false;
      const hasListingCoords = p.lat != null && p.lng != null;
      const hasEventCoords = events.some((e) => (e.data?.lat ?? e.lat) != null && (e.data?.lng ?? e.lng) != null);
      return hasListingCoords || hasEventCoords;
    });
    return withOpenHouse
      .map((p) => {
        const label = getOpenHouseLabel(p, eventsByListing);
        const events = eventsByListing[p.id] || [];
        const firstWithLocation = events.find((e) => (e.data?.lat ?? e.lat) != null && (e.data?.lng ?? e.lng) != null);
        const firstWithAddress = events.find((e) => e.data?.address ?? e.address);
        const displayLat = p.lat ?? firstWithLocation?.data?.lat ?? firstWithLocation?.lat ?? null;
        const displayLng = p.lng ?? firstWithLocation?.data?.lng ?? firstWithLocation?.lng ?? null;
        const displayAddress = ((firstWithAddress?.data?.address ?? firstWithAddress?.address) || p.location || p.title || "").trim() || "—";
        return {
          ...p,
          lat: displayLat ?? p.lat,
          lng: displayLng ?? p.lng,
          location: displayAddress !== "—" ? displayAddress : p.location,
          distanceKm: (displayLat != null && displayLng != null) ? haversineKm(center.lat, center.lng, displayLat, displayLng) : null,
          openHouseLabel: label,
          openHouseEvents: events,
        };
      })
      .sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
  }, [listings, userLocation, eventsByListing]);

  const selected = selectedId ? withDistance.find((p) => p.id === selectedId) : null;
  const selectProperty = useCallback((property) => setSelectedId(property?.id ?? null), []);

  // On mobile, ensure scroll is at top so the page header and "Coming soon" block are visible
  useEffect(() => {
    if (loading) return;
    const wrapper = document.querySelector("[data-sidebar-content]");
    if (wrapper && typeof wrapper.scrollTo === "function") wrapper.scrollTo({ top: 0, behavior: "auto" });
  }, [loading]);

  if (loading) {
    return (
      <Loading
        variant="screen"
        size="md"
        message="Loading open houses..."
        className="min-h-[60vh] px-4 pt-24 md:px-6 md:pt-24 lg:px-8 xl:px-12"
      />
    );
  }

  return (
    <div className="flex min-h-0 w-full flex-col animate-fade-in md:flex-row md:h-[100dvh] md:max-h-[100dvh]" style={{ minHeight: "100dvh" }}>
      <aside className="flex min-h-0 w-full flex-col border-r border-gray-100 bg-white md:w-[420px] md:min-w-[380px] md:max-h-[100dvh] pt-16 md:pt-0">
        <div className="shrink-0 border-b border-gray-100 px-6 py-5">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-black tracking-tight text-black">Open Houses</h1>
            <button
              type="button"
              className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-50 hover:text-black"
              title="More options"
              aria-label="More options"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
          </div>
          <p className="mt-1 text-sm font-medium text-gray-400">
            {userLocation && !locationError
              ? "Sorted by distance from your location"
              : "Enable location to sort by distance"}
          </p>
        </div>

        <div className="min-h-0 flex-1">
          {withDistance.length === 0 ? (
            <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 py-12 text-center pt-16 md:pt-20 md:min-h-0 md:py-20">
              <h2 className="text-3xl font-black tracking-tight text-[var(--primary)] md:text-4xl">Coming soon</h2>
              <p className="mt-4 max-w-md text-[var(--muted)]">
                Open house listings will be available here shortly.
              </p>
              <Link href="/profile" className="btn-primary mt-8 inline-block rounded-xl px-6 py-3 text-sm font-bold">
                Back to profile
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {withDistance.map((property) => {
                const isExpanded = expandedId === property.id;
                const isSelected = selectedId === property.id;
                const label = property.openHouseLabel || "Open house";
                return (
                  <li key={property.id} className="transition-colors hover:bg-gray-50/50">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(property.id);
                        setExpandedId((prev) => (prev === property.id ? null : property.id));
                      }}
                      className="w-full px-6 py-4 text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold text-black">{property.location || property.title}</p>
                          <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-gray-400">
                            ID: {property.id.substring(0, 12)}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                            isSelected ? "bg-black text-white" : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {label}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-sm font-bold text-gray-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {property.distanceKm != null ? (
                          <span className="text-black">{property.distanceKm} km from you</span>
                        ) : (
                          <span>— km</span>
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="animate-fade-in border-t border-gray-50 bg-gray-50/50 px-6 pb-4 pt-2">
                        <div className="space-y-3 text-sm">
                          {property.openHouseEvents.length > 0 && (
                            <div>
                              <span className="font-bold text-gray-500">Open house</span>
                              <ul className="mt-1 space-y-1">
                                {property.openHouseEvents.map((e) => (
                                  <li key={e.id} className="font-medium text-black">
                                    {formatOpenHouseEvent(e) || (e.remarks && ` ${e.remarks}`) || "—"}
                                    {(e.data?.address ?? e.address) && <span className="block mt-0.5 text-xs text-gray-500">{e.data?.address ?? e.address}</span>}
                                    {(e.data?.open_house_url ?? e.open_house_url) && (
                                      <a href={e.data?.open_house_url ?? e.open_house_url} target="_blank" rel="noopener noreferrer" className="block mt-1 text-xs font-bold text-primary hover:underline">Open house link</a>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {property.openHouse && !property.openHouseEvents.length && (
                            <div>
                              <span className="font-bold text-gray-500">Open house</span>
                              <p className="mt-1 font-medium text-black">{property.openHouse}</p>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="font-bold text-gray-500">Price</span>
                            <span className="font-black text-black">${(property.price ?? 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-bold text-gray-500">Beds · Baths</span>
                            <span className="font-black text-black">{formatBeds(property)} · {property.baths ?? "—"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-bold text-gray-500">Distance</span>
                            <span className="font-black text-black">{property.distanceKm != null ? `${property.distanceKm} km` : "—"}</span>
                          </div>
                          <div className="flex gap-2 pt-2">
                            <Link
                              href={`/listings/${property.id}`}
                              className="flex-1 rounded-xl bg-black py-2.5 text-center text-xs font-black text-white transition-colors hover:bg-gray-800"
                            >
                              View details
                            </Link>
                            <button
                              type="button"
                              onClick={openChooseAgentModal}
                              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-center text-xs font-black text-black transition-colors hover:border-black"
                            >
                              Contact agent
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      <div className="relative min-h-0 flex-1 flex flex-col bg-gray-100">
        {locationError && (
          <div className="absolute left-4 top-4 z-[1000] rounded-xl bg-amber-50 px-4 py-2 text-xs font-bold text-amber-800 shadow-lg">
            Using default location. Enable location for “from you” distances.
          </div>
        )}
        <div className="min-h-0 flex-1 w-full min-h-[400px]">
          <PropertyMap properties={withDistance} onSelectProperty={selectProperty} />
        </div>

        {selected && (
          <div className="absolute bottom-0 left-0 right-0 z-[1000] border-t border-gray-200 bg-white/95 p-6 shadow-[0_-20px_60px_-15px_rgba(0,0,0,0.1)] backdrop-blur-md">
            <div className="mx-auto flex max-w-[1600px] flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                  {selected.openHouseLabel || "Open house"}
                </p>
                <h3 className="mt-1 text-xl font-black tracking-tight text-black">{selected.location || selected.title}</h3>
                <p className="mt-2 text-sm font-bold text-gray-500">
                  From your location: <span className="text-black">{selected.distanceKm != null ? `${selected.distanceKm} km` : "—"}</span>
                </p>
                <p className="text-xs text-gray-400">List price: ${(selected.price ?? 0).toLocaleString()}</p>
              </div>
              <div className="flex shrink-0 gap-3 flex-wrap">
                <Link
                  href={`/listings/${selected.id}`}
                  className="rounded-2xl bg-black px-8 py-3 text-sm font-black text-white transition-colors hover:bg-gray-800"
                >
                  View listing
                </Link>
                <button
                  type="button"
                  onClick={openChooseAgentModal}
                  className="rounded-2xl border-2 border-gray-200 px-8 py-3 text-sm font-black text-black transition-colors hover:border-black"
                >
                  Contact agent
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
