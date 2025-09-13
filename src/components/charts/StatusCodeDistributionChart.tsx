import React, { useMemo } from 'react';
import { Pie } from 'react-chartjs-2';
import { BulkResult } from '../../types';
import { EmptyState } from '../ui/EmptyState';
import { PieChart } from '../icons';

interface StatusCodeDistributionChartProps {
  results: BulkResult[];
}

const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'rgba(16, 185, 129, 0.7)'; // success
    if (status >= 400 && status < 500) return 'rgba(245, 158, 11, 0.7)'; // warning
    if (status >= 500) return 'rgba(239, 68, 68, 0.7)'; // destructive
    return 'rgba(107, 114, 128, 0.7)'; // muted
};

export const StatusCodeDistributionChart: React.FC<StatusCodeDistributionChartProps> = ({ results }) => {
    const chartData = useMemo(() => {
        const statusCounts = new Map<string, number>();
        const completedResults = results.filter(r => r.status !== 'pending' && r.response.status > 0);

        completedResults.forEach(result => {
            const { status } = result.response;
            const statusGroup = `${Math.floor(status / 100)}xx`;
            statusCounts.set(statusGroup, (statusCounts.get(statusGroup) || 0) + 1);
        });

        if (statusCounts.size === 0) return null;

        const labels = Array.from(statusCounts.keys()).sort();
        const data = labels.map(label => statusCounts.get(label) || 0);

        const backgroundColors = labels.map(label => {
            const statusCode = parseInt(label.charAt(0)) * 100;
            return getStatusColor(statusCode);
        });

        return {
            labels,
            datasets: [{
                data,
                backgroundColor: backgroundColors,
                borderColor: 'hsl(var(--card))',
                borderWidth: 2,
            }]
        };
    }, [results]);

    if (!chartData) {
        return <EmptyState icon={<PieChart className="h-12 w-12 stroke-1 text-muted-foreground" />} message="No data to display." />;
    }
    
    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'right' as const,
                labels: {
                    color: 'hsl(var(--muted-foreground))'
                }
            },
            title: {
                display: true,
                text: 'Status Code Distribution',
                color: 'hsl(var(--foreground))'
            },
        },
    };

    return (
        <div className="h-full w-full">
            <Pie data={chartData} options={options} />
        </div>
    );
};
