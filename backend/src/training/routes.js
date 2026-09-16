import { Router } from 'express';
import { PROGRAMS } from './programs.js';
import { generatePlan, getActivePlan, getPlan, autoMatchActivities, markWorkoutStatus } from './planEngine.js';
import { computeLoadSeries, getCurrentLoad, adaptUpcomingWeek, applyMismatchAdjustment, dismissMismatch } from './adapt.js';
import { setOverride, clearOverride, rescheduleActivePlan } from './scheduler.js';
import { getProfile } from '../db.js';
import { getLang, tProgram, tSystem } from '../i18n/translations.js';
import { todayStr } from '../shared/dates.js';

export const trainingRouter = Router();

trainingRouter.get('/programs', (req, res) => {
  const lang = getLang(req);
  res.json(
    PROGRAMS.map(({ id, goalFocus, defaultWeeks }) => {
      const text = tProgram(id, lang);
      return { id, name: text.name, tagline: text.tagline, description: text.description, goalFocus, defaultWeeks };
    })
  );
});

trainingRouter.post('/plan/generate', (req, res) => {
  try {
    const lang = getLang(req);
    const profile = getProfile(req.userId);
    const { programId, startDate, weeks } = req.body;
    const plan = generatePlan({
      userId: req.userId,
      programId,
      startDate: startDate || todayStr(),
      weeks,
      weeklyHoursAvailable: profile.weekly_hours_available,
      ftp: profile.ftp_watts,
    });
    res.json(getPlan(plan.id, lang, req.userId));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

trainingRouter.get('/plan/active', (req, res) => {
  const lang = getLang(req);
  const plan = getActivePlan(req.userId, lang);
  if (!plan) return res.json(null);
  autoMatchActivities(plan.id, req.userId);
  res.json(getPlan(plan.id, lang, req.userId));
});

trainingRouter.get('/plan/:id', (req, res) => {
  const lang = getLang(req);
  const plan = getPlan(Number(req.params.id), lang, req.userId);
  if (!plan) return res.status(404).json({ error: 'Not found' });
  res.json(plan);
});

trainingRouter.post('/plan/:id/adapt', (req, res) => {
  try {
    const lang = getLang(req);
    const result = adaptUpcomingWeek(Number(req.params.id), lang, req.userId);
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

trainingRouter.post('/workouts/:id/status', (req, res) => {
  const { status, matchedActivityId } = req.body;
  const ok = markWorkoutStatus(Number(req.params.id), status, matchedActivityId || null, req.userId);
  if (!ok) return res.status(404).json({ error: tSystem(getLang(req), 'unauthorized') });
  res.json({ ok: true });
});

// Marks (or unmarks) a single date as unavailable to train, then immediately reflows
// the active plan's still-open sessions around it — a lighter-weight sibling to
// changing the standing weekly pattern in Settings, scoped to just one day/week.
trainingRouter.put('/availability/:date', (req, res) => {
  try {
    const { date } = req.params;
    const { blocked } = req.body;
    if (blocked) setOverride(req.userId, date, 0);
    else clearOverride(req.userId, date);
    const reschedule = rescheduleActivePlan(req.userId);
    res.json({ ok: true, reschedule });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Confirm-first mid-week mismatch prompt (see training/mismatch.js): applying scales
// the remaining not-yet-happened days of that same week; dismissing just clears the
// pending flag so the prompt goes away without changing anything.
trainingRouter.post('/workouts/:id/mismatch/apply', (req, res) => {
  try {
    const lang = getLang(req);
    const result = applyMismatchAdjustment(Number(req.params.id), lang, req.userId);
    if (!result) return res.status(404).json({ error: tSystem(lang, 'unauthorized') });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

trainingRouter.post('/workouts/:id/mismatch/dismiss', (req, res) => {
  const ok = dismissMismatch(Number(req.params.id), req.userId);
  if (!ok) return res.status(404).json({ error: tSystem(getLang(req), 'unauthorized') });
  res.json({ ok: true });
});

trainingRouter.get('/load', (req, res) => {
  const days = Number(req.query.days) || 120;
  res.json({ series: computeLoadSeries(req.userId, days), current: getCurrentLoad(req.userId) });
});
