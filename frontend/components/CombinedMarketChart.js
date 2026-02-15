"use client";

import { useEffect, useRef, useState } from "react";

const HOT = "#dc2626";   // red
const MEDIUM = "#16a34a"; // green
const COLD = "#2563eb";   // blue
const SOLD_BAR = "#ea580c"; // orange

function getActivityColor(value, minVal, maxVal) {
  if (maxVal == null || maxVal <= minVal) return MEDIUM;
  const range = maxVal - minVal;
  const pct = range ? (value - minVal) / range : 0;
  if (pct >= 2 / 3) return HOT;
  if (pct >= 1 / 3) return MEDIUM;
  return COLD;
}

export default function CombinedMarketChart({ monthly = [], className = "" }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !monthly?.length) return;
    import("chart.js/auto").then((module) => {
      const Chart = module.default;
      if (!Chart) return;
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }

      const labels = monthly.map((m) => m.year_month || "—");
      const soldCounts = monthly.map((m) => m.sold_count ?? 0);
      const activityValues = monthly.map((m) => (m.active_count ?? 0) + (m.new_listings_count ?? 0));
      const minActivity = Math.min(...activityValues);
      const maxActivity = Math.max(...activityValues);

      if (canvasRef.current) {
        chartRef.current = new Chart(canvasRef.current, {
          type: "bar",
          data: {
            labels,
            datasets: [
              {
                label: "Sold count",
                data: soldCounts,
                type: "bar",
                backgroundColor: SOLD_BAR,
                borderColor: "#c2410c",
                borderWidth: 1,
                order: 0,
                yAxisID: "y",
              },
              {
                label: "Activity score",
                data: activityValues,
                type: "line",
                borderWidth: 3,
                fill: false,
                tension: 0.2,
                pointRadius: 2,
                pointHoverRadius: 5,
                order: 1,
                yAxisID: "y1",
                segment: {
                  borderColor: (ctx) => {
                    const v = ctx.p1?.parsed?.y ?? ctx.p0?.parsed?.y ?? 0;
                    return getActivityColor(v, minActivity, maxActivity);
                  },
                },
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: { mode: "index", intersect: false },
            plugins: {
              legend: {
                display: true,
                position: "top",
                labels: { usePointStyle: true, padding: 16, font: { size: 12 } },
              },
              tooltip: {
                callbacks: {
                  label: (ctx) => {
                    if (ctx.dataset.label === "Sold count") return `Sold count: ${ctx.raw}`;
                    return `Activity score: ${ctx.raw}`;
                  },
                },
              },
            },
            scales: {
              x: {
                grid: { display: false },
                title: { display: true, text: "Month" },
                ticks: { maxRotation: 45, minRotation: 0, maxTicksLimit: 14 },
              },
              y: {
                type: "linear",
                position: "left",
                beginAtZero: true,
                title: { display: true, text: "Sold count" },
                grid: { color: "rgba(0,0,0,0.06)" },
              },
              y1: {
                type: "linear",
                position: "right",
                beginAtZero: true,
                title: { display: true, text: "Activity score" },
                grid: { drawOnChartArea: false },
              },
            },
          },
        });
      }
    });
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [mounted, monthly]);

  if (!monthly?.length) {
    return (
      <div className={`rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm ${className}`}>
        <p className="text-sm font-medium text-gray-600">
          Run <code className="rounded bg-gray-100 px-1">npm run analytics</code> to populate <code className="rounded bg-gray-100 px-1">analytics_monthly</code>.
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
        analytics_monthly
      </div>
      <h2 className="mb-1 text-2xl font-black tracking-tight text-black">Activity score & sold listings</h2>
      <p className="mb-6 text-sm text-gray-500">
        Activity score = active + new listings per month. Line color: <span className="font-medium text-red-600">Hot</span> (high), <span className="font-medium text-green-600">Medium</span> (mid), <span className="font-medium text-blue-600">Cold</span> (low). <span className="font-medium text-orange-600">Orange bars</span> = Sold count.
      </p>
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="h-[380px]">
          {mounted && <canvas ref={canvasRef} />}
        </div>
      </div>
    </div>
  );
}
