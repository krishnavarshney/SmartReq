import React from 'react';
import { HttpMethod, KeyValueItem } from '../types';
import { Button } from './ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/Select';
import { Globe, Send } from './icons';
import { VariablePreviewInput } from './ui/VariablePreviewInput';
import { useWorkspace } from '../context/WorkspaceContext';

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
  const { environments, activeEnvironmentId, setActiveEnvironmentId } = useWorkspace();

  return (
    <div className="flex flex-wrap items-stretch p-4 gap-2 flex-shrink-0">
      <div className="flex flex-1 items-stretch rounded-md border border-border bg-input min-w-0 shadow-sm">
        <Select
          value={method}
          onValueChange={(value) => onMethodChange(value as HttpMethod)}
        >
          <SelectTrigger className={`w-24 sm:w-28 font-semibold border-0 rounded-r-none rounded-l-md bg-muted focus:ring-0 ${getMethodClass(method)}`}>
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

        <Select
          value={activeEnvironmentId || 'no-environment'}
          onValueChange={(value) => setActiveEnvironmentId(value === 'no-environment' ? null : value)}
        >
          <SelectTrigger className="min-w-[150px] w-auto flex-shrink-0 border-0 rounded-none bg-muted focus:ring-0 whitespace-nowrap">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Env" className="truncate" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="no-environment">No Environment</SelectItem>
            {environments.map((env) => (
              <SelectItem key={env.id} value={env.id}>
                {env.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1 w-0">
          <VariablePreviewInput
            url={url}
            onUrlChange={onUrlChange}
            globals={globals}
            dataVariables={dataVariables}
            placeholder="https://api.example.com/resource"
            className="w-full text-sm sm:text-base !border-0 !ring-0 !h-full"
          />
        </div>
        <Button
          onClick={onSend}
          isLoading={isLoading}
          disabled={isLoading || isBodyInvalid}
          variant="primary"
          className="px-3 sm:px-4 rounded-l-none"
          aria-label={isLoading ? 'Sending request' : 'Send request (Ctrl or Cmd + Enter)'}
          title={isBodyInvalid ? 'Body is invalid JSON' : 'Shortcut: Ctrl/Cmd + Enter'}
        >
          <Send className="h-4 w-4 mr-2" />
          {isLoading ? 'Sending' : (sendButtonLabel || 'Send')}
        </Button>
      </div>
      {isBodyInvalid && (
        <div className="w-full -mt-2 px-1 text-xs text-destructive">
          Request body is invalid JSON. Please fix errors before sending.
        </div>
      )}
    </div>
  );
};
