import React, { useMemo } from 'react';
import { BodyType, HttpMethod, KeyValueItem } from '../../types';
import { KeyValueEditor } from '../ui/KeyValueEditor';
import { Tooltip } from '../ui/Tooltip';
import { Info } from '../icons';
import { COMMON_HEADERS } from '../../utils/http-data';

interface HeadersPanelProps {
  headers: KeyValueItem[];
  onHeadersChange: (headers: KeyValueItem[]) => void;
  method: HttpMethod;
  bodyType: BodyType;
}

export const HeadersPanel: React.FC<HeadersPanelProps> = ({ headers, onHeadersChange, method, bodyType }) => {
  const suggestions = useMemo(() => {
    const dynamicSuggestions = new Set<string>();

    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      dynamicSuggestions.add('Content-Length');
    }

    if (bodyType !== 'none') {
      dynamicSuggestions.add('Content-Type');
    }

    if (method !== 'GET') {
      dynamicSuggestions.add('Accept');
    }

    return [...new Set([...COMMON_HEADERS, ...Array.from(dynamicSuggestions)])].sort();
  }, [method, bodyType]);

  return (
    <div className="p-4">
        <div className="flex items-center text-xs text-muted-foreground mb-4 gap-2">
            <Tooltip content="Common and context-aware HTTP headers will be suggested as you type.">
                <span>
                  <Info className="h-4 w-4 cursor-help" />
                </span>
            </Tooltip>
            <p>Intelligent header suggestions are enabled.</p>
        </div>
      <KeyValueEditor 
        items={headers}
        onItemsChange={onHeadersChange}
        keySuggestions={suggestions}
      />
    </div>
  );
};