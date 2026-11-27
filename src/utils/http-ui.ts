/**
 * Shared visual vocabulary for HTTP concepts. Use these instead of
 * re-implementing method/status colors per component.
 */

const METHOD_TEXT: Record<string, string> = {
  GET: 'text-method-get',
  POST: 'text-method-post',
  PUT: 'text-method-put',
  PATCH: 'text-method-patch',
  DELETE: 'text-method-delete',
};

/** Text color class for an HTTP method label. */
export const getMethodClass = (method?: string): string =>
  METHOD_TEXT[(method || '').toUpperCase()] ?? 'text-method-other';

/** Short label that fits a fixed-width method column ("DELETE" -> "DEL"). */
export const getMethodShort = (method?: string): string => {
  const m = (method || '').toUpperCase();
  if (m === 'DELETE') return 'DEL';
  if (m === 'OPTIONS') return 'OPT';
  if (m === 'PATCH') return 'PTCH';
  return m;
};

export type StatusTone = 'success' | 'info' | 'warning' | 'error' | 'neutral';

/** Map an HTTP status to a semantic tone. 0 means the request never completed. */
export const getStatusTone = (status?: number | null): StatusTone => {
  if (!status) return 'error';
  if (status >= 200 && status < 300) return 'success';
  if (status >= 300 && status < 400) return 'info';
  if (status >= 400 && status < 500) return 'warning';
  if (status >= 500) return 'error';
  return 'neutral';
};

const TONE_BADGE: Record<StatusTone, string> = {
  success: 'bg-success-bg text-success-text',
  info: 'bg-info-bg text-info-text',
  warning: 'bg-warning-bg text-warning-text',
  error: 'bg-destructive-bg text-destructive-text',
  neutral: 'bg-muted text-muted-foreground',
};

const TONE_TEXT: Record<StatusTone, string> = {
  success: 'text-success-text',
  info: 'text-info-text',
  warning: 'text-warning-text',
  error: 'text-destructive-text',
  neutral: 'text-muted-foreground',
};

const TONE_DOT: Record<StatusTone, string> = {
  success: 'bg-success',
  info: 'bg-info',
  warning: 'bg-warning',
  error: 'bg-destructive',
  neutral: 'bg-muted-foreground',
};

/** Pill background + text classes for a status code. */
export const getStatusBadgeClass = (status?: number | null): string => TONE_BADGE[getStatusTone(status)];
/** Text-only color class for a status code. */
export const getStatusTextClass = (status?: number | null): string => TONE_TEXT[getStatusTone(status)];
/** Solid dot color class for a status code. */
export const getStatusDotClass = (status?: number | null): string => TONE_DOT[getStatusTone(status)];
export const toneBadgeClass = (tone: StatusTone): string => TONE_BADGE[tone];
