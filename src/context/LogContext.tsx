import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { LogEntry, SingleRequestLog } from '../types';
import { usePersistentState } from '../hooks/usePersistentState';

interface LogContextType {
  logs: LogEntry[];
  setLogs: React.Dispatch<React.SetStateAction<LogEntry[]>>;
  singleRequestLogs: SingleRequestLog[];
  urlHistory: string[];
  deleteLog: (logId: number) => void;
  clearLogs: () => void;
}

const LogContext = createContext<LogContextType | undefined>(undefined);

export const LogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [logs, setLogs] = usePersistentState<LogEntry[]>('apiLogs_v5', []);
  
  const singleRequestLogs = useMemo(() => logs.filter((l): l is SingleRequestLog => l.mode === 'single'), [logs]);
  
  const urlHistory = useMemo(() => {
    const urls = logs
        .filter((log): log is SingleRequestLog => log.mode === 'single')
        .map(log => log.request.url);
    return [...new Set(urls)]; // logs are newest first, so this is most recent first
  }, [logs]);

  const deleteLog = useCallback((logId: number) => {
    setLogs((currentLogs) => currentLogs.filter((l) => l.id !== logId));
  }, [setLogs]);

  const clearLogs = useCallback(() => setLogs([]), [setLogs]);

  return (
    <LogContext.Provider value={{ logs, setLogs, singleRequestLogs, urlHistory, deleteLog, clearLogs }}>
      {children}
    </LogContext.Provider>
  );
};

export const useLog = (): LogContextType => {
  const context = useContext(LogContext);
  if (!context) throw new Error('useLog must be used within a LogProvider');
  return context;
};