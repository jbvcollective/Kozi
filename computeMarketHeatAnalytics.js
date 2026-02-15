/**
 * Compute market heat analytics from listings_unified (VOW sold data) and save to Supabase.
 * - List-to-sale price ratio by area (CityRegion or City)
 * - Average DOM by PropertySubType in CityRegion
 */
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env") });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function toYearMonth(d) {
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function parseDate(d) {
  if (!d) return null;
  const date = new Date(d);
  return isNaN(date.getTime()) ? null : date;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function median(arr) {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function main() {
  console.log("Loading listings_unified (idx + vow)...");
  const { data: rows, error: fetchError } = await supabase
    .from("listings_unified")
    .select("listing_key, idx, vow");
  if (fetchError) {
    console.error("Supabase error:", fetchError.message);
    process.exit(1);
  }

  const all = rows || [];
  const sold = all.map((r) => r.vow).filter(Boolean);
  console.log("Found", all.length, "listings,", sold.length, "with VOW (sold) data.");

  if (sold.length > 0) {
  // --- List-to-sale ratio by area ---
  // area = CityRegion or City; ratio = ClosePrice / ListPrice (only when ListPrice > 0)
  const byArea = new Map();
  for (const v of sold) {
    const listPrice = parseFloat(v.ListPrice ?? v.OriginalListPrice);
    const closePrice = parseFloat(v.ClosePrice);
    if (!(listPrice > 0) || closePrice == null || isNaN(closePrice)) continue;
    const areaValue = (v.CityRegion || v.City || "Unknown").trim() || "Unknown";
    const areaType = v.CityRegion ? "CityRegion" : "City";
    const key = areaType + "\0" + areaValue;
    if (!byArea.has(key)) byArea.set(key, { areaType, areaValue, sum: 0, count: 0 });
    const rec = byArea.get(key);
    rec.sum += closePrice / listPrice;
    rec.count += 1;
  }

  const listToSaleRows = Array.from(byArea.values()).map((r) => ({
    area_type: r.areaType,
    area_value: r.areaValue,
    list_to_sale_ratio: Math.round((r.sum / r.count) * 10000) / 10000,
    sale_count: r.count,
    updated_at: new Date().toISOString(),
  }));

  const { error: err1 } = await supabase.from("analytics_list_to_sale").upsert(listToSaleRows, {
    onConflict: "area_type,area_value",
  });
  if (err1) console.error("analytics_list_to_sale upsert error:", err1.message);
  else console.log("analytics_list_to_sale:", listToSaleRows.length, "rows upserted.");

  // --- Average DOM by PropertySubType in CityRegion ---
  const byDom = new Map();
  for (const v of sold) {
    const dom = parseInt(v.DaysOnMarket, 10);
    if (dom == null || isNaN(dom) || dom < 0) continue;
    const cityRegion = (v.CityRegion || v.City || "Unknown").trim() || "Unknown";
    const subType = (v.PropertySubType || v.PropertyType || "Unknown").trim() || "Unknown";
    const key = cityRegion + "\0" + subType;
    if (!byDom.has(key)) byDom.set(key, { city_region: cityRegion, property_sub_type: subType, sum: 0, count: 0 });
    const rec = byDom.get(key);
    rec.sum += dom;
    rec.count += 1;
  }

  const domRows = Array.from(byDom.values()).map((r) => ({
    city_region: r.city_region,
    property_sub_type: r.property_sub_type,
    avg_dom: Math.round((r.sum / r.count) * 100) / 100,
    listing_count: r.count,
    updated_at: new Date().toISOString(),
  }));

  const { error: err2 } = await supabase.from("analytics_avg_dom").upsert(domRows, {
    onConflict: "city_region,property_sub_type",
  });
  if (err2) console.error("analytics_avg_dom upsert error:", err2.message);
  else console.log("analytics_avg_dom:", domRows.length, "rows upserted.");

  // --- Average DOM for same price bracket in area ---
  const PRICE_BRACKETS = [
    [0, 300000, "0 – 300k"],
    [300000, 500000, "300k – 500k"],
    [500000, 750000, "500k – 750k"],
    [750000, 1000000, "750k – 1M"],
    [1000000, 1500000, "1M – 1.5M"],
    [1500000, Infinity, "1.5M+"],
  ];
  function getPriceBracket(closePrice) {
    const p = parseFloat(closePrice);
    if (p == null || isNaN(p) || p < 0) return null;
    for (const [low, high, label] of PRICE_BRACKETS) {
      if (p >= low && p < high) return label;
    }
    return "Other";
  }
  const byPriceBracket = new Map();
  for (const v of sold) {
    const dom = parseInt(v.DaysOnMarket, 10);
    if (dom == null || isNaN(dom) || dom < 0) continue;
    const bracket = getPriceBracket(v.ClosePrice);
    if (!bracket) continue;
    const areaValue = (v.CityRegion || v.City || "Unknown").trim() || "Unknown";
    const areaType = v.CityRegion ? "CityRegion" : "City";
    const key = areaType + "\0" + areaValue + "\0" + bracket;
    if (!byPriceBracket.has(key)) byPriceBracket.set(key, { area_type: areaType, area_value: areaValue, price_bracket: bracket, sum: 0, count: 0 });
    const rec = byPriceBracket.get(key);
    rec.sum += dom;
    rec.count += 1;
  }
  const domByPriceRows = Array.from(byPriceBracket.values()).map((r) => ({
    area_type: r.area_type,
    area_value: r.area_value,
    price_bracket: r.price_bracket,
    avg_dom: Math.round((r.sum / r.count) * 100) / 100,
    listing_count: r.count,
    updated_at: new Date().toISOString(),
  }));
  const { error: err2b } = await supabase.from("analytics_avg_dom_by_price").upsert(domByPriceRows, {
    onConflict: "area_type,area_value,price_bracket",
  });
  if (err2b) console.error("analytics_avg_dom_by_price upsert error:", err2b.message);
  else console.log("analytics_avg_dom_by_price:", domByPriceRows.length, "rows upserted.");

  // --- Monthly time-series: Sold, New Listings, Active (proxy), Median Sold Price, Avg DOM ---
  const byMonth = new Map();
  for (const r of all) {
    const vow = r.vow || {};
    const idx = r.idx || {};
    const listDate = vow.OriginalEntryTimestamp ?? idx.OriginalEntryTimestamp;
    const soldDate = vow.SoldEntryTimestamp ?? vow.CloseDate;
    const listMonth = toYearMonth(listDate);
    const soldMonth = toYearMonth(soldDate);
    if (listMonth) {
      if (!byMonth.has(listMonth)) byMonth.set(listMonth, { soldPrices: [], doms: [], soldCount: 0, newCount: 0 });
      byMonth.get(listMonth).newCount += 1;
    }
    if (soldMonth && (vow.ClosePrice != null || vow.ListPrice != null)) {
      if (!byMonth.has(soldMonth)) byMonth.set(soldMonth, { soldPrices: [], doms: [], soldCount: 0, newCount: 0 });
      const rec = byMonth.get(soldMonth);
      rec.soldCount += 1;
      const price = parseFloat(vow.ClosePrice);
      if (!isNaN(price)) rec.soldPrices.push(price);
      const dom = parseInt(vow.DaysOnMarket, 10);
      if (!isNaN(dom) && dom >= 0) rec.doms.push(dom);
    }
  }
  const months = Array.from(byMonth.keys()).sort();
  let runningActive = 0;
  const monthlyRows = months.map((ym) => {
    const rec = byMonth.get(ym);
    runningActive = runningActive + (rec.newCount || 0) - (rec.soldCount || 0);
    if (runningActive < 0) runningActive = 0;
    return {
      year_month: ym,
      sold_count: rec.soldCount || 0,
      new_listings_count: rec.newCount || 0,
      active_count: runningActive,
      median_sold_price: rec.soldPrices.length ? median(rec.soldPrices) : null,
      avg_dom: rec.doms.length ? Math.round(rec.doms.reduce((a, b) => a + b, 0) / rec.doms.length * 100) / 100 : null,
      updated_at: new Date().toISOString(),
    };
  });

  const { error: err3 } = await supabase.from("analytics_monthly").upsert(monthlyRows, {
    onConflict: "year_month",
  });
  if (err3) console.error("analytics_monthly upsert error:", err3.message);
  else console.log("analytics_monthly:", monthlyRows.length, "rows upserted.");
  }

  // --- Area Market Health (CityRegion and PostalCode) ---
  const now = new Date();
  const thisMonth = toYearMonth(now);
  const cutoff90 = daysAgo(90);
  const cutoff30 = daysAgo(30);
  const cutoff60 = daysAgo(60);

  function areaKey(areaType, areaValue) {
    return areaType + "\0" + (areaValue || "Unknown");
  }
  const healthByArea = new Map();

  function getHealth(areaType, areaValue) {
    const key = areaKey(areaType, areaValue);
    if (!healthByArea.has(key)) {
      healthByArea.set(key, {
        area_type: areaType,
        area_value: areaValue || "Unknown",
        activeCount: 0,
        activeListPrices: [],
        newThisMonth: 0,
        soldThisMonth: 0,
        expiredThisMonth: 0,
        soldLast90Prices: [],
        soldLast30Prices: [],
        soldPrev30Prices: [],
        soldLast90Sqft: [],
        soldLast30Count: 0,
      });
    }
    return healthByArea.get(key);
  }

  for (const r of all) {
    const idx = r.idx || {};
    const vow = r.vow || {};
    const isActive = Object.keys(idx).length > 0 && !vow.CloseDate;
    const listPrice = parseFloat(idx.ListPrice ?? idx.OriginalListPrice);
    const listDate = parseDate(idx.OriginalEntryTimestamp);
    const expDate = parseDate(idx.ExpirationDate);
    const soldDate = parseDate(vow.SoldEntryTimestamp ?? vow.CloseDate);
    const closePrice = parseFloat(vow.ClosePrice);
    const livingArea = parseFloat(vow.LivingArea ?? idx.LivingArea ?? vow.BuildingAreaTotal ?? idx.BuildingAreaTotal);

    if (Object.keys(idx).length > 0) {
      const cityRegion = (idx.CityRegion || idx.City || "Unknown").trim() || "Unknown";
      const postalCode = (idx.PostalCode || "").trim() || "Unknown";
      if (toYearMonth(listDate) === thisMonth) {
        getHealth("CityRegion", cityRegion).newThisMonth += 1;
        getHealth("PostalCode", postalCode).newThisMonth += 1;
      }
      if (isActive) {
        getHealth("CityRegion", cityRegion).activeCount += 1;
        getHealth("PostalCode", postalCode).activeCount += 1;
        if (!isNaN(listPrice) && listPrice > 0) {
          getHealth("CityRegion", cityRegion).activeListPrices.push(listPrice);
          getHealth("PostalCode", postalCode).activeListPrices.push(listPrice);
        }
        if (expDate && toYearMonth(expDate) === thisMonth) {
          getHealth("CityRegion", cityRegion).expiredThisMonth += 1;
          getHealth("PostalCode", postalCode).expiredThisMonth += 1;
        }
      }
    }

    if (soldDate && (closePrice != null && !isNaN(closePrice))) {
      const cityRegion = (vow.CityRegion || vow.City || "Unknown").trim() || "Unknown";
      const postalCode = (vow.PostalCode || "").trim() || "Unknown";
      if (toYearMonth(soldDate) === thisMonth) {
        getHealth("CityRegion", cityRegion).soldThisMonth += 1;
        getHealth("PostalCode", postalCode).soldThisMonth += 1;
      }
      if (soldDate >= cutoff90) {
        getHealth("CityRegion", cityRegion).soldLast90Prices.push(closePrice);
        getHealth("PostalCode", postalCode).soldLast90Prices.push(closePrice);
        if (livingArea > 0) {
          getHealth("CityRegion", cityRegion).soldLast90Sqft.push(closePrice / livingArea);
          getHealth("PostalCode", postalCode).soldLast90Sqft.push(closePrice / livingArea);
        }
      }
      if (soldDate >= cutoff30) {
        getHealth("CityRegion", cityRegion).soldLast30Prices.push(closePrice);
        getHealth("PostalCode", postalCode).soldLast30Prices.push(closePrice);
        getHealth("CityRegion", cityRegion).soldLast30Count += 1;
        getHealth("PostalCode", postalCode).soldLast30Count += 1;
      }
      if (soldDate >= cutoff60 && soldDate < cutoff30) {
        getHealth("CityRegion", cityRegion).soldPrev30Prices.push(closePrice);
        getHealth("PostalCode", postalCode).soldPrev30Prices.push(closePrice);
      }
    }
  }

  const healthRows = [];
  for (const h of healthByArea.values()) {
    if (h.area_value === "Unknown" && h.area_type === "PostalCode") continue;
    const activeListPrices = h.activeListPrices || [];
    const sold90 = h.soldLast90Prices || [];
    const sold30 = h.soldLast30Prices || [];
    const prev30 = h.soldPrev30Prices || [];
    const sold30Count = h.soldLast30Count || 0;
    const totalActive = h.activeCount || 0;
    const soldPerMonth = sold30Count; // sold in last 30 days as proxy for monthly rate
    const monthsOfSupply = soldPerMonth > 0 ? totalActive / soldPerMonth : null;
    let marketIndicator = null;
    if (monthsOfSupply != null) {
      if (monthsOfSupply < 4) marketIndicator = "sellers";
      else if (monthsOfSupply <= 6) marketIndicator = "neutral";
      else marketIndicator = "buyers";
    }
    const absorptionRate = totalActive > 0 && h.soldThisMonth != null ? h.soldThisMonth / totalActive : null;

    let priceTrendDirection = null;
    let priceTrendPctChange = null;
    if (sold30.length > 0 && prev30.length > 0) {
      const avgRecent = sold30.reduce((a, b) => a + b, 0) / sold30.length;
      const avgPrev = prev30.reduce((a, b) => a + b, 0) / prev30.length;
      if (avgPrev > 0) {
        priceTrendPctChange = Math.round(((avgRecent - avgPrev) / avgPrev) * 10000) / 100;
        if (priceTrendPctChange > 1) priceTrendDirection = "up";
        else if (priceTrendPctChange < -1) priceTrendDirection = "down";
        else priceTrendDirection = "flat";
      }
    }

    healthRows.push({
      area_type: h.area_type,
      area_value: h.area_value,
      total_active: totalActive,
      new_this_month: h.newThisMonth || 0,
      sold_this_month: h.soldThisMonth || 0,
      expired_this_month: h.expiredThisMonth || 0,
      avg_list_price: activeListPrices.length ? Math.round(activeListPrices.reduce((a, b) => a + b, 0) / activeListPrices.length * 100) / 100 : null,
      median_list_price: activeListPrices.length ? median(activeListPrices) : null,
      avg_sold_price_last_90_days: sold90.length ? Math.round(sold90.reduce((a, b) => a + b, 0) / sold90.length * 100) / 100 : null,
      price_trend_direction: priceTrendDirection,
      price_trend_pct_change: priceTrendPctChange,
      avg_price_per_sqft: (h.soldLast90Sqft || []).length ? Math.round((h.soldLast90Sqft.reduce((a, b) => a + b, 0) / h.soldLast90Sqft.length) * 100) / 100 : null,
      months_of_supply: monthsOfSupply != null ? Math.round(monthsOfSupply * 100) / 100 : null,
      absorption_rate: absorptionRate != null ? Math.round(absorptionRate * 10000) / 10000 : null,
      market_indicator: marketIndicator,
      updated_at: new Date().toISOString(),
    });
  }

  const { error: err4 } = await supabase.from("analytics_area_market_health").upsert(healthRows, {
    onConflict: "area_type,area_value",
  });
  if (err4) console.error("analytics_area_market_health upsert error:", err4.message);
  else console.log("analytics_area_market_health:", healthRows.length, "rows upserted.");

  console.log("Market heat analytics saved to Supabase.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
