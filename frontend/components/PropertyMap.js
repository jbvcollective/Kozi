"use client";

import { useEffect, useRef, useState } from "react";

const BOUNDS_DEBOUNCE_MS = 350;
const TORONTO = { lat: 43.6532, lng: -79.3832 };

function escapeHtml(str) {
  if (str == null) return "";
  const s = String(str);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const MAPS_CALLBACK = "__vestaMapsCallback";
const MAPS_LOAD_PROMISE_KEY = "__vestaMapsLoadPromise";

function waitForGoogleMaps(interval = 50, maxWait = 15000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const t = setInterval(() => {
      if (window.google?.maps) {
        clearInterval(t);
        resolve();
        return;
      }
      if (Date.now() - start >= maxWait) {
        clearInterval(t);
        reject(new Error("Maps failed to load (timeout)"));
      }
    }, interval);
  });
}

function loadGoogleMapsScript(apiKey, onAuthFailure) {
  if (typeof window === "undefined" || !apiKey) return Promise.reject(new Error("No API key"));
  if (window.google?.maps) return Promise.resolve();
  if (window[MAPS_LOAD_PROMISE_KEY]) return window[MAPS_LOAD_PROMISE_KEY];
  if (document.querySelectorAll('script[src*="maps.googleapis.com"]').length > 0) return waitForGoogleMaps();
  let promise;
  promise = new Promise((resolve, reject) => {
    window[MAPS_LOAD_PROMISE_KEY] = promise;
    window.gm_authFailure = () => {
      if (onAuthFailure) onAuthFailure();
      reject(new Error("Google Maps auth failed"));
    };
    window[MAPS_CALLBACK] = () => {
      try {
        delete window[MAPS_CALLBACK];
      } catch (_) {}
      if (window.google?.maps) resolve();
      else reject(new Error("Maps failed to load"));
    };
    const script = document.createElement("script");
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}` +
      `&callback=${MAPS_CALLBACK}&libraries=maps,marker&v=beta`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      try {
        delete window[MAPS_CALLBACK];
      } catch (_) {}
      try {
        delete window[MAPS_LOAD_PROMISE_KEY];
      } catch (_) {}
      reject(new Error("Maps script failed to load"));
    };
    document.head.appendChild(script);
  });
  return promise;
}

export default function PropertyMap({ properties = [], onSelectProperty, onBoundsChange }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const infoWindowRef = useRef(null);
  const onBoundsChangeRef = useRef(onBoundsChange);
  const boundsDebounceRef = useRef(null);
  const [mapLoadError, setMapLoadError] = useState(null);

  onBoundsChangeRef.current = onBoundsChange;

  useEffect(() => {
    const handlePopupClick = (e) => {
      const popupCard = e.target.closest("[data-property-id]");
      if (popupCard) {
        const propertyId = popupCard.getAttribute("data-property-id");
        const property = properties.find((p) => p.id === propertyId);
        if (property) onSelectProperty?.(property);
      }
    };

    const container = mapContainerRef.current;
    if (container) container.addEventListener("click", handlePopupClick);
    return () => {
      if (container) container.removeEventListener("click", handlePopupClick);
    };
  }, [properties, onSelectProperty]);

  useEffect(() => {
    const apiKey =
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
      process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY?.trim();
    if (!mapContainerRef.current || !apiKey) return;

    setMapLoadError(null);
    let mounted = true;

    loadGoogleMapsScript(apiKey, () => {
      if (mounted) setMapLoadError("auth");
    })
      .then(() => {
        if (mounted) setMapLoadError(null);
        if (!mounted || !mapContainerRef.current) return;
        const google = window.google;
        if (!google?.maps) return;

        if (!mapRef.current) {
          mapRef.current = new google.maps.Map(mapContainerRef.current, {
            center: TORONTO,
            zoom: 12,
            zoomControl: true,
            zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_BOTTOM },
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
          });
        }

        markersRef.current.forEach((m) => m.setMap(null));
        markersRef.current = [];

        const list = Array.isArray(properties) ? properties : [];
        const valid = list.filter((p) => {
          if (p == null) return false;
          const lat = p.lat ?? p.latitude ?? p.Latitude;
          const lng = p.lng ?? p.longitude ?? p.Longitude;
          return lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
        }).map((p) => ({
          ...p,
          lat: Number(p.lat ?? p.latitude ?? p.Latitude),
          lng: Number(p.lng ?? p.longitude ?? p.Longitude),
        }));
        const JITTER_DEG = 0.0012;
        const keyToIndex = new Map();
        const withJitter = valid.map((p) => {
          const key = `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
          const i = keyToIndex.get(key) ?? 0;
          keyToIndex.set(key, i + 1);
          if (i === 0) return { ...p, lat: p.lat, lng: p.lng };
          const angle = (i * 0.618) * 2 * Math.PI;
          return { ...p, lat: p.lat + JITTER_DEG * Math.cos(angle), lng: p.lng + JITTER_DEG * Math.sin(angle) };
        });

        let infoWindow = infoWindowRef.current;
        if (!infoWindow) {
          infoWindow = new google.maps.InfoWindow({ maxWidth: 280 });
          infoWindowRef.current = infoWindow;
        }

        if (withJitter.length > 0) {
          const bounds = new google.maps.LatLngBounds();

          withJitter.forEach((property) => {
            const price = property.price ?? 0;
            const displayPrice =
              price >= 1_000_000 ? `$${(price / 1_000_000).toFixed(1)}M` : `$${(price / 1_000).toFixed(0)}K`;

            const marker = new google.maps.Marker({
              position: { lat: property.lat, lng: property.lng },
              map: mapRef.current,
              label: {
                text: displayPrice,
                color: "white",
                fontSize: "10px",
                fontWeight: "bold",
              },
              zIndex: Math.round(price / 1000),
            });

            const imgSrc =
              property.image ||
              property.images?.[0] ||
              "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=600";
            const popupContent = `
              <div class="interactive-map-popup group flex w-full cursor-pointer flex-col" data-property-id="${escapeHtml(property.id)}">
                <div class="relative h-40 overflow-hidden rounded-t-[1.5rem]">
                  <img src="${escapeHtml(imgSrc)}" class="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" onerror="this.src='https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=600'" />
                  <div class="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                  <div class="absolute left-3 top-3 rounded bg-black/80 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-white backdrop-blur-md">
                    ${escapeHtml(property.type || "Property")}
                  </div>
                </div>
                <div class="rounded-b-[1.5rem] bg-white p-5">
                  <h4 class="mb-1 truncate text-lg font-black leading-tight text-black">${escapeHtml(property.title || "")}</h4>
                  <p class="mb-4 truncate text-[10px] font-bold uppercase tracking-widest text-gray-400">${escapeHtml(property.location || "")}</p>
                  <div class="flex items-center justify-between border-t border-gray-50 pt-3">
                    <div class="flex flex-col">
                      <span class="text-[9px] font-black uppercase tracking-widest leading-none text-gray-300">${property.priceIsMonthly ? "Per month" : "Price"}</span>
                      <span class="text-xl font-black tracking-tighter text-black">$${(price || 0).toLocaleString()}${property.priceIsMonthly ? "/mo" : ""}</span>
                    </div>
                    <div class="group-hover:translate-x-1 flex items-center space-x-2 text-[10px] font-black uppercase tracking-widest text-purple-600 transition-transform">
                      <span>View Details</span>
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            `;

            marker.addListener("click", () => {
              infoWindow.setContent(popupContent);
              infoWindow.open(mapRef.current, marker);
            });

            bounds.extend(marker.getPosition());
            markersRef.current.push(marker);
          });

          mapRef.current.fitBounds(bounds, {
            top: 100,
            right: 100,
            bottom: 100,
            left: 100,
          });
          const listener = google.maps.event.addListener(mapRef.current, "idle", () => {
            google.maps.event.removeListener(listener);
            const maxZoom = 15;
            if (mapRef.current.getZoom() > maxZoom) mapRef.current.setZoom(maxZoom);
          });
        }

        const map = mapRef.current;
        if (map && typeof onBoundsChangeRef.current === "function") {
          const notifyBounds = () => {
            boundsDebounceRef.current = null;
            const b = map.getBounds();
            if (b) {
              onBoundsChangeRef.current({
                minLat: b.getSouth(),
                maxLat: b.getNorth(),
                minLng: b.getWest(),
                maxLng: b.getEast(),
              });
            }
          };
          const scheduleNotify = () => {
            if (boundsDebounceRef.current) clearTimeout(boundsDebounceRef.current);
            boundsDebounceRef.current = setTimeout(notifyBounds, BOUNDS_DEBOUNCE_MS);
          };
          map.addListener("bounds_changed", scheduleNotify);
          setTimeout(() => {
            if (mounted && mapRef.current) notifyBounds();
          }, 400);
        }
      })
      .catch((err) => {
        console.error("Google Maps load error:", err?.message || err);
        if (mounted) setMapLoadError(err?.message?.includes("auth") ? "auth" : "load");
      });

    return () => {
      mounted = false;
      if (boundsDebounceRef.current) clearTimeout(boundsDebounceRef.current);
    };
  }, [properties]);

  const list = Array.isArray(properties) ? properties : [];
  const hasAnyCoords = list.some((p) => {
    if (p == null) return false;
    const lat = p.lat ?? p.latitude ?? p.Latitude;
    const lng = p.lng ?? p.longitude ?? p.Longitude;
    return lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
  });
  const apiKey =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY?.trim();

  return (
    <div className="relative h-full w-full overflow-hidden bg-gray-50">
      {!apiKey && (
        <div className="absolute top-4 left-1/2 z-[1000] -translate-x-1/2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center shadow-lg max-w-md">
          <p className="text-sm font-bold text-amber-900">Map not configured</p>
          <p className="mt-1 text-xs text-amber-800">
            Set <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> or{" "}
            <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_GOOGLE_PLACES_API_KEY</code> in{" "}
            <code className="rounded bg-amber-100 px-1">frontend/.env.local</code>. Enable &quot;Maps JavaScript API&quot; in Google Cloud Console.
          </p>
        </div>
      )}
      {apiKey && list.length > 0 && !hasAnyCoords && (
        <div className="absolute top-4 left-1/2 z-[1000] -translate-x-1/2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center shadow-lg max-w-md">
          <p className="text-sm font-bold text-amber-900">No listing locations on map</p>
          <p className="mt-1 text-xs text-amber-800">
            Listings need latitude/longitude. Run{" "}
            <code className="rounded bg-amber-100 px-1">npm run geocode-listings</code> in the project root to backfill
            coordinates from addresses, then reload. Or run a fresh sync if the feed provides coordinates.
          </p>
        </div>
      )}
      {apiKey && mapLoadError && (
        <div className="absolute top-4 left-1/2 z-[1000] -translate-x-1/2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center shadow-lg max-w-md">
          <p className="text-sm font-bold text-red-900">Google Maps didn&apos;t load</p>
          <p className="mt-1 text-xs text-red-800">
            {mapLoadError === "auth"
              ? "API key rejected. In Google Cloud Console: (1) Enable billing for the project. (2) Under Credentials → your key → Application restrictions, add your site (e.g. http://localhost:3000/* and your production domain) as HTTP referrers, or use “None” to test. (3) Under API restrictions, allow “Maps JavaScript API”."
              : "Check the browser console (F12) for details. Ensure Maps JavaScript API is enabled and billing is on."}
          </p>
        </div>
      )}
      <div ref={mapContainerRef} className="h-full w-full min-h-[300px]" />
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .gm-style-iw-c { border-radius: 1.5rem; padding: 0 !important; overflow: hidden; box-shadow: 0 30px 60px -12px rgba(0, 0, 0, 0.2); border: 1px solid rgba(0, 0, 0, 0.05); }
        .gm-style-iw-d { margin: 0; overflow: auto !important; max-width: 280px !important; }
        .gm-style-iw-tc { display: none !important; }
        .map-pin-price-label { background: var(--primary, #1a3c3c); padding: 2px 6px; border-radius: 4px; }
        .interactive-map-popup { font-family: 'Inter', sans-serif; }
      `,
        }}
      />
    </div>
  );
}
