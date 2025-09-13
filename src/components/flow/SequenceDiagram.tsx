import React from 'react';
import { FlowRunResult } from '../../types';

interface SequenceDiagramProps {
  results: FlowRunResult[];
}

export const SequenceDiagram: React.FC<SequenceDiagramProps> = ({ results }) => {
    if (results.length === 0) {
        return <div className="p-4 text-muted-foreground">Run the flow to see the sequence diagram.</div>;
    }

    const participants = ['Client', ...Array.from(new Set(results.map(r => new URL(r.request.url).hostname)))];
    const totalDuration = results.reduce((sum, r) => sum + r.response.duration, 0) + (results.length - 1) * 50; // Add arbitrary delay between calls

    return (
        <div className="p-8 overflow-x-auto bg-card">
            <div className="relative" style={{ minHeight: `${results.length * 120}px` }}>
                {/* Participant Lifelines */}
                <div className="flex justify-around h-full">
                    {participants.map(p => (
                        <div key={p} className="flex flex-col items-center">
                            <div className="font-bold text-foreground mb-2 p-2 bg-muted rounded">{p}</div>
                            <div className="w-px h-full bg-border border-dashed"></div>
                        </div>
                    ))}
                </div>

                {/* Messages */}
                {results.map((result, index) => {
                    const targetName = new URL(result.request.url).hostname;
                    const fromIndex = 0; // Client
                    const toIndex = participants.indexOf(targetName);
                    
                    const top = index * 120;
                    const left = `${(fromIndex / (participants.length -1)) * 100}%`;
                    const width = `${((toIndex - fromIndex) / (participants.length -1)) * 100}%`;

                    return (
                        <div key={result.nodeId} className="absolute" style={{ top: `${top}px`, left, width }}>
                            {/* Request Arrow */}
                            <div className="flex items-center">
                                <span className="text-sm font-mono truncate">{result.request.method} {new URL(result.request.url).pathname}</span>
                                <div className="flex-grow border-t border-primary border-dashed mx-2"></div>
                                <span className="text-primary text-2xl -mt-1">▶</span>
                            </div>
                             {/* Response Arrow */}
                             <div className="absolute flex items-center" style={{ top: '50px', left: 0, width: '100%'}}>
                                <span className="text-primary text-2xl -mt-1">◀</span>
                                <div className="flex-grow border-t border-primary/50 border-dashed mx-2"></div>
                                <span className={`text-sm font-mono truncate ${result.response.status >= 400 ? 'text-destructive' : 'text-success'}`}>
                                    {result.response.status} {result.response.statusText} ({result.response.duration}ms)
                                </span>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    );
};
