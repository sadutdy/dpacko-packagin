import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';

import { useAuth } from './AuthContext.js';
import { useUiPrefs } from '../settings/UiPrefsContext.js';

interface NavItem {
  to: string;
  label: string;
  permission?: string;
  icon: ReactNode;
}

/* Compact 24×24 stroke icons (heroicon-style). */
const ICON_PROPS = {
  className: 'h-5 w-5 shrink-0',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const DashboardIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z" />
  </svg>
);
const OrdersIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4ZM3 6h18M16 10a4 4 0 0 1-8 0" />
  </svg>
);
const QuotesIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8ZM14 2v6h6M8 13h8M8 17h5" />
  </svg>
);
const InvoicesIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M5 3h14v18l-2.3-1.5L14.4 21l-2.4-1.5L9.6 21l-2.3-1.5L5 21ZM9 7h6M9 11h6M9 15h3" />
  </svg>
);
const ProductionIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M12 2 3 7v10l9 5 9-5V7ZM3 7l9 5m0 10V12m9-5-9 5" />
  </svg>
);
const InventoryIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M3 7h18M3 12h18M3 17h18" />
    <path d="m5 7 1.5-4h11L19 7m-14 0 1.3 14h13.4L21 7" />
  </svg>
);
const DeliveryIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8Z" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
);
const CrmIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const ReportsIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M3 3v18h18" />
    <path d="M7 15v3M12 10v8M17 6v12" />
  </svg>
);
const UsersIcon = () => (
  <svg {...ICON_PROPS}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21v-1a8 8 0 0 1 16 0v1" />
  </svg>
);
const SettingsIcon = () => (
  <svg {...ICON_PROPS}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
  </svg>
);
const MyDayIcon = () => (
  <svg {...ICON_PROPS}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
const DeskIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M5 4h14l-1 4H6Z" />
    <path d="M12 8v9m-4 4h8M9 13h6" />
  </svg>
);
const RoutesIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M4 19c4-1 4-8 8-8s4 7 8 8" />
    <circle cx="4" cy="19" r="2" />
    <circle cx="20" cy="19" r="2" />
  </svg>
);
const RegistersIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M5 3h14v18H5z" />
    <path d="M9 7h6M9 11h6M9 15h4" />
  </svg>
);
const ControlsIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="m8 16-5-5 5-5M16 8l5 5-5 5" />
    <path d="M13 5 11 19" />
  </svg>
);

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
  { to: '/orders', label: 'Orders', permission: 'orders:read', icon: <OrdersIcon /> },
  { to: '/quotes', label: 'Quotes', permission: 'orders:read', icon: <QuotesIcon /> },
  { to: '/invoices', label: 'Invoices', permission: 'orders:read:all', icon: <InvoicesIcon /> },
  {
    to: '/production',
    label: 'Production',
    permission: 'production:read',
    icon: <ProductionIcon />,
  },
  { to: '/inventory', label: 'Inventory', permission: 'inventory:read', icon: <InventoryIcon /> },
  { to: '/delivery', label: 'Delivery', permission: 'delivery:read', icon: <DeliveryIcon /> },
  { to: '/crm', label: 'CRM', permission: 'crm:read', icon: <CrmIcon /> },
  { to: '/reports', label: 'Reports', permission: 'reports:read', icon: <ReportsIcon /> },
  { to: '/users', label: 'Users', permission: 'users:read', icon: <UsersIcon /> },
  { to: '/office', label: 'My Day', permission: 'office:read', icon: <MyDayIcon /> },
  { to: '/office/desk', label: 'Order Desk', permission: 'office:read', icon: <DeskIcon /> },
  { to: '/office/routes', label: 'Routes', permission: 'office:read', icon: <RoutesIcon /> },
  {
    to: '/office/outstanding',
    label: 'Outstanding',
    permission: 'office:read',
    icon: <RoutesIcon />,
  },
  { to: '/office/dispatch', label: 'Dispatch', permission: 'office:read', icon: <DeliveryIcon /> },
  {
    to: '/office/registers',
    label: 'Registers',
    permission: 'office:read',
    icon: <RegistersIcon />,
  },
  { to: '/office/controls', label: 'Controls', permission: 'office:read', icon: <ControlsIcon /> },
  { to: '/settings', label: 'Settings', permission: 'settings:read', icon: <SettingsIcon /> },
];

function visibleItems(can: (permission: string) => boolean): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.permission || can(item.permission));
}

function DefaultNavList({ collapsed }: { collapsed: boolean }) {
  const { can } = useAuth();
  return (
    <nav className={`flex flex-col gap-1 ${collapsed ? 'items-center' : ''}`}>
      {visibleItems(can).map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          title={collapsed ? item.label : undefined}
          className={({ isActive }) =>
            `flex items-center rounded-md px-3 py-2 text-sm font-medium transition ${
              collapsed ? 'justify-center px-0' : 'gap-3'
            } ${
              isActive
                ? 'bg-app-nav-active text-white'
                : 'text-app-nav-text hover:bg-app-nav-hover hover:text-white'
            }`
          }
        >
          {item.icon}
          {!collapsed && <span>{item.label}</span>}
        </NavLink>
      ))}
    </nav>
  );
}

function GlassNavList({ collapsed }: { collapsed: boolean }) {
  const { can } = useAuth();
  return (
    <nav className={`flex flex-col gap-1.5 ${collapsed ? 'items-center' : ''}`}>
      {visibleItems(can).map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          title={collapsed ? item.label : undefined}
          className={({ isActive }) => {
            const base = 'group flex items-center rounded-xl text-sm font-medium';
            const box = collapsed ? 'justify-center p-2' : 'gap-3 px-2.5 py-2';
            const active = isActive
              ? 'bg-white/90 text-slate-900 shadow-[0_8px_24px_-12px_rgba(14,165,233,0.6)] ring-1 ring-slate-900/10 dark:bg-white/20 dark:text-white dark:ring-white/25'
              : 'text-slate-800 hover:bg-white/70 hover:text-slate-900 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white';
            // Frequent interaction → color feedback only, no scale or glow
            // (motion.md › Best practices). Still guarded by motion-safe.
            return `${base} ${box} ${active} transition-colors duration-200`;
          }}
        >
          <span
            className={`grid place-items-center rounded-lg transition-colors duration-200 motion-safe:group-hover:text-sky-700 motion-safe:dark:group-hover:text-sky-300 ${
              collapsed ? 'h-9 w-9' : 'h-8 w-8'
            }`}
          >
            {item.icon}
          </span>
          {!collapsed && <span>{item.label}</span>}
        </NavLink>
      ))}
    </nav>
  );
}

export function RoleAwareNav({ collapsed = false }: { collapsed?: boolean }) {
  const { sidebarStyle } = useUiPrefs();
  return sidebarStyle === 'glass' ? (
    <GlassNavList collapsed={collapsed} />
  ) : (
    <DefaultNavList collapsed={collapsed} />
  );
}
