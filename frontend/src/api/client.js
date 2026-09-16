import { getStoredLang } from '../i18n/translations.js';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'coach_auth_token';

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setAuthToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
}

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json', 'x-lang': getStoredLang() };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    throw new ApiError('Unauthorized — please log in again.', 401);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let message = text;
    try {
      const parsed = JSON.parse(text);
      message = parsed.error || text;
    } catch {
      // not JSON, use raw text
    }
    throw new ApiError(message || `Request failed: ${res.status}`, res.status);
  }
  if (res.status === 204) return null;
  return res.json();
}

// Separate path for file uploads: must NOT set Content-Type so the browser can add
// the correct multipart boundary itself, but still needs the auth header.
async function uploadFile(path, file) {
  const form = new FormData();
  form.append('file', file);
  const headers = { 'x-lang': getStoredLang() };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: form,
  });
  const text = await res.text().catch(() => '');
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }
  if (!res.ok) {
    throw new ApiError((data && data.error) || text || `Upload failed: ${res.status}`, res.status);
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),

  health: () => request('/health'),

  // Auth: signup/login return { token, user } — the token is stored by the caller
  // (see AppContext.jsx) and sent as a Bearer header on every subsequent request.
  authSignup: (payload) => request('/auth/signup', { method: 'POST', body: payload }),
  authLogin: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  authLogout: () => request('/auth/logout', { method: 'POST' }),
  authMe: () => request('/auth/me'),

  getProfile: () => request('/profile'),
  updateProfile: (fields) => request('/profile', { method: 'PUT', body: fields }),
  getSnapshot: () => request('/profile/snapshot'),
  getFtpHistory: () => request('/profile/ftp-history'),
  getWeightHistory: () => request('/profile/weight-history'),

  // Optional/advanced live sync — see Settings for why file import is the default path.
  getStravaStatus: () => request('/strava/status'),
  stravaConnectUrl: () => `${BASE_URL}/strava/connect?token=${encodeURIComponent(getAuthToken())}&lang=${getStoredLang()}`,
  syncStrava: () => request('/strava/sync', { method: 'POST' }),
  disconnectStrava: () => request('/strava/disconnect', { method: 'POST' }),

  // Primary data path: no OAuth required.
  importCsv: (file) => uploadFile('/import/csv', file),
  importZip: (file) => uploadFile('/import/zip', file),
  importActivityFile: (file) => uploadFile('/import/activity-file', file),
  importManual: (payload) => request('/import/manual', { method: 'POST', body: payload }),
  getImportedActivities: (limit = 30) => request(`/import/activities?limit=${limit}`),

  getPrograms: () => request('/training/programs'),
  generatePlan: (payload) => request('/training/plan/generate', { method: 'POST', body: payload }),
  getActivePlan: () => request('/training/plan/active'),
  adaptPlan: (planId) => request(`/training/plan/${planId}/adapt`, { method: 'POST' }),
  setWorkoutStatus: (id, status) => request(`/training/workouts/${id}/status`, { method: 'POST', body: { status } }),
  getLoad: (days = 120) => request(`/training/load?days=${days}`),
  setDayAvailability: (date, blocked) => request(`/training/availability/${date}`, { method: 'PUT', body: { blocked } }),
  applyMismatch: (id) => request(`/training/workouts/${id}/mismatch/apply`, { method: 'POST' }),
  dismissMismatch: (id) => request(`/training/workouts/${id}/mismatch/dismiss`, { method: 'POST' }),

  getNutritionToday: () => request('/nutrition/today'),
  getNutritionWeek: (days = 7) => request(`/nutrition/week?days=${days}`),
  getNutritionHistory: () => request('/nutrition/history'),
  getWeighIns: () => request('/nutrition/weigh-ins'),
  addWeighIn: (payload) => request('/nutrition/weigh-ins', { method: 'POST', body: payload }),
  getAdaptiveNutrition: () => request('/nutrition/adaptive'),
};

export { ApiError };
