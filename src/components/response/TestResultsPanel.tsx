import React from 'react';
import { CheckCircle2, XCircle, TestTube2 } from '../icons';
import { TestResult } from '../../types';
import { EmptyState } from '../ui/EmptyState';
import { Button } from '../ui/Button';

interface TestResultsPanelProps {
    results: TestResult[];
    /** When provided, the empty state offers AI test generation. */
    onGenerateTests?: () => void;
    isGeneratingTests?: boolean;
}

export const TestResultsPanel: React.FC<TestResultsPanelProps> = ({ results, onGenerateTests, isGeneratingTests }) => {
    if (results.length === 0) {
        return (
            <EmptyState
                icon={<TestTube2 />}
                title="No tests ran"
                message={
                    <>
                        Add assertions in the request's Tests tab, for example{' '}
                        <code className="rounded bg-muted px-1 font-mono text-[12px] text-foreground">pm.response.to.have.status(200)</code>. They run after every
                        send and their results show up here.
                    </>
                }
            >
                {onGenerateTests && (
                    <Button size="sm" variant="secondary" onClick={onGenerateTests} isLoading={isGeneratingTests}>
                        {!isGeneratingTests && <TestTube2 className="h-3.5 w-3.5" />}
                        Generate tests with AI
                    </Button>
                )}
            </EmptyState>
        );
    }

    const passed = results.filter((r) => r.passed).length;
    const failed = results.length - passed;
    const pct = Math.round((passed / results.length) * 100);
    const ordered = [...results.map((r, i) => ({ r, i }))].sort((a, b) => Number(a.r.passed) - Number(b.r.passed) || a.i - b.i);

    return (
        <div className="h-full min-h-0 overflow-auto p-3">
            <div className="mb-3 rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="font-semibold text-foreground">
                        {failed === 0 ? 'All tests passed' : `${failed} of ${results.length} test${results.length === 1 ? '' : 's'} failed`}
                    </span>
                    <span className="flex-1" />
                    <span className="flex items-center gap-1.5 text-xs text-success-text">
                        <CheckCircle2 className="h-3.5 w-3.5" /> {passed} passed
                    </span>
                    <span className={`flex items-center gap-1.5 text-xs ${failed ? 'text-destructive-text' : 'text-muted-foreground'}`}>
                        <XCircle className="h-3.5 w-3.5" /> {failed} failed
                    </span>
                </div>
                <div
                    className="mt-2.5 flex h-1.5 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={pct}
                    aria-label="Tests passed"
                >
                    <div className="h-full bg-success" style={{ width: `${pct}%` }} />
                    <div className="h-full bg-destructive" style={{ width: `${100 - pct}%` }} />
                </div>
            </div>

            <ul className="overflow-hidden rounded-lg border border-border">
                {ordered.map(({ r, i }) => (
                    <li key={i} className="border-b border-border/60 px-3 py-2 last:border-b-0">
                        <div className="flex items-start gap-2.5">
                            {r.passed ? (
                                <CheckCircle2 className="mt-px h-4 w-4 flex-shrink-0 text-success-text" aria-label="Passed" />
                            ) : (
                                <XCircle className="mt-px h-4 w-4 flex-shrink-0 text-destructive-text" aria-label="Failed" />
                            )}
                            <span className="min-w-0 flex-1 break-words text-[13px] text-foreground">{r.name}</span>
                            <span
                                className={`flex-shrink-0 rounded px-1.5 text-[10px] font-semibold uppercase leading-5 tracking-wide ${
                                    r.passed ? 'bg-success-bg text-success-text' : 'bg-destructive-bg text-destructive-text'
                                }`}
                            >
                                {r.passed ? 'Pass' : 'Fail'}
                            </span>
                        </div>
                        {!r.passed && r.error && (
                            <pre className="ml-[26px] mt-1.5 whitespace-pre-wrap break-words rounded-md bg-destructive-bg px-2.5 py-1.5 font-mono text-xs text-destructive-text">
                                {r.error}
                            </pre>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
};
