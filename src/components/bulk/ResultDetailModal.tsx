import React, { useEffect, useMemo, useState } from 'react';
import { Ban, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { Spinner } from '../ui/Spinner';
import { Kbd } from '../ui/Tooltip';
import { SegmentedControl } from '../ui/SegmentedControl';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { BulkResult, SingleRequestLog } from '../../types';
import { ResponsePanel } from '../response/ResponsePanel';
import { getMethodClass, getStatusBadgeClass } from '../../utils/http-ui';
import { formatBytes } from '../../utils/formatters';
import { isSettled } from './bulkUtils';

interface ResultDetailModalProps {
  result: BulkResult;
  onClose: () => void;
  /** Position within the current (filtered) results list. */
  position?: { index: number; total: number };
  onPrev?: () => void;
  onNext?: () => void;
}

const Section: React.FC<{ title: string; count?: number; children: React.ReactNode }> = ({ title, count, children }) => (
  <section className="border-b border-border px-4 py-3 last:border-b-0">
    <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {title}
      {count !== undefined && <span className="font-mono normal-case tabular-nums">{count}</span>}
    </h3>
    {children}
  </section>
);

const KeyValueList: React.FC<{ items: { key: string; value: string }[]; empty: string }> = ({ items, empty }) =>
  items.length === 0 ? (
    <p className="text-xs text-muted-foreground">{empty}</p>
  ) : (
    <dl className="grid grid-cols-[minmax(80px,auto)_1fr] gap-x-3 gap-y-1 font-mono text-xs">
      {items.map((item, i) => (
        <React.Fragment key={`${item.key}-${i}`}>
          <dt className="truncate text-[color:var(--token-key)]" title={item.key}>
            {item.key}
          </dt>
          <dd className="min-w-0 break-all text-foreground">{item.value || <span className="text-muted-foreground">(empty)</span>}</dd>
        </React.Fragment>
      ))}
    </dl>
  );

const prettyBody = (body: string): string => {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
};

export const ResultDetailModal: React.FC<ResultDetailModalProps> = ({ result, onClose, position, onPrev, onNext }) => {
  const isWide = useMediaQuery('(min-width: 1024px)');
  const [mobileView, setMobileView] = useState<'response' | 'request'>('response');
  const settled = isSettled(result);
  const req = result.request ?? ({} as BulkResult['request']);
  const hasRequest = !!req.url;

  // Arrow keys step through rows unless the user is typing or selecting inside a view.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.metaKey || e.ctrlKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.closest('input, textarea, select, [contenteditable="true"], [role="tablist"], [role="radiogroup"], .cm-editor'))) return;
      if (e.key === 'ArrowLeft' && onPrev) {
        e.preventDefault();
        onPrev();
      } else if (e.key === 'ArrowRight' && onNext) {
        e.preventDefault();
        onNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onPrev, onNext]);

  const logEntry: SingleRequestLog | null = useMemo(
    () =>
      settled && hasRequest
        ? { id: result.id, mode: 'single', request: req, response: result.response, timestamp: new Date().toISOString(), originalRequest: {} as SingleRequestLog['originalRequest'] }
        : null,
    [settled, hasRequest, result, req]
  );

  const headers = (req.headers ?? []).filter((h) => h.enabled && h.key).map((h) => ({ key: h.key, value: h.value }));
  const sourceData = Object.entries(result.data).map(([key, value]) => ({ key, value }));

  const requestPane = (
    <div className="min-h-0 overflow-auto">
      <Section title="Source data" count={sourceData.length}>
        <KeyValueList items={sourceData} empty="This row has no columns." />
      </Section>
      {hasRequest ? (
        <>
          <Section title="Request">
            <p className="break-all font-mono text-xs leading-5">
              <span className={`mr-2 font-semibold ${getMethodClass(req.method)}`}>{req.method}</span>
              <span className="text-foreground">{req.url}</span>
            </p>
          </Section>
          <Section title="Headers" count={headers.length}>
            <KeyValueList items={headers} empty="No headers were sent." />
          </Section>
          <Section title="Body">
            {req.bodyStructure ? (
              <KeyValueList items={req.bodyStructure.filter((i) => i.enabled && i.key).map((i) => ({ key: i.key, value: i.value }))} empty="Empty form body." />
            ) : typeof req.body === 'string' && req.body ? (
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted/60 p-2 font-mono text-xs text-foreground">{prettyBody(req.body)}</pre>
            ) : (
              <p className="text-xs text-muted-foreground">No request body.</p>
            )}
          </Section>
        </>
      ) : (
        <Section title="Request">
          <p className="text-xs text-muted-foreground">The request is built when the row is sent.</p>
        </Section>
      )}
    </div>
  );

  const pendingState =
    result.status === 'cancelled' ? (
      <EmptyState compact icon={<Ban />} title="Cancelled" message="The run was stopped before this row received a response." />
    ) : result.status === 'running' ? (
      <EmptyState compact icon={<Spinner className="h-4 w-4" />} title="In flight" message="Waiting for the server to respond." />
    ) : (
      <EmptyState compact icon={<Clock />} title="Queued" message="This row has not been sent yet." />
    );

  const responsePane = <div className="flex h-full min-h-0 flex-col p-3">{logEntry ? <ResponsePanel currentLog={logEntry} isLoading={false} responseHistory={[]} onGenerateTests={() => {}} isGeneratingTests={false} /> : pendingState}</div>;

  const statusBadge = settled ? (
    result.response.status > 0 ? (
      <span className={`inline-flex h-5 items-center rounded px-1.5 font-mono text-[11px] font-semibold ${getStatusBadgeClass(result.response.status)}`}>
        {result.response.status} {result.response.statusText}
      </span>
    ) : (
      <Badge tone="error">{result.response.statusText || 'No response'}</Badge>
    )
  ) : (
    <Badge tone="neutral">{result.status === 'cancelled' ? 'Cancelled' : result.status === 'running' ? 'Running' : 'Queued'}</Badge>
  );

  const title = (
    <span className="flex flex-wrap items-center gap-2">
      Row {result.id}
      {statusBadge}
      {settled && (
        <span className="font-mono text-xs font-normal tabular-nums text-muted-foreground">
          {Math.round(result.response.duration)} ms{result.response.size ? ` · ${formatBytes(result.response.size.total, 1)}` : ''}
        </span>
      )}
    </span>
  );

  const footer = (
    <>
      {position && (
        <span className="mr-auto hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
          <span className="font-mono tabular-nums">
            {position.index + 1} / {position.total}
          </span>
          <span>·</span>
          <Kbd>←</Kbd>
          <Kbd>→</Kbd>
          <span>to navigate</span>
        </span>
      )}
      <Button size="sm" variant="secondary" onClick={onPrev} disabled={!onPrev} aria-label="Previous row">
        <ChevronLeft className="h-3.5 w-3.5" /> Prev
      </Button>
      <Button size="sm" variant="secondary" onClick={onNext} disabled={!onNext} aria-label="Next row">
        Next <ChevronRight className="h-3.5 w-3.5" />
      </Button>
    </>
  );

  return (
    <Modal
      show
      onClose={onClose}
      size="full"
      flush
      title={title}
      description={hasRequest ? <span className="block truncate font-mono text-xs">{`${req.method} ${req.url}`}</span> : 'Bulk run result'}
      footer={footer}
    >
      {isWide ? (
        <div className="grid h-[min(680px,calc(100vh-14rem))] grid-cols-[minmax(320px,38%)_1fr]">
          <div className="min-h-0 overflow-auto border-r border-border">{requestPane}</div>
          {responsePane}
        </div>
      ) : (
        <div className="flex h-[calc(92vh-11rem)] min-h-[320px] flex-col">
          <div className="flex-shrink-0 border-b border-border px-3 py-2">
            <SegmentedControl
              size="sm"
              aria-label="Detail view"
              value={mobileView}
              onChange={(v) => setMobileView(v as 'response' | 'request')}
              options={[
                { value: 'response', label: 'Response' },
                { value: 'request', label: 'Request' },
              ]}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-auto">{mobileView === 'response' ? responsePane : requestPane}</div>
        </div>
      )}
    </Modal>
  );
};
