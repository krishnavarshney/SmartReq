/**
 * Pure helpers for the response viewer: content detection, line building for
 * the code view, markup tokenizing and timing layout.
 */

export type BodyKind = 'json' | 'html' | 'xml' | 'csv' | 'image' | 'text' | 'empty';

export interface CodeToken {
  text: string;
  cls?: string;
}

export interface CodeLine {
  tokens: CodeToken[];
  /** Indent level; rendered as padding so wrapped text keeps its indent. */
  depth: number;
  /** For foldable openers: index of the matching closing line. */
  foldEnd?: number;
  /** Summary shown when folded, e.g. "3 keys". */
  foldLabel?: string;
  /** Tokens shown after the summary when folded, e.g. "}," */
  foldClose?: CodeToken[];
}

export const getContentType = (headers: Record<string, string> | undefined): string => {
  if (!headers) return '';
  const key = Object.keys(headers).find((k) => k.toLowerCase() === 'content-type');
  return key ? String(headers[key]) : '';
};

/** Short, human label for a content type ("application/json; charset=utf-8" -> "JSON"). */
export const describeContentType = (contentType: string, kind: BodyKind): string => {
  const mime = contentType.split(';')[0].trim().toLowerCase();
  if (kind === 'image') return mime.replace('image/', '').toUpperCase() || 'Image';
  if (kind === 'json') return 'JSON';
  if (kind === 'html') return 'HTML';
  if (kind === 'xml') return 'XML';
  if (kind === 'csv') return 'CSV';
  if (kind === 'empty') return 'Empty';
  if (!mime) return 'Text';
  if (mime === 'text/plain') return 'Text';
  return mime;
};

const looksLikeJson = (s: string) => {
  const t = s.trimStart();
  return t.startsWith('{') || t.startsWith('[');
};

export interface DetectedBody {
  kind: BodyKind;
  /** Parsed JSON value when kind === 'json'. */
  json?: unknown;
  /** Body as text (raw). For JSON objects this is compact JSON. */
  text: string;
}

/** Decide how to render a response body. `body` is what api/realApiCall produced. */
export const detectBody = (body: unknown, contentType: string): DetectedBody => {
  const ct = contentType.toLowerCase();
  if (body === undefined || body === null || body === '') return { kind: 'empty', text: '' };

  if (typeof body === 'object') {
    let text = '';
    try {
      text = JSON.stringify(body);
    } catch {
      text = String(body);
    }
    return { kind: 'json', json: body, text };
  }

  const text = String(body);
  if (ct.startsWith('image/') && text.startsWith('data:image')) return { kind: 'image', text };
  if (ct.includes('json') || (!ct.includes('html') && !ct.includes('xml') && looksLikeJson(text))) {
    try {
      return { kind: 'json', json: JSON.parse(text), text };
    } catch {
      /* fall through to text */
    }
  }
  if (ct.includes('html')) return { kind: 'html', text };
  if (ct.includes('xml')) return { kind: 'xml', text };
  if (ct.includes('csv')) return { kind: 'csv', text };
  if (!ct && /^\s*<(!doctype html|html)[\s>]/i.test(text)) return { kind: 'html', text };
  return { kind: 'text', text };
};

const P = (text: string): CodeToken => ({ text, cls: 'token punctuation' });

const primitiveToken = (v: unknown): CodeToken => {
  if (v === null) return { text: 'null', cls: 'token null' };
  switch (typeof v) {
    case 'string':
      return { text: JSON.stringify(v), cls: 'token string' };
    case 'number':
      return { text: String(v), cls: 'token number' };
    case 'boolean':
      return { text: String(v), cls: 'token boolean' };
    default:
      return { text: String(v), cls: 'token null' };
  }
};

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

/** Pretty-print a JSON value into foldable, syntax-tokenized lines. */
export const buildJsonLines = (value: unknown): CodeLine[] => {
  const lines: CodeLine[] = [];
  const walk = (v: unknown, depth: number, prefix: CodeToken[], comma: boolean) => {
    const tail = comma ? [P(',')] : [];
    if (v !== null && typeof v === 'object') {
      const isArr = Array.isArray(v);
      const keys = isArr ? null : Object.keys(v as object);
      const count = isArr ? (v as unknown[]).length : keys!.length;
      const open = isArr ? '[' : '{';
      const close = isArr ? ']' : '}';
      if (count === 0) {
        lines.push({ tokens: [...prefix, P(open + close), ...tail], depth });
        return;
      }
      const opener: CodeLine = {
        tokens: [...prefix, P(open)],
        depth,
        foldLabel: isArr ? plural(count, 'item') : plural(count, 'key'),
        foldClose: [P(close), ...tail],
      };
      lines.push(opener);
      if (isArr) {
        const arr = v as unknown[];
        for (let i = 0; i < arr.length; i++) walk(arr[i], depth + 1, [], i < arr.length - 1);
      } else {
        const obj = v as Record<string, unknown>;
        keys!.forEach((k, i) => {
          walk(obj[k], depth + 1, [{ text: JSON.stringify(k), cls: 'token key' }, P(': ')], i < keys!.length - 1);
        });
      }
      lines.push({ tokens: [P(close), ...tail], depth });
      opener.foldEnd = lines.length - 1;
      return;
    }
    lines.push({ tokens: [...prefix, primitiveToken(v), ...tail], depth });
  };
  walk(value, 0, [], false);
  return lines;
};

