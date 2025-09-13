import React, { createContext, useContext, useState, useEffect } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';

type Layout = 'vertical' | 'horizontal';

interface AppContextType {
  isSettingsOpen: boolean;
  setIsSettingsOpen: (isOpen: boolean) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (isOpen: boolean | ((prev: boolean) => boolean)) => void;
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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const DESKTOP_BREAKPOINT = 768; // Corresponds to Tailwind's 'md'

export const AppContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= DESKTOP_BREAKPOINT) {
      try {
        const storedValue = window.localStorage.getItem('sidebarOpen_desktop_v1');
        return storedValue !== null ? JSON.parse(storedValue) : true;
      } catch {
        return true;
      }
    }
    return false; // Default to closed on mobile
  });

  const [sidebarWidth, setSidebarWidth] = usePersistentState('sidebarWidth_v1', 320);
  const [layout, setLayoutState] = usePersistentState<Layout>('layout_v1', 'horizontal');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [hasOnboarded, setHasOnboarded] = usePersistentState('hasOnboarded_v1', false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  
  useEffect(() => {
    const handleResize = () => {
      const newLayout: Layout = window.innerWidth < DESKTOP_BREAKPOINT ? 'vertical' : 'horizontal';
      setLayoutState(newLayout); // Update the layout state
      if (window.innerWidth < DESKTOP_BREAKPOINT) {
        setIsSidebarOpen(false);
      } else {
        // On desktop, restore sidebar state from local storage if it was open
        try {
          const storedValue = window.localStorage.getItem('sidebarOpen_desktop_v1');
          if (storedValue !== null) {
            setIsSidebarOpen(JSON.parse(storedValue));
          } else {
            setIsSidebarOpen(true); // Default to open if no stored value
          }
        } catch {
          setIsSidebarOpen(true);
        }
      }
    };

    // Set initial layout on mount
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Only persist state on desktop
    if (window.innerWidth >= DESKTOP_BREAKPOINT) {
      try {
        window.localStorage.setItem('sidebarOpen_desktop_v1', JSON.stringify(isSidebarOpen));
      } catch (error) {
        console.error("Could not save sidebar state:", error);
      }
    }
  }, [isSidebarOpen]);
  
  const setLayout = (newLayout: Layout) => {
    setLayoutState(newLayout);
  };


  return (
    <AppContext.Provider value={{
      isSettingsOpen, setIsSettingsOpen,
      isSidebarOpen, setIsSidebarOpen,
      sidebarWidth, setSidebarWidth,
      layout, setLayout,
      isImportModalOpen, setIsImportModalOpen,
      isOnboardingOpen, setIsOnboardingOpen,
      hasOnboarded, setHasOnboarded
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppContextProvider');
  return context;
};