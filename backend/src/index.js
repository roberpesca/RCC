import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { requireAuth } from './middleware/auth.js';
import { authRouter } from './auth/routes.js';
import { stravaRouter, stravaPublicRouter } from './strava/routes.js';
import { trainingRouter } from './training/routes.js';
import { nutritionRouter } from './nutrition/routes.js';
import { profileRouter } from './profile/routes.js';
import { importRouter } from './import/routes.js';
import { getLang, tSystem } from './i18n/translations.js';
import './db.js'; // ensure schema is initialized (and any one-time migration runs) on boot

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Signup/login issue the session token itself, so they can't require one.
app.use('/api/auth', authRouter);

// The Strava OAuth callback is hit directly by Strava's redirect (no custom header
// possible), so it can't be behind the auth gate — it recovers the user via its own
// one-time `state` token instead (see strava/routes.js). Everything else requires a
// logged-in session, so one athlete's plan/nutrition/weigh-ins/activities are never
// visible to another.
app.use('/api/strava', stravaPublicRouter);
app.use('/api/strava', requireAuth, stravaRouter);
app.use('/api/training', requireAuth, trainingRouter);
app.use('/api/nutrition', requireAuth, nutritionRouter);
app.use('/api/profile', requireAuth, profileRouter);
app.use('/api/import', requireAuth, importRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: tSystem(getLang(req), 'internalError') });
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Cycling coach backend listening on :${port}`);
});
