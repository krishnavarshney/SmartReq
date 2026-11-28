import React, { useCallback } from 'react';
import { BodyDetails, BodyType, HttpMethod, KeyValueItem } from '../../types';
import { JsonEditor } from './JsonEditor';
import { KeyValueEditor } from '../ui/KeyValueEditor';
import { EmptyState } from '../ui/EmptyState';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Button } from '../ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import { CodeEditor, CodeLanguage } from '../ui/CodeEditor';
import { AlertTriangle, FileText, Wand2 } from '../icons';
import { useToast } from '../../context/ToastContext';
import { formatJsonTemplate, RAW_CONTENT_TYPES, validateJsonTemplate } from '../../utils/http-data';

interface BodyBuilderProps {
  body: BodyDetails;
  onBodyChange: (body: BodyDetails) => void;
  onValidationChange: (isInvalid: boolean) => void;
  /** Used to warn that GET/HEAD bodies are not sent by browsers. */
  method?: HttpMethod;
  /** Environment variables for `{{var}}` highlighting in form fields. */
  variables?: KeyValueItem[];
}

const BODY_TYPES: { value: BodyType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'json', label: 'JSON' },
  { value: 'form-data', label: 'Form data' },
  { value: 'x-www-form-urlencoded', label: 'URL-encoded' },
  { value: 'raw', label: 'Raw' },
  { value: 'graphql', label: 'GraphQL' },
];

const rawLanguage = (contentType?: string): CodeLanguage => {
  if (!contentType) return 'text';
  if (contentType.includes('xml') || contentType.includes('html')) return 'xml';
  if (contentType.includes('javascript')) return 'javascript';
  if (contentType.includes('json')) return 'json';
  return 'text';
};

const SectionLabel: React.FC<{ children: React.ReactNode; right?: React.ReactNode }> = ({ children, right }) => (
  <div className="flex h-8 flex-shrink-0 items-center justify-between border-b border-border px-3">
    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{children}</span>
    {right}
  </div>
);

export const BodyBuilder: React.FC<BodyBuilderProps> = ({ body, onBodyChange, onValidationChange, method, variables }) => {
  const { addToast } = useToast();
  const noBodyMethod = method === 'GET' || method === 'HEAD';

  const handleTypeChange = (type: BodyType) => {
    onBodyChange({ ...body, type });
    if (type !== 'json' && type !== 'graphql') onValidationChange(false);
  };

  const format = useCallback(
    (field: 'jsonBody' | 'graphqlVariables') => {
      const text = body[field] || '';
      if (!text.trim()) return;
      try {
        onBodyChange({ ...body, [field]: formatJsonTemplate(text) });
      } catch {
        addToast(`Can't beautify: ${validateJsonTemplate(text) ?? 'invalid JSON'}`, 'error');
      }
    },
    [body, onBodyChange, addToast]
  );

  const graphqlVarsInvalid = useCallback((invalid: boolean) => onValidationChange(invalid), [onValidationChange]);

  const renderEditor = () => {
    switch (body.type) {
      case 'json':
        return (
          <JsonEditor value={body.jsonBody || ''} onChange={(jsonBody) => onBodyChange({ ...body, jsonBody })} onValidationChange={onValidationChange} />
        );
      case 'raw':
        return (
          <CodeEditor
            value={body.rawBody || ''}
            onChange={(rawBody) => onBodyChange({ ...body, rawBody })}
            language={rawLanguage(body.rawContentType)}
            aria-label="Raw body"
            placeholder={body.rawContentType?.includes('xml') ? '<user>\n  <name>{{name}}</name>\n</user>' : 'Request body'}
          />
        );
      case 'graphql':
        return (
          <div className="flex h-full min-h-0 flex-col">
            <SectionLabel>Query</SectionLabel>
            <div className="min-h-0 flex-[3]">
              <CodeEditor
                value={body.graphqlQuery || ''}
                onChange={(graphqlQuery) => onBodyChange({ ...body, graphqlQuery })}
                language="graphql"
                aria-label="GraphQL query"
                placeholder={'query User($id: ID!) {\n  user(id: $id) {\n    id\n    name\n  }\n}'}
                minHeight={140}
              />
            </div>
            <div className="border-t border-border" />
            <SectionLabel
              right={
                <Button variant="ghost" size="xs" onClick={() => format('graphqlVariables')} disabled={!body.graphqlVariables?.trim()}>
                  <Wand2 /> Beautify
                </Button>
              }
            >
              Variables
            </SectionLabel>
            <div className="min-h-0 flex-[2]">
              <JsonEditor
                value={body.graphqlVariables || ''}
                onChange={(graphqlVariables) => onBodyChange({ ...body, graphqlVariables })}
                onValidationChange={graphqlVarsInvalid}
                placeholder={'{\n  "id": "{{userId}}"\n}'}
                aria-label="GraphQL variables"
                minHeight={100}
              />
            </div>
          </div>
        );
      case 'form-data':
        return (
          <div className="space-y-2 p-3">
            <KeyValueEditor
              items={body.formData || []}
              onItemsChange={(formData) => onBodyChange({ ...body, formData })}
              showBulkEdit
              layout="table"
              variables={variables}
              aria-label="Form fields"
            />
            <p className="text-xs text-muted-foreground">Sent as multipart/form-data. Fields are text; file uploads are not supported.</p>
          </div>
        );
      case 'x-www-form-urlencoded':
        return (
          <div className="p-3">
            <KeyValueEditor
              items={body.urlEncoded || []}
              onItemsChange={(urlEncoded) => onBodyChange({ ...body, urlEncoded })}
              showBulkEdit
              layout="table"
              variables={variables}
              aria-label="Form fields"
            />
          </div>
        );
      case 'none':
      default:
        return (
          <EmptyState
            compact
            icon={<FileText />}
            title="No body"
            message={noBodyMethod ? `${method} requests don't carry a body.` : 'Choose a body type above to send data with this request.'}
          >
            {!noBodyMethod && (
              <Button variant="secondary" size="sm" onClick={() => handleTypeChange('json')}>
                Add JSON body
              </Button>
            )}
          </EmptyState>
        );
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-10 flex-shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-1.5">
        <div className="no-scrollbar -mx-1 min-w-0 overflow-x-auto px-1">
          <SegmentedControl options={BODY_TYPES} value={body.type} onChange={(v) => handleTypeChange(v as BodyType)} size="sm" aria-label="Body type" />
        </div>
        {body.type === 'json' && (
          <Button variant="ghost" size="xs" onClick={() => format('jsonBody')} disabled={!body.jsonBody?.trim()}>
            <Wand2 /> Beautify
          </Button>
        )}
        {body.type === 'raw' && (
          <Select value={body.rawContentType || 'text/plain'} onValueChange={(rawContentType) => onBodyChange({ ...body, rawContentType })}>
            <SelectTrigger className="h-7 w-auto min-w-[120px] text-xs" aria-label="Content type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RAW_CONTENT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {noBodyMethod && body.type !== 'none' && (
        <div role="note" className="flex flex-shrink-0 items-center gap-2 border-b border-border bg-warning-bg px-3 py-1.5 text-xs text-warning-text">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          Browsers can't send a body with {method}. It is ignored unless you switch to POST, PUT or PATCH.
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto">{renderEditor()}</div>
    </div>
  );
};
