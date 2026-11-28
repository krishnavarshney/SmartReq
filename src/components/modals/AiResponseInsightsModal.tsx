import React, { useCallback, useEffect, useRef, useState } from 'react';
import { KeyRound, RefreshCw } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Sparkles, AlertTriangle, Copy, Check, Settings } from '../icons';
import { useApiKey } from '../../hooks/useApiKey';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';

interface AiResponseInsightsModalProps {
  show: boolean;
  onClose: () => void;
  responseBody: string;
  status?: number;
  contentType?: string;
}

const MAX_BODY_CHARS = 30_000;

type State = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'done'; text: string };

// ---------------------------------------------------------------------------
// Minimal, safe markdown -> React (no HTML injection).

const renderInline = (text: string, keyBase: string): React.ReactNode[] => {
  const out: React.ReactNode[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyBase}-${i++}`;
    if (tok.startsWith('`')) out.push(<code key={key} className="rounded bg-muted px-1 py-px font-mono text-[12px] text-foreground">{tok.slice(1, -1)}</code>);
    else if (tok.startsWith('**')) out.push(<strong key={key} className="font-semibold text-foreground">{tok.slice(2, -2)}</strong>);
    else out.push(<em key={key}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
};

const Markdown: React.FC<{ text: string }> = ({ text }) => {
  const blocks: React.ReactNode[] = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++]);
      i++;
      blocks.push(
        <pre key={k++} className="overflow-x-auto rounded-md border border-border bg-muted/60 p-3 font-mono text-xs leading-5 text-foreground">
          {code.join('\n')}
        </pre>
      );
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      blocks.push(
        <h4 key={k++} className={`${level <= 2 ? 'text-sm' : 'text-[13px]'} mt-1 font-semibold text-foreground`}>
          {renderInline(h[2], `h${k}`)}
        </h4>
      );
      i++;
      continue;
    }
    if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]/.test(line);
      const items: { depth: number; text: string }[] = [];
      while (i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) {
        const m = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i])!;
        items.push({ depth: Math.min(2, Math.floor(m[1].length / 2)), text: m[3] });
        i++;
      }
      const List = ordered ? 'ol' : 'ul';
      blocks.push(
        <List key={k++} className={`space-y-1 ${ordered ? 'list-decimal' : 'list-disc'} pl-5 marker:text-muted-foreground`}>
          {items.map((it, j) => (
            <li key={j} style={{ marginLeft: it.depth * 16 }}>
              {renderInline(it.text, `l${k}-${j}`)}
            </li>
          ))}
        </List>
      );
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|\s*```|\s*([-*+]|\d+[.)])\s+)/.test(lines[i])) para.push(lines[i++]);
    blocks.push(<p key={k++}>{renderInline(para.join(' '), `p${k}`)}</p>);
  }
  return <div className="space-y-3 text-[13px] leading-relaxed text-muted-foreground">{blocks}</div>;
};

// ---------------------------------------------------------------------------

const buildPrompt = (body: string, status?: number, contentType?: string) => {
  let pretty = body;
  try {
    pretty = JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    /* not JSON: send as-is */
  }
  const truncated = pretty.length > MAX_BODY_CHARS;
  const sample = truncated ? pretty.slice(0, MAX_BODY_CHARS) : pretty;
  return [
    'You are helping a developer understand an HTTP API response.',
    `Status: ${status ?? 'unknown'}. Content-Type: ${contentType || 'unknown'}.`,
    truncated ? `The body was truncated to the first ${MAX_BODY_CHARS} characters.` : '',
    'Write a concise analysis in Markdown with these sections:',
    '## Summary (one or two sentences on what this response represents)',
    '## Structure (main entities and fields; counts of items in arrays)',
    '## Things to check (empty arrays, nulls, inconsistent types, error indicators, anything surprising). Say "Nothing notable" if there is nothing.',
    'Use short bullet points and `code` formatting for field names. Do not repeat the whole body.',
    '',
    'Response body:',
    '```',
    sample,
    '```',
  ]
    .filter(Boolean)
    .join('\n');
};

