import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiRequest, BulkResult, BulkRunState, BulkSettings, KeyValueItem } from '../../types';
import { RequestComposer } from '../request/RequestComposer';
import { RequestPanel } from '../request/RequestPanel';
import { SegmentedControl } from '../ui/SegmentedControl';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { usePersistentState } from '../../hooks/usePersistentState';
import { DataInputPanel, StepBadge } from './DataInputPanel';
import { ExecutionPanel } from './ExecutionPanel';
import { checkTemplateVariables, collectColumns, computeStats } from './bulkUtils';
import { useRunClock } from './useRunClock';

interface BulkWorkspaceProps {
  request: ApiRequest;
  onRequestChange: (request: ApiRequest) => void;
  data: Record<string, string>[];
  onDataChange: (data: Record<string, string>[]) => void;
  results: BulkResult[];
  runState: BulkRunState;
  /** Called with `{ rows }` to re-run only those row indices (retry failed). */
  onRun: (options?: { rows?: number[] }) => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onTestSend: () => void;
  isTestSending?: boolean;
  settings: BulkSettings;
  onSettingsChange: (settings: BulkSettings) => void;
  onGenerateBulkData: (data: Record<string, any>[]) => void;
  globals: KeyValueItem[];
}

interface SplitLayout {
  /** Fraction of height for the Data | Request row. */
  top: number;
  /** Fraction of width for the Data panel. */
  left: number;
  /** Results take the whole workspace. */
  maximized: boolean;
}

const DEFAULT_LAYOUT: SplitLayout = { top: 0.48, left: 0.4, maximized: false };
const MIN_PANE_PX = 200;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/**
 * Accessible drag handle between two panes. Pointer drag or arrow keys move it;
 * `onMove` receives the pointer position as a fraction of the container.
 */
const SplitHandle: React.FC<{
  orientation: 'horizontal' | 'vertical';
  container: React.RefObject<HTMLDivElement | null>;
  value: number;
  min: number;
  max: number;
  onChange: (fraction: number) => void;
  label: string;
}> = ({ orientation, container, value, min, max, onChange, label }) => {
  const [dragging, setDragging] = useState(false);
  const vertical = orientation === 'vertical'; // vertical line: splits left/right

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = container.current;
    if (!el) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDragging(true);
    const rect = el.getBoundingClientRect();
    const move = (ev: PointerEvent) => {
      const f = vertical ? (ev.clientX - rect.left) / rect.width : (ev.clientY - rect.top) / rect.height;
      onChange(clamp(f, min, max));
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = vertical ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const dec = vertical ? 'ArrowLeft' : 'ArrowUp';
    const inc = vertical ? 'ArrowRight' : 'ArrowDown';
    if (e.key === dec || e.key === inc) {
      e.preventDefault();
      onChange(clamp(value + (e.key === inc ? 0.03 : -0.03), min, max));
    }
  };

  return (
    <div
      role="separator"
      aria-orientation={vertical ? 'vertical' : 'horizontal'}
      aria-label={label}
      aria-valuenow={Math.round(value * 100)}
      aria-valuemin={Math.round(min * 100)}
      aria-valuemax={Math.round(max * 100)}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onDoubleClick={() => onChange(vertical ? DEFAULT_LAYOUT.left : DEFAULT_LAYOUT.top)}
      className={`group relative flex flex-shrink-0 touch-none items-center justify-center outline-none ${vertical ? 'w-3 cursor-col-resize' : 'h-3 cursor-row-resize'}`}
    >
      <span
        className={`rounded-full transition-colors duration-150 ${vertical ? 'h-10 w-1' : 'h-1 w-10'} ${
          dragging ? 'bg-primary' : 'bg-border group-hover:bg-muted-foreground/50 group-focus-visible:bg-primary'
        }`}
      />
    </div>
  );
};

