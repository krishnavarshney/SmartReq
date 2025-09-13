import React from 'react';
import { BulkProgress, BulkRunState } from '../types';

interface ProgressTrackerProps {
  progress: BulkProgress;
  runState: BulkRunState;
}

export const ProgressTracker: React.FC<ProgressTrackerProps> = ({ progress, runState }) => {
  const percentage = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  const getStatusText = () => {
    switch (runState) {
      case 'running': return 'Running...';
      case 'paused': return 'Paused';
      case 'finished': return 'Finished';
      case 'stopped': return 'Stopped';
      default: return 'Idle';
    }
  }

  const etaSeconds = progress.rps && progress.rps > 0
    ? Math.max(0, Math.round((progress.total - progress.completed) / progress.rps))
    : null;

  const formatEta = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  return (
    <div className="text-sm w-full">
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground text-xs">{getStatusText()}</span>
          <span className="text-muted-foreground text-xs">({progress.completed} / {progress.total})</span>
        </div>
        <div className="flex items-center gap-3">
            <span className="text-xs">Success: <span className="text-success font-semibold">{progress.success}</span></span>
            <span className="text-xs">Errors: <span className="text-destructive font-semibold">{progress.errors}</span></span>
            {runState === 'running' && progress.rps !== undefined && 
                <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{progress.rps.toFixed(1)} req/s</span>
            }
            {runState === 'running' && etaSeconds !== null && 
                <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded" title="Estimated time remaining">ETA {formatEta(etaSeconds)}</span>
            }
        </div>
      </div>
      <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden relative">
        <div 
            className="bg-primary h-full rounded-full transition-all duration-300 ease-linear" 
            style={{ width: `${percentage}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold text-primary-foreground mix-blend-difference">{percentage}%</span>
        </div>
      </div>
    </div>
  );
};