export const AiResponseInsightsModal: React.FC<AiResponseInsightsModalProps> = ({ show, onClose, responseBody, status, contentType }) => {
  const apiKey = useApiKey();
  const { setIsSettingsOpen } = useApp();
  const { addToast } = useToast();
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [copied, setCopied] = useState(false);
  const runId = useRef(0);

  const generate = useCallback(async () => {
    if (!apiKey) return;
    const id = ++runId.current;
    setState({ kind: 'loading' });
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const result = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: buildPrompt(responseBody, status, contentType) });
      if (id !== runId.current) return;
      const text = (result.text ?? '').trim();
      setState(text ? { kind: 'done', text } : { kind: 'error', message: 'The model returned an empty answer. Try again.' });
    } catch (err: any) {
      if (id !== runId.current) return;
      const msg = String(err?.message || '');
      let message = 'The request to Gemini failed. Check your network connection and try again.';
      if (err instanceof TypeError && msg.includes('dynamically imported module')) message = 'The AI module failed to load. Check your connection and reload the page.';
      else if (/api key|API_KEY|permission|401|403/i.test(msg)) message = 'Gemini rejected the API key. Check the key in Settings.';
      else if (/quota|429|rate/i.test(msg)) message = 'Gemini rate limit or quota reached. Wait a moment and try again.';
      setState({ kind: 'error', message });
    }
  }, [apiKey, responseBody, status, contentType]);

  // Generate on open, and again once a key is added while the dialog is open.
  useEffect(() => {
    if (!show) return;
    if (apiKey) generate();
    else setState({ kind: 'idle' });
    return () => {
      runId.current++;
    };
  }, [show, apiKey, generate]);

  const copy = () => {
    if (state.kind !== 'done') return;
    navigator.clipboard.writeText(state.text).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      },
      () => addToast('Could not copy to the clipboard.', 'error')
    );
  };

  let body: React.ReactNode;
  let footer: React.ReactNode;

  if (!apiKey) {
    body = (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-muted/60 text-muted-foreground">
          <KeyRound className="h-5 w-5" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">Add a Gemini API key</h3>
        <p className="max-w-sm text-[13px] text-muted-foreground">
          AI insights use Google Gemini with your own API key. The key stays in this browser and requests go straight from here to Google.
        </p>
      </div>
    );
    footer = (
      <>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={() => setIsSettingsOpen(true)}>
          <Settings className="h-4 w-4" />
          Open Settings
        </Button>
      </>
    );
  } else if (state.kind === 'loading' || state.kind === 'idle') {
    body = (
      <div role="status" aria-label="Analyzing response" className="space-y-5 py-1">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 animate-pulse text-primary" />
          Analyzing the response with Gemini…
        </p>
        {[0, 1, 2].map((s) => (
          <div key={s} className="space-y-2 animate-pulse">
            <div className="h-3 w-28 rounded bg-muted" />
            <div className="h-2.5 w-full rounded bg-muted/70" />
            <div className="h-2.5 w-11/12 rounded bg-muted/70" />
            {s !== 1 && <div className="h-2.5 w-2/3 rounded bg-muted/70" />}
          </div>
        ))}
      </div>
    );
    footer = (
      <Button variant="secondary" onClick={onClose}>
        Close
      </Button>
    );
  } else if (state.kind === 'error') {
    body = (
      <div className="flex items-start gap-3 rounded-lg border border-destructive/25 bg-destructive-bg p-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive-text" />
        <div>
          <p className="text-[13px] font-medium text-destructive-text">Couldn't generate insights</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{state.message}</p>
        </div>
      </div>
    );
    footer = (
      <>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
        <Button variant="secondary" onClick={generate}>
          <RefreshCw className="h-3.5 w-3.5" />
          Try again
        </Button>
      </>
    );
  } else {
    body = (
      <>
        <Markdown text={state.text} />
        <p className="mt-5 border-t border-border pt-3 text-[11px] text-muted-foreground/80">Generated by Gemini. Verify important details against the raw response.</p>
      </>
    );
    footer = (
      <>
        <Button variant="ghost" onClick={generate}>
          <RefreshCw className="h-3.5 w-3.5" />
          Regenerate
        </Button>
        <span className="flex-1" />
        <Button variant="secondary" onClick={copy}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </>
    );
  }

  return (
    <Modal show={show} onClose={onClose} size="2xl" icon={<Sparkles />} title="Response insights" description="An AI summary of the response structure and anything worth checking." footer={footer}>
      {body}
    </Modal>
  );
};
