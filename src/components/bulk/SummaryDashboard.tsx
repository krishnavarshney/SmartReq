import React, { useMemo } from 'react';
import { BulkResult } from '../../types';
import { KPICard } from '../ui/KPICard';
import { formatBytes } from '../../utils/formatters';
import { StatusCodeDistributionChart } from '../charts/StatusCodeDistributionChart';
import { ResponseTimeHistogram } from '../charts/ResponseTimeHistogram';

interface SummaryDashboardProps {
  results: BulkResult[];
}

export const SummaryDashboard: React.FC<SummaryDashboardProps> = ({ results }) => {
    const summaryStats = useMemo(() => {
        const completed = results.filter(r => r.status !== 'pending');
        if (completed.length === 0) {
            return {
                successRate: 0,
                avgTime: 0,
                avgSize: 0,
            };
        }
        
        const successful = completed.filter(r => r.status === 'success');
        const totalDuration = successful.reduce((sum, r) => sum + (r.response.duration || 0), 0);
        const totalSize = successful.reduce((sum, r) => sum + (r.response.size?.total || 0), 0);

        return {
            successRate: (successful.length / completed.length) * 100,
            avgTime: successful.length > 0 ? totalDuration / successful.length : 0,
            avgSize: successful.length > 0 ? totalSize / successful.length : 0,
        };
    }, [results]);

    return (
        <div className="p-4 space-y-4 h-full flex flex-col">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <KPICard 
                    title="Success Rate"
                    value={`${summaryStats.successRate.toFixed(1)}%`}
                    description={`${results.filter(r => r.status === 'success').length} / ${results.filter(r => r.status !== 'pending').length} successful`}
                />
                 <KPICard 
                    title="Average Time"
                    value={`${summaryStats.avgTime.toFixed(0)} ms`}
                    description="For successful requests"
                />
                 <KPICard 
                    title="Average Size"
                    value={formatBytes(summaryStats.avgSize)}
                    description="For successful requests"
                />
            </div>
            <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4 min-h-[250px]">
                <div className="bg-card p-4 rounded-lg border border-border">
                    <StatusCodeDistributionChart results={results} />
                </div>
                 <div className="bg-card p-4 rounded-lg border border-border">
                    <ResponseTimeHistogram results={results} />
                </div>
            </div>
        </div>
    );
};
