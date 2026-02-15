import { mapMergedToHouseSigma } from "./listingSchema";

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

  const address = [
    merged.StreetNumber,
    merged.StreetName,
    merged.StreetSuffix,
    merged.UnitNumber ? `#${merged.UnitNumber}` : null,
    merged.City,
    merged.Province || merged.StateOrProvince || merged.State,
  ]
    .filter(Boolean)
    .join(" ");

  const listPrice = Number(merged.ListPrice || merged.ClosePrice || 0);
  const originalPrice = Number(merged.OriginalListPrice || merged.ListPrice || 0);
  const previousPrice = Number(merged.PreviousListPrice || merged.ListPrice || 0);
  const maintenance = Number(merged.AssociationFee || merged.MaintenanceFee || merged.CondoFee || 0);
  const taxes = Number(merged.TaxAnnualAmount || merged.Taxes || 0);

  // Days on market: use feed value, or compute from listing timestamps (OriginalEntryTimestamp = list date)
  let dom = Number(merged.DaysOnMarket ?? merged.DOM ?? merged.CDOM ?? NaN);
  if (!Number.isFinite(dom) || dom < 0) {
    const listDate = merged.OriginalEntryTimestamp ?? merged.ModificationTimestamp;
    if (listDate) {
      const ts = typeof listDate === "string" ? new Date(listDate).getTime() : (listDate && typeof listDate.getTime === "function" ? listDate.getTime() : NaN);
      if (Number.isFinite(ts)) {
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
    if (originalPrice > listPrice) status = "Price Reduced";
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
    originalPrice: originalPrice > listPrice ? originalPrice : undefined,
    previousListPrice: previousPrice > listPrice ? previousPrice : undefined,
    location: address || "Global Portfolio",
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
    sqft: Number(merged.LivingArea || merged.BuildingAreaTotal || 0),
    maintenance: maintenance > 0 ? maintenance : undefined,
    taxes: taxes > 0 ? taxes : undefined,
    type: merged.PropertyType || merged.PropertySubType || "Modernist",
    image: photos[0] || "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=1200",
    images: photos.length > 0 ? photos : ["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=1200"],
    description: merged.PublicRemarks || "Contact our advisors for private details on this exceptional listing.",
    amenities: Array.isArray(merged.ExteriorFeatures) ? merged.ExteriorFeatures : ["Concierge", "Architectural Design"],
    lat: merged.Latitude != null && merged.Latitude !== "" ? Number(merged.Latitude) : undefined,
    lng: merged.Longitude != null && merged.Longitude !== "" ? Number(merged.Longitude) : undefined,
    daysOnMarket: dom,
    status,
    openHouse: openHouse || undefined,
  };
}