interface MarkupState {
  inTag: boolean;
  inComment: boolean;
}

/** Minimal HTML/XML highlighter. Carries tag/comment state across lines. */
const tokenizeMarkupLine = (line: string, state: MarkupState): CodeToken[] => {
  const out: CodeToken[] = [];
  let i = 0;
  const push = (text: string, cls?: string) => {
    if (!text) return;
    const last = out[out.length - 1];
    if (last && last.cls === cls) last.text += text;
    else out.push({ text, cls });
  };
  while (i < line.length) {
    const rest = line.slice(i);
    if (state.inComment) {
      const end = rest.indexOf('-->');
      const chunk = end === -1 ? rest : rest.slice(0, end + 3);
      push(chunk, 'token comment');
      i += chunk.length;
      if (end !== -1) state.inComment = false;
      continue;
    }
    if (!state.inTag) {
      const lt = rest.indexOf('<');
      if (lt === -1) {
        push(rest);
        break;
      }
      if (lt > 0) {
        push(rest.slice(0, lt));
        i += lt;
        continue;
      }
      if (rest.startsWith('<!--')) {
        state.inComment = true;
        continue;
      }
      const m = /^<[/!?]?[\w:.-]+/.exec(rest);
      if (m) {
        const sigil = /^<[/!?]?/.exec(m[0])![0];
        push(sigil, 'token punctuation');
        push(m[0].slice(sigil.length), 'token keyword');
        i += m[0].length;
        state.inTag = true;
        continue;
      }
      push('<');
      i += 1;
      continue;
    }
    // inside a tag
    const ws = /^\s+/.exec(rest);
    if (ws) {
      push(ws[0]);
      i += ws[0].length;
      continue;
    }
    const end = /^(\/?>|\?>)/.exec(rest);
    if (end) {
      push(end[0], 'token punctuation');
      i += end[0].length;
      state.inTag = false;
      continue;
    }
    const quoted = /^("[^"]*"?|'[^']*'?)/.exec(rest);
    if (quoted) {
      push(quoted[0], 'token string');
      i += quoted[0].length;
      continue;
    }
    if (rest[0] === '=') {
      push('=', 'token punctuation');
      i += 1;
      continue;
    }
    const attr = /^[^\s=>/"']+/.exec(rest);
    if (attr) {
      push(attr[0], 'token key');
      i += attr[0].length;
      continue;
    }
    push(rest[0]);
    i += 1;
  }
  return out;
};

export const buildTextLines = (text: string, highlight: 'markup' | 'none' = 'none'): CodeLine[] => {
  const raw = text.split(/\r?\n/);
  if (highlight === 'none') return raw.map((l) => ({ tokens: l ? [{ text: l }] : [], depth: 0 }));
  const state: MarkupState = { inTag: false, inComment: false };
  return raw.map((l) => ({ tokens: tokenizeMarkupLine(l, state), depth: 0 }));
};

export const lineText = (line: CodeLine): string => {
  if (line.tokens.length === 1) return line.tokens[0].text;
  let s = '';
  for (const t of line.tokens) s += t.text;
  return s;
};

const MIME_EXT: Record<string, string> = {
  json: 'json',
  html: 'html',
  xml: 'xml',
  csv: 'csv',
  text: 'txt',
  empty: 'txt',
};

/** Suggest a download filename from the request URL and body kind. */
export const suggestFilename = (url: string | undefined, kind: BodyKind, contentType: string): string => {
  let base = 'response';
  try {
    const u = new URL(url || '');
    const seg = u.pathname.split('/').filter(Boolean).slice(-2).join('-');
    if (seg) base = seg.replace(/[^\w.-]+/g, '_').slice(0, 60);
  } catch {
    /* keep default */
  }
  base = base.replace(/\.[a-z0-9]{1,5}$/i, '');
  let ext = MIME_EXT[kind] ?? 'txt';
  if (kind === 'image') {
    const sub = contentType.split(';')[0].split('/')[1] || 'png';
    ext = sub.replace('svg+xml', 'svg').replace('jpeg', 'jpg');
  }
  return `${base}.${ext}`;
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const dataUrlToBlob = (dataUrl: string): Blob => {
  const [head, data] = dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(head)?.[1] || 'application/octet-stream';
  if (head.includes(';base64')) {
    const bin = atob(data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  return new Blob([decodeURIComponent(data)], { type: mime });
};

// ---------------------------------------------------------------------------
// Timing

export interface TimingPhase {
  name: string;
  start: number;
  duration: number;
  /** Background class for the bar. */
  color: string;
}

const PHASE_COLORS: Record<string, string> = {
  'DNS Lookup': 'bg-info',
  'TCP Handshake': 'bg-warning',
  'SSL Handshake': 'bg-[color:var(--token-keyword)]',
  'Waiting (TTFB)': 'bg-primary',
  'Content Download': 'bg-success',
};
const FALLBACK_COLORS = ['bg-info', 'bg-warning', 'bg-method-patch', 'bg-primary', 'bg-success', 'bg-muted-foreground'];

export const PHASE_HINTS: Record<string, string> = {
  'DNS Lookup': 'Resolving the host name to an IP address.',
  'TCP Handshake': 'Opening the TCP connection (includes TLS when present).',
  'SSL Handshake': 'Negotiating TLS. Overlaps the end of the TCP connection.',
  'Waiting (TTFB)': 'From sending the request until the first response byte.',
  'Content Download': 'Receiving the response body.',
};

/** True when the timing record holds at least one measured phase. */
export const hasTiming = (timing?: Record<string, number>): timing is Record<string, number> =>
  !!timing && Object.values(timing).some((v) => typeof v === 'number' && isFinite(v)) && Object.keys(timing).length > 0;

/**
 * Lay out the phases reported by realApiCall on one time axis. TLS is part of
 * the TCP connect interval (connectEnd - secureConnectionStart), so it is
 * drawn ending where TCP ends rather than after it.
 */
export const layoutPhases = (timing: Record<string, number>): TimingPhase[] => {
  const phases: TimingPhase[] = [];
  let cursor = 0;
  let tcpEnd = 0;
  Object.entries(timing).forEach(([name, raw], i) => {
    const duration = Math.max(0, Number(raw) || 0);
    const color = PHASE_COLORS[name] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length];
    if (name === 'SSL Handshake') {
      // Plain HTTP has no TLS phase; omit the row rather than show a fake zero.
      if (duration > 0) phases.push({ name, start: Math.max(0, tcpEnd - duration), duration, color });
      return;
    }
    phases.push({ name, start: cursor, duration, color });
    cursor += duration;
    if (name === 'TCP Handshake') tcpEnd = cursor;
  });
  return phases;
};

// ---------------------------------------------------------------------------
// Status

const STATUS_TEXT: Record<number, string> = {
  100: 'Continue', 101: 'Switching Protocols', 200: 'OK', 201: 'Created', 202: 'Accepted', 203: 'Non-Authoritative Information',
  204: 'No Content', 205: 'Reset Content', 206: 'Partial Content', 301: 'Moved Permanently', 302: 'Found', 303: 'See Other',
  304: 'Not Modified', 307: 'Temporary Redirect', 308: 'Permanent Redirect', 400: 'Bad Request', 401: 'Unauthorized',
  402: 'Payment Required', 403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed', 406: 'Not Acceptable',
  408: 'Request Timeout', 409: 'Conflict', 410: 'Gone', 411: 'Length Required', 412: 'Precondition Failed',
  413: 'Payload Too Large', 414: 'URI Too Long', 415: 'Unsupported Media Type', 418: "I'm a teapot", 422: 'Unprocessable Content',
  425: 'Too Early', 426: 'Upgrade Required', 428: 'Precondition Required', 429: 'Too Many Requests',
  431: 'Request Header Fields Too Large', 451: 'Unavailable For Legal Reasons', 500: 'Internal Server Error',
  501: 'Not Implemented', 502: 'Bad Gateway', 503: 'Service Unavailable', 504: 'Gateway Timeout', 505: 'HTTP Version Not Supported',
};

/** Status text, falling back to the standard reason phrase (HTTP/2 responses have none). */
export const statusLabel = (status: number, statusText?: string): string => {
  if (!status) return statusText || 'Error';
  const text = statusText && statusText.trim() ? statusText : STATUS_TEXT[status] ?? '';
  return `${status}${text ? ` ${text}` : ''}`;
};
