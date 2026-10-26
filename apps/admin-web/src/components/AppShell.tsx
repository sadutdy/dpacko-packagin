import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';

import { useAuth } from '../app/auth/AuthContext.js';
import { useUiPrefs } from '../app/settings/UiPrefsContext.js';
import { useTheme } from '../hooks/useTheme.js';
import { RoleAwareNav } from '../app/auth/RoleAwareNav.js';
import { BrandLogo, BrandMark } from './BrandLogo.js';

const COLLAPSE_KEY = 'ameen-sidebar-collapsed';

function SunIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 3h4a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Live date/time, updated every second. */
function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const date = `${WEEKDAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  return (
    <span
      className="flex items-center gap-2 text-sm text-app-muted"
      title={`Current date and time · ${now.getFullYear()}`}
    >
      <ClockIcon />
      <span className="hidden md:inline">{date}</span>
      <span className="font-medium tabular-nums text-app-text">{time}</span>
    </span>
  );
}

export function AppShell() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const { sidebarStyle } = useUiPrefs();
  const glass = sidebarStyle === 'glass';
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1');

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  return (
    <div className="flex h-screen flex-col bg-app-bg">
      {/* Top bar: brand, menu toggle, clock, user, theme, sign out */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-app-border bg-app-surface px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            title={collapsed ? 'Show menu' : 'Hide menu'}
            aria-label={collapsed ? 'Show menu' : 'Hide menu'}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-app-border text-app-muted hover:bg-app-subtle hover:text-app-text"
          >
            <svg
              className={`h-5 w-5 transition-transform ${collapsed ? '' : 'rotate-180'}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m11 17-5-5 5-5M18 17l-5-5 5-5" />
            </svg>
          </button>
          {collapsed ? (
            <span title="D PACKO Packaging Solutions">
              <BrandMark />
            </span>
          ) : (
            <BrandLogo />
          )}
        </div>
        <div className="flex items-center gap-4">
          <Clock />
          <span className="h-6 w-px bg-app-border" aria-hidden="true" />
          <div className="text-right leading-tight">
            <div className="text-sm font-medium text-app-strong">{user?.name}</div>
            <div className="text-xs capitalize text-app-muted">{user?.role}</div>
          </div>
          <button
            type="button"
            onClick={toggle}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-app-border text-app-muted hover:bg-app-subtle hover:text-app-text"
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            title="Sign out"
            aria-label="Sign out"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-app-border text-app-muted hover:bg-app-subtle hover:text-app-danger-text"
          >
            <SignOutIcon />
          </button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {glass && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-sky-400/25 blur-3xl" />
            <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-fuchsia-400/20 blur-3xl" />
            <div className="absolute bottom-0 left-0 h-72 w-72 rounded-full bg-indigo-400/20 blur-3xl" />
          </div>
        )}
        <aside
          className={`z-10 flex shrink-0 flex-col p-3 transition-all duration-200 ${
            glass
              ? 'border-r border-slate-900/10 bg-white/60 backdrop-blur-2xl dark:border-white/10 dark:bg-white/5'
              : 'bg-app-nav'
          } ${collapsed ? 'w-16 items-center' : 'w-64'}`}
        >
          <RoleAwareNav collapsed={collapsed} />
        </aside>

        <main className="relative min-w-0 flex-1 overflow-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
