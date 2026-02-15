"use client";

import { useEffect, useRef, useState } from "react";

const TOP_N = 12;

export default function AreaMarketHealthChart({ data = [], className = "" }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !data?.length) return;
    import("chart.js/auto").then((module) => {
      const Chart = module.default;
      if (!Chart) return;
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }

      const top = data.slice(0, TOP_N);
      const labels = top.map((r) => r.area_value || "—");
      const activeData = top.map((r) => r.total_active ?? 0);
      const priceData = top.map((r) => {
        const v = r.avg_sold_price_last_90_days;
        return v != null && Number(v) > 0 ? Number(v) : null;
      });
      const hasAnyPrice = priceData.some((v) => v != null && v > 0);

      if (canvasRef.current) {
        chartRef.current = new Chart(canvasRef.current, {
          type: "bar",
          data: {
            labels,
            datasets: [
              {
                label: "Active listings",
                data: activeData,
                type: "bar",
                backgroundColor: "rgba(30, 58, 95, 0.85)",
                borderColor: "rgb(30, 58, 95)",
                borderWidth: 1,
                yAxisID: "y",
                order: 0,
              },
              {
                label: "Avg sold price (90 days)",
                data: hasAnyPrice ? priceData : [],
                type: "line",
                borderColor: "rgb(91, 155, 213)",
                backgroundColor: "rgba(91, 155, 213, 0.1)",
                borderWidth: 2,
                fill: false,
                tension: 0.2,
                pointRadius: 4,
                pointHoverRadius: 6,
                xAxisID: "x1",
                order: 1,
                spanGaps: true,
              },
            ],
          },
          options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: true,
            interaction: { mode: "index", intersect: false },
            plugins: {
              legend: { display: true, position: "top", labels: { usePointStyle: true, padding: 12 } },
              tooltip: {
                callbacks: {
                  label: (ctx) => {
                    if (ctx.dataset.label === "Active listings") return `Active listings: ${ctx.raw}`;
                    if (ctx.raw != null) return `Avg sold price: $${Number(ctx.raw).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
                    return null;
                  },
                },
              },
            },
            scales: {
              y: {
                grid: { display: false },
                title: { display: false },
              },
              x: {
                type: "linear",
                position: "bottom",
                beginAtZero: true,
                title: { display: true, text: "Active listings" },
                grid: { color: "rgba(0,0,0,0.06)" },
              },
              x1: {
                type: "linear",
                position: "top",
                beginAtZero: true,
                min: 0,
                title: { display: true, text: "Avg sold price (90 days)" },
                grid: { drawOnChartArea: false },
                ticks: {
                  callback: (v) => (v >= 1e6 ? "$" + (v / 1e6).toFixed(1) + "M" : "$" + (v / 1e3).toFixed(0) + "K"),
                },
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
  }, [mounted, data]);

  if (!data?.length) {
    return (
      <div className={`rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm ${className}`}>
        <p className="text-sm font-medium text-gray-600">No area market health data loaded.</p>
        <p className="mt-2 text-xs text-gray-500">
          Run <code className="rounded bg-gray-100 px-1">npm run analytics</code> to populate. If data exists in Supabase, allow SELECT on <code className="rounded bg-gray-100 px-1">analytics_area_market_health</code> for your role, or use the backend and <code className="rounded bg-gray-100 px-1">NEXT_PUBLIC_API_URL</code>.
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <h2 className="mb-1 text-2xl font-black tracking-tight text-black">Area market health</h2>
      <p className="mb-6 text-sm text-gray-500">
        Top {TOP_N} areas by active listings. Bars = active listings. Line = avg sold price (last 90 days) when available.
      </p>
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="h-[380px]">
          {mounted && <canvas ref={canvasRef} />}
        </div>
      </div>
    </div>
  );
}
