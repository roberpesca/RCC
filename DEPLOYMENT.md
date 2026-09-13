# Deploying Coach so friends can use it

This turns your local app into a live website anyone with the link can sign up for and use — each person gets their own private account, plan, and nutrition data.

Setup: **GitHub** (holds the code) → **Railway** (runs the backend + database) → **Vercel** (serves the frontend). Railway's free trial covers this easily at the start; expect roughly $5/month after that for the backend. Vercel's free tier is enough for the frontend indefinitely.

The repo is already initialized locally (`git init`, first commit done, `.env` and the database file are gitignored so they never get pushed).

---

## 1. Push to GitHub

1. Go to [github.com/new](https://github.com/new) and create a new **empty** repository (don't check "Add a README" — you already have one). Name it something like `cycling-coach-app`. Public or private both work; private is fine since it costs nothing on GitHub.
2. Copy the repo URL it gives you (looks like `https://github.com/YOUR_USERNAME/cycling-coach-app.git`).
3. In a terminal, in your project folder:

```
cd "cycling-coach-app"
git remote add origin https://github.com/YOUR_USERNAME/cycling-coach-app.git
git push -u origin main
```

It'll ask you to sign in to GitHub the first time (a browser window pops up) — approve it, and the push completes.

---

## 2. Deploy the backend on Railway

1. Go to [railway.app](https://railway.app) and sign up (GitHub sign-in is easiest — it can then see your repos directly).
2. **New Project** → **Deploy from GitHub repo** → pick your `cycling-coach-app` repo.
3. Railway will create a service and try to build it. Open the service's **Settings** tab:
   - **Root Directory**: set to `backend` (this repo has both backend and frontend in one repo, so Railway needs to know which folder is this service).
   - **Start Command**: should auto-detect `npm start` from `backend/package.json` — leave it unless it's wrong.
4. Add a **persistent volume** (Settings → Volumes → New Volume): mount path `/data`. Without this, your database gets wiped every time Railway redeploys.
5. Go to the **Variables** tab and add:
   - `DB_PATH` = `/data/coach.db` (matches the volume you just mounted)
   - `NIXPACKS_NODE_VERSION` = `22` (the app needs Node 22+; this makes sure Railway uses it)
   - `SIGNUP_CODE` = pick a short word/phrase if you want to require an invite code before anyone can sign up (recommended so randoms who find the URL can't create accounts). Leave it unset for open signup.
   - `FRONTEND_URL` = leave blank for now, you'll fill this in after step 3 once you know your Vercel URL.
   - Strava variables (`STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_REDIRECT_URI`) — only needed if you want live Strava sync to work for *your own* account specifically (see the note at the end). Skip these for now; file import works for everyone regardless.
   - Do **not** set `OWNER_EMAIL`/`OWNER_PASSWORD` here — those are only for migrating your existing *local* database, which is a separate step (see §5). A fresh Railway deploy starts with an empty database and everyone just signs up normally.
6. Railway will deploy automatically. Once it's live, go to **Settings → Networking** and click **Generate Domain** to get a public URL like `https://cycling-coach-backend-production.up.railway.app`. Copy it.
7. Quick check: open `https://YOUR-RAILWAY-URL/api/health` in a browser — you should see `{"ok":true,...}`.

---

## 3. Deploy the frontend on Vercel

1. Go to [vercel.com](https://vercel.com) and sign up with GitHub.
2. **Add New → Project** → import your `cycling-coach-app` repo.
3. In the import screen:
   - **Root Directory**: click Edit, choose `frontend`.
   - Framework Preset: Vercel should auto-detect **Vite**.
   - **Environment Variables**: add `VITE_API_URL` = `https://YOUR-RAILWAY-URL/api` (the URL from step 2.6, with `/api` on the end).
4. Click **Deploy**. After it finishes you'll get a URL like `https://cycling-coach-app.vercel.app` — that's the link you'll share with friends.
5. Go back to Railway → your backend service → Variables, and now set `FRONTEND_URL` = your Vercel URL (no trailing slash). This is only used to redirect back correctly after a Strava connect attempt.

That's it functionally — open the Vercel URL, you should see the login/signup screen.

---

## 4. Try it

1. Open your Vercel URL, sign up with your own email (use the `SIGNUP_CODE` if you set one).
2. Complete onboarding, generate a plan, log a weigh-in — confirm it all works against the live backend.
3. Send the link (and the `SIGNUP_CODE`, if set) to a friend. They sign up separately and get their own private profile, plan, and nutrition — nobody sees anyone else's data.

---

## 5. Bringing over your existing data (optional, one-time)

If you want *your own* existing plan/history (the one you've been testing with locally) to show up under your account on the live site instead of starting fresh:

1. On Railway, temporarily add two variables: `OWNER_EMAIL` (the email you want to log in with) and `OWNER_PASSWORD` (the password you want).
2. Locally, copy your `backend/data/coach.db` file and upload it to the Railway volume — this needs the [Railway CLI](https://docs.railway.app/guides/cli): `railway login`, then `railway run --service backend cp coach.db /data/coach.db` (or use Railway's volume browser in the dashboard if available). This step is a bit fiddly — if you'd rather skip it, it's completely fine to just start fresh on the live site and keep using your local copy separately.
3. Redeploy/restart the backend service. On boot it'll detect the old-style data and print a migration message in the logs, attaching everything to the account you specified.
4. Once confirmed working, remove `OWNER_EMAIL`/`OWNER_PASSWORD` from Railway's variables (they're not needed again — the migration only runs once).

---

## Keeping it updated

Whenever you want to ship a change: commit and push to GitHub (`git add -A && git commit -m "..." && git push`). Railway and Vercel both auto-redeploy on every push to `main` — no extra steps.

---

## About Strava live-sync in a shared deployment

Strava API apps start capped at **one authorized athlete** ("single player mode") until Strava manually approves a capacity increase for your app — which can take a while and isn't guaranteed. In practice that means the "Connect Strava" button will only work for whoever's Strava account you register the app under (probably you), not for your friends. This isn't something fixable in the code — it's a Strava platform restriction. Everyone else (and honestly, you too, since it's simpler) should use **Settings → Get your data in**, which supports Strava's bulk CSV/ZIP export, individual GPX/TCX file export, or just typing a ride in manually — no OAuth cap, works for everyone.

## Installing it like an app on a phone

The site is a PWA (installable web app). On iPhone: open the link in Safari → Share button → "Add to Home Screen". On Android: open in Chrome → menu (⋮) → "Install app" / "Add to Home screen". It then behaves like a normal app icon, full-screen, no browser bar.
