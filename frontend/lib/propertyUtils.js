import { mapMergedToHouseSigma, normalizeCanadianPostalCode } from "./listingSchema";

/**
 * Format beds for display: "4+1" when above/below grade, else total number.
 * @param {{ beds?: number, bedsAboveGrade?: number, bedsBelowGrade?: number }} property
 * @returns {string|number}
 */
export function formatBeds(property) {
  if (!property) return "—";
  const above = property.bedsAboveGrade ?? 0;
  const below = property.bedsBelowGrade ?? 0;
  if ((above > 0 || below > 0) && Number.isFinite(above) && Number.isFinite(below)) return `${above}+${below}`;
  return property.beds ?? "—";
}

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/**
 * Format days-on-market for display: "Just Listed" (&lt; 1h), "Xh ago" (&lt; 24h), "Xd ago" (days).
 * @param {{ listedAt?: number, daysOnMarket?: number }} options - listedAt = list date in ms (optional), daysOnMarket = fallback days
 * @returns {string}
 */
export function formatDaysOnMarket(options = {}) {
  const { listedAt, daysOnMarket } = options;
  const now = Date.now();
  if (listedAt != null && Number.isFinite(listedAt)) {
    const elapsed = now - listedAt;
    if (elapsed < MS_PER_HOUR) return "Just Listed";
    if (elapsed < MS_PER_DAY) {
      const hours = Math.floor(elapsed / MS_PER_HOUR);
      return `${hours}h ago`;
    }
    const days = Math.floor(elapsed / MS_PER_DAY);
    return `${days}d ago`;
  }
  const dom = daysOnMarket != null && Number.isFinite(daysOnMarket) ? Number(daysOnMarket) : null;
  if (dom === 0 || dom === null) return "Just Listed";
  return `${dom}d ago`;
}

/**
 * Map a listings_unified row (listing_key, idx, vow) to a Property shape for UI.
 * Also sets property.listing = HouseSigma-style fields for Key Facts / Details / Description.
 */
