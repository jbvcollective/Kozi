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

You’ll do three things: put your code on GitHub, connect that to Vercel, then add your Supabase keys so the live site works.

---

### Step 1: Get your Supabase keys (you’ll need them later)

1. Open **Supabase**: https://supabase.com and sign in.
2. Open your **project** (the one this app uses).
3. Go to **Project Settings** (gear icon in the left sidebar) → **API**.
4. Copy and save somewhere safe:
   - **Project URL** (e.g. `https://xxxxx.supabase.co`) → you’ll use this as `NEXT_PUBLIC_SUPABASE_URL`.
   - **anon public** key (under “Project API keys”) → you’ll use this as `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

---

### Step 2: Put your code on GitHub

1. Create a **GitHub account** if you don’t have one: https://github.com/signup.
2. **Install Git** on your computer if needed: https://git-scm.com/downloads (then restart your editor).
3. Open **Terminal** in your project folder (e.g. `C:\Users\johnb\Documents\VestaHome_Backend`).
4. Run these three commands one at a time (you don’t need to type your username here—run them as-is):

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

5. On GitHub: click **+** (top right) → **New repository**.
6. Name it (e.g. `VestaHome`), leave “Add a README” **unchecked**, click **Create repository**.
7. On the new repo page, copy the **URL** (it will look like `https://github.com/YourUsername/VestaHome.git`—YourUsername is your GitHub login).
8. Back in Terminal, run (paste your URL where it says YOUR_REPO_URL):

   ```bash
   git remote add origin YOUR_REPO_URL
   git branch -M main
   git push -u origin main
   ```

   If it asks for login, use your GitHub username and a **Personal Access Token** (GitHub → Settings → Developer settings → Personal access tokens → Generate new token). Use the token as the password.

Your code is now on GitHub.

---

### Step 3: Sign in to Vercel and add the project

1. Go to **https://vercel.com** and click **Sign Up** (or **Log In** if you have an account).
2. Choose **Continue with GitHub** and allow Vercel to access your GitHub.
3. After sign-in, click **Add New…** (or **New Project**).
4. You should see a list of your GitHub repos. Click **Import** next to the repo you pushed (e.g. `VestaHome` or `VestaHome_Backend`).
5. **Don’t click Deploy yet.** First set the options below.

---

### Step 4: Tell Vercel where your frontend lives

On the “Import Project” / “Configure Project” page:

1. Find **Root Directory**.
2. Click **Edit** next to it.
3. Type: **`frontend`** (exactly that, no slash at the start).
4. Click **Continue** or **Save**.  
   That way Vercel builds the Next.js app inside the `frontend` folder.

---

### Step 5: Add your Supabase environment variables

On the same page, find **Environment Variables**.

1. **Name:** `NEXT_PUBLIC_SUPABASE_URL`  
   **Value:** paste the **Project URL** you copied from Supabase (Step 1).  
   Click **Add** or the plus icon.

2. **Name:** `NEXT_PUBLIC_SUPABASE_ANON_KEY`  
   **Value:** paste the **anon public** key you copied from Supabase (Step 1).  
   Click **Add** again.

3. Leave the environment as **Production** (or add the same two variables for Production if there’s a dropdown).

---

### Step 6: Deploy

1. Click **Deploy** (big button at the bottom).
2. Wait 1–2 minutes. Vercel will run `npm install` and `npm run build` for you.
3. When it’s done, you’ll see **Congratulations!** and a link like **https://your-project-name.vercel.app**. Click it to open your live site.

If the build fails, check the build log on Vercel; the error message will tell you what went wrong (e.g. missing env var or a code error).

---

### Step 7: Updating your live site later

Whenever you want to update what’s online:

1. Make your code changes on your computer.
2. In Terminal (in your project folder), run:

   ```bash
   git add .
   git commit -m "Describe your change"
   git push
   ```

3. Vercel will automatically build and deploy the new version. In a minute or two, your live URL will show the update. You don’t need to run `npm run build` yourself or upload anything by hand.
