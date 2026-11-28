import React, { useMemo } from 'react';
import { HttpMethod, KeyValueItem } from '../../types';
import { Button } from '../ui/Button';
import { Tooltip } from '../ui/Tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import { Send, X } from '../icons';
import { VariablePreviewInput } from '../ui/VariablePreviewInput';
import { getMethodClass } from '../../utils/http-ui';
import { resolveVariable } from '../../utils/interpolation';
import { MOD_KEY } from '../Header';

interface RequestPanelProps {
  url: string;
  onUrlChange: (url: string) => void;
  method: HttpMethod;
  onMethodChange: (method: HttpMethod) => void;
  onSend: () => void;
  isLoading: boolean;
  isBodyInvalid: boolean;
  globals: KeyValueItem[];
  sendButtonLabel?: string;
  dataVariables?: Record<string, string>;
  /** When provided, the Send button becomes Cancel while a request is in flight. */
  onCancel?: () => void;
  /** Handle a pasted `curl ...` command. Return true when imported. */
  onPasteCurl?: (command: string) => boolean | Promise<boolean>;
  /** Extra controls rendered after the Send button (e.g. Save). */
  actions?: React.ReactNode;
}

const httpMethods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

/** Resolve env/data variables for display; dynamic ones stay as typed since they change per send. */
const previewUrl = (url: string, globals: KeyValueItem[], data?: Record<string, string>) =>
  url.replace(/\{\{([^{}]+)\}\}/g, (whole, name: string) => {
    const v = resolveVariable(name, globals, data);
    return v.source === 'environment' || v.source === 'data' ? (v.value ?? '') : whole;
  });

export const RequestPanel: React.FC<RequestPanelProps> = ({
  url,
  onUrlChange,
  method,
  onMethodChange,
  onSend,
  isLoading,
  isBodyInvalid,
  globals,
  sendButtonLabel,
  dataVariables,
  onCancel,
  onPasteCurl,
  actions,
}) => {
  const resolved = useMemo(() => (url.includes('{{') ? previewUrl(url, globals, dataVariables) : null), [url, globals, dataVariables]);
  const label = sendButtonLabel || 'Send';

  const sendButton =
    isLoading && onCancel ? (
      <Button variant="secondary" onClick={onCancel} className="h-9 px-2.5 sm:min-w-[84px]" aria-label="Cancel request">
        <X className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Cancel</span>
      </Button>
    ) : (
      <Tooltip content={isBodyInvalid ? 'Fix the invalid JSON body first' : `Send request`} shortcut={isBodyInvalid ? undefined : `${MOD_KEY} Enter`} side="bottom">
        <Button onClick={onSend} isLoading={isLoading} disabled={isLoading || isBodyInvalid} className={`h-9 ${sendButtonLabel ? "px-3" : "w-9 px-0 sm:w-auto sm:min-w-[84px] sm:px-4"}`} aria-label={label}>
          {!isLoading && <Send className="h-3.5 w-3.5" />}
          <span className={sendButtonLabel ? '' : 'hidden sm:inline'}>{isLoading ? 'Sending' : label}</span>
        </Button>
      </Tooltip>
    );

  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-9 min-w-0 flex-1 items-stretch rounded-md border border-input bg-background transition-[border-color,box-shadow] duration-150 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25">
          <Select value={method} onValueChange={(value) => onMethodChange(value as HttpMethod)}>
            <SelectTrigger
              aria-label="HTTP method"
              className={`!h-full w-[70px] flex-shrink-0 !rounded-r-none !border-0 !border-r !border-border bg-transparent pl-2.5 pr-2 font-mono text-xs font-semibold sm:w-[96px] ${getMethodClass(method)} focus-visible:!ring-0`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {httpMethods.map((m) => (
                <SelectItem key={m} value={m}>
                  <span className={`font-mono text-xs font-semibold ${getMethodClass(m)}`}>{m}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <VariablePreviewInput
            url={url}
            onUrlChange={onUrlChange}
            globals={globals}
            dataVariables={dataVariables}
            placeholder="Enter a URL or paste a cURL command"
            aria-label="Request URL"
            onSubmit={() => !isLoading && !isBodyInvalid && onSend()}
            onPasteCurl={onPasteCurl}
            className="h-full flex-1"
          />
        </div>
        {sendButton}
        {actions}
      </div>
      {resolved !== null && (
        <div className="mt-1.5 flex min-w-0 items-center gap-1.5 pl-1 text-[11px] text-muted-foreground" title={resolved}>
          <span className="flex-shrink-0">Resolves to</span>
          <span className="truncate font-mono text-foreground/80">{resolved || ' '}</span>
        </div>
      )}
    </div>
  );
};
