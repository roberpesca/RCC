import { Router } from 'express';
import { db, getProfile, updateProfile } from '../db.js';

export const profileRouter = Router();

profileRouter.get('/', (req, res) => {
  res.json(getProfile(req.userId));
});

profileRouter.put('/', (req, res) => {
  const profile = updateProfile(req.userId, req.body);
  if (req.body.ftp_watts) {
    db.prepare(`INSERT INTO ftp_history (user_id, date, ftp_watts, source) VALUES (?, date('now', 'localtime'), ?, 'manual')`).run(req.userId, req.body.ftp_watts);
  }
  res.json(profile);
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
    profile,
    wattsPerKg: wkg,
    weightDeltaKg: firstWeight ? Math.round((profile.weight_kg - firstWeight.weight_kg) * 10) / 10 : 0,
    ftpDeltaWatts: firstFtp ? Math.round(profile.ftp_watts - firstFtp.ftp_watts) : 0,
    weightRemainingKg: profile.goal_weight_kg && profile.weight_kg ? Math.round((profile.weight_kg - profile.goal_weight_kg) * 10) / 10 : null,
  });
});
