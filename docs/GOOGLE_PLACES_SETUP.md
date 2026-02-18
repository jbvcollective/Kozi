# Google Places API – Schools & Transportation

**Schools near this location** can use the Google Places API **directly per listing** (no Supabase storage required). Set `GOOGLE_PLACES_API_KEY` (or `GOOGLE_MAPS_API_KEY`) and schools are fetched from Google when a user views a listing.

- **With Express backend:** set the key in the project root `.env`. `GET /api/schools` will call Google Places first.
- **Next.js only (no backend):** set `GOOGLE_PLACES_API_KEY` in `frontend/.env.local` so the route `GET /api/schools/near?lat=&lng=` can fetch schools server-side.

Optionally, you can still **sync** schools and transport into Supabase (see below) for offline/cached use.

## 1. Get a Google API key

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project.
3. Enable **Places API (New)** (or **Places API**): APIs & Services → Library → search “Places” → enable.
4. Create an API key: APIs & Services → Credentials → Create credentials → API key.
5. Restrict the key (recommended): restrict to “Places API” and optionally to your server IPs.

**Do not commit your API key.** Use environment variables only. If you ever paste a key in chat or in code, rotate it (revoke and create a new one) in Google Cloud Console.

## 2. Configure environment

In the project root `.env` (used by the sync script), add:

```env
# Google Places API – used by scripts/syncGooglePlaces.js
GOOGLE_PLACES_API_KEY=your_api_key_here

# Or if you already use the same key for Maps:
# GOOGLE_MAPS_API_KEY=your_api_key_here

# Supabase (required for saving results)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Optional:

```env
# Multiple centers: "lat,lng|lat,lng" (default: Toronto 43.65,-79.38)
GOOGLE_PLACES_CENTERS=43.65,-79.38|45.5,-73.6
```

## 3. Create Supabase tables

Run the SQL in Supabase (SQL Editor):

- **`sql/google_places_tables.sql`** – creates `places_schools` and `places_transport` (and RLS).

## 4. Run the sync

From the project root:

```bash
npm run sync-google-places
```

Or:

```bash
node scripts/syncGooglePlaces.js
```

The script will:

- For each center (lat/lng), call the Places API for **schools** (preschool, primary, secondary, university, etc.) and **transport** (transit, bus, train, subway, light rail, bus stop).
- Upsert results into **`places_schools`** and **`places_transport`** in Supabase.

## Tables

| Table             | Description                                      |
|-------------------|--------------------------------------------------|
| `places_schools`  | Schools from Google (level, name, address, lat/lng). |
| `places_transport`| Transit stations, bus/train/subway stops, etc.  |

Your app can query these tables (e.g. “schools near this listing” or “transit near this address”) and show them on listing or map views.
