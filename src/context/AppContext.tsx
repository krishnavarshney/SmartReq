import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';

export type Layout = 'vertical' | 'horizontal';
export type AppMode = 'single' | 'bulk' | 'flow' | 'discovery';
export type SidebarPanel = 'collections' | 'environment' | 'history';

interface AppContextType {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (isOpen: boolean) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (isOpen: boolean | ((prev: boolean) => boolean)) => void;
  sidebarPanel: SidebarPanel;
  setSidebarPanel: (panel: SidebarPanel) => void;
  /** Open the sidebar on a given panel (used by header/env selector/palette). */
  revealSidebarPanel: (panel: SidebarPanel) => void;
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
  layout: Layout;
  setLayout: (layout: Layout) => void;
  isImportModalOpen: boolean;
  setIsImportModalOpen: (isOpen: boolean) => void;
  isOnboardingOpen: boolean;
  setIsOnboardingOpen: (isOpen: boolean) => void;
  hasOnboarded: boolean;
  setHasOnboarded: (hasOnboarded: boolean) => void;
  isCommandPaletteOpen: boolean;
  setIsCommandPaletteOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  isMobile: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const DESKTOP_BREAKPOINT = 768; // Tailwind 'md'
const SIDEBAR_KEY = 'sidebarOpen_desktop_v1';

const readDesktopSidebar = (): boolean => {
  try {
    const stored = window.localStorage.getItem(SIDEBAR_KEY);
    return stored !== null ? JSON.parse(stored) : true;
  } catch {
    return true;
  }
};

export const AppContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < DESKTOP_BREAKPOINT);
  const [mode, setMode] = usePersistentState<AppMode>('appMode_v1', 'single');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => (isMobile ? false : readDesktopSidebar()));
  const [sidebarPanel, setSidebarPanel] = useState<SidebarPanel>('collections');
  const [sidebarWidth, setSidebarWidth] = usePersistentState('sidebarWidth_v2', 300);
  const [layout, setLayout] = usePersistentState<Layout>('layout_v1', 'horizontal');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [hasOnboarded, setHasOnboarded] = usePersistentState('hasOnboarded_v1', false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const wasMobile = useRef(isMobile);

  // React only to crossing the breakpoint, so resizing a desktop window never
  // fights the user's sidebar choice or layout preference.
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${DESKTOP_BREAKPOINT - 1}px)`);
    const onChange = () => {
      const mobile = mq.matches;
      setIsMobile(mobile);
      if (mobile !== wasMobile.current) {
        setIsSidebarOpen(mobile ? false : readDesktopSidebar());
        wasMobile.current = mobile;
      }
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (isMobile) return;
    try {
      window.localStorage.setItem(SIDEBAR_KEY, JSON.stringify(isSidebarOpen));
    } catch {
      /* storage unavailable; preference just won't persist */
    }
  }, [isSidebarOpen, isMobile]);

  const revealSidebarPanel = (panel: SidebarPanel) => {
    setSidebarPanel(panel);
    setIsSidebarOpen(true);
  };

  return (
    <AppContext.Provider
      value={{
        mode,
        setMode,
        isSettingsOpen,
        setIsSettingsOpen,
        isSidebarOpen,
        setIsSidebarOpen,
        sidebarPanel,
        setSidebarPanel,
        revealSidebarPanel,
        sidebarWidth,
        setSidebarWidth,
        layout,
        setLayout,
        isImportModalOpen,
        setIsImportModalOpen,
        isOnboardingOpen,
        setIsOnboardingOpen,
        hasOnboarded,
        setHasOnboarded,
        isCommandPaletteOpen,
        setIsCommandPaletteOpen,
        isMobile,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppContextProvider');
  return context;
};
