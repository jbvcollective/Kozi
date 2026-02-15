# Terminal setup and run

## 6. Go to Terminal

1. **`node -v`**
   - If an error appears:
     1. Download Node.js: https://nodejs.org/en/download
     2. Install it, then close and reopen your editor (e.g. PyCharm / Cursor) and try again.

2. **`npm install`**
   - Run this in the project folder that has `package.json`.
   - For the **frontend** app: `cd frontend` then `npm install`.

3. **`npm run dev`**
   - Starts the dev server (e.g. frontend at http://localhost:3001).

## 7. Go to New Terminal

1. **`npm run build`**
   - Run from the same folder where you ran `npm install` (e.g. `frontend`).
   - This creates the production build.
   - **Note:** For this Next.js frontend, the build output is in the **`.next`** folder, not `dist`. A `dist` folder is used by some other tools (e.g. Vite); Next.js uses `.next`.

---

**Quick reference (frontend):**
```bash
cd frontend
node -v
npm install
npm run dev
```
In a new terminal, to build:
```bash
cd frontend
npm run build
```

---

## Launch your app on Vercel (step-by-step for beginners)

You'll do three things: put your code on GitHub, connect that to Vercel, then add your Supabase keys so the live site works. **Backend vs frontend:** All UI and deployment config are in **`frontend/`**; root is backend only. See **DEPLOYMENT_STRUCTURE.md**.

---

### Step 1: Get your Supabase keys (you'll need them later)

1. Open **Supabase**: https://supabase.com and sign in.
2. Open your **project** (the one this app uses).
3. Go to **Project Settings** (gear icon in the left sidebar) → **API**.
4. Copy and save somewhere safe:
   - **Project URL** (e.g. `https://xxxxx.supabase.co`) → you'll use this as `NEXT_PUBLIC_SUPABASE_URL`.
   - **anon public** key (under "Project API keys") → you'll use this as `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

---

### Step 2: Put your code on GitHub

1. Create a **GitHub account** if you don't have one: https://github.com/signup.
2. **Install Git** on your computer if needed: https://git-scm.com/downloads (then restart your editor).
3. Open **Terminal** in your project folder (e.g. `C:\Users\johnb\Documents\VestaHome_Backend`).
4. Run these three commands one at a time (you don't need to type your username here—run them as-is):

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

5. On GitHub: click **+** (top right) → **New repository**.
6. Name it (e.g. `Lumina-Realty`). Choose **Public** (recommended—Vercel can connect easily) or **Private** if you want only you to see the code. Leave "Add a README" **unchecked**, then click **Create repository**.
7. On the new repo page, copy the **URL** (e.g. `https://github.com/jbvcollective/Lumina-Realty.git`).
8. Back in Terminal, run these—paste your repo URL in place of `YOUR_REPO_URL` (e.g. `https://github.com/jbvcollective/Lumina-Realty.git`):

   ```bash
   git remote add origin YOUR_REPO_URL
   git branch -M main
   git push -u origin main
   ```

   If it asks for login, use your GitHub username and a **Personal Access Token** (GitHub → Settings → Developer settings → Personal access tokens → Generate new token). Use the token as the password.

Your code is now on GitHub.

---

### Step 3: Sign in to Vercel and import the project

1. Go to **https://vercel.com** and click **Sign up** (or **Log in** if you have an account).
2. Choose **Continue with GitHub** and allow Vercel to access your GitHub.
3. After sign-in, click **Add New** → **Project** (or **Import Project**).
4. Import the repo you pushed (e.g. **Lumina-Realty**). **Don't click Deploy yet**—set the options in the next steps.

---

### Step 4: Set Root Directory and build settings (important)

Your repo **Lumina-Realty** has the Next.js app in the **`frontend`** folder at the repo root. Vercel must build from that folder or you'll get "Page not found" (404).

1. **Root Directory:** Click **Edit**, clear the default, and type **`frontend`** (no leading slash).
2. **Framework Preset:** should show **Next.js** (Vercel usually detects it once Root Directory is set).
3. **Build Command:** **`npm run build`** (or leave default).
4. **Output Directory:** leave as default (Vercel handles Next.js).

Click **Continue** or **Save**.

---

### Step 5: Add your Supabase environment variables (required for login and data)

Without these, the site will load but sign-in and Supabase data won't work.

**If you're on the "Configure Project" page (before first Deploy):**

1. Expand **Environment Variables**.
2. **First variable:** **Key** = `NEXT_PUBLIC_SUPABASE_URL`. **Value** = your Supabase **Project URL** (e.g. `https://xxxxx.supabase.co`). Click **Add**.
3. **Second variable:** **Key** = `NEXT_PUBLIC_SUPABASE_ANON_KEY`. **Value** = your Supabase **anon public** key. Add it.
4. Leave environment as **Production** (and Preview if you want).

**If you already deployed and skipped this:**

1. In Vercel, open your project (**Lumina-Realty**) → **Settings** → **Environment Variables**.
2. Click **Add New**. **Key:** `NEXT_PUBLIC_SUPABASE_URL`. **Value:** your Supabase Project URL. Production (and Preview). Save.
3. Add another. **Key:** `NEXT_PUBLIC_SUPABASE_ANON_KEY`. **Value:** your Supabase anon key. Production (and Preview). Save.
4. Go to **Deployments** → **⋮** on the latest deployment → **Redeploy** so the new variables are used.

**Where to get the values:** Supabase dashboard → your project → **Project Settings** (gear) → **API** → copy **Project URL** and **anon public** (under Project API keys).

---

### Step 6: Deploy

1. Click **Deploy** (big button at the bottom).
2. Wait 1–2 minutes. Vercel will run `npm install` and `npm run build` in the **frontend** folder.
3. When it's done, you'll see **Congratulations!** and a link like **https://lumina-realty.vercel.app**. Click it to open your live site.

If the build fails, check the build log (e.g. wrong Root Directory, missing env var, or a code error).

---

### Step 7: Updating your live site later

Whenever you want to update what's online:

1. Make your code changes on your computer.
2. In Terminal (in your project folder), run:

   ```bash
   git add .
   git commit -m "Describe your change"
   git push
   ```

3. Vercel will automatically build and deploy the new version. In a minute or two, your live URL will show the update. You don't need to run `npm run build` yourself or upload anything by hand.

---

### If the build fails or "No Next.js version detected"

Vercel is building from a folder that doesn't contain the Next.js app. Your repo **Lumina-Realty** has the Next.js app in the **frontend** folder at the repo root.

1. In Vercel, open your project → **Settings** → **General**.
2. Under **Build & Development Settings**, click **Edit**.
3. Set **Root Directory** to **`frontend`** (type it exactly). Set **Framework Preset** to **Next.js** and **Build Command** to **`npm run build`**. Save.
4. Go to **Deployments** → **⋮** on the latest deployment → **Redeploy**.

If it still fails, check the build log. Common causes: Root Directory wrong (must be **frontend**), or missing env vars.

---

### If the build fails with "No url found for submodule path 'frontend'"

This means the repo had **frontend** registered as a Git submodule but the submodule URL was missing or broken. The fix (already applied in this repo) was to remove the submodule and track **frontend** as normal files. If you see this on another clone or repo, run from the repo root:

```bash
git rm --cached frontend
git config -f .gitmodules --remove-section submodule.frontend 2>/dev/null || true
rm -rf .git/modules/frontend 2>/dev/null || true
# Remove frontend/.git if it exists (so frontend is not an embedded repo)
git add frontend
git commit -m "Remove broken frontend submodule and track frontend normally"
git push
```

Then trigger a new Vercel deploy.

---

### If you see "404" or "Page not found" after deploy

This usually means Vercel built from the repo root (or the wrong folder) instead of **frontend**, so the Next.js app wasn't built.

1. In Vercel, open your project → **Settings** → **General**.
2. Under **Build & Development Settings**, click **Edit**: set **Root Directory** to **`frontend`**, **Framework Preset** to **Next.js**, **Build Command** to **`npm run build`**. Save.
3. Go to **Deployments** → **⋮** on the latest deployment → **Redeploy**.

After the redeploy finishes, open your site URL again. If you still see 404, check the **Deployments** tab and the latest deployment's build log to confirm the build ran in **frontend** and Next.js was detected.
