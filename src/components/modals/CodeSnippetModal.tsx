import React, { useState, useMemo, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { ApiRequest, KeyValueItem } from '../../types';
import HTTPSnippet from 'httpsnippet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import { useToast } from '../../context/ToastContext';
import { Button } from '../ui/Button';
import { Check, Code2, Copy } from '../icons';
import { buildHarRequest } from '../../utils/har';
import { applyPathVariables } from '../../utils/http-data';
import { buildVariableMap, interpolateString } from '../../utils/interpolation';
import { base64Utf8 } from '../../api';

interface CodeSnippetModalProps {
  request: ApiRequest;
  onClose: () => void;
  globals: KeyValueItem[];
}

interface SnippetTarget {
  key: string;
  title: string;
  clients: { key: string; title: string }[];
}

const STORAGE_KEY = 'codeSnippetTarget_v1';

const readChoice = (): { target: string; client: string } => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { target: 'shell', client: 'curl' };
};

/** Fold things buildHarRequest doesn't know about (path variables, raw bodies, non-Latin1 basic auth, OAuth2) into plain fields. */
const prepare = (request: ApiRequest, globals: KeyValueItem[]) => {
  const vars = buildVariableMap(globals);
  const i = (s?: string) => interpolateString(s || '', vars);
  const pathValues: Record<string, string> = {};
  (request.pathVariables || []).forEach((p) => p.key && (pathValues[p.key] = i(p.value)));
  const prepared: ApiRequest = { ...request, url: applyPathVariables(request.url, pathValues), headers: [...request.headers] };

  const auth = request.auth;
  let authHeader: string | undefined;
  if (auth.type === 'basic' && (auth.basicUser || auth.basicPass)) authHeader = `Basic ${base64Utf8(`${i(auth.basicUser)}:${i(auth.basicPass)}`)}`;
  if (auth.type === 'oauth2' && auth.oauth2?.accessToken) authHeader = `Bearer ${i(auth.oauth2.accessToken)}`;
  if (authHeader) {
    prepared.auth = { type: 'none' };
    if (!prepared.headers.some((h) => h.enabled && h.key.toLowerCase() === 'authorization')) {
      prepared.headers.unshift({ id: -1, key: 'Authorization', value: authHeader, enabled: true });
    }
  }
  const noBody = request.method === 'GET' || request.method === 'HEAD';
  if (noBody) prepared.body = { type: 'none' };

  const har = buildHarRequest(prepared, globals);
  if (!noBody && request.body.type === 'raw' && request.body.rawBody) {
    const mimeType = request.body.rawContentType || 'text/plain';
    har.postData = { mimeType, text: i(request.body.rawBody) };
    if (!har.headers.some((h: { name: string }) => h.name === 'content-type')) har.headers.push({ name: 'content-type', value: mimeType });
  }
  if (!noBody && request.body.type === 'graphql') {
    let variables: unknown;
    try {
      variables = request.body.graphqlVariables?.trim() ? JSON.parse(i(request.body.graphqlVariables)) : undefined;
    } catch {
      variables = undefined;
    }
    har.postData = { mimeType: 'application/json', text: JSON.stringify({ query: i(request.body.graphqlQuery), variables }) };
    if (!har.headers.some((h: { name: string }) => h.name === 'content-type')) har.headers.push({ name: 'content-type', value: 'application/json' });
  }
  return har;
};

export const CodeSnippetModal: React.FC<CodeSnippetModalProps> = ({ request, onClose, globals }) => {
  const { addToast } = useToast();
  const targets = useMemo<SnippetTarget[]>(() => (HTTPSnippet as any).availableTargets(), []);
  const initial = useMemo(() => {
    const saved = readChoice();
    const target = targets.find((t) => t.key === saved.target) ?? targets.find((t) => t.key === 'shell') ?? targets[0];
    const client = target?.clients.find((c) => c.key === saved.client) ?? target?.clients[0];
    return { target: target?.key ?? 'shell', client: client?.key ?? 'curl' };
  }, [targets]);
  const [selectedTarget, setSelectedTarget] = useState(initial.target);
  const [selectedClient, setSelectedClient] = useState(initial.client);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ target: selectedTarget, client: selectedClient }));
    } catch {
      /* ignore */
    }
  }, [selectedTarget, selectedClient]);

  const { code, error } = useMemo(() => {
    try {
      const snippet = new (HTTPSnippet as any)(prepare(request, globals));
      const result = snippet.convert(selectedTarget, selectedClient);
      return { code: (Array.isArray(result) ? result.join('\n\n') : result) || '', error: null as string | null };
    } catch (e) {
      return { code: '', error: e instanceof Error ? e.message : 'Could not generate a snippet for this request.' };
    }
  }, [request, globals, selectedTarget, selectedClient]);

  const clients = targets.find((t) => t.key === selectedTarget)?.clients ?? [];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      addToast('Could not copy to the clipboard.', 'error');
    }
  };

  return (
    <Modal
      show
      onClose={onClose}
      size="3xl"
      icon={<Code2 />}
      title="Code snippet"
      description="This request as code, with variables resolved from the active environment. Pre-request scripts are not included."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button onClick={handleCopy} disabled={!code}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select
            value={selectedTarget}
            onValueChange={(key) => {
              setSelectedTarget(key);
              setSelectedClient(targets.find((t) => t.key === key)?.clients[0]?.key || '');
            }}
          >
            <SelectTrigger className="sm:w-52" aria-label="Language" data-autofocus>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {targets.map((target) => (
                <SelectItem key={target.key} value={target.key}>
                  {target.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger className="sm:w-52" aria-label="Library">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {clients.map((client) => (
                <SelectItem key={client.key} value={client.key}>
                  {client.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {error ? (
          <p role="alert" className="rounded-md bg-destructive-bg px-3 py-2 text-xs text-destructive-text">
            {error}
          </p>
        ) : (
          <pre
            tabIndex={0}
            aria-label="Generated code"
            className="max-h-[50vh] min-h-[200px] overflow-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-xs leading-5 text-foreground focus-ring"
          >
            {code}
          </pre>
        )}
      </div>
    </Modal>
  );
};
