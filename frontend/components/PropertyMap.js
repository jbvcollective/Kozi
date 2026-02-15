"use client";

import { useEffect, useRef } from "react";

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

export default function PropertyMap({ properties = [], onSelectProperty }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  // Popup click delegation
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

  // Init Leaflet map and markers
  useEffect(() => {
    if (!mapContainerRef.current) return;

    let mounted = true;

    Promise.all([
      import("leaflet"),
      import("leaflet/dist/leaflet.css"),
    ]).then(([leafletModule]) => {
      if (!mounted || !mapContainerRef.current) return;

      const L = leafletModule.default;

      if (!mapRef.current) {
        mapRef.current = L.map(mapContainerRef.current, {
          center: [43.6532, -79.3832],
          zoom: 12,
          zoomControl: false,
        });

        L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: "abcd",
          maxZoom: 20,
        }).addTo(mapRef.current);

        L.control.zoom({ position: "bottomright" }).addTo(mapRef.current);
      }

      setTimeout(() => {
        if (mapRef.current) mapRef.current.invalidateSize();
      }, 200);

      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const list = Array.isArray(properties) ? properties : [];
      const valid = list.filter((p) => p != null && p.lat != null && p.lng != null);

      if (valid.length > 0) {
        const bounds = L.latLngBounds(valid.map((p) => [p.lat, p.lng]));

        valid.forEach((property) => {
          const price = property.price ?? 0;
          const displayPrice =
            price >= 1_000_000 ? `$${(price / 1_000_000).toFixed(1)}M` : `$${(price / 1_000).toFixed(0)}K`;

          const customIcon = L.divIcon({
            className: "custom-div-icon",
            html: `
              <div class="map-pin-marker flex cursor-pointer flex-col items-center justify-center transition-all hover:scale-110" title="${escapeHtml(displayPrice)}">
                <span class="map-pin-emoji text-2xl leading-none drop-shadow-md" aria-hidden="true">📍</span>
                <span class="map-pin-price mt-0.5 rounded bg-[var(--primary)] px-2 py-0.5 text-[10px] font-black text-white shadow-lg whitespace-nowrap">${escapeHtml(displayPrice)}</span>
              </div>
            `,
            iconSize: [56, 48],
            iconAnchor: [28, 46],
          });

          const marker = L.marker([property.lat, property.lng], { icon: customIcon }).addTo(
            mapRef.current
          );

          const imgSrc = property.image || property.images?.[0] || "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=600";
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

          marker.bindPopup(popupContent, {
            maxWidth: 280,
            minWidth: 280,
            className: "lumina-map-popup",
            offset: [0, -10],
          });

          markersRef.current.push(marker);
        });

        mapRef.current.fitBounds(bounds, {
          padding: [100, 100],
          maxZoom: 15,
          animate: true,
          duration: 1.5,
        });
      }
    });

    return () => {
      mounted = false;
    };
  }, [properties]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-gray-50">
      <div ref={mapContainerRef} className="h-full w-full" />
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .lumina-map-popup .leaflet-popup-content-wrapper {
          border-radius: 1.5rem;
          padding: 0;
          overflow: hidden;
          box-shadow: 0 30px 60px -12px rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(0, 0, 0, 0.05);
        }
        .lumina-map-popup .leaflet-popup-content {
          margin: 0;
          width: 280px !important;
        }
        .lumina-map-popup .leaflet-popup-tip-container {
          display: none;
        }
        .custom-div-icon {
          background: none !important;
          border: none !important;
        }
        .map-pin-marker {
          filter: drop-shadow(0 2px 6px rgba(0,0,0,0.2));
        }
        .map-pin-marker .map-pin-price {
          background: var(--primary, #1a3c3c);
        }
        .map-pin-marker:hover .map-pin-price {
          box-shadow: 0 4px 12px rgba(0,0,0,0.25);
        }
        .leaflet-container {
          font-family: 'Inter', sans-serif !important;
        }
        .leaflet-marker-icon {
          animation: markerFadeIn 0.5s ease-out forwards;
        }
        @keyframes markerFadeIn {
          from { opacity: 0; transform: scale(0.5) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `,
        }}
      />
    </div>
  );
}
