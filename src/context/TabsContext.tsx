import React, { createContext, useContext, useCallback, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { usePersistentState } from '../hooks/usePersistentState';
import { Tab, RequestItem, ApiRequest } from '../types';
import { createDefaultRequest } from '../utils/collection';

interface SaveRequestState {
  isOpen: boolean;
  tabId: string | null;
}

interface TabsContextType {
  tabs: Tab[];
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
  activeTabId: string | null;
  setActiveTabId: React.Dispatch<React.SetStateAction<string | null>>;
  activeTab?: Tab;
  activeRequest?: ApiRequest;
  openTab: (requestItem: RequestItem | 'new', name?: string) => void;
  addTab: (request: ApiRequest) => void; // Add new function
  closeTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<Tab>) => void;
  saveRequestState: SaveRequestState;
  setSaveRequestState: React.Dispatch<React.SetStateAction<SaveRequestState>>;
  isBodyInvalid: boolean;
  setIsBodyInvalid: (isInvalid: boolean) => void;
}

const TabsContext = createContext<TabsContextType | undefined>(undefined);

export const TabsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [tabs, setTabs] = usePersistentState<Tab[]>('apiTabs_v1', []);
    const [activeTabId, setActiveTabId] = usePersistentState<string | null>('activeApiTabId_v1', null);
    const [saveRequestState, setSaveRequestState] = useState<SaveRequestState>({ isOpen: false, tabId: null });
    const [isBodyInvalid, setIsBodyInvalid] = useState(false);

    const activeTab = React.useMemo(() => tabs.find(t => t.id === activeTabId), [tabs, activeTabId]);
    const activeRequest = activeTab?.request;

    const openTab = useCallback((requestItem: RequestItem | 'new', name?: string) => {
        if (requestItem !== 'new') {
            const existingTab = tabs.find(t => t.originalRequestId === requestItem.id);
            if (existingTab) {
                setActiveTabId(existingTab.id);
                return;
            }
        }

        const newTab: Tab = requestItem === 'new'
            ? { id: uuidv4(), name: 'New Request', request: createDefaultRequest(), isDirty: false }
            : {
                id: uuidv4(),
                name: name || requestItem.name,
                request: JSON.parse(JSON.stringify(requestItem.request)),
                isDirty: false,
                originalRequestId: requestItem.id,
              };

        setTabs(prev => [...prev, newTab]);
        setActiveTabId(newTab.id);
    }, [tabs, setTabs, setActiveTabId]);

    const addTab = useCallback((request: ApiRequest) => {
        const newTab: Tab = {
            id: uuidv4(),
            name: request.url || 'cURL Import',
            request: request,
            isDirty: true,
        };
        setTabs(prev => [...prev, newTab]);
        setActiveTabId(newTab.id);
    }, [setTabs, setActiveTabId]);

    const closeTab = useCallback((tabId: string) => {
        setTabs(prev => {
            const tabIndex = prev.findIndex(t => t.id === tabId);
            const newTabs = prev.filter(t => t.id !== tabId);

            if (activeTabId === tabId) {
                if (newTabs.length > 0) {
                    const newActiveIndex = Math.max(0, tabIndex - 1);
                    setActiveTabId(newTabs[newActiveIndex].id);
                } else {
                    setActiveTabId(null);
                }
            }
            return newTabs;
        });
    }, [activeTabId, setTabs, setActiveTabId]);

    const updateTab = useCallback((tabId: string, updates: Partial<Tab>) => {
        setTabs(prev => prev.map(tab => tab.id === tabId ? { ...tab, ...updates } : tab));
    }, [setTabs]);
    
  return (
    <TabsContext.Provider value={{
      tabs, setTabs,
      activeTabId, setActiveTabId,
      activeTab, activeRequest,
      openTab, closeTab, updateTab, addTab,
      saveRequestState, setSaveRequestState,
      isBodyInvalid, setIsBodyInvalid
    }}>
      {children}
    </TabsContext.Provider>
  );
};

export const useTabs = (): TabsContextType => {
  const context = useContext(TabsContext);
  if (!context) throw new Error('useTabs must be used within a TabsProvider');
  return context;
};
