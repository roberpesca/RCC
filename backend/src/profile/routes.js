import { Router } from 'express';
import { db, getProfile, updateProfile } from '../db.js';
import { rescheduleActivePlan } from '../training/scheduler.js';

export const profileRouter = Router();

// available_days is stored as a JSON string internally (see db.js) but the frontend
// always deals with a plain array of weekday ints (Mon=0..Sun=6), defaulting to
// every day so callers never have to special-case "not set yet".
function decorateProfileOut(profile) {
  let availableDays = [0, 1, 2, 3, 4, 5, 6];
  if (profile?.available_days) {
    try {
      const parsed = JSON.parse(profile.available_days);
      if (Array.isArray(parsed) && parsed.length > 0) availableDays = parsed;
    } catch {
      // keep default
    }
  }
  return { ...profile, available_days: availableDays };
}

profileRouter.get('/', (req, res) => {
  res.json(decorateProfileOut(getProfile(req.userId)));
});

profileRouter.put('/', (req, res) => {
  const body = { ...req.body };
  const changingAvailability = Array.isArray(body.available_days);
  if (changingAvailability) body.available_days = JSON.stringify(body.available_days);

  const profile = updateProfile(req.userId, body);
  if (req.body.ftp_watts) {
    db.prepare(`INSERT INTO ftp_history (user_id, date, ftp_watts, source) VALUES (?, date('now', 'localtime'), ?, 'manual')`).run(req.userId, req.body.ftp_watts);
  }

  let reschedule = null;
  if (changingAvailability) {
    try {
      reschedule = rescheduleActivePlan(req.userId);
    } catch {
      // don't fail the profile save if reschedule hits an issue — the new
      // availability is saved either way and will apply to the next plan/edit
    }
  }
  res.json({ ...decorateProfileOut(profile), reschedule });
});

profileRouter.get('/ftp-history', (req, res) => {
  res.json(db.prepare('SELECT * FROM ftp_history WHERE user_id = ? ORDER BY date ASC').all(req.userId));
});

profileRouter.get('/weight-history', (req, res) => {
  res.json(db.prepare('SELECT * FROM weigh_ins WHERE user_id = ? ORDER BY date ASC').all(req.userId));
});

// Combined snapshot used by the dashboard: current FTP, weight, W/kg, and goal deltas.
profileRouter.get('/snapshot', (req, res) => {
  const profile = getProfile(req.userId);
  const wkg = profile.ftp_watts && profile.weight_kg ? Math.round((profile.ftp_watts / profile.weight_kg) * 100) / 100 : null;
  const firstWeight = db.prepare('SELECT weight_kg FROM weigh_ins WHERE user_id = ? ORDER BY date ASC LIMIT 1').get(req.userId);
  const firstFtp = db.prepare('SELECT ftp_watts FROM ftp_history WHERE user_id = ? ORDER BY date ASC LIMIT 1').get(req.userId);
  res.json({
    profile: decorateProfileOut(profile),
    wattsPerKg: wkg,
    weightDeltaKg: firstWeight ? Math.round((profile.weight_kg - firstWeight.weight_kg) * 10) / 10 : 0,
    ftpDeltaWatts: firstFtp ? Math.round(profile.ftp_watts - firstFtp.ftp_watts) : 0,
    weightRemainingKg: profile.goal_weight_kg && profile.weight_kg ? Math.round((profile.weight_kg - profile.goal_weight_kg) * 10) / 10 : null,
  });
});
