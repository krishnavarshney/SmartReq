import React, { useState } from 'react';
import { LogEntry } from '../../types';
import { Input } from '../ui/Input';
import { EmptyState } from '../ui/EmptyState';
import { Copy, PenSquare, Search, Trash2 } from '../icons';
import { useToast } from '../../context/ToastContext';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '../ui/ContextMenu';
import { useLog } from '../../context/LogContext';

interface LogPanelProps {
  onLogClick: (log: LogEntry) => void;
}

const getStatusPillBGClass = (status: number) => {
    if (status >= 200 && status < 300) return 'bg-success/10';
    if (status >= 400 && status < 500) return 'bg-warning/10';
    if (status >= 500) return 'bg-destructive/10';
    return 'bg-muted';
};
const getStatusPillTextClass = (status: number) => {
    if (status >= 200 && status < 300) return 'text-success-text';
    if (status >= 400 && status < 500) return 'text-warning';
    if (status >= 500) return 'text-destructive-text';
    return 'text-muted-foreground';
};

const getMethodClass = (method: string) => {
    switch(method) {
        case 'GET': return 'text-sky-400';
        case 'POST': return 'text-emerald-400';
        case 'PUT': return 'text-amber-400';
        case 'PATCH': return 'text-orange-400';
        case 'DELETE': return 'text-rose-400';
        default: return 'text-muted-foreground';
    }
}

const SingleRequestLogItem: React.FC<{ log: LogEntry & { mode: 'single' }, onClick: () => void }> = ({ log, onClick }) => {
    try {
        const url = new URL(log.request.url);
        return (
            <div
                onClick={onClick}
                className={`p-3 flex items-start justify-between rounded-lg transition-all duration-200 group cursor-pointer hover:bg-card`}
              >
                <div className="flex items-start gap-3 overflow-hidden flex-1">
                  <span className={`font-bold text-xs w-12 text-left pt-1 ${getMethodClass(log.request.method)}`}>{log.request.method}</span>
                  <div className="flex-1 overflow-hidden">
                        <p className="truncate text-sm text-foreground font-mono">{url.pathname}{url.search}</p>
                        <p className="text-xs text-muted-foreground truncate block">{url.hostname}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-4">
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusPillBGClass(log.response.status)} ${getStatusPillTextClass(log.response.status)}`}>
                      {log.response.status}
                  </span>
                  <span className="text-muted-foreground text-xs">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            </div>
        )
    } catch(e) {
        return <div className="p-2 text-xs text-destructive">Invalid URL in log: {log.request.url}</div>;
    }
};

const BulkRunLogItem: React.FC<{ log: LogEntry & { mode: 'bulk' }, onClick: () => void }> = ({ log, onClick }) => {
    const successCount = log.results.filter(r => r.status === 'success').length;
    const errorCount = log.results.length - successCount;

    return (
        <div
            onClick={onClick}
            className={`p-3 flex items-start justify-between rounded-lg transition-all duration-200 group cursor-pointer hover:bg-card`}
        >
            <div className="flex items-start gap-3 overflow-hidden flex-1">
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-primary/20 text-primary mt-1">BULK</span>
                <div className="flex-1 overflow-hidden">
                    <p className="truncate text-sm text-foreground font-mono">{log.requestTemplate.url}</p>
                    <p className="text-xs text-muted-foreground truncate block">
                        {log.results.length} reqs ({successCount} success, {errorCount} errors)
                    </p>
                </div>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-4">
              <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${errorCount > 0 ? 'bg-destructive/10 text-destructive-text' : 'bg-success/10 text-success-text'}`}>
                  {errorCount > 0 ? 'FAIL' : 'PASS'}
              </span>
              <span className="text-muted-foreground text-xs">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
        </div>
    );
};

export const LogPanel: React.FC<LogPanelProps> = ({ onLogClick }) => {
  const { logs, deleteLog } = useLog();
  const [filter, setFilter] = useState('');
  const { addToast } = useToast();

  const filteredLogs = logs.filter(log => {
    if (!filter) return true;
    const searchTerm = filter.toLowerCase();
    if (log.mode === 'single') {
        const methodMatch = log.request.method.toLowerCase().includes(searchTerm);
        const urlMatch = log.request.url.toLowerCase().includes(searchTerm);
        const statusMatch = String(log.response.status).includes(searchTerm);
        return methodMatch || urlMatch || statusMatch;
    } else { // mode is 'bulk'
        const urlMatch = log.requestTemplate.url.toLowerCase().includes(searchTerm);
        const bulkTagMatch = 'bulk'.includes(searchTerm);
        return urlMatch || bulkTagMatch;
    }
  });
  
  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      addToast('URL copied to clipboard!', 'success');
    }, () => {
      addToast('Failed to copy URL.', 'error');
    });
  };

  const handleCopyResponseBody = (body: any) => {
    const bodyString = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
    navigator.clipboard.writeText(bodyString).then(() => {
      addToast('Response body copied!', 'success');
    }, () => {
      addToast('Failed to copy response body.', 'error');
    });
  };

  return (
    <div className="h-full flex flex-col">
       <div className="p-4 border-b border-border flex-shrink-0">
          <h2 className="text-sm font-semibold mb-2">History</h2>
          <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                  placeholder="Filter history..." 
                  value={filter} 
                  onChange={(e) => setFilter(e.target.value)}
                  className="text-sm w-full !pl-9"
              />
          </div>
       </div>

      <div className="overflow-y-auto flex-grow p-2">
        {logs.length === 0 ? (
           <EmptyState message="Your request history will appear here." />
        ) : filteredLogs.length === 0 ? (
           <EmptyState message="No logs match your filter." />
        ) : (
        <div className="space-y-1">
          {filteredLogs.map((log) => (
              <ContextMenu key={log.id}>
                <ContextMenuTrigger>
                  {log.mode === 'single'
                    ? <SingleRequestLogItem log={log} onClick={() => onLogClick(log)} />
                    : <BulkRunLogItem log={log} onClick={() => onLogClick(log)} />
                  }
                </ContextMenuTrigger>
                <ContextMenuContent>
                    <ContextMenuItem onClick={() => onLogClick(log)}>
                        <PenSquare className="h-4 w-4 mr-2" />
                        {log.mode === 'single' ? 'Load Request' : 'Load Bulk Run'}
                    </ContextMenuItem>
                    {log.mode === 'single' && (
                        <>
                          <ContextMenuItem onClick={() => handleCopyUrl(log.request.url)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Copy URL
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => handleCopyResponseBody(log.response.body)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Copy Response Body
                          </ContextMenuItem>
                        </>
                    )}
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => deleteLog(log.id)} className="!text-destructive hover:!bg-destructive/10">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                    </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            ))}
        </div>
        )}
      </div>
    </div>
  );
};
