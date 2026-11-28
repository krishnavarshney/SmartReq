import React, { useEffect, useMemo, useRef } from 'react';

export type CodeLanguage = 'json' | 'javascript' | 'graphql' | 'xml' | 'text';

const escapeHtml = (str: string) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const VAR_HTML = (v: string) => `<span class="rounded-sm bg-info-bg text-info-text">${escapeHtml(v)}</span>`;

/** Tokenize with one regex; unmatched text is escaped verbatim. */
const tokenize = (code: string, re: RegExp, classify: (match: RegExpExecArray) => string | null): string => {
  let out = '';
  let last = 0;
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    if (m[0].length === 0) {
      re.lastIndex++;
      continue;
    }
    out += escapeHtml(code.slice(last, m.index));
    const cls = classify(m);
    if (cls === 'var') out += VAR_HTML(m[0]);
    else out += cls ? `<span class="token ${cls}">${escapeHtml(m[0])}</span>` : escapeHtml(m[0]);
    last = m.index + m[0].length;
  }
  return out + escapeHtml(code.slice(last));
};

const JSON_RE = /(\{\{[^{}\n]*\}\})|("(?:\\.|[^"\\\n])*")(\s*:)?|\b(true|false)\b|\b(null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}[\],:])/g;
const highlightJson = (code: string) =>
  tokenize(code, JSON_RE, (m) => {
    if (m[1]) return 'var';
    if (m[2]) return m[3] ? 'key' : 'string';
    if (m[4]) return 'boolean';
    if (m[5]) return 'null';
    if (m[6]) return 'number';
    return 'punctuation';
  }).replace(/<span class="token key">([^<]*?)(\s*:)<\/span>/g, '<span class="token key">$1</span><span class="token punctuation">$2</span>');

