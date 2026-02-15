/**
 * HouseSigma-style listing schema: canonical field names and mapping from PropTx idx/vow.
 * Used for Key Facts, Details, and Description on the listing detail page.
 */

// PropTx (IDX/VOW) uses PascalCase. Map to camelCase and optional display label.
const PROPTX_TO_CANONICAL = {
  // Identifiers
  ListingKey: "listingKey",
  MlsStatus: "mlsStatus",
  StandardStatus: "standardStatus",
  ContractStatus: "contractStatus",
  TransactionType: "transactionType",
  // Price
  ListPrice: "listPrice",
  OriginalListPrice: "originalListPrice",
  ExpirationDate: "expirationDate",
  ListingContractDate: "listingContractDate",
  OriginalEntryTimestamp: "originalEntryTimestamp",
  ModificationTimestamp: "modificationTimestamp",
  // Rentals (per month)
  LeaseAmount: "leaseAmount",
  Year1LeasePrice: "year1LeasePrice",
  LeaseTerm: "leaseTerm",
  RentIncludes: "rentIncludes",
  // Address
  StreetNumber: "streetNumber",
  StreetName: "streetName",
  StreetSuffix: "streetSuffix",
  UnitNumber: "unitNumber",
  City: "city",
  CityRegion: "cityRegion",
  StateOrProvince: "stateOrProvince",
  PostalCode: "postalCode",
  UnparsedAddress: "unparsedAddress",
  CrossStreet: "crossStreet",
  // Property
  PropertyType: "propertyType",
  PropertySubType: "propertySubType",
  ArchitecturalStyle: "architecturalStyle",
  ConstructionMaterials: "constructionMaterials",
  ApproximateAge: "approximateAge",
  LegalStories: "legalStories",
  LivingAreaRange: "livingAreaRange",
  SquareFootSource: "squareFootSource",
  BuildingAreaTotal: "livingArea", // fallback for sqft
  // Rooms
  BedroomsTotal: "bedroomsTotal",
  BedroomsAboveGrade: "bedroomsAboveGrade",
  KitchensTotal: "kitchensTotal",
  BathroomsTotalInteger: "bathroomsTotalInteger",
  RoomsAboveGrade: "roomsAboveGrade",
  WashroomsType1: "washroomsType1",
  WashroomsType2: "washroomsType2",
  WashroomsType3: "washroomsType3",
  WashroomsType4: "washroomsType4",
  WashroomsType5: "washroomsType5",
  // Parking / Locker
  GarageYN: "garageYN",
  GarageType: "garageType",
  ParkingTotal: "parkingTotal",
  CoveredSpaces: "coveredSpaces",
  ParkingSpot1: "parkingSpot1",
  ParkingLevelUnit1: "parkingLevelUnit1",
  Locker: "locker",
  LockerLevel: "lockerLevel",
  LockerUnit: "lockerUnit",
  // Features
  Cooling: "cooling",
  HeatType: "heatType",
  HeatSource: "heatSource",
  Basement: "basement",
  Furnished: "furnished",
  FireplaceYN: "fireplaceYN",
  WaterfrontYN: "waterfrontYN",
  PetsAllowed: "petsAllowed",
  InteriorFeatures: "interiorFeatures",
  PropertyFeatures: "propertyFeatures",
  AssociationAmenities: "associationAmenities",
  // Remarks
  PublicRemarks: "publicRemarks",
  // Media
  VirtualTourURLUnbranded: "virtualTourURLUnbranded",
  // Office
  ListOfficeName: "listOfficeName",
  PropertyManagementCompany: "propertyManagementCompany",
};

/** Human-readable labels for Key Facts / Details sections */
export const LISTING_LABELS = {
  // Identifiers
  listingKey: "Listing ID",
  mlsStatus: "MLS Status",
  standardStatus: "Status",
  contractStatus: "Contract Status",
  transactionType: "Transaction Type",
  // Price
  listPrice: "List Price",
  originalListPrice: "Original List Price",
  expirationDate: "Expiration Date",
  listingContractDate: "Listing Contract Date",
  originalEntryTimestamp: "Date Listed",
  modificationTimestamp: "Last Modified",
  leaseAmount: "Rent (per month)",
  year1LeasePrice: "Year 1 Lease Price",
  leaseTerm: "Lease Term",
  rentIncludes: "Rent Includes",
  // Address
  streetNumber: "Street Number",
  streetName: "Street Name",
  streetSuffix: "Street Suffix",
  unitNumber: "Unit",
  city: "City",
  cityRegion: "City Region",
  stateOrProvince: "Province",
  postalCode: "Postal Code",
  unparsedAddress: "Address",
  crossStreet: "Cross Street",
  // Property
  propertyType: "Property Type",
  propertySubType: "Property Sub Type",
  architecturalStyle: "Architectural Style",
  constructionMaterials: "Construction Materials",
  approximateAge: "Approximate Age",
  legalStories: "Stories",
  livingAreaRange: "Living Area Range",
  squareFootSource: "Square Foot Source",
  livingArea: "Living Area",
  // Rooms
  bedroomsTotal: "Bedrooms",
  bedroomsAboveGrade: "Bedrooms Above Grade",
  kitchensTotal: "Kitchens",
  bathroomsTotalInteger: "Bathrooms",
  roomsAboveGrade: "Rooms Above Grade",
  washroomsType1: "Washrooms Type 1",
  washroomsType2: "Washrooms Type 2",
  washroomsType3: "Washrooms Type 3",
  washroomsType4: "Washrooms Type 4",
  washroomsType5: "Washrooms Type 5",
  // Parking / Locker
  garageYN: "Garage",
  garageType: "Garage Type",
  parkingTotal: "Parking Total",
  coveredSpaces: "Covered Spaces",
  parkingSpot1: "Parking Spot",
  parkingLevelUnit1: "Parking Level/Unit",
  locker: "Locker",
  lockerLevel: "Locker Level",
  lockerUnit: "Locker Unit",
  // Features
  cooling: "Cooling",
  heatType: "Heat Type",
  heatSource: "Heat Source",
  basement: "Basement",
  furnished: "Furnished",
  fireplaceYN: "Fireplace",
  waterfrontYN: "Waterfront",
  petsAllowed: "Pets Allowed",
  interiorFeatures: "Interior Features",
  propertyFeatures: "Property Features",
  associationAmenities: "Association Amenities",
  // Remarks
  publicRemarks: "Description",
  // Media
  virtualTourURLUnbranded: "Virtual Tour",
  // Office
  listOfficeName: "List Office",
  propertyManagementCompany: "Property Management",
};

