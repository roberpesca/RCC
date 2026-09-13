import { NavLink } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { IconHome, IconBike, IconFork, IconTrendingUp, IconSettings } from './icons.jsx';

export default function NavBar() {
  const { t } = useApp();
  const TABS = [
    { to: '/', label: t('nav.dashboard'), end: true, Icon: IconHome },
    { to: '/training', label: t('nav.training'), Icon: IconBike },
    { to: '/nutrition', label: t('nav.nutrition'), Icon: IconFork },
    { to: '/progress', label: t('nav.progress'), Icon: IconTrendingUp },
    { to: '/settings', label: t('nav.settings'), Icon: IconSettings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white/95 backdrop-blur-sm safe-bottom">
      <div className="mx-auto flex max-w-md justify-between px-2">
        {TABS.map(({ to, label, end, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition-colors ${
                isActive ? 'text-brand-600' : 'text-neutral-400'
              }`
            }
          >
            <Icon />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
