import React, { useMemo } from 'react';
import { KPICard } from './ui/KPICard';
import { useTabs } from '../context/TabsContext';

export const HeaderKPIs: React.FC = () => {
  const { activeTab } = useTabs();
  const latest = activeTab?.latestResponse;

  const metrics = useMemo(() => {
    if (!latest) return null;
    const sizeTotal = latest.size?.total || 0;
    const kb = (sizeTotal / 1024).toFixed(1) + ' KB';
    const status = `${latest.status} ${latest.statusText}`;
    const duration = `${latest.duration} ms`;
    const ttfb = latest.timing?.['ttfb'] ? `${latest.timing['ttfb']} ms` : '—';
    return { kb, status, duration, ttfb };
  }, [latest]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <KPICard title="Status" value={metrics?.status || '—'} description="HTTP Status" className="motion-base hover:elev-1" />
      <KPICard title="Latency" value={metrics?.duration || '—'} description="Total duration" className="motion-base hover:elev-1" />
      <KPICard title="TTFB" value={metrics?.ttfb || '—'} description="Time to first byte" className="motion-base hover:elev-1" />
      <KPICard title="Payload" value={metrics?.kb || '—'} description="Response size" className="motion-base hover:elev-1" />
    </div>
  );
};