/** Order for Key Facts section (top-level summary). publicRemarks shown in Description only. */
export const KEY_FACTS_ORDER = [
  "listPrice", "originalListPrice", "leaseAmount", "year1LeasePrice", "leaseTerm", "rentIncludes",
  "expirationDate", "listingContractDate",
  "unparsedAddress", "streetNumber", "streetName", "unitNumber", "city", "cityRegion", "stateOrProvince", "postalCode", "crossStreet",
  "propertyType", "propertySubType", "architecturalStyle", "constructionMaterials", "approximateAge", "legalStories", "livingAreaRange", "livingArea", "squareFootSource",
  "bedroomsTotal", "bedroomsAboveGrade", "kitchensTotal", "bathroomsTotalInteger",
  "washroomsType1", "washroomsType2", "washroomsType3", "washroomsType4", "washroomsType5",
  "roomsAboveGrade",
  "garageYN", "garageType", "parkingTotal", "coveredSpaces", "parkingSpot1", "parkingLevelUnit1", "locker", "lockerLevel", "lockerUnit",
  "cooling", "heatType", "heatSource", "basement", "furnished", "fireplaceYN", "waterfrontYN", "petsAllowed",
  "interiorFeatures", "propertyFeatures", "associationAmenities",
  "listOfficeName", "propertyManagementCompany",
  "mlsStatus", "standardStatus", "contractStatus", "transactionType", "listingKey",
];

/** Order for Details section (full data) */
export const DETAILS_ORDER = KEY_FACTS_ORDER;

/**
 * Build HouseSigma-style listing object from merged idx/vow (vow overridden by idx).
 * Only includes keys that have a non-null, non-empty value.
 */
export function mapMergedToHouseSigma(merged) {
  if (!merged || typeof merged !== "object") return {};
  const out = {};
  for (const [propTxKey, canonicalKey] of Object.entries(PROPTX_TO_CANONICAL)) {
    const raw = merged[propTxKey];
    if (raw === undefined && merged[canonicalKey] !== undefined) {
      out[canonicalKey] = merged[canonicalKey];
      continue;
    }
    if (raw === null || raw === undefined) continue;
    if (Array.isArray(raw) && raw.length === 0) continue;
    if (typeof raw === "string" && raw.trim() === "") continue;
    out[canonicalKey] = raw;
  }
  // Photos: IDX/VOW use Photos or photos array
  const photos = merged.Photos ?? merged.photos ?? [];
  if (Array.isArray(photos) && photos.length > 0) out.photos = photos;
  return out;
}

/**
 * Format a value for display (currency, YN, arrays). Returns string or React node for links.
 */
export function formatListingValue(key, value) {
  if (value === null || value === undefined) return null;
  if (key === "listPrice" || key === "originalListPrice" || key === "year1LeasePrice") {
    const n = Number(value);
    return Number.isFinite(n) ? `$${n.toLocaleString()}` : String(value);
  }
  if (key === "leaseAmount") {
    const n = Number(value);
    return Number.isFinite(n) ? `$${n.toLocaleString()}/mo` : String(value);
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (key === "garageYN" || key === "fireplaceYN" || key === "waterfrontYN") {
    const v = String(value).toLowerCase();
    if (v === "true" || v === "y" || v === "yes" || v === "1") return "Yes";
    if (v === "false" || v === "n" || v === "no" || v === "0") return "No";
  }
  if (key === "virtualTourURLUnbranded" && typeof value === "string" && value.startsWith("http")) {
    return value; // caller can render as <a href={value}>
  }
  if (Array.isArray(value)) return value.length === 0 ? null : value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
