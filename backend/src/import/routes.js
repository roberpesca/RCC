import { Router } from 'express';
import multer from 'multer';
import AdmZip from 'adm-zip';
import { getProfile } from '../db.js';
import { maybeUpdateFtpEstimate } from '../shared/tss.js';
import { upsertActivities, upsertActivity, listRecentActivities } from '../shared/activityStore.js';
import { parseStravaActivitiesCsv } from './stravaCsv.js';
import { parseActivityFile } from './activityFile.js';
import { buildManualActivity } from './manual.js';
import { getLang, tImportError } from '../i18n/translations.js';

export const importRouter = Router();

const uploadCsv = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const uploadZip = multer({ storage: multer.memoryStorage(), limits: { fileSize: 250 * 1024 * 1024 } });
const uploadActivityFile = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

function handleMulterError(err, res, lang) {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: tImportError(lang, 'fileTooLarge') });
  }
  return res.status(400).json({ error: err.message });
}

importRouter.post('/csv', (req, res) => {
  const lang = getLang(req);
  uploadCsv.single('file')(req, res, (err) => {
    if (err) return handleMulterError(err, res, lang);
    if (!req.file) return res.status(400).json({ error: tImportError(lang, 'noFile') });
    try {
      const profile = getProfile(req.userId);
      const csvText = req.file.buffer.toString('utf-8');
      const { activities, skipped, total } = parseStravaActivitiesCsv(csvText, {
        units: profile.units,
        ftp: profile.ftp_watts || 200,
      });
      const imported = upsertActivities(activities, req.userId);
      const newFtp = maybeUpdateFtpEstimate(req.userId);
      res.json({ imported, skipped, totalRows: total, newFtp });
    } catch (e) {
      res.status(400).json({ error: `${tImportError(lang, 'csvParsePrefix')}${e.message}` });
    }
  });
});

importRouter.post('/zip', (req, res) => {
  const lang = getLang(req);
  uploadZip.single('file')(req, res, (err) => {
    if (err) return handleMulterError(err, res, lang);
    if (!req.file) return res.status(400).json({ error: tImportError(lang, 'noFile') });
    try {
      const zip = new AdmZip(req.file.buffer);
      const entry = zip.getEntries().find((e) => /(^|\/)activities\.csv$/i.test(e.entryName));
      if (!entry) {
        return res.status(400).json({ error: tImportError(lang, 'csvNotFoundInZip') });
      }
      const profile = getProfile(req.userId);
      const csvText = entry.getData().toString('utf-8');
      const { activities, skipped, total } = parseStravaActivitiesCsv(csvText, {
        units: profile.units,
        ftp: profile.ftp_watts || 200,
      });
      const imported = upsertActivities(activities, req.userId);
      const newFtp = maybeUpdateFtpEstimate(req.userId);
      res.json({ imported, skipped, totalRows: total, newFtp });
    } catch (e) {
      res.status(400).json({ error: `${tImportError(lang, 'zipReadPrefix')}${e.message}` });
    }
  });
});

importRouter.post('/activity-file', (req, res) => {
  const lang = getLang(req);
  uploadActivityFile.single('file')(req, res, (err) => {
    if (err) return handleMulterError(err, res, lang);
    if (!req.file) return res.status(400).json({ error: tImportError(lang, 'noFile') });
    try {
      const profile = getProfile(req.userId);
      const text = req.file.buffer.toString('utf-8');
      const activity = parseActivityFile(text, req.file.originalname, profile.ftp_watts || 200, req.userId);
      if (!activity) {
        return res.status(400).json({ error: tImportError(lang, 'noTrackPoints') });
      }
      upsertActivity(activity, req.userId);
      const newFtp = maybeUpdateFtpEstimate(req.userId);
      res.json({ imported: 1, activity: { name: activity.name, start_date: activity.start_date, tss_estimate: activity.tss_estimate }, newFtp });
    } catch (e) {
      res.status(400).json({ error: `${tImportError(lang, 'filePrefix')}${e.message}` });
    }
  });
});

importRouter.post('/manual', (req, res) => {
  try {
    const profile = getProfile(req.userId);
    const activity = buildManualActivity(req.body, profile.ftp_watts || 200, req.userId);
    upsertActivity(activity, req.userId);
    const newFtp = maybeUpdateFtpEstimate(req.userId);
    res.json({ imported: 1, activity: { name: activity.name, start_date: activity.start_date, tss_estimate: activity.tss_estimate }, newFtp });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

importRouter.get('/activities', (req, res) => {
  res.json(listRecentActivities(req.userId, Number(req.query.limit) || 100));
});
