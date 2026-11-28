import React, { createContext, useContext, useCallback, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { usePersistentState } from '../hooks/usePersistentState';
import { Tab, RequestItem, ApiRequest, BodyDetails } from '../types';
import { createDefaultRequest } from '../utils/collection';
import { validateJsonTemplate } from '../utils/http-data';

/** Message describing why a body cannot be sent, or null. `{{variables}}` are allowed anywhere. */
export const getBodyError = (body: BodyDetails | undefined): string | null => {
  if (!body) return null;
  if (body.type === 'json') return validateJsonTemplate(body.jsonBody || '');
  if (body.type === 'graphql') {
    const err = validateJsonTemplate(body.graphqlVariables || '');
    return err ? `GraphQL variables: ${err}` : null;
  }
  return null;
};

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
  /** Close every tab except `tabId`. */
  closeOtherTabs: (tabId: string) => void;
  /** Open a copy of a tab (unsaved, not linked to the collection item). */
  duplicateTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<Tab>) => void;
  saveRequestState: SaveRequestState;
  setSaveRequestState: React.Dispatch<React.SetStateAction<SaveRequestState>>;
  /** Derived from the active request's body, so switching tabs never leaves a stale value. */
  isBodyInvalid: boolean;
  /** @deprecated Validity is derived from the active request; kept for compatibility (no-op). */
  setIsBodyInvalid: (isInvalid: boolean) => void;
}

const noop = () => {};

const TabsContext = createContext<TabsContextType | undefined>(undefined);

export const TabsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [tabs, setTabs] = usePersistentState<Tab[]>('apiTabs_v1', []);
    const [activeTabId, setActiveTabId] = usePersistentState<string | null>('activeApiTabId_v1', null);
    const [saveRequestState, setSaveRequestState] = useState<SaveRequestState>({ isOpen: false, tabId: null });
    const activeTab = React.useMemo(() => tabs.find(t => t.id === activeTabId), [tabs, activeTabId]);
    const activeRequest = activeTab?.request;
    const isBodyInvalid = React.useMemo(() => getBodyError(activeRequest?.body) !== null, [activeRequest?.body]);

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
        const tabIndex = tabs.findIndex(t => t.id === tabId);
        if (tabIndex < 0) return;
        const remaining = tabs.filter(t => t.id !== tabId);
        setTabs(remaining);
        if (activeTabId === tabId) {
            // Prefer the tab to the right (like browsers), then the one to the left.
            const next = remaining[tabIndex] ?? remaining[tabIndex - 1];
            setActiveTabId(next ? next.id : null);
        }
    }, [tabs, activeTabId, setTabs, setActiveTabId]);

    const closeOtherTabs = useCallback((tabId: string) => {
        setTabs(prev => prev.filter(t => t.id === tabId));
        setActiveTabId(tabId);
    }, [setTabs, setActiveTabId]);

    const duplicateTab = useCallback((tabId: string) => {
        const source = tabs.find(t => t.id === tabId);
        if (!source) return;
        const copy: Tab = {
            id: uuidv4(),
            name: `${source.name} copy`,
            request: JSON.parse(JSON.stringify(source.request)),
            isDirty: true,
        };
        setTabs(prev => {
            const idx = prev.findIndex(t => t.id === tabId);
            const next = [...prev];
            next.splice(idx + 1, 0, copy);
            return next;
        });
        setActiveTabId(copy.id);
    }, [tabs, setTabs, setActiveTabId]);

    const updateTab = useCallback((tabId: string, updates: Partial<Tab>) => {
        setTabs(prev => prev.map(tab => tab.id === tabId ? { ...tab, ...updates } : tab));
    }, [setTabs]);
    
  return (
    <TabsContext.Provider value={{
      tabs, setTabs,
      activeTabId, setActiveTabId,
      activeTab, activeRequest,
      openTab, closeTab, closeOtherTabs, duplicateTab, updateTab, addTab,
      saveRequestState, setSaveRequestState,
      isBodyInvalid, setIsBodyInvalid: noop
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
