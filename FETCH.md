# Fetch commands

| Command | What it fetches | Saves to |
|---------|-----------------|----------|
| **`npm run fetch-all`** | **IDX + VOW** — runs both fetches, saves each to its table | `idx_listings` then `vow_listings` |
| **`npm run fetch-listings`** | **IDX only** — PropTx IDX property + media (photos) | `idx_listings` |
| **`npm run fetch-vow-listings`** | **VOW only** — PropTx VOW sold + full property + photos | `vow_listings` |

- **fetch-all**: runs IDX fetch first (saves to `idx_listings`), then VOW fetch (saves to `vow_listings`). One command for both.
- IDX script does not fetch or write any VOW data.
- VOW script does not fetch or write any IDX data.

Run the SQL for each table once in Supabase before fetching: `sql/idx_listings.sql`, `sql/vow_listings.sql`.
