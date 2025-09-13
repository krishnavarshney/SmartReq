import React from 'react';
import { Bar } from 'react-chartjs-2';
import { EmptyState } from '../ui/EmptyState';
import { Timer } from '../icons';

interface WaterfallPanelProps {
  timing?: Record<string, number>;
  total: number;
}

const BAR_COLORS = [
    'rgba(250, 204, 21, 0.7)',  // yellow
    'rgba(251, 146, 60, 0.7)',  // orange
    'rgba(59, 130, 246, 0.7)', // blue
    'rgba(239, 68, 68, 0.7)',   // red
    'rgba(16, 185, 129, 0.7)', // green
];

export const WaterfallPanel: React.FC<WaterfallPanelProps> = ({ timing, total }) => {
    if (!timing || total <= 0) {
        return <EmptyState icon={<Timer className="h-12 w-12 stroke-1 text-muted-foreground"/>} message="No detailed timing data available for this request." />;
    }

    const phases = Object.entries(timing as Record<string, number>);
    let accumulatedTime = 0;

    const data = {
        labels: phases.map(([name]) => name),
        datasets: [{
            data: phases.map(([_, duration], index) => {
                const start = accumulatedTime;
                accumulatedTime += duration as number;
                return [start, start + (duration as number)];
            }),
            backgroundColor: phases.map((_, index) => BAR_COLORS[index % BAR_COLORS.length]),
            borderColor: phases.map((_, index) => BAR_COLORS[index % BAR_COLORS.length].replace('0.7', '1')),
            borderWidth: 1,
            borderSkipped: false,
        }]
    };

    const options = {
        indexAxis: 'y' as const,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: (context: any) => {
                        const [start, end] = context.raw;
                        const duration = end - start;
                        return `${context.dataset.label || context.label}: ${duration.toFixed(2)} ms`;
                    }
                }
            }
        },
        scales: {
            x: {
                min: 0,
                max: total,
                title: { display: true, text: 'Time (ms)' },
                grid: { color: 'rgba(128,128,128,0.1)' },
            },
            y: {
                grid: { display: false },
            }
        }
    };
    
    return (
        <div className="p-4 h-full">
            <div className="h-full min-h-[200px]">
                <Bar data={data} options={options} />
            </div>
        </div>
    );
};