"use client";

import { useMemo, useEffect, useRef, useState } from "react";

function KPIBox({ label, value, subtitle }) {
  return (
    <div className="group rounded-[3rem] border border-gray-100 bg-white p-10 shadow-sm transition-all hover:shadow-xl">
      <div className="flex flex-col space-y-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</p>
        <div className="text-4xl font-black tracking-tighter text-black">{value}</div>
        <p className="text-[11px] font-bold uppercase tracking-tighter text-gray-300">{subtitle}</p>
      </div>
    </div>
  );
}

function AvgDomChart({ rows, title, subtitle }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !rows?.length || !canvasRef.current) return;
    const sorted = [...rows]
      .filter((r) => r.avg_dom != null && Number.isFinite(Number(r.avg_dom)))
      .sort((a, b) => Number(b.avg_dom) - Number(a.avg_dom))
      .slice(0, 14);
    if (!sorted.length) return;
    let cancelled = false;
    import("chart.js/auto").then((module) => {
      if (cancelled) return;
      const Chart = module.default;
      if (chartRef.current) chartRef.current.destroy();
      const labels = sorted.map((r) => `${r.city_region || "—"} - ${r.property_sub_type || "—"}`);
      const data = sorted.map((r) => Math.round(Number(r.avg_dom)));
      const gridColor = "rgba(0, 0, 0, 0.08)";
      const xMax = data.length ? Math.min(700, Math.ceil((Math.max(...data) * 1.1) / 100) * 100) : 700;
      chartRef.current = new Chart(canvasRef.current, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Avg days on market",
              data,
              backgroundColor: "rgba(55, 65, 64, 0.85)",
              borderColor: "rgba(55, 65, 64, 1)",
              borderWidth: 0,
            },
          ],
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => ` ${ctx.raw} days`,
              },
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              title: { display: true, text: "Days" },
              grid: { color: gridColor },
              ticks: { font: { size: 11 }, maxTicksLimit: 8 },
              max: xMax,
            },
            y: {
              grid: { color: gridColor },
              ticks: { maxRotation: 0, autoSkip: false, font: { size: 11 }, color: "rgba(0, 0, 0, 0.7)" },
            },
          },
        },
      });
    });
    return () => {
      cancelled = true;
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [mounted, rows]);

  if (!rows?.length) return null;
  return (
    <div className="rounded-[3rem] border border-gray-100 bg-white p-8 shadow-sm">
      <h3 className="mb-2 text-2xl font-black tracking-tight text-gray-800">{title}</h3>
      <p className="mb-6 text-sm font-normal text-gray-600">{subtitle}</p>
      <div className="h-[380px] w-full rounded-2xl bg-[#faf9f7] px-2 pt-2">
        {mounted && <canvas ref={canvasRef} />}
      </div>
    </div>
  );
}

