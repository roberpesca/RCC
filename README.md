# Coach — your personal cycling + nutrition coach

A personal training app built around one goal: raise your FTP and manage your weight, using your real ride data to keep the plan honest. It's installable on your phone as a PWA (Progressive Web App) — no app store needed, and no Strava login required to get your data in.

## What's in v1

**Spanish by default, English if you want it.** The app opens in Spanish; tap the ES/EN toggle (top-right on every screen, and on the access-code screen) to switch. Every plan you've already generated — program names, workout titles/descriptions, coaching messages, adaptation reasons — re-renders correctly in either language immediately, with nothing to regenerate.

**Cycling only.** Every program is built entirely from on-bike sessions (endurance, tempo, sweet spot, threshold, VO2max, climbing/anaerobic repeats, recovery spins) — no gym or strength days anywhere in the plan.

**Training.** Six programs to choose from — FTP Builder, Lean & Aerobic Base, FTP + Weight Loss Combo (recommended if both goals matter), Gran Fondo/Century Prep, Climbing Specialist, and Race/Crit Prep. Pick one and the app generates a full periodized plan (Base → Build → Peak/Specialty phases, with a step-back recovery week every 4th week) scaled to the hours per week you actually have.

**Data-aware adaptation.** Bring in your ride history (see below — no OAuth needed) and the app estimates Training Stress Score (TSS) for each ride (from power when available, Strava's Relative Effort otherwise, falling back to duration if neither exists), and tracks your Fitness/Fatigue/Form (CTL/ATL/TSB) — the same model TrainingPeaks and intervals.icu use. Tap "Adapt next week" and it compares what you actually did against the plan and nudges the upcoming week's volume up or down accordingly. It also watches your hard efforts for FTP gains and updates your number automatically when it sees clear evidence.

**Nutrition.** Every day gets a calorie and macro target that flexes with your training: carbs are periodized (lower on rest days, higher on long/hard days), protein stays high to protect muscle in a deficit, and the calorie target itself adapts every couple of weeks based on your actual logged weight trend versus your goal rate — the same idea used by adaptive-TDEE apps. Each workout also comes with simple fueling guidance (before/during/after).

**Progress.** FTP over time, weight over time, and the metric that ties both goals together: watts per kilogram.

## Getting your Strava data in — no login required

Strava caps every newly-created API application at **1 connected athlete** ("single player mode") until Strava reviews and manually approves a capacity increase — and that review can be slow or simply not come through. That makes live "Connect with Strava" OAuth unreliable for an app like this one, so v1 leads with file import instead: you export your own data from Strava (which anyone can always do, no API approval needed) and hand it to the app directly. Everything downstream — TSS, fitness/fatigue tracking, FTP detection, plan adaptation — works identically no matter which of these you use:

1. **Bulk history (do this first).** On strava.com: **Settings → My Account → Download or Delete Your Account → Request your archive.** Strava emails you a link within a few hours with a ZIP containing `activities.csv` — a full spreadsheet of every ride with power, heart rate, and effort data already summarized. In the app's Settings tab, upload that ZIP directly, or just pull out `activities.csv` and upload that (faster, since it skips all the photos/GPS files also in the archive).
2. **Quick-add a recent ride.** From any individual ride's page on strava.com, use the **⋯ (more) menu → Export GPX**, or for a version that reliably includes power data, add `/export_tcx` to the end of the ride's URL (e.g. `strava.com/activities/1234567890/export_tcx`) and it downloads instantly, no waiting for an archive. Upload either file type in Settings.
3. **Manual entry.** Always available, no export needed — just type in the date, duration, and whatever else you know (power, heart rate, or a 1-10 effort rating). Good for logging a ride the moment you finish.

The app's Settings screen still has an optional "Advanced: live Strava sync" section using OAuth, in case you've registered your own Strava API app and gotten athlete-capacity approval — but for most people the import flow above is the reliable path.

One small setup note: Strava's export respects your account's unit preference (metric vs. imperial) for distance and elevation, so set the app's **Units** field in Settings to match before importing — it only affects how distances are displayed, not any of the training or nutrition math.

## How it's built

```
cycling-coach-app/
├── backend/     Node/Express API — file import (CSV/ZIP/GPX/TCX/manual), optional Strava OAuth, training engine, nutrition engine, SQLite storage
└── frontend/    React + Tailwind installable PWA
```

The backend uses Node's built-in `node:sqlite` module rather than a native database driver, so there's no compiled binary to worry about across different hosts — just Node 22.5+.

This is a single-user app (built for you specifically), so instead of a full login system there's one shared `ACCESS_CODE` that the app asks for once and remembers on your phone.

## 1. Run it locally first

**Backend:**
```bash
cd backend
cp .env.example .env
# edit .env: set ACCESS_CODE to something only you know
npm install
npm run dev
```
This starts the API on `http://localhost:8080`.

**Frontend** (in a second terminal):
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` on your phone or laptop (same Wi-Fi network — use your computer's local IP instead of localhost to test from your phone). Enter the access code you set above, fill in your profile, pick a program, then head to Settings to import your Strava history.

## 2. Deploy it for real (so it's always on your phone)

### Backend → Render

1. Push this project to a GitHub repo.
2. On [Render](https://render.com), create a new **Web Service** pointing at the `backend` folder.
   - Build command: `npm install`
   - Start command: `npm start`
   - Add a **persistent disk** (Render calls it a "Disk"), mounted at e.g. `/data` — this is where your SQLite file lives so it survives redeploys.
3. Set environment variables in Render's dashboard: `ACCESS_CODE`, `FRONTEND_URL` (your Vercel URL, set after the step below), `DB_PATH` (`/data/coach.db`).
4. Bulk ZIP uploads can be large — Render's free tier has limited RAM, so if a big multi-year archive fails to import, unzip it on your computer first and upload just `activities.csv` instead (this is also just faster).

Fly.io works just as well if you prefer it — same idea, just use a Fly Volume instead of a Render Disk.

### Frontend → Vercel

1. On [Vercel](https://vercel.com), import the same repo, set the root directory to `frontend`.
2. Framework preset: Vite. Build command `npm run build`, output directory `dist`.
3. Set the environment variable `VITE_API_URL` to `https://<your-render-domain>/api`.
4. Deploy, then update `FRONTEND_URL` on the Render backend to match and redeploy the backend.

### Install it on your phone

Open the Vercel URL in Safari (iPhone) or Chrome (Android), then:
- **iPhone:** Share icon → "Add to Home Screen."
- **Android:** Chrome menu → "Install app" (or you'll get an automatic install prompt).

It'll open full-screen with an app icon, no browser chrome — indistinguishable from a native app for everyday use.

## Optional: live Strava sync (advanced)

If you'd rather have rides sync automatically and are willing to deal with Strava's review process, you can still set up OAuth:

1. Go to <https://www.strava.com/settings/api> and create an app (any name/website is fine). It starts in "single player mode," capped at 1 athlete — that's fine for just yourself.
2. Note your **Client ID** and **Client Secret**, and set the **Authorization Callback Domain** to wherever your backend runs (`localhost` for local dev, your Render domain in production).
3. Add `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, and `STRAVA_REDIRECT_URI` (`https://<your-render-domain>/api/strava/callback`) to the backend's environment variables.
4. In the app, go to Settings → "Advanced: live Strava sync" → Connect.

If you ever want other people to use their own Strava accounts with an app you host, Strava's athlete-capacity increase form is the only path — approval isn't guaranteed or fast, which is exactly why file import is the default here.

## Notes on the numbers

TSS, CTL/ATL/TSB, FTP estimation, calorie/macro targets, and fueling guidance are all computed with standard, published sports-science formulas and heuristics (Mifflin-St Jeor for BMR, the classic 42/7-day EWMA for CTL/ATL, etc.) — the same math widely used in coaching software. They're a strong starting point, not a substitute for a coach or dietitian who can look at you individually, especially around clinical nutrition needs.

## Known v1 limitations / natural next steps

FTP detection uses ride averages rather than a true power-duration curve, and GPX/TCX imports use a simple average-power calculation rather than a proper 30-second-rolling normalized power — pulling in full activity streams would make both more precise. Strava's CSV export column names have shifted slightly over the years and the parser matches several known variants defensively, but if you hit an import that reports 0 rides found, the manual entry or GPX/TCX path always works as a fallback. There's no food-logging (targets are given, but the app doesn't track what you actually ate) — connecting a nutrition database or barcode scanner is a natural v2 addition. Workouts are shown as structured targets, not pushed to a head unit; exporting `.fit`/`.zwo` files for Garmin/Wahoo/Zwift would close that loop. And if you eventually want true native apps (widgets, health app integration, offline GPS), the React codebase could be wrapped with Capacitor to produce iOS/Android builds without a rewrite.
