"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

// #region agent log
const _qaLog = (location, message, data = {}) => {
  fetch("http://127.0.0.1:7243/ingest/44e6888a-4d84-49e4-8550-759d2db8073e", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "5fa93a" },
    body: JSON.stringify({
      sessionId: "5fa93a",
      location,
      message,
      data: { ...data, timestamp: Date.now() },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
};
// #endregion

const BOUNDS_DEBOUNCE_MS = 750;
const TORONTO = { lat: 43.6532, lng: -79.3832 };
/** Default span for initial fetch when map bounds are not yet available (degrees). */
const DEFAULT_BOUNDS_SPAN = 0.5;

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

function buildMarkerLabel(property) {
  const price = property.price ?? 0;
  const priceStr =
    price >= 1_000_000 ? `${(price / 1_000_000).toFixed(1)}M` : `${(price / 1_000).toFixed(0)}K`;
  const parts = [priceStr];
  const units = property.units ?? property.unitCount;
  if (units != null && units > 1) parts.push(`${units} units`);
  if (property.status === "New") parts.push("NEW");
  if (property.virtualTour) parts.push("3D");
  return parts.join(" · ");
}

const ZOOM_SHOW_PRICE = 14;

/** Minimal small red dot for zoomed-out view (light rendering). */
function getCircleMarkerIcon(google) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5" fill="#dc2626"/></svg>`;
  const url = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  return {
    url,
    scaledSize: new google.maps.Size(14, 14),
    anchor: new google.maps.Point(7, 7),
    labelOrigin: new google.maps.Point(7, 7),
  };
}

/** Smaller red pill for zoomed-in view (price label). */
function getPillMarkerIcon(google) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="20" viewBox="0 0 52 20"><rect width="52" height="20" rx="10" ry="10" fill="#dc2626"/></svg>`;
  const url = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  return {
    url,
    scaledSize: new google.maps.Size(52, 20),
    anchor: new google.maps.Point(26, 10),
    labelOrigin: new google.maps.Point(26, 10),
  };
}

function applyMarkerStyleForZoom(marker, google, zoom) {
  const showPrice = zoom >= ZOOM_SHOW_PRICE;
  marker.setIcon(showPrice ? getPillMarkerIcon(google) : getCircleMarkerIcon(google));
  marker.setLabel("");
}

const PropertyMapComponent = forwardRef(function PropertyMap(
  { properties = [], onSelectProperty, onBoundsChange },
  ref
) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const infoWindowRef = useRef(null);
  const onBoundsChangeRef = useRef(onBoundsChange);
  const boundsDebounceRef = useRef(null);
  const lastBoundsRef = useRef(null);
  const lastRenderedIdsRef = useRef(null);
  const popupOpenRef = useRef(false);
  const [mapLoadError, setMapLoadError] = useState(null);

  onBoundsChangeRef.current = onBoundsChange;

  useImperativeHandle(ref, () => ({
    fitToMarkers() {
      if (mapRef.current && lastBoundsRef.current) {
        mapRef.current.fitBounds(lastBoundsRef.current, {
          top: 100,
          right: 100,
          bottom: 100,
          left: 100,
        });
      }
    },
    setMapType(mapTypeId) {
      if (mapRef.current && mapTypeId) mapRef.current.setMapTypeId(mapTypeId);
    },
  }), []);

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
    const container = mapContainerRef.current;
    if (!container) return;
    const handleWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

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
            mapTypeId: google.maps.MapTypeId.ROADMAP,
            streetViewControl: false,
            fullscreenControl: true,
            scrollwheel: true,
            gestureHandling: "greedy",
          });
          // #region agent log
          _qaLog("PropertyMap.js:map-init", "Map created", {});
          // #endregion
        }

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
        const idsKey = valid.map((p) => String(p.id ?? "")).sort().join(",");
        const sameListings = idsKey === lastRenderedIdsRef.current;
        // #region agent log
        _qaLog("PropertyMap.js:markers-decision", sameListings ? "Same listings, skip recreate" : "Recreate markers", {
          sameListings,
          count: valid.length,
          idsKeyLen: idsKey.length,
        });
        // #endregion

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

        if (sameListings && withJitter.length > 0) {
          lastBoundsRef.current = new google.maps.LatLngBounds();
          withJitter.forEach((p) => lastBoundsRef.current.extend({ lat: p.lat, lng: p.lng }));
        } else {
          lastRenderedIdsRef.current = idsKey;
        }

        let infoWindow = infoWindowRef.current;
        if (!infoWindow) {
          infoWindow = new google.maps.InfoWindow({ maxWidth: 280 });
          infoWindowRef.current = infoWindow;
          google.maps.event.addListener(infoWindow, "closeclick", () => {
            popupOpenRef.current = false;
            // #region agent log
            _qaLog("PropertyMap.js:popup-close", "Popup closed (closeclick)", {});
            // #endregion
          });
        }

        if (!sameListings && withJitter.length > 0) {
          const bounds = new google.maps.LatLngBounds();
          const map = mapRef.current;
          const initialZoom = map.getZoom() ?? ZOOM_SHOW_PRICE;
          const newMarkers = [];
          withJitter.forEach((property) => {
            const price = property.price ?? 0;
            const labelText = buildMarkerLabel(property);
            const labelStr = typeof labelText === "string" ? labelText : String(labelText ?? "");

            const marker = new google.maps.Marker({
              position: { lat: property.lat, lng: property.lng },
              map,
              icon: getCircleMarkerIcon(google),
              label: "",
              zIndex: Math.round(price / 1000),
            });
            marker._labelText = labelStr;
            applyMarkerStyleForZoom(marker, google, initialZoom);

            const imgSrc =
              property.image ||
              property.images?.[0] ||
              "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=600";
            const listingPath = `/listings/${encodeURIComponent(String(property.id || ""))}`;
            const popupContent = `
              <div class="interactive-map-popup group flex w-full cursor-pointer flex-col" data-property-id="${escapeHtml(property.id)}" onmousedown="event.stopPropagation()" onclick="event.stopPropagation()">
                <a href="${escapeHtml(listingPath)}" style="text-decoration:none;color:inherit;display:block" class="rounded-t-[1.5rem] rounded-b-[1.5rem]">
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
                </a>
              </div>
            `;

            marker.addListener("click", (e) => {
              if (e?.domEvent) e.domEvent.stopPropagation();
              popupOpenRef.current = true;
              // #region agent log
              _qaLog("PropertyMap.js:popup-open", "Popup opened", { propertyId: property.id });
              // #endregion
              infoWindow.setContent(popupContent);
              infoWindow.open(mapRef.current, marker);
            });

            bounds.extend(marker.getPosition());
            newMarkers.push(marker);
          });

          const oldMarkers = markersRef.current;
          markersRef.current = newMarkers;
          oldMarkers.forEach((m) => m.setMap(null));
          lastBoundsRef.current = bounds;
          // Do not auto-fit on every property update — it overrides user zoom/pan. Use Re-center to fit.
        } else if (!sameListings && withJitter.length === 0) {
          markersRef.current.forEach((m) => m.setMap(null));
          markersRef.current = [];
        }

        const map = mapRef.current;
        if (map && typeof onBoundsChangeRef.current === "function") {
          const notifyBounds = () => {
            boundsDebounceRef.current = null;
            if (popupOpenRef.current) {
              // #region agent log
              _qaLog("PropertyMap.js:notifyBounds", "Skipped (popup open)", {});
              // #endregion
              return;
            }
            const b = map.getBounds();
            if (b && typeof b.getSouth === "function") {
              const bounds = {
                minLat: b.getSouth(),
                maxLat: b.getNorth(),
                minLng: b.getWest(),
                maxLng: b.getEast(),
              };
              // #region agent log
              _qaLog("PropertyMap.js:notifyBounds", "Firing onBoundsChange", bounds);
              // #endregion
              onBoundsChangeRef.current(bounds);
            } else {
              const c = map.getCenter?.();
              const lat = c?.lat?.() ?? TORONTO.lat;
              const lng = c?.lng?.() ?? TORONTO.lng;
              const half = DEFAULT_BOUNDS_SPAN / 2;
              onBoundsChangeRef.current({
                minLat: lat - half,
                maxLat: lat + half,
                minLng: lng - half,
                maxLng: lng + half,
              });
            }
          };
          const scheduleNotify = () => {
            // #region agent log
            _qaLog("PropertyMap.js:bounds_changed", "bounds_changed fired", {});
            // #endregion
            if (boundsDebounceRef.current) clearTimeout(boundsDebounceRef.current);
            boundsDebounceRef.current = setTimeout(notifyBounds, BOUNDS_DEBOUNCE_MS);
          };
          map.addListener("bounds_changed", scheduleNotify);
          map.addListener("click", () => {
            popupOpenRef.current = false;
            // #region agent log
            _qaLog("PropertyMap.js:popup-close", "Popup closed (map click)", {});
            // #endregion
          });
          map.addListener("zoom_changed", () => {
            const zoom = map.getZoom() ?? ZOOM_SHOW_PRICE;
            markersRef.current.forEach((m) => applyMarkerStyleForZoom(m, google, zoom));
          });
          setTimeout(() => {
            if (mounted && mapRef.current) notifyBounds();
          }, 400);
        }
      })
      .catch((err) => {
        console.error("Google Maps load error:", err?.message || err);
        // #region agent log
        _qaLog("PropertyMap.js:map-error", "Map load failed", {
          message: err?.message,
          auth: err?.message?.includes("auth"),
        });
        // #endregion
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
});

export { loadGoogleMapsScript };
export default PropertyMapComponent;
