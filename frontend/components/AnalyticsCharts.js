"use client";

import { useEffect, useRef, useState } from "react";

export default function AnalyticsCharts({ monthly, className = "" }) {
  const listingsChartRef = useRef(null);
  const priceDomChartRef = useRef(null);
  const chartsRef = useRef({ listings: null, priceDom: null });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !monthly?.length) return;
    import("chart.js/auto").then((module) => {
      const Chart = module.default;
      if (!Chart) return;
      const labels = monthly.map((m) => m.year_month);
      if (chartsRef.current.listings) chartsRef.current.listings.destroy();
      if (chartsRef.current.priceDom) chartsRef.current.priceDom.destroy();
      if (listingsChartRef.current) {
        chartsRef.current.listings = new Chart(listingsChartRef.current, {
          type: "bar",
          data: {
            labels,
            datasets: [
              { label: "Active Listings", data: monthly.map((m) => m.active_count), backgroundColor: "rgba(255,159,64,0.8)" },
              { label: "New Listings", data: monthly.map((m) => m.new_listings_count), type: "line", borderColor: "#1e3a5f", fill: false, tension: 0.2 },
              { label: "Total Sold", data: monthly.map((m) => m.sold_count), type: "line", borderColor: "#5b9bd5", fill: false, tension: 0.2 },
            ],
          },
          options: { responsive: true, maintainAspectRatio: true, scales: { y: { beginAtZero: true } } },
        });
      }
      if (priceDomChartRef.current) {
        chartsRef.current.priceDom = new Chart(priceDomChartRef.current, {
          type: "line",
          data: {
            labels,
            datasets: [
              { label: "Median Sold Price", data: monthly.map((m) => m.median_sold_price), yAxisID: "y", borderColor: "#1e3a5f", fill: false, tension: 0.2 },
              { label: "Average Days on Market", data: monthly.map((m) => m.avg_dom), yAxisID: "y1", type: "bar", backgroundColor: "rgba(75,192,192,0.6)" },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
              y: { type: "linear", position: "left", beginAtZero: false, title: { display: true, text: "Median Sold Price" } },
              y1: { type: "linear", position: "right", beginAtZero: true, grid: { drawOnChartArea: false }, title: { display: true, text: "Average Days on Market" } },
            },
          },
        });
      }
    });
    return () => {
      if (chartsRef.current.listings) chartsRef.current.listings.destroy();
      if (chartsRef.current.priceDom) chartsRef.current.priceDom.destroy();
    };
  }, [mounted, monthly]);

  if (!monthly?.length) return null;

  return (
    <div className={className}>
      <div className="mb-6 rounded-lg bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-base font-medium text-zinc-800">Sold, Active & New Listings</h3>
        <div className="h-[280px]">
          {mounted && <canvas ref={listingsChartRef} />}
        </div>
      </div>
      <div className="rounded-lg bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-base font-medium text-zinc-800">Median Sold Price & Average Days on Market</h3>
        <div className="h-[280px]">
          {mounted && <canvas ref={priceDomChartRef} />}
        </div>
      </div>
    </div>
  );
}