const JS_RE =
  /(\{\{[^{}\n]*\}\})|(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|(`(?:\\[\s\S]|[^`\\])*`|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|\b(function|return|if|else|const|let|var|for|while|of|in|async|await|try|catch|finally|throw|new|this|typeof|class|import|export|from)\b|\b(true|false|null|undefined)\b|\b(pm|expect|console|JSON|Math|Date)\b|(-?\b\d+(?:\.\d+)?\b)/g;
const highlightJs = (code: string) =>
  tokenize(code, JS_RE, (m) => {
    if (m[1]) return 'var';
    if (m[2]) return 'comment';
    if (m[3]) return 'string';
    if (m[4]) return 'keyword';
    if (m[5]) return 'boolean';
    if (m[6]) return 'built-in';
    if (m[7]) return 'number';
    return null;
  });

const GQL_RE = /(\{\{[^{}\n]*\}\})|(#[^\n]*)|("(?:\\.|[^"\\\n])*")|\b(query|mutation|subscription|fragment|on|true|false|null)\b|(\$[A-Za-z_]\w*)|(-?\b\d+(?:\.\d+)?\b)|([{}()[\]:!,=@])/g;
const highlightGraphql = (code: string) =>
  tokenize(code, GQL_RE, (m) => {
    if (m[1]) return 'var';
    if (m[2]) return 'comment';
    if (m[3]) return 'string';
    if (m[4]) return 'keyword';
    if (m[5]) return 'built-in';
    if (m[6]) return 'number';
    return 'punctuation';
  });

const XML_RE = /(\{\{[^{}\n]*\}\})|(<!--[\s\S]*?-->)|(<\/?[A-Za-z][\w:.-]*)|("[^"\n]*"|'[^'\n]*')|(\/?>)|([A-Za-z_:][\w:.-]*)(?==)/g;
const highlightXml = (code: string) =>
  tokenize(code, XML_RE, (m) => {
    if (m[1]) return 'var';
    if (m[2]) return 'comment';
    if (m[3]) return 'keyword';
    if (m[4]) return 'string';
    if (m[5]) return 'keyword';
    if (m[6]) return 'key';
    return null;
  });

const TEXT_RE = /(\{\{[^{}\n]*\}\})/g;
const highlightText = (code: string) => tokenize(code, TEXT_RE, () => 'var');

const HIGHLIGHTERS: Record<CodeLanguage, (code: string) => string> = {
  json: highlightJson,
  javascript: highlightJs,
  graphql: highlightGraphql,
  xml: highlightXml,
  text: highlightText,
};

/** Turn a JSON.parse message into "line X, column Y" when it carries a position. */
export const describeJsonError = (message: string, source: string): string => {
  const lineCol = message.match(/line (\d+) column (\d+)/i);
  if (lineCol) return message;
  const pos = message.match(/position (\d+)/i);
  if (!pos) return message;
  const offset = Number(pos[1]);
  const before = source.slice(0, offset);
  const line = before.split('\n').length;
  const col = offset - before.lastIndexOf('\n');
  return `${message.replace(/\s*in JSON at position \d+.*$/i, '').replace(/\s*at position \d+.*$/i, '')} (line ${line}, column ${col})`;
};

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: CodeLanguage;
  onError?: (error: string | null) => void;
  readOnly?: boolean;
  placeholder?: string;
  'aria-label'?: string;
  className?: string;
  /** Minimum editor height in px (default 200). */
  minHeight?: number;
}

const INDENT = '  ';

/** Lightweight code editor: a native textarea over a highlighted mirror, with line numbers and indentation helpers. */
export const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  language,
  onError,
  readOnly = false,
  placeholder,
  'aria-label': ariaLabel,
  className = '',
  minHeight = 200,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const escaped = useRef(false);

  const lineCount = useMemo(() => value.split('\n').length, [value]);
  const html = useMemo(() => HIGHLIGHTERS[language](value) + '\n', [value, language]);

  useEffect(() => {
    if (language !== 'json' || !onError) return;
    if (!value.trim()) return onError(null);
    try {
      JSON.parse(value.replace(/\{\{[^{}]*\}\}/g, '0'));
      onError(null);
    } catch (e) {
      onError(describeJsonError(e instanceof Error ? e.message : 'Invalid JSON', value));
    }
  }, [value, language, onError]);

  const syncScroll = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    if (preRef.current) {
      preRef.current.scrollTop = ta.scrollTop;
      preRef.current.scrollLeft = ta.scrollLeft;
    }
    if (gutterRef.current) gutterRef.current.style.transform = `translateY(${-ta.scrollTop}px)`;
  };

  /** Insert text at the selection keeping the browser's undo stack where possible. */
  const insertText = (text: string, selectStart?: number, selectEnd?: number) => {
    const ta = textareaRef.current;
    if (!ta) return;
    if (selectStart !== undefined && selectEnd !== undefined) ta.setSelectionRange(selectStart, selectEnd);
    const ok = typeof document.execCommand === 'function' && document.execCommand('insertText', false, text);
    if (!ok) {
      const { selectionStart: s, selectionEnd: e } = ta;
      const next = ta.value.slice(0, s) + text + ta.value.slice(e);
      onChange(next);
      requestAnimationFrame(() => ta.setSelectionRange(s + text.length, s + text.length));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (readOnly) return;
    const ta = e.currentTarget;
    if (e.key === 'Escape') {
      escaped.current = true;
      return;
    }
    if (e.key === 'Tab' && !escaped.current && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      const { selectionStart: s, selectionEnd: end, value: v } = ta;
      const lineStart = v.lastIndexOf('\n', s - 1) + 1;
      if (s === end && !e.shiftKey) {
        insertText(INDENT);
        return;
      }
      // Indent / outdent every selected line.
      const blockEnd = v.indexOf('\n', end - (end > s && v[end - 1] === '\n' ? 1 : 0));
      const stop = blockEnd === -1 ? v.length : blockEnd;
      const block = v.slice(lineStart, stop);
      const lines = block.split('\n');
      const changed = e.shiftKey
        ? lines.map((l) => (l.startsWith(INDENT) ? l.slice(INDENT.length) : l.replace(/^ /, '')))
        : lines.map((l) => INDENT + l);
      const next = changed.join('\n');
      insertText(next, lineStart, stop);
      ta.setSelectionRange(lineStart, lineStart + next.length);
      return;
    }
    escaped.current = false;
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
      const { selectionStart: s, value: v } = ta;
      const lineStart = v.lastIndexOf('\n', s - 1) + 1;
      const line = v.slice(lineStart, s);
      const indent = line.match(/^\s*/)?.[0] ?? '';
      const opener = /[{[(]\s*$/.test(line);
      const closer = /^\s*[}\])]/.test(v.slice(s));
      e.preventDefault();
      if (opener && closer) {
        insertText(`\n${indent}${INDENT}\n${indent}`);
        const caret = s + 1 + indent.length + INDENT.length;
        ta.setSelectionRange(caret, caret);
      } else {
        insertText(`\n${indent}${opener ? INDENT : ''}`);
      }
    }
  };

  return (
    <div
      className={`relative flex h-full overflow-hidden bg-muted/40 font-mono text-xs leading-5 ${className}`}
      style={{ minHeight }}
    >
      <div aria-hidden="true" className="relative flex-shrink-0 select-none overflow-hidden border-r border-border/60 text-right text-muted-foreground/60">
        <div ref={gutterRef} className="px-2 py-3" style={{ minWidth: `${Math.max(2, String(lineCount).length) + 2}ch` }}>
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
      </div>
      <div className="relative min-w-0 flex-1">
        <pre
          ref={preRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 m-0 overflow-hidden whitespace-pre px-3 py-3 text-foreground"
        >
          <code dangerouslySetInnerHTML={{ __html: html }} />
        </pre>
        {!value && placeholder && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 whitespace-pre px-3 py-3 text-muted-foreground/60">
            {placeholder}
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={syncScroll}
          onKeyDown={handleKeyDown}
          readOnly={readOnly}
          aria-label={ariaLabel}
          wrap="off"
          className="absolute inset-0 h-full w-full resize-none overflow-auto whitespace-pre border-0 bg-transparent px-3 py-3 text-transparent caret-foreground outline-none selection:bg-primary/30 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring/40"
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
        />
      </div>
    </div>
  );
};
