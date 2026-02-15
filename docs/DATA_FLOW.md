# How listing data is fetched and sorted (idx / vow)

## One row per listing, two columns for data

Every listing is stored as **one row** in `listings_unified` with:

- **`listing_key`** – unique ID
- **`idx`** – JSONB: **all data** from the IDX feed for that listing (property + photos), or `{}` if IDX has no record for it
- **`vow`** – JSONB: **all data** from the VOW feed for that listing (property + photos), or `null` if VOW has no record for it
- **`updated_at`** – last sync time

We do **not** restrict by status: **idx** holds whatever the IDX feed returns; **vow** holds whatever the VOW feed returns. Both feeds can include active, sold, terminated, etc.; we store each feed’s full payload in its column.

## Where the data comes from

| Source | What it is | Stored in | Fetched by |
|--------|------------|-----------|------------|
| **IDX** (PropTx IDX token) | Active/for-sale listings | `idx` | `fetchAllListingsUnified.js` or `fetchListings.js` |
| **VOW** (PropTx VOW token) | Sold (and optionally terminated) listings | `vow` | `fetchAllListingsUnified.js` or `fetchVowListings.js` |

- **IDX** = PropTx IDX feed (full payload per their IDX schema).
- **VOW** = PropTx VOW feed (full payload per their VOW schema; VOW has extra fields like ClosePrice, SoldEntryTimestamp, etc.). Optional: set VOW_FILTER_SOLD_ONLY=true in .env to restrict VOW to sold only.
## How the fetcher works (`fetchAllListingsUnified.js`)

1. **Fetch IDX** – Get all listings from PropTx IDX Property API (up to `LISTING_LIMIT`), full property fields + media.
2. **Fetch VOW** – Get all listings from PropTx VOW Property API (up to `LISTING_LIMIT`), full property fields + media. By default **no** status filter; set `VOW_FILTER_SOLD_ONLY=true` in `.env` to restrict VOW to sold only.
3. **Union of keys** – Collect every `listing_key` that appears in either IDX or VOW.
4. **For each listing_key:**
   - If it exists in IDX: fetch IDX media (photos), build payload → **write to `idx`** (or `{}` if no IDX record).
   - If it exists in VOW: fetch VOW media, build payload → **write to `vow`** (or `null` if no VOW record).
5. **Upsert one row** – `{ listing_key, idx, vow, updated_at }` into `listings_unified`.

So: **all data for each listing is fetched and sorted into `idx` and `vow`**; both columns are set on every row (with `{}`/`null` when a source has no data for that listing).

## How the app uses it

- **Frontend / API** – Select `listing_key, idx, vow, updated_at` from `listings_unified` (or `listings_unified_clean` for display without null/empty-array keys).
- **listings_unified_clean** – Same shape as `listings_unified`; `idx`/`vow` have null- and `[]`-valued keys stripped. Kept in sync by a trigger on `listings_unified`. See `sql/listings_unified_clean.sql`.
- **Mapping to UI** – Merge: `merged = { ...vow, ...idx }` so you get all fields from both feeds (idx overrides when both have the same key). Photos: prefer `idx.Photos`, then `vow.Photos`.
- **Status** – Derived from the merged data (e.g. “Sold” when `ClosePrice` or `Status === 'Sold'`; “Active”, “Price Reduced”, “New”, etc. from `StandardStatus` / `MlsStatus`).

## Sold or terminated only

To **fetch only sold or terminated listings**, use:

- **View** `v_listings_sold_terminated` – selects from `listings_unified` where `vow IS NOT NULL` or `idx->>'StandardStatus'` / `idx->>'Status'` is Sold/Terminated/Expired/Canceled. No duplicate storage.
- **Table** `listings_sold_terminated` – same columns as `listings_unified`, populated by `syncSoldTerminatedListings.js` from `listings_unified` for fast, dedicated queries.

See `sql/listings_sold_terminated.sql` and `syncSoldTerminatedListings.js`.
