import { Router } from 'express';
import { intervalsFetchWithKey, getConnection, saveConnection, disconnect, isConnected } from './client.js';
import { pullActivities } from './pull.js';
import { pushPlanToIntervals } from './push.js';
import { getLang } from '../i18n/translations.js';

export const intervalsRouter = Router();

intervalsRouter.get('/status', (req, res) => {
  const conn = getConnection(req.userId);
  res.json({ connected: !!conn, athleteName: conn?.athlete_name || null });
});

// Validates the pasted API key by calling GET /athlete/0 (fails fast with a clear
// error if it's wrong) before ever saving it, and grabs the athlete's display name
// while we're there so Settings can show "Connected as <name>" rather than just a
// generic "Connected".
intervalsRouter.post('/connect', async (req, res) => {
  try {
    const { apiKey } = req.body;
    if (!apiKey || !apiKey.trim()) return res.status(400).json({ error: 'API key required' });
    const athlete = await intervalsFetchWithKey(apiKey.trim(), '/athlete/0');
    saveConnection(req.userId, { apiKey: apiKey.trim(), athleteId: athlete.id, athleteName: athlete.name || athlete.firstname || null });
    res.json({ connected: true, athleteName: athlete.name || athlete.firstname || null });
  } catch (e) {
    res.status(400).json({ error: 'Could not verify that API key with Intervals.icu — double check it and try again.' });
  }
});

intervalsRouter.post('/disconnect', (req, res) => {
  disconnect(req.userId);
  res.json({ ok: true });
});

// Manual "Sync now": pulls recent completed activities and pushes the current plan,
// the same two things that otherwise happen automatically (pull on page load,
// debounced; push whenever the plan changes) — useful right after first connecting,
// when there's nothing to trigger either yet.
intervalsRouter.post('/sync', async (req, res) => {
  if (!isConnected(req.userId)) return res.status(400).json({ error: 'Intervals.icu not connected' });
  try {
    const lang = getLang(req);
    const pulled = await pullActivities(req.userId, { force: true });
    const pushed = await pushPlanToIntervals(req.userId, lang);
    res.json({ pulled, pushed });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
