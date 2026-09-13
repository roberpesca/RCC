import { Navigate, Route, Routes } from 'react-router-dom';
import { useState } from 'react';
import { useApp } from './context/AppContext.jsx';
import { api, setAuthToken } from './api/client.js';
import NavBar from './components/NavBar.jsx';
import Onboarding from './pages/Onboarding.jsx';
import ProgramPicker from './pages/ProgramPicker.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Training from './pages/Training.jsx';
import Nutrition from './pages/Nutrition.jsx';
import Progress from './pages/Progress.jsx';
import Settings from './pages/Settings.jsx';

function LangToggle({ className = '' }) {
  const { lang, setLang } = useApp();
  return (
    <div className={`inline-flex rounded-full border border-neutral-200 bg-white p-0.5 text-[10px] font-bold uppercase tracking-wide ${className}`}>
      {['es', 'en'].map((code) => (
        <button
          key={code}
          onClick={() => setLang(code)}
          className={`rounded-full px-2.5 py-1 transition-colors ${lang === code ? 'bg-brand-600 text-white' : 'text-neutral-400'}`}
        >
          {code}
        </button>
      ))}
    </div>
  );
}

// Every athlete gets their own account — this is what lets several friends share one
// deployment of the app without seeing each other's plan, nutrition, or weigh-ins.
function AuthGate() {
  const { bootstrap, t } = useApp();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [form, setForm] = useState({ name: '', email: '', password: '', signupCode: '' });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErr(null);
    try {
      const result = mode === 'login'
        ? await api.authLogin({ email: form.email, password: form.password })
        : await api.authSignup({ name: form.name, email: form.email, password: form.password, signupCode: form.signupCode });
      setAuthToken(result.token);
      await bootstrap();
    } catch (e2) {
      setErr(e2.message || t('auth.genericError'));
    } finally {
      setSubmitting(false);
    }
  };

  const isSignup = mode === 'signup';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6">
      <LangToggle className="mb-8" />
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <div className="text-2xl font-black tracking-tight text-neutral-900">
            Coach<span className="text-brand-500">.</span>
          </div>
          <h1 className="mt-3 text-lg font-semibold text-neutral-900">{t(isSignup ? 'auth.signupTitle' : 'auth.loginTitle')}</h1>
          <p className="mt-1 text-sm text-neutral-500">{t(isSignup ? 'auth.signupSubtitle' : 'auth.loginSubtitle')}</p>
        </div>

        {isSignup && (
          <input
            type="text"
            value={form.name}
            onChange={set('name')}
            placeholder={t('auth.name')}
            className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-neutral-900 outline-none focus:border-brand-500"
          />
        )}
        <input
          type="email"
          value={form.email}
          onChange={set('email')}
          placeholder={t('auth.email')}
          className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-neutral-900 outline-none focus:border-brand-500"
          autoFocus
        />
        <div>
          <input
            type="password"
            value={form.password}
            onChange={set('password')}
            placeholder={t('auth.password')}
            className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-neutral-900 outline-none focus:border-brand-500"
          />
          {isSignup && <p className="mt-1 text-[11px] text-neutral-400">{t('auth.passwordHint')}</p>}
        </div>
        {isSignup && (
          <input
            type="text"
            value={form.signupCode}
            onChange={set('signupCode')}
            placeholder={t('auth.inviteCode')}
            className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-neutral-900 outline-none focus:border-brand-500"
          />
        )}

        {err && <p className="text-sm text-rose-600">{err}</p>}
        <button
          type="submit"
          disabled={submitting || !form.email || !form.password}
          className="w-full rounded-full bg-brand-600 py-3 font-semibold text-white shadow-pop disabled:opacity-50"
        >
          {submitting
            ? t(isSignup ? 'auth.signingUp' : 'auth.loggingIn')
            : t(isSignup ? 'auth.signupButton' : 'auth.loginButton')}
        </button>
        <button
          type="button"
          onClick={() => { setMode(isSignup ? 'login' : 'signup'); setErr(null); }}
          className="w-full text-center text-xs font-medium text-neutral-500"
        >
          {t(isSignup ? 'auth.toggleToLogin' : 'auth.toggleToSignup')}
        </button>
      </form>
    </div>
  );
}

export default function App() {
  const { authed, loading, profile, t } = useApp();

  if (!authed) return <AuthGate />;
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-neutral-400">
        {t('loadingCoach')}
      </div>
    );
  }

  const needsOnboarding = profile && !profile.onboarded;

  return (
    <div className="min-h-screen bg-white pb-20 safe-top">
      <div className="mx-auto flex max-w-md justify-end px-5 pt-3">
        <LangToggle />
      </div>
      <Routes>
        {needsOnboarding ? (
          <>
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="*" element={<Navigate to="/onboarding" replace />} />
          </>
        ) : (
          <>
            <Route path="/" element={<Dashboard />} />
            <Route path="/programs" element={<ProgramPicker />} />
            <Route path="/training" element={<Training />} />
            <Route path="/nutrition" element={<Nutrition />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
      {!needsOnboarding && <NavBar />}
    </div>
  );
}
