import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getAuthToken, clearAuthToken } from '../api/client.js';
import { getStoredLang, setStoredLang, t as translate } from '../i18n/translations.js';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [authed, setAuthed] = useState(!!getAuthToken());
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [plan, setPlan] = useState(null);
  const [stravaConnected, setStravaConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lang, setLangState] = useState(getStoredLang());

  const refreshProfile = useCallback(async () => {
    const p = await api.getProfile();
    setProfile(p);
    return p;
  }, []);

  const refreshPlan = useCallback(async () => {
    const pl = await api.getActivePlan();
    setPlan(pl);
    return pl;
  }, []);

  const refreshStrava = useCallback(async () => {
    const s = await api.getStravaStatus();
    setStravaConnected(s.connected);
    return s.connected;
  }, []);

  const bootstrap = useCallback(async () => {
    if (!getAuthToken()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [me] = await Promise.all([api.authMe(), refreshProfile(), refreshPlan(), refreshStrava()]);
      setUser(me.user);
      setAuthed(true);
    } catch (e) {
      setError(e);
      if (e.status === 401) {
        clearAuthToken();
        setAuthed(false);
      }
    } finally {
      setLoading(false);
    }
  }, [refreshProfile, refreshPlan, refreshStrava]);

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.authLogout();
    } catch {
      // ignore — clearing the local token is what actually matters
    }
    clearAuthToken();
    setAuthed(false);
    setUser(null);
    setProfile(null);
    setPlan(null);
  }, []);

  // Backend-generated text (program names, workout titles/descriptions, coaching
  // messages) is resolved server-side from the `x-lang` header, so switching languages
  // means re-fetching the already-generated plan/profile rather than regenerating it —
  // the same plan renders correctly in either language.
  const setLang = useCallback(
    (next) => {
      setStoredLang(next);
      setLangState(next);
      if (authed) {
        refreshPlan().catch(() => {});
      }
    },
    [authed, refreshPlan]
  );

  const tt = useCallback((path, ...args) => translate(lang, path, ...args), [lang]);

  const value = {
    authed,
    setAuthed,
    user,
    profile,
    plan,
    stravaConnected,
    loading,
    error,
    refreshProfile,
    refreshPlan,
    refreshStrava,
    bootstrap,
    logout,
    lang,
    setLang,
    t: tt,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
