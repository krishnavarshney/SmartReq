import React from 'react';
import { HttpMethod, KeyValueItem } from '../../types';
import { Button } from '../ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import { Send } from '../icons';
import { VariablePreviewInput } from '../ui/VariablePreviewInput';

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
}

const httpMethods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];

const getMethodClass = (method: string) => {
    switch(method) {
        case 'GET': return 'text-sky-400';
        case 'POST': return 'text-emerald-400';
        case 'PUT': return 'text-amber-400';
        case 'PATCH': return 'text-orange-400';
        case 'DELETE': return 'text-rose-400';
        default: return 'text-muted-foreground';
    }
}

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
}) => {
  return (
    <div className="relative flex flex-wrap items-stretch gap-2 flex-shrink-0 bg-card/70 backdrop-blur-md border border-border rounded-lg p-2 md:p-3 elev-1">
      <Select
        value={method}
        onValueChange={(value) => onMethodChange(value as HttpMethod)}
      >
        <SelectTrigger className={`w-12 sm:w-32 font-semibold glass-surface-lite elev-1 ${getMethodClass(method)}`}>
            <SelectValue />
        </SelectTrigger>
        <SelectContent>
            {httpMethods.map((m) => (
              <SelectItem key={m} value={m}>
                <span className={getMethodClass(m)}>{m}</span>
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
      <div className="relative flex-1 min-w-[220px] pb-6">
        <VariablePreviewInput
          url={url}
          onUrlChange={onUrlChange}
          globals={globals}
          dataVariables={dataVariables}
          placeholder="https://api.example.com/resource"
          className="w-full"
        />
      </div>
      <Button onClick={onSend} isLoading={isLoading} disabled={isLoading || isBodyInvalid} className="px-4 elev-1">
        <Send className="h-4 w-4 mr-2" />
        {isLoading ? 'Sending' : (sendButtonLabel || 'Send')}
      </Button>
    </div>
  );
};