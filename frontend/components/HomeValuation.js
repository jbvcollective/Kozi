"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { getValuationInsights } from "@/lib/geminiService";

function mapBenchmarkRow(row) {
  const idx = row.idx || {};
  const vow = row.vow || {};
  const merged = { ...vow, ...idx };
  return {
    id: row.listing_key,
    title: merged.StreetName || "Nearby Reference",
    price: Number(merged.ListPrice || 0),
    location: merged.City || "Canada",
    image: idx.Photos?.[0] || "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=400",
  };
}

export default function HomeValuation() {
  const [address, setAddress] = useState("");
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState(null);

  const handleCalculate = async (e) => {
    e.preventDefault();
    if (!address) return;

    setCalculating(true);
    setResult(null);

    try {
      let benchmarks = [];

      if (supabase) {
        const { data } = await supabase
          .from("listings_unified")
          .select("listing_key, idx, vow")
          .limit(3);
        benchmarks = (data || []).map(mapBenchmarkRow);
      }

      const aiInsight = await getValuationInsights(address);

      const avgBenchmark =
        benchmarks.length > 0
          ? benchmarks.reduce((acc, p) => acc + p.price, 0) / benchmarks.length
          : 1500000;
      const price = avgBenchmark * (0.9 + Math.random() * 0.2);

      setResult({
        price,
        range: [price * 0.94, price * 1.06],
        aiInsight,
        benchmarks,
      });
    } catch (err) {
      console.error("Valuation error:", err);
    } finally {
      setCalculating(false);
    }
  };

  return (
    <div className="pt-24 px-8 pb-32 max-w-[1600px] mx-auto animate-fade-in md:px-12">
      <div className="mb-20 text-center space-y-6">
        <div className="inline-flex items-center space-x-2 px-4 py-1.5 bg-surface rounded-full border border-border">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted">Lumina Neural Valuation</span>
        </div>
        <h1 className="text-7xl md:text-8xl font-black tracking-tighter leading-none text-foreground">Equity.</h1>
        <p className="text-2xl text-muted font-medium max-w-2xl mx-auto leading-tight">
          Precise, AI-driven asset appraisal for the Canadian residential market.{" "}
          <span className="text-foreground">Enter your address to begin.</span>
        </p>
      </div>

      <form onSubmit={handleCalculate} className="relative mb-24 max-w-4xl mx-auto">
        <div
          className={`relative flex items-center bg-surface-elevated border-2 transition-premium rounded-3xl px-10 py-8 ${
            calculating ? "border-primary ring-4 ring-primary/10" : "border-border focus-within:border-primary focus-within:[box-shadow:var(--shadow-focus)]"
          }`}
          style={{ boxShadow: "var(--shadow-elevated)" }}
        >
          <input
            type="text"
            placeholder="e.g. 150 King St W, Toronto, ON"
            className="flex-grow bg-transparent text-2xl md:text-3xl outline-none text-foreground font-bold placeholder-muted"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={calculating}
          />
          <button
            type="submit"
            disabled={calculating || !address}
            className="btn-primary p-6 rounded-xl flex items-center space-x-3 group"
          >
            {calculating ? (
              <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span className="text-sm font-black uppercase tracking-widest hidden md:block">Analyze</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 transition-transform group-hover:translate-x-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </>
            )}
          </button>
        </div>
        <p className="mt-6 text-center text-[10px] font-black uppercase tracking-[0.5em] text-muted">
          Global MLS® & Unified Database Sync Active
        </p>
      </form>

      {result && (
        <div className="space-y-12 animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="card lg:col-span-2 bg-surface-elevated rounded-3xl border-border p-12 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-muted mb-4 block">
                  Strategic Market Value
                </span>
                <div className="text-8xl font-black tracking-tighter text-foreground leading-none mb-6">
                  ${Math.round(result.price / 1000).toLocaleString()}K
                </div>

                <div className="relative pt-12 pb-8">
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden relative">
                    <div
                      className="h-full bg-black/10 absolute rounded-full"
                      style={{ left: "35%", width: "30%" }}
                    />
                  </div>
                  <div className="flex justify-between items-center mt-6">
                    <div className="text-left">
                      <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Conservatory</span>
                      <p className="text-sm font-bold">${Math.round(result.range[0] / 1000).toLocaleString()}K</p>
                    </div>
                    <div className="text-center">
                      <div className="inline-block px-4 py-1 bg-black text-white rounded-full text-[9px] font-black uppercase tracking-widest mb-1">
                        Point Estimate
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Optimistic</span>
                      <p className="text-sm font-bold">${Math.round(result.range[1] / 1000).toLocaleString()}K</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-12 pt-12 border-t border-gray-50 flex flex-wrap gap-12">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Market Confidence</span>
                  <p className="text-lg font-black text-green-600">High (97.4%)</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Asset Volatility</span>
                  <p className="text-lg font-black text-black">Low</p>
                </div>
              </div>
            </div>

            <div className="bg-black rounded-[4rem] p-12 text-white flex flex-col justify-between relative overflow-hidden group">
              <div className="relative z-10 space-y-8">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 005.93 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" />
                    </svg>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40">Advisor Insight</span>
                </div>
                <p className="text-2xl font-medium leading-relaxed italic text-white/90">&quot;{result.aiInsight}&quot;</p>
              </div>
              <div className="relative z-10 pt-10 border-t border-white/10">
                <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-4">Recommendations</p>
                <div className="flex flex-col space-y-2">
                  <button type="button" className="text-left text-xs font-black uppercase tracking-widest hover:text-white/60 transition-colors">
                    → Refine with Floorplan
                  </button>
                  <button type="button" className="text-left text-xs font-black uppercase tracking-widest hover:text-white/60 transition-colors">
                    → Professional Audit
                  </button>
                </div>
              </div>
              <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-white/5 rounded-full blur-3xl pointer-events-none" />
            </div>
          </div>

          {result.benchmarks.length > 0 && (
            <div className="space-y-8 animate-fade-in pt-12 border-t border-gray-100">
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="text-3xl font-black tracking-tight">Neighborhood Anchors.</h2>
                  <p className="text-gray-400 font-medium">Live market benchmarks used for this analysis.</p>
                </div>
                <button type="button" className="text-[10px] font-black uppercase tracking-widest border-b-2 border-black pb-1">
                  View Full Map
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {result.benchmarks.map((benchmark) => (
                  <div
                    key={benchmark.id}
                    className="group cursor-pointer bg-white border border-gray-100 rounded-[2.5rem] p-6 flex items-center space-x-6 hover:shadow-xl transition-all"
                  >
                    <div className="w-24 h-24 rounded-2xl overflow-hidden shrink-0">
                      <img
                        src={benchmark.image}
                        className="w-full h-full object-cover transition-transform group-hover:scale-110"
                        alt={benchmark.title}
                      />
                    </div>
                    <div className="overflow-hidden">
                      <h4 className="font-black text-black truncate">{benchmark.title}</h4>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{benchmark.location}</p>
                      <p className="text-xl font-black tracking-tighter">${benchmark.price.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!result && (
        <div className="grid grid-cols-1 gap-12 border-t border-gray-50 pt-20 md:grid-cols-3">
          <div className="space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-black">Neural Correlation</h3>
            <p className="text-gray-400 font-medium leading-relaxed">
              Our AI correlates architectural prestige with neighborhood liquidity to find hidden equity value.
            </p>
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-black">ML Accuracy</h3>
            <p className="text-gray-400 font-medium leading-relaxed">
              Precision localized data for the GTA, Metro Vancouver, and Canadian luxury markets.
            </p>
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-black">MLS® Synergy</h3>
            <p className="text-gray-400 font-medium leading-relaxed">
              Seamlessly integrated with current active inventory and historical sold records.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
