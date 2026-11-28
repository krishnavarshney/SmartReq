import React, { useMemo, useState } from 'react';
import { BodyType, HttpMethod, KeyValueItem } from '../../../types';
import { KeyValueEditor } from '../../ui/KeyValueEditor';
import { ChevronRight } from '../../icons';
import { COMMON_HEADERS, isForbiddenHeader } from '../../../utils/http-data';

interface HeadersPanelProps {
  headers: KeyValueItem[];
  onHeadersChange: (headers: KeyValueItem[]) => void;
  method: HttpMethod;
  bodyType: BodyType;
  /** Headers SmartReq adds from the Body and Auth tabs (already excluding ones you override). */
  autoHeaders?: KeyValueItem[];
  variables?: KeyValueItem[];
}

const BROWSER_HEADERS = ['Host', 'User-Agent', 'Accept-Encoding', 'Connection', 'Origin', 'Content-Length'];

export const HeadersPanel: React.FC<HeadersPanelProps> = ({ headers, onHeadersChange, method, bodyType, autoHeaders = [], variables }) => {
  const [showAuto, setShowAuto] = useState(true);

  const suggestions = useMemo(() => {
    const extra = new Set<string>(['Accept', 'X-Request-Id', 'X-Api-Key', 'If-Modified-Since']);
    if (bodyType !== 'none' || ['POST', 'PUT', 'PATCH'].includes(method)) extra.add('Content-Type');
    return [...new Set([...COMMON_HEADERS, ...extra])].filter((h) => !isForbiddenHeader(h)).sort();
  }, [method, bodyType]);

  return (
    <div className="space-y-3 p-3">
      <KeyValueEditor
        items={headers}
        onItemsChange={onHeadersChange}
        keySuggestions={suggestions}
        keyPlaceholder="Header"
        valuePlaceholder="Value"
        layout="table"
        showBulkEdit
        variables={variables}
        aria-label="Request headers"
        getRowWarning={(item) => (item.key && isForbiddenHeader(item.key) ? `Browsers don't let web apps set ${item.key}; it will not be sent.` : undefined)}
      />

      <div className="rounded-md border border-border">
        <button
          type="button"
          onClick={() => setShowAuto((v) => !v)}
          aria-expanded={showAuto}
          className="flex h-8 w-full items-center gap-1.5 px-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground focus-ring rounded-md"
        >
          <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-150 ${showAuto ? 'rotate-90' : ''}`} />
          Auto-generated
          <span className="ml-1 rounded bg-muted px-1 py-px text-[10px] tabular-nums">{autoHeaders.length}</span>
        </button>
        {showAuto && (
          <div className="border-t border-border">
            {autoHeaders.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">None. Content-Type and Authorization appear here when the Body or Auth tab sets them.</p>
            ) : (
              autoHeaders.map((h, i) => (
                <div key={`${h.key}-${i}`} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-2 border-b border-border px-3 py-1.5 font-mono text-xs last:border-b-0">
                  <span className="truncate text-muted-foreground">{h.key}</span>
                  <span className="truncate text-muted-foreground" title={h.value}>
                    {h.key.toLowerCase() === 'authorization' && h.value.length > 24 ? `${h.value.slice(0, 18)}…` : h.value}
                  </span>
                </div>
              ))
            )}
            <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
              Add a header with the same name above to override one. The browser also sets {BROWSER_HEADERS.join(', ')} itself.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