export function mapListingToProperty(row) {
  const idx = row.idx || {};
  const vow = row.vow || {};
  const merged = { ...vow, ...idx };

  const photos =
    idx.Photos?.length ? idx.Photos :
    vow.Photos?.length ? vow.Photos :
    idx.photos?.length ? idx.photos : (vow.photos || []);

  const province = merged.Province || merged.StateOrProvince || merged.State;
  const postalCodeRaw = merged.PostalCode;
  const postalCode = postalCodeRaw && String(postalCodeRaw).trim() ? normalizeCanadianPostalCode(postalCodeRaw) : null;
  const streetParts = [
    merged.StreetNumber,
    merged.StreetDirPrefix,
    merged.StreetName,
    merged.StreetSuffix,
    merged.StreetDirSuffix,
  ].filter(Boolean);
  const streetLine = streetParts.join(" ").trim();
  const unitNumber = merged.UnitNumber ? String(merged.UnitNumber).trim() : null;
  const buildingName = merged.BuildingName && String(merged.BuildingName).trim() ? String(merged.BuildingName).trim() : null;
  const propType = String(merged.PropertyType || merged.PropertySubType || "").toLowerCase();
  const isCondoOrApt = !!(
    unitNumber ||
    propType.includes("condo") ||
    propType.includes("apartment") ||
    propType.includes("apt") ||
    propType.includes("multi")
  );
  // Condo/Apartment: Name, 123 Main St, Apt 4B, City, State, Zip
  // House: Name, 123 Main St, City, State, Zip (no unit)
  const unitLabel = isCondoOrApt && unitNumber ? `Apt ${unitNumber}` : null;
  const addressStreetParts = [buildingName, streetLine, unitLabel].filter(Boolean);
  const addressStreet = addressStreetParts.length ? addressStreetParts.join(", ") : null;
  const city = merged.City ? String(merged.City).trim() : null;
  const cityLineParts = [city, province, postalCode].filter(Boolean);
  const cityLine = cityLineParts.length ? cityLineParts.join(", ") : null;
  const address =
    addressStreet && cityLine
      ? `${addressStreet}, ${cityLine}`
      : addressStreet || cityLine || [streetLine, unitLabel, city, province, postalCode].filter(Boolean).join(", ") || null;

  const listPrice = Number(merged.ListPrice || merged.ClosePrice || 0);
  const origList = Number(merged.OriginalListPrice || 0);
  const prevList = Number(merged.PreviousListPrice || 0);
  const previousPrice = Number(merged.PreviousListPrice || merged.ListPrice || 0);
  const maintenance = Number(merged.AssociationFee || merged.MaintenanceFee || merged.CondoFee || 0);
  const taxes = Number(merged.TaxAnnualAmount || merged.Taxes || 0);

  // Days on market: use feed value, or compute from listing timestamps (OriginalEntryTimestamp = list date)
  let dom = Number(merged.DaysOnMarket ?? merged.DOM ?? merged.CDOM ?? NaN);
  let listedAtMs = undefined;
  const listDate = merged.OriginalEntryTimestamp ?? merged.ModificationTimestamp;
  if (listDate) {
    const ts = typeof listDate === "string" ? new Date(listDate).getTime() : (listDate && typeof listDate.getTime === "function" ? listDate.getTime() : NaN);
    if (Number.isFinite(ts)) {
      listedAtMs = ts;
      if (!Number.isFinite(dom) || dom < 0) {
        const days = Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000));
        dom = Math.max(0, days);
      }
    }
  }
  if (!Number.isFinite(dom)) dom = 0;

  // Prefer current status from idx (IDX = current listing). If currently For Sale/Active, do not show Sold.
  const currentStatus = (idx.StandardStatus ?? idx.Status ?? idx.MlsStatus ?? vow.StandardStatus ?? vow.Status ?? vow.MlsStatus ?? "").trim();
  const onMarket = ["Active", "For Sale", "New", "Coming Soon", "Pending", "Active Under Contract"];
  let status = "Active";
  if (currentStatus === "Sold" || (currentStatus === "" && (merged.ClosePrice && Number(merged.ClosePrice) > 0))) status = "Sold";
  else if (onMarket.includes(currentStatus) || !currentStatus) {
    if (origList > listPrice || prevList > listPrice) status = "Price Reduced";
    else if (dom <= 3) status = "New";
  } else status = currentStatus || "Active";

  // Open house from MLS (idx/vow): common field names
  const unparsed = merged.UnparsedOpenHouse || merged.PublicOpenHouse;
  const openHouseFromFeed =
    typeof unparsed === "string" && unparsed.trim()
      ? unparsed.trim()
      : Array.isArray(unparsed) && unparsed.length
        ? unparsed.map((e) => (typeof e === "string" ? e : e?.StartTime || e?.EndTime || "").trim()).filter(Boolean).join("; ")
        : null;
  const openHouseDate = merged.OpenHouseDate || merged.PublicOpenHouseDate;
  const openHouseStart = merged.OpenHouseStartTime || merged.OpenHouseTime;
  const openHouseEnd = merged.OpenHouseEndTime;
  const openHouseBuilt =
    openHouseDate || openHouseStart
      ? [openHouseDate, openHouseStart, openHouseEnd].filter(Boolean).join(" ")
      : null;
  const openHouse = openHouseFromFeed || openHouseBuilt || null;

  const listingBrokerage = merged.ListOfficeName || merged.ListingOfficeName || merged.ListOffice || merged.Brokerage || null;
  const listingAgent = merged.ListAgentFullName || merged.ListAgentName || merged.ListingAgentName || merged.AgentName || null;
  const listingAgentPhone = merged.ListAgentPreferredPhone || merged.ListAgentDirectPhone || merged.ListAgentOfficePhone || merged.ListAgentCellPhone || merged.AgentPhone || null;
  const listingAgentEmail = merged.ListAgentEmail || merged.ListAgentPreferredEmail || merged.AgentEmail || null;

  const hasPriceReduction = !!(origList > listPrice || prevList > listPrice);
  const isRental = (() => {
    const tt = String(merged.TransactionType ?? "").toLowerCase();
    const type = String(merged.PropertyType ?? merged.PropertySubType ?? "").toLowerCase();
    return !!(
      merged.LeaseAmount != null ||
      merged.Year1LeasePrice != null ||
      tt.includes("lease") ||
      tt.includes("rent") ||
      type.includes("rental") ||
      type.includes("lease")
    );
  })();
  const priceIsMonthly = isRental;
  const displayPrice = priceIsMonthly && (merged.LeaseAmount ?? merged.Year1LeasePrice) != null
    ? Number(merged.LeaseAmount ?? merged.Year1LeasePrice)
    : listPrice;

  return {
    id: row.listing_key || merged.ListingKey || String(Math.random()),
    listing: mapMergedToHouseSigma(merged),
    listingBrokerage: listingBrokerage && String(listingBrokerage).trim() ? String(listingBrokerage).trim() : undefined,
    listingAgent: listingAgent && String(listingAgent).trim() ? String(listingAgent).trim() : undefined,
    listingAgentPhone: listingAgentPhone && String(listingAgentPhone).trim() ? String(listingAgentPhone).trim() : undefined,
    listingAgentEmail: listingAgentEmail && String(listingAgentEmail).trim() ? String(listingAgentEmail).trim() : undefined,
    title: merged.PublicRemarks
      ? merged.PublicRemarks.substring(0, 40) + "..."
      : (merged.StreetName || "Architectural Sanctuary"),
    price: displayPrice,
    priceIsMonthly: priceIsMonthly,
    originalPrice: !isRental && hasPriceReduction ? Math.max(origList, prevList) : undefined,
    previousListPrice: previousPrice > listPrice ? previousPrice : undefined,
    location: address || "Global Portfolio",
    addressStreet: addressStreet || undefined,
    addressCity: city || undefined,
    addressProvince: province && String(province).trim() ? String(province).trim() : undefined,
    addressPostalCode: postalCode || undefined,
    city: city || undefined,
    bedsAboveGrade: Number(merged.BedroomsAboveGrade ?? 0),
    bedsBelowGrade: Number(merged.BedroomsBelowGrade ?? 0),
    beds: (() => {
      const above = Number(merged.BedroomsAboveGrade ?? 0);
      const below = Number(merged.BedroomsBelowGrade ?? 0);
      if (above > 0 || below > 0) return above + below;
      return Number(merged.BedroomsTotal || merged.BedsTotal || 0);
    })(),
    baths: (() => {
      const totalInt = Number(merged.BathroomsTotalInteger);
      if (Number.isFinite(totalInt) && totalInt >= 0) return totalInt;
      const washroomSum = [1, 2, 3, 4, 5].reduce(
        (sum, n) => sum + (Number(merged[`WashroomsType${n}`]) || 0),
        0
      );
      if (washroomSum > 0) return washroomSum;
      return Number(merged.BathroomsTotalDecimal || merged.BathsTotal || 0);
    })(),
    washroomTypes: (() => {
      const out = [];
      for (let n = 1; n <= 5; n++) {
        const count = Number(merged[`WashroomsType${n}`]);
        if (Number.isFinite(count) && count > 0) out.push({ type: n, count });
      }
      return out.length ? out : undefined;
    })(),
    parking: Number(merged.GarageSpaces || merged.ParkingSpaces || 0),
    sqft: (() => {
      const exact = Number(merged.LivingArea || merged.BuildingAreaTotal || 0);
      if (exact > 0) return exact;
      const rangeRaw = merged.LivingAreaRange != null ? String(merged.LivingAreaRange).trim() : "";
      if (!rangeRaw) return 0;
      const rangeMatch = rangeRaw.match(/^(\d{1,6})\s*-\s*(\d{1,6})$/);
      if (rangeMatch) {
        const low = Number(rangeMatch[1]);
        const high = Number(rangeMatch[2]);
        if (Number.isFinite(low) && Number.isFinite(high) && low <= high) return Math.round((low + high) / 2);
      }
      const single = Number(rangeRaw.replace(/\D/g, ""));
      return Number.isFinite(single) && single > 0 ? single : 0;
    })(),
    livingAreaRange: (merged.LivingAreaRange != null && String(merged.LivingAreaRange).trim()) ? String(merged.LivingAreaRange).trim() : undefined,
    maintenance: maintenance > 0 ? maintenance : undefined,
    taxes: taxes > 0 ? taxes : undefined,
    type: merged.PropertyType || merged.PropertySubType || "Modernist",
    image: photos[0] || "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=1200",
    images: photos.length > 0 ? photos : ["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=1200"],
    description: merged.PublicRemarks || "Contact our advisors for private details on this exceptional listing.",
    amenities: Array.isArray(merged.ExteriorFeatures) ? merged.ExteriorFeatures : ["Concierge", "Architectural Design"],
    lat: (() => {
      const v = merged.Latitude ?? merged.latitude ?? merged.LATITUDE;
      if (v == null || v === "") return undefined;
      const n = Number(v);
      return Number.isFinite(n) && n >= -90 && n <= 90 ? n : undefined;
    })(),
    lng: (() => {
      const v = merged.Longitude ?? merged.longitude ?? merged.LONGITUDE;
      if (v == null || v === "") return undefined;
      const n = Number(v);
      return Number.isFinite(n) && n >= -180 && n <= 180 ? n : undefined;
    })(),
    daysOnMarket: dom,
    listedAt: listedAtMs,
    status,
    openHouse: openHouse || undefined,
  };
}