function AnalyticsTable({ title, subtitle, columns, rows }) {
  if (!rows?.length) return null;
  return (
    <div className="rounded-[3rem] border border-gray-100 bg-white p-8 shadow-sm">
      <h3 className="mb-2 text-2xl font-black tracking-tight text-black">{title}</h3>
      <p className="mb-6 text-sm text-gray-500">{subtitle}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {columns.map((c) => (
                <th key={c.key} className="pb-3 pr-4 font-black uppercase tracking-wider text-gray-500">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 10).map((row, i) => (
              <tr key={i} className="border-b border-gray-50">
                {columns.map((c) => (
                  <td key={c.key} className="py-3 pr-4 font-medium text-black">
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function MarketAnalysis({ properties = [], analytics = null }) {
  const stats = useMemo(() => {
    if (!properties.length) return null;

    const totalCount = properties.length;
    const withPrice = properties.filter((p) => p.price != null && p.price > 0);
    const avgPrice =
      withPrice.length > 0
        ? withPrice.reduce((acc, p) => acc + p.price, 0) / withPrice.length
        : 0;
    const withDom = properties.filter((p) => p.daysOnMarket != null && !Number.isNaN(p.daysOnMarket));
    const avgDOM =
      withDom.length > 0
        ? withDom.reduce((acc, p) => acc + Number(p.daysOnMarket), 0) / withDom.length
        : 0;

    const typeDistribution = properties.reduce((acc, p) => {
      const t = p.type || "Other";
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {});

    const sortedByPrice = [...properties].sort((a, b) => (b.price || 0) - (a.price || 0));
    const maxPrice = sortedByPrice[0]?.price ?? 0;

    return {
      totalCount,
      avgPrice,
      avgDOM,
      typeDistribution: Object.entries(typeDistribution)
        .map(([type, count]) => ({ type, pct: Math.round((count / totalCount) * 100) }))
        .sort((a, b) => b.pct - a.pct),
      maxPrice,
    };
  }, [properties]);

  if (!stats) {
    return (
      <div className="py-32 px-4 pt-24 text-center sm:px-6 md:px-8 lg:px-12">
        <h1 className="text-4xl font-black text-gray-200">No database records found.</h1>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] animate-fade-in px-4 pb-32 pt-24 sm:px-6 md:px-8 lg:px-12">
      {/* Real-Data Header */}
      <div className="mb-16 border-b border-gray-100 pb-12">
        <div className="mb-4 flex items-center space-x-3">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-400">
            Live Inventory Insight
          </span>
        </div>
        <h1 className="text-8xl font-black leading-none tracking-tighter text-black">The Pulse.</h1>
        <p className="mt-4 max-w-2xl text-2xl font-medium leading-tight text-gray-400">
          Live stats from our active database of{" "}
          <span className="font-black text-black">{stats.totalCount}</span> listings across Canada.
        </p>
      </div>

      {/* Real KPI Dashboard */}
      <div className="mb-20 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <KPIBox label="Active Inventory" value={`${stats.totalCount} Units`} subtitle="Database Total" />
        <KPIBox
          label="Average List Price"
          value={`$${Math.round(stats.avgPrice / 1000).toLocaleString()}K`}
          subtitle="Across All Categories"
        />
        <KPIBox
          label="Peak Valuation"
          value={`$${(stats.maxPrice / 1_000_000).toFixed(1)}M`}
          subtitle="Portfolio High Point"
        />
        <KPIBox
          label="Avg. Days on Market"
          value={`${Math.round(stats.avgDOM)} Days`}
          subtitle="Inventory Velocity"
        />
      </div>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
        {/* Composition by Architecture Type */}
        <div className="flex flex-col justify-center rounded-[4rem] border border-gray-100 bg-gray-50 p-12 lg:col-span-2">
          <h3 className="mb-10 text-4xl font-black tracking-tighter">Inventory Composition.</h3>
          <div className="space-y-10">
            {stats.typeDistribution.map((item) => (
              <div key={item.type} className="space-y-4">
                <div className="flex items-end justify-between">
                  <span className="text-sm font-black uppercase tracking-widest text-black">
                    {item.type}
                  </span>
                  <span className="text-2xl font-black">{item.pct}%</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-black transition-all duration-1000"
                    style={{ width: `${item.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Advisory Sidebar */}
        <div className="flex flex-col justify-between rounded-[4rem] bg-black p-12 text-white">
          <div className="space-y-8">
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30">
              Expert Advisory
            </span>
            <h3 className="text-4xl font-black leading-tight tracking-tighter">
              Database Transparency.
            </h3>
            <p className="font-medium leading-relaxed text-white/60">
              These figures are recalculated in real-time as properties enter and exit our unified
              database. We provide 100% transparency on market liquidity across our platform.
            </p>
          </div>

          <div className="mt-12 space-y-2 border-t border-white/10 pt-12">
            <p className="text-[9px] font-black uppercase tracking-widest text-white/20">
              Last Updated
            </p>
            <p className="text-sm font-bold">
              {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
            </p>
          </div>
        </div>
      </div>

      {/* Supabase analytics (when populated via npm run analytics) */}
      {analytics && (
        <div className="mt-20 space-y-12">
          <div className="border-b border-gray-100 pb-8">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">
              Supabase Analytics
            </span>
            <h2 className="mt-2 text-5xl font-black tracking-tighter text-black">Market intelligence.</h2>
            <p className="mt-2 text-gray-500">
              Aggregates from <code className="rounded bg-gray-100 px-1">analytics_*</code> tables. Run <code className="rounded bg-gray-100 px-1">npm run analytics</code> to refresh.
            </p>
          </div>

          {/* Latest month snapshot */}
          {analytics.monthly?.length > 0 && (() => {
            const last = analytics.monthly[analytics.monthly.length - 1];
            return (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                <KPIBox label="Month" value={last.year_month || "—"} subtitle="Latest period" />
                <KPIBox label="Sold" value={`${last.sold_count ?? 0} sales`} subtitle="Closed" />
                <KPIBox label="New listings" value={`${last.new_listings_count ?? 0} listings`} subtitle="Added" />
                <KPIBox
                  label="Median sold price"
                  value={last.median_sold_price != null ? `$${Math.round(Number(last.median_sold_price) / 1000)}K` : "—"}
                  subtitle="Closed sales"
                />
                <KPIBox
                  label="Avg DOM"
                  value={last.avg_dom != null ? `${Math.round(Number(last.avg_dom))} days` : "—"}
                  subtitle="Days on market"
                />
              </div>
            );
          })()}

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <AnalyticsTable
              title="List-to-sale ratio by area"
              subtitle="How close to list price properties sold (100% = at list). Source: analytics_list_to_sale."
              columns={[
                { key: "area_value", label: "Area" },
                { key: "area_type", label: "Type" },
                { key: "list_to_sale_ratio", label: "Ratio", render: (r) => (r.list_to_sale_ratio != null ? `${(Number(r.list_to_sale_ratio) * 100).toFixed(1)}%` : "—") },
                { key: "sale_count", label: "Sales", render: (r) => (r.sale_count != null ? `${r.sale_count} sales` : "—") },
              ]}
              rows={analytics.list_to_sale ?? []}
            />
            <div className="space-y-8">
              <AvgDomChart
                title="Avg days on market by type & region"
                subtitle="By property type and city region. Source: analytics_avg_dom."
                rows={analytics.avg_dom ?? []}
              />
              <AnalyticsTable
                title="Avg DOM by type & region (data)"
                subtitle="Same data as the chart above."
                columns={[
                  { key: "city_region", label: "Region" },
                  { key: "property_sub_type", label: "Property type" },
                  { key: "avg_dom", label: "Avg DOM", render: (r) => (r.avg_dom != null ? `${Math.round(Number(r.avg_dom))} days` : "—") },
                  { key: "listing_count", label: "Listings", render: (r) => (r.listing_count != null ? `${r.listing_count} listings` : "—") },
                ]}
                rows={analytics.avg_dom ?? []}
              />
            </div>
          </div>

          <AnalyticsTable
            title="Avg DOM by price bracket & area"
            subtitle="Days on market by price band and area. Source: analytics_avg_dom_by_price."
            columns={[
              { key: "area_value", label: "Area" },
              { key: "price_bracket", label: "Price bracket" },
              { key: "avg_dom", label: "Avg DOM", render: (r) => (r.avg_dom != null ? `${Math.round(Number(r.avg_dom))} days` : "—") },
              { key: "listing_count", label: "Listings", render: (r) => (r.listing_count != null ? `${r.listing_count} listings` : "—") },
            ]}
            rows={analytics.avg_dom_by_price ?? []}
          />

          {analytics.area_market_health?.length > 0 && (
            <div className="rounded-[3rem] border border-gray-100 bg-gray-50 p-8">
              <h3 className="mb-2 text-2xl font-black tracking-tight text-black">Area market health (top areas by active listings)</h3>
              <p className="mb-6 text-sm text-gray-500">Source: analytics_area_market_health. Active, new, sold and expired counts plus price trend.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="pb-3 pr-4 font-black uppercase tracking-wider text-gray-500">Area</th>
                      <th className="pb-3 pr-4 font-black uppercase tracking-wider text-gray-500">Active</th>
                      <th className="pb-3 pr-4 font-black uppercase tracking-wider text-gray-500">New</th>
                      <th className="pb-3 pr-4 font-black uppercase tracking-wider text-gray-500">Sold</th>
                      <th className="pb-3 pr-4 font-black uppercase tracking-wider text-gray-500">Median list</th>
                      <th className="pb-3 pr-4 font-black uppercase tracking-wider text-gray-500">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(analytics.area_market_health ?? []).slice(0, 10).map((row, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-3 pr-4 font-medium text-black">{row.area_value || "—"}</td>
                        <td className="py-3 pr-4">{row.total_active != null ? `${row.total_active} listings` : "—"}</td>
                        <td className="py-3 pr-4">{row.new_this_month != null ? `${row.new_this_month} new` : "—"}</td>
                        <td className="py-3 pr-4">{row.sold_this_month != null ? `${row.sold_this_month} sales` : "—"}</td>
                        <td className="py-3 pr-4">
                          {row.median_list_price != null ? `$${Math.round(Number(row.median_list_price) / 1000)}K` : "—"}
                        </td>
                        <td className="py-3 pr-4">{row.market_indicator || row.price_trend_direction || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer Disclaimer */}
      <footer className="mt-32 border-t border-gray-50 pt-16 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.6em] text-gray-300">
          End of Report
        </p>
      </footer>
    </div>
  );
}
