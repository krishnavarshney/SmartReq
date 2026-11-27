
import React, { createContext, useState, useContext, useRef, useCallback } from 'react';
import { DiscoverySession } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { startDiscovery } from '../utils/discovery';
import { useToast } from './ToastContext';
import { getApiKey } from '../utils/apiKey';

interface DiscoveryContextType {
    session: DiscoverySession | null;
    start: (baseUrl: string) => Promise<void>;
    stop: () => void;
}

const DiscoveryContext = createContext<DiscoveryContextType | undefined>(undefined);

export const DiscoveryProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
    const { addToast } = useToast();
    const [session, setSession] = useState<DiscoverySession | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const start = useCallback(async (baseUrl: string) => {
        if (!baseUrl.trim() || !/^https?:\/\//.test(baseUrl.trim())) {
            addToast('Please enter a valid starting URL (including http/https).', 'error');
            return;
        }

        if (!getApiKey()) {
            addToast('Gemini API key is not available. Add it in Settings.', 'error');
            setSession({ id: uuidv4(), baseUrl, status: 'error', endpoints: [], log: [] });
            return;
        }

        abortControllerRef.current = new AbortController();
        const newSession: DiscoverySession = {
            id: uuidv4(),
            baseUrl: baseUrl.trim(),
            status: 'running',
            endpoints: [],
            log: [`[${new Date().toLocaleTimeString()}] Starting discovery at ${baseUrl.trim()}`],
        };
        setSession(newSession);

        try {
            for await (const update of startDiscovery(baseUrl.trim(), abortControllerRef.current.signal)) {
                setSession(s => {
                    if (!s || s.id !== newSession.id) return s;
                    return {
                        ...s,
                        endpoints: update.endpoints || s.endpoints,
                        log: [...s.log, ...update.log],
                        generatedSpec: update.generatedSpec || s.generatedSpec,
                    };
                });
            }
            setSession(s => {
                if (!s || s.id !== newSession.id) return s;
                return { ...s, status: 'finished', log: [...s.log, `[${new Date().toLocaleTimeString()}] Discovery finished.`] };
            });
        } catch (error: any) {
            if (error.name !== 'AbortError') {
                console.error('Discovery error:', error);
                addToast(`Discovery failed: ${error.message}`, 'error');
                setSession(s => {
                    if (!s || s.id !== newSession.id) return s;
                    return { ...s, status: 'error', log: [...s.log, `[${new Date().toLocaleTimeString()}] Error: ${error.message}`] };
                });
            } else {
                setSession(s => {
                    if (!s || s.id !== newSession.id) return s;
                    return { ...s, status: 'idle', log: [...s.log, `[${new Date().toLocaleTimeString()}] Discovery stopped.`] };
                });
            }
        }
    }, [addToast]);

    const stop = useCallback(() => {
        abortControllerRef.current?.abort();
    }, []);

    return (
        <DiscoveryContext.Provider value={{ session, start, stop }}>
            {children}
        </DiscoveryContext.Provider>
    );
};

export const useDiscovery = () => {
    const context = useContext(DiscoveryContext);
    if (context === undefined) {
        throw new Error('useDiscovery must be used within a DiscoveryProvider');
    }
    return context;
};
