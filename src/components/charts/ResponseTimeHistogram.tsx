import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { BulkResult } from '../../types';
import { EmptyState } from '../ui/EmptyState';
import { Timer } from '../icons';

interface ResponseTimeHistogramProps {
  results: BulkResult[];
}

export const ResponseTimeHistogram: React.FC<ResponseTimeHistogramProps> = ({ results }) => {
    const chartData = useMemo(() => {
        const durations = results
            .filter(r => r.status !== 'pending' && typeof r.response.duration === 'number')
            .map(r => r.response.duration);

        if (durations.length === 0) return null;

        const min = Math.min(...durations);
        const max = Math.max(...durations);
        const binCount = Math.min(10, Math.max(5, Math.floor(Math.sqrt(durations.length))));
        if (max === min) return null; // Can't create bins
        
        const binSize = Math.max(1, Math.ceil((max - min) / binCount));
        
        const bins = new Array(binCount).fill(0);
        const labels = new Array(binCount).fill('');

        for (let i = 0; i < binCount; i++) {
            const binStart = min + i * binSize;
            const binEnd = binStart + binSize;
            labels[i] = `${Math.floor(binStart)}-${Math.floor(binEnd)}ms`;
        }

        durations.forEach(duration => {
            const binIndex = Math.min(binCount - 1, Math.floor((duration - min) / binSize));
            bins[binIndex]++;
        });

        return {
            labels,
            datasets: [{
                label: 'Request Count',
                data: bins,
                backgroundColor: 'hsla(var(--primary) / 0.7)',
                borderColor: 'hsla(var(--primary))',
                borderWidth: 1,
            }]
        };
    }, [results]);

    if (!chartData) {
        return <EmptyState icon={<Timer className="h-12 w-12 stroke-1 text-muted-foreground" />} message="No response time data available." />;
    }

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            title: {
                display: true,
                text: 'Response Time Distribution',
                color: 'hsl(var(--foreground))'
            },
        },
        scales: {
            x: {
                title: { display: true, text: 'Response Time (ms)', color: 'hsl(var(--muted-foreground))' },
                ticks: { color: 'hsl(var(--muted-foreground))' },
                grid: { color: 'hsl(var(--border))' }
            },
            y: {
                beginAtZero: true,
                title: { display: true, text: 'Number of Requests', color: 'hsl(var(--muted-foreground))' },
                ticks: { color: 'hsl(var(--muted-foreground))' },
                grid: { color: 'hsl(var(--border))' }
            }
        }
    };

    return (
        <div className="h-full w-full">
            <Bar data={chartData} options={options} />
        </div>
    );
};
