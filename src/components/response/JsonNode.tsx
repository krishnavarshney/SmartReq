import React, { useEffect, useState } from 'react';
import { ChevronRight } from '../icons';

/**
 * Compact, inline JSON value renderer (table cells, previews). Objects and
 * arrays are collapsible. For full documents use CodeView, which keeps line
 * numbers aligned and handles large payloads.
 */
interface JsonNodeProps {
  data: any;
  startExpanded?: boolean;
}

const PRIMITIVE_CLASS: Record<string, string> = {
  string: 'token string',
  number: 'token number',
  bigint: 'token number',
  boolean: 'token boolean',
  null: 'token null',
  undefined: 'token null italic',
};

const getDataType = (value: any): string => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
};

const PrimitiveNode: React.FC<{ data: any; dataType: string }> = ({ data, dataType }) => {
  const value = dataType === 'string' ? JSON.stringify(data) : String(data);
  return <span className={`break-words ${PRIMITIVE_CLASS[dataType] ?? ''}`}>{value}</span>;
};

const CollapsibleNode: React.FC<{ data: any; isArray: boolean; startExpanded: boolean }> = ({ data, isArray, startExpanded }) => {
  const [isExpanded, setIsExpanded] = useState(startExpanded);
  useEffect(() => setIsExpanded(startExpanded), [startExpanded]);

  const entries: [string, any][] = isArray ? (data as any[]).map((v, i) => [String(i), v]) : Object.entries(data);
  const [open, close] = isArray ? ['[', ']'] : ['{', '}'];

  if (entries.length === 0) return <span className="token punctuation">{open + close}</span>;

  const summary = isArray ? `${entries.length} item${entries.length === 1 ? '' : 's'}` : `${entries.length} key${entries.length === 1 ? '' : 's'}`;

  return (
    <span className="inline-block max-w-full align-top font-mono">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded((v) => !v);
        }}
        aria-expanded={isExpanded}
        className="inline-flex items-center gap-1 rounded-sm text-muted-foreground hover:text-foreground focus-ring"
      >
        <ChevronRight className={`h-3 w-3 shrink-0 transition-transform duration-100 ${isExpanded ? 'rotate-90' : ''}`} />
        <span className="token punctuation">{open}</span>
        {!isExpanded && (
          <>
            <span className="font-sans text-[11px]">{summary}</span>
            <span className="token punctuation">{close}</span>
          </>
        )}
      </button>
      {isExpanded && (
        <span className="block">
          <span className="ml-1.5 block border-l border-border pl-3">
            {entries.map(([key, value]) => (
              <span key={key} className="flex items-start gap-1.5 py-px">
                <span className={`shrink-0 ${isArray ? 'text-muted-foreground' : 'token key'}`}>{isArray ? key : JSON.stringify(key)}</span>
                <span className="token punctuation shrink-0">:</span>
                <span className="min-w-0">
                  <JsonNode data={value} startExpanded={startExpanded} />
                </span>
              </span>
            ))}
          </span>
          <span className="token punctuation">{close}</span>
        </span>
      )}
    </span>
  );
};

export const JsonNode: React.FC<JsonNodeProps> = ({ data, startExpanded = false }) => {
  const dataType = getDataType(data);
  if (dataType === 'array') return <CollapsibleNode data={data} isArray startExpanded={startExpanded} />;
  if (dataType === 'object') return <CollapsibleNode data={data} isArray={false} startExpanded={startExpanded} />;
  if (dataType in PRIMITIVE_CLASS) return <PrimitiveNode data={data} dataType={dataType} />;
  return <span>{String(data)}</span>;
};