const MobileTabLabel: React.FC<{ text: string; meta?: React.ReactNode; warn?: boolean; active?: boolean }> = ({ text, meta, warn, active }) => (
  <span className="flex items-center gap-1.5">
    {active && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" aria-hidden="true" />}
    {text}
    {meta !== undefined && <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{meta}</span>}
    {warn && <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-label="has warnings" />}
  </span>
);

export const BulkWorkspace: React.FC<BulkWorkspaceProps> = (props) => {
  const { request, data, results, runState, globals } = props;
  const [isBodyInvalid, setIsBodyInvalid] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [layout, setLayout] = usePersistentState<SplitLayout>('bulkLayout_v1', DEFAULT_LAYOUT);
  const [mobilePane, setMobilePane] = useState<'data' | 'request' | 'run'>('data');
  const rootRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const [rootHeight, setRootHeight] = useState(0);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setRootHeight(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [isDesktop]);

  const columns = useMemo(() => collectColumns(data), [data]);
  const variableCheck = useMemo(() => checkTemplateVariables(request, columns, data, globals), [request, columns, data, globals]);
  const stats = useMemo(() => computeStats(results), [results]);
  const clock = useRunClock(runState, stats.settled, stats.pending + stats.running);

  // On small screens, jump to the Run pane when a run starts so progress is visible.
  const prevRunState = useRef(runState);
  useEffect(() => {
    if (!isDesktop && runState === 'running' && prevRunState.current !== 'running' && prevRunState.current !== 'paused') setMobilePane('run');
    prevRunState.current = runState;
  }, [runState, isDesktop]);

  const updateLayout = useCallback((patch: Partial<SplitLayout>) => setLayout((prev) => ({ ...DEFAULT_LAYOUT, ...prev, ...patch })), [setLayout]);

  // Keep both panes at least MIN_PANE_PX tall.
  const minTop = rootHeight ? clamp(MIN_PANE_PX / rootHeight, 0.15, 0.5) : 0.25;
  const maxTop = rootHeight ? clamp(1 - MIN_PANE_PX / rootHeight, 0.5, 0.85) : 0.75;
  const topFraction = clamp(layout.top ?? DEFAULT_LAYOUT.top, minTop, maxTop);
  const leftFraction = clamp(layout.left ?? DEFAULT_LAYOUT.left, 0.25, 0.7);

  const dataPanel = <DataInputPanel data={data} onDataChange={props.onDataChange} variableCheck={variableCheck} compactHeader={!isDesktop} />;

  const requestPanel = (
    <section aria-label="Request template" className="flex h-full min-h-0 flex-col">
      {isDesktop && (
        <div className="flex h-10 flex-shrink-0 items-center gap-2 border-b border-border px-3">
          <StepBadge n={2} />
          <h2 className="text-[13px] font-semibold text-foreground">Request template</h2>
          <p className="min-w-0 truncate text-xs text-muted-foreground">
            Use <code className="font-mono text-foreground">{'{{column}}'}</code> in the URL, params, headers or body.
          </p>
        </div>
      )}
      <div className="flex-shrink-0 p-2">
        <RequestPanel
          method={request.method}
          onMethodChange={(method) => props.onRequestChange({ ...request, method })}
          url={request.url}
          onUrlChange={(url) => props.onRequestChange({ ...request, url })}
          onSend={props.onTestSend}
          isLoading={!!props.isTestSending}
          isBodyInvalid={isBodyInvalid}
          globals={globals}
          sendButtonLabel="Test row 1"
          dataVariables={data[0]}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden border-t border-border">
        <RequestComposer
          request={request}
          onRequestChange={props.onRequestChange}
          onBodyValidationChange={setIsBodyInvalid}
          onGenerateBulkData={props.onGenerateBulkData}
          onSave={() => {}}
          data={data}
          globals={globals}
        />
      </div>
    </section>
  );

  const executionPanel = (
    <ExecutionPanel
      results={results}
      runState={runState}
      onRun={props.onRun}
      onPause={props.onPause}
      onResume={props.onResume}
      onStop={props.onStop}
      settings={props.settings}
      onSettingsChange={props.onSettingsChange}
      data={data}
      url={request.url}
      variableCheck={variableCheck}
      clock={clock}
      isMaximized={isDesktop ? layout.maximized : undefined}
      onToggleMaximize={isDesktop ? () => updateLayout({ maximized: !layout.maximized }) : undefined}
      compactHeader={!isDesktop}
    />
  );

  const panelClass = 'min-h-0 min-w-0 overflow-hidden rounded-lg border border-border bg-card';

  if (!isDesktop) {
    const runMeta = runState === 'running' || runState === 'paused' ? `${stats.settled + stats.cancelled}/${stats.total}` : results.length || undefined;
    return (
      <div className="flex h-full min-h-0 flex-col gap-2 p-2">
        <SegmentedControl
          aria-label="Bulk step"
          className="w-full flex-shrink-0 [&>button]:flex-1"
          value={mobilePane}
          onChange={(v) => setMobilePane(v as typeof mobilePane)}
          options={[
            { value: 'data', label: <MobileTabLabel text="Data" meta={data.length || undefined} /> },
            { value: 'request', label: <MobileTabLabel text="Request" warn={variableCheck.missing.length > 0} /> },
            { value: 'run', label: <MobileTabLabel text="Run" meta={runMeta} active={runState === 'running'} /> },
          ]}
        />
        <div className={`${panelClass} flex-1`} hidden={mobilePane !== 'data'}>
          {dataPanel}
        </div>
        <div className={`${panelClass} flex-1`} hidden={mobilePane !== 'request'}>
          {requestPanel}
        </div>
        <div className={`${panelClass} flex-1`} hidden={mobilePane !== 'run'}>
          {executionPanel}
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="flex h-full min-h-0 flex-col p-3">
      {!layout.maximized && (
        <>
          <div ref={topRef} className="flex min-h-0 flex-shrink-0" style={{ height: `${topFraction * 100}%` }}>
            <div className={panelClass} style={{ width: `${leftFraction * 100}%` }}>
              {dataPanel}
            </div>
            <SplitHandle
              orientation="vertical"
              container={topRef}
              value={leftFraction}
              min={0.25}
              max={0.7}
              onChange={(left) => updateLayout({ left })}
              label="Resize data and request panels"
            />
            <div className={`${panelClass} flex-1`}>{requestPanel}</div>
          </div>
          <SplitHandle
            orientation="horizontal"
            container={rootRef}
            value={topFraction}
            min={minTop}
            max={maxTop}
            onChange={(top) => updateLayout({ top })}
            label="Resize setup and results panels"
          />
        </>
      )}
      <div className={`${panelClass} flex-1`}>{executionPanel}</div>
    </div>
  );
};
