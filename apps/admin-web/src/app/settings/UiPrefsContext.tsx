import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type SidebarStyle = 'default' | 'glass';

const STORAGE_KEY = 'ameen-sidebar-style';

export const SIDEBAR_STYLES: { value: SidebarStyle; label: string; description: string }[] = [
  {
    value: 'default',
    label: 'Default',
    description: 'Solid dark rail — the current look.',
  },
  {
    value: 'glass',
    label: 'Glass UI',
    description: 'Frosted translucent rail with glowing, springy icons on hover.',
  },
];

function isSidebarStyle(value: unknown): value is SidebarStyle {
  return value === 'default' || value === 'glass';
}

function initialStyle(): SidebarStyle {
  const stored = localStorage.getItem(STORAGE_KEY);
  return isSidebarStyle(stored) ? stored : 'default';
}

interface UiPrefsContextValue {
  sidebarStyle: SidebarStyle;
  setSidebarStyle: (style: SidebarStyle) => void;
}

const UiPrefsContext = createContext<UiPrefsContextValue | undefined>(undefined);

export function UiPrefsProvider({ children }: { children: ReactNode }) {
  const [sidebarStyle, setSidebarStyleState] = useState<SidebarStyle>(initialStyle);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, sidebarStyle);
  }, [sidebarStyle]);

  const setSidebarStyle = useCallback((style: SidebarStyle) => setSidebarStyleState(style), []);

  const value = useMemo(() => ({ sidebarStyle, setSidebarStyle }), [sidebarStyle, setSidebarStyle]);

  return <UiPrefsContext.Provider value={value}>{children}</UiPrefsContext.Provider>;
}

export function useUiPrefs(): UiPrefsContextValue {
  const context = useContext(UiPrefsContext);
  if (!context) throw new Error('useUiPrefs must be used within a UiPrefsProvider');
  return context;
}
