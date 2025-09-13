import React from 'react';

interface TimeMetricsProps {
    timing?: Record<string, number>;
    total: number;
}

const BAR_COLORS = [
    'bg-yellow-500',
    'bg-orange-500',
    'bg-blue-500',
    'bg-sky-500',
    'bg-indigo-500',
    'bg-red-500',
    'bg-emerald-500',
    'bg-rose-500'
];

export const TimeMetrics: React.FC<TimeMetricsProps> = ({ timing, total }) => {
    if (!timing || total <= 0) {
        return <div className="p-2 text-sm">No timing data available.</div>;
    }

    const phases = Object.entries(timing as Record<string, number>);
    let accumulatedTime = 0;

    return (
        <div className="p-2 text-sm w-80">
            <div className="flex justify-between items-center font-bold mb-2">
                <span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline -mt-0.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                    Response Time
                </span>
                <span>{total.toFixed(2)} ms</span>
            </div>
            
            <div className="space-y-1 font-mono text-xs">
                {phases.map(([name, duration], index) => {
                    const percentage = Math.max((duration / total) * 100, 0.1);
                    const offset = (accumulatedTime / total) * 100;
                    accumulatedTime += duration as number;

                    const barStyle = {
                        width: `${percentage}%`,
                        marginLeft: `${offset}%`,
                        border: name === 'Waiting (TTFB)' ? '1px dashed #ef4444' : 'none'
                    };
                    
                    return (
                        <div key={name} className="flex items-center gap-2">
                            <span className="w-1/3 text-muted-foreground truncate">{name}</span>
                            <div className="w-1/3 h-3 bg-muted rounded-sm overflow-hidden">
                                <div className={`h-full ${BAR_COLORS[index % BAR_COLORS.length]}`} style={barStyle} />
                            </div>
                            <span className="w-1/3 text-right">{(duration as number).toFixed(2)} ms</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
