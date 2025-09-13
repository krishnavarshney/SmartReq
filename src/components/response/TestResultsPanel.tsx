import React from 'react';
import { TestResult } from '../../types';

interface TestResultsPanelProps {
    results: TestResult[];
}

const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
);

const XIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
    </svg>
);


export const TestResultsPanel: React.FC<TestResultsPanelProps> = ({ results }) => {
    const passed = results.filter(r => r.passed).length;
    const failed = results.length - passed;

    return (
        <div className="text-sm p-4">
            <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-success">Passed:</span>
                    <span>{passed}</span>
                </div>
                 <div className="flex items-center gap-2">
                    <span className="font-bold text-destructive">Failed:</span>
                    <span>{failed}</span>
                </div>
            </div>

            <div className="space-y-2">
                {results.map((result, index) => (
                    <div key={index} className="p-2 rounded-md bg-muted">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                {result.passed 
                                    ? <span className="text-success"><CheckIcon /></span> 
                                    : <span className="text-destructive"><XIcon /></span>
                                }
                                <span className="text-foreground">{result.name}</span>
                            </div>
                            {result.passed ? (
                                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-success/10 text-success">PASS</span>
                            ) : (
                                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-destructive/10 text-destructive">FAIL</span>
                            )}
                        </div>
                        {!result.passed && result.error && (
                            <pre className="mt-2 p-2 text-xs bg-card rounded font-mono text-destructive whitespace-pre-wrap">
                                {result.error}
                            </pre>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};