import React, { useId } from 'react';
import { RequestSettings } from '../../../types';
import { Switch } from '../../ui/Switch';
import { Input } from '../../ui/Input';
import { DEFAULT_TIMEOUT_MS } from '../../../api';

interface RequestSettingsPanelProps {
  settings: RequestSettings;
  onSettingsChange: (settings: RequestSettings) => void;
}

const Row: React.FC<{ title: string; description: React.ReactNode; htmlFor?: string; children: React.ReactNode }> = ({ title, description, htmlFor, children }) => (
  <div className="flex items-start justify-between gap-6 py-3">
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-foreground">
        {title}
      </label>
      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
    </div>
    <div className="flex-shrink-0 pt-0.5">{children}</div>
  </div>
);

export const RequestSettingsPanel: React.FC<RequestSettingsPanelProps> = ({ settings, onSettingsChange }) => {
  const id = useId();
  const timeoutMs = settings.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const seconds = timeoutMs / 1000;

  return (
    <div className="max-w-2xl divide-y divide-border px-4 py-1">
      <Row
        title="Follow redirects"
        htmlFor={`${id}-redirects`}
        description="Follow 3xx responses automatically. When off, the browser stops at the redirect but hides its status and Location header."
      >
        <Switch id={`${id}-redirects`} checked={settings.followRedirects !== false} onCheckedChange={(followRedirects) => onSettingsChange({ ...settings, followRedirects })} />
      </Row>
      <Row title="Timeout" htmlFor={`${id}-timeout`} description="Give up waiting after this many seconds. 0 waits indefinitely (until you cancel).">
        <div className="flex items-center gap-2">
          <Input
            id={`${id}-timeout`}
            type="number"
            min={0}
            step={1}
            size="sm"
            value={Number.isFinite(seconds) ? String(seconds) : ''}
            onChange={(e) => {
              const n = Math.max(0, Number(e.target.value));
              onSettingsChange({ ...settings, timeoutMs: Number.isFinite(n) ? Math.round(n * 1000) : DEFAULT_TIMEOUT_MS });
            }}
            className="w-20 text-right font-mono tabular-nums"
          />
          <span className="text-xs text-muted-foreground">sec</span>
        </div>
      </Row>
      <Row
        title="SSL certificate verification"
        description="Always on: browsers verify TLS certificates and do not let web apps turn this off. Use a trusted certificate (or http:// locally)."
      >
        <Switch checked disabled onCheckedChange={() => {}} aria-label="SSL certificate verification (always on in browsers)" />
      </Row>
    </div>
  );
};
