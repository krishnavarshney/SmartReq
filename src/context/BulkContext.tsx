import React, { createContext, useContext, useState } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import { ApiRequest, BulkResult, BulkRunState, BulkSettings } from '../types';
import { createDefaultRequest } from '../utils/collection';

interface BulkContextType {
  bulkData: Record<string, string>[];
  setBulkData: React.Dispatch<React.SetStateAction<Record<string, string>[]>>;
  bulkResults: BulkResult[];
  setBulkResults: React.Dispatch<React.SetStateAction<BulkResult[]>>;
  bulkRunState: BulkRunState;
  setBulkRunState: React.Dispatch<React.SetStateAction<BulkRunState>>;
  bulkSettings: BulkSettings;
  setBulkSettings: React.Dispatch<React.SetStateAction<BulkSettings>>;
  bulkRequest: ApiRequest;
  setBulkRequest: React.Dispatch<React.SetStateAction<ApiRequest>>;
}

const BulkContext = createContext<BulkContextType | undefined>(undefined);

export const BulkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [bulkData, setBulkData] = usePersistentState<Record<string, string>[]>('bulkData_v1', []);
    const [bulkResults, setBulkResults] = useState<BulkResult[]>([]);
    const [bulkRunState, setBulkRunState] = useState<BulkRunState>('idle');
    const [bulkSettings, setBulkSettings] = usePersistentState<BulkSettings>('bulkSettings_v1', { concurrency: 5, delay: 0 });
    const [bulkRequest, setBulkRequest] = usePersistentState<ApiRequest>('bulkRequest_v1', createDefaultRequest());

    return (
        <BulkContext.Provider value={{
            bulkData, setBulkData,
            bulkResults, setBulkResults,
            bulkRunState, setBulkRunState,
            bulkSettings, setBulkSettings,
            bulkRequest, setBulkRequest,
        }}>
            {children}
        </BulkContext.Provider>
    );
};

export const useBulk = (): BulkContextType => {
    const context = useContext(BulkContext);
    if (!context) throw new Error('useBulk must be used within a BulkProvider');
    return context;
};
