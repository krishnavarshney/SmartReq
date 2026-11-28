import React, { useId, useMemo, useState } from 'react';
import { AuthDetails, AuthType, GrantType, KeyValueItem } from '../../../types';
import { Input } from '../../ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/Select';
import { Button, IconButton } from '../../ui/Button';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Eye, Info, CheckCircle2, AlertTriangle } from '../../icons';
import { EyeOff, KeyRound } from 'lucide-react';
import { VarField } from '../VarField';
import { buildVariableMap, interpolateString } from '../../../utils/interpolation';
import { base64Utf8, realApiCall } from '../../../api';
import { useToast } from '../../../context/ToastContext';
import { EmptyState } from '../../ui/EmptyState';

interface AuthorizationPanelProps {
  auth: AuthDetails;
  onAuthChange: (auth: AuthDetails) => void;
  /** Environment/global variables, for `{{variable}}` highlighting and token requests. */
  variables?: KeyValueItem[];
}

const AUTH_TYPES: { value: AuthType; label: string; description: string }[] = [
  { value: 'none', label: 'No auth', description: 'No credentials are added.' },
  { value: 'bearer', label: 'Bearer token', description: 'Sends Authorization: Bearer <token>.' },
  { value: 'basic', label: 'Basic auth', description: 'Sends Authorization: Basic <base64 user:password>.' },
  { value: 'apiKey', label: 'API key', description: 'Sends a key/value pair as a header or query parameter.' },
  { value: 'jwt', label: 'JWT bearer', description: 'Sends a JSON Web Token as Authorization: Bearer <token>.' },
  { value: 'oauth2', label: 'OAuth 2.0', description: 'Sends an access token as Authorization: Bearer <token>.' },
];

const GRANT_TYPES: { value: GrantType; label: string }[] = [
  { value: 'client_credentials', label: 'Client credentials' },
  { value: 'password_credentials', label: 'Password' },
  { value: 'authorization_code', label: 'Authorization code' },
  { value: 'implicit', label: 'Implicit' },
];

const Field: React.FC<{ label: string; htmlFor?: string; hint?: React.ReactNode; children: React.ReactNode }> = ({ label, htmlFor, hint, children }) => (
  <div className="grid gap-1.5 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-start sm:gap-3">
    <label htmlFor={htmlFor} className="pt-0 text-xs font-medium text-muted-foreground sm:pt-2">
      {label}
    </label>
    <div className="min-w-0">
      {children}
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  </div>
);

const SecretInput: React.FC<{ id: string; value: string; onChange: (v: string) => void; placeholder?: string }> = ({ id, value, onChange, placeholder }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className="pr-9 font-mono text-xs"
      />
      <IconButton
        size="xs"
        className="absolute right-1 top-1"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide value' : 'Show value'}
        aria-pressed={visible}
      >
        {visible ? <EyeOff /> : <Eye />}
      </IconButton>
    </div>
  );
};

const decodeJwt = (token: string): { header: Record<string, unknown>; payload: Record<string, unknown> } | null => {
  const parts = token.trim().split('.');
  if (parts.length !== 3) return null;
  try {
    const decode = (s: string) => {
      const b64 = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=');
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    };
    return { header: decode(parts[0]), payload: decode(parts[1]) };
  } catch {
    return null;
  }
};

const relativeTime = (seconds: number): string => {
  const abs = Math.abs(seconds);
  if (abs < 90) return `${Math.round(abs)}s`;
  if (abs < 5400) return `${Math.round(abs / 60)}m`;
  if (abs < 172800) return `${Math.round(abs / 3600)}h`;
  return `${Math.round(abs / 86400)}d`;
};

const JwtSummary: React.FC<{ token: string }> = ({ token }) => {
  const decoded = useMemo(() => (token.includes('{{') ? null : decodeJwt(token)), [token]);
  if (!decoded) return null;
  const exp = typeof decoded.payload.exp === 'number' ? decoded.payload.exp : undefined;
  const now = Date.now() / 1000;
  const expired = exp !== undefined && exp < now;
  return (
    <div className="mt-2 rounded-md border border-border bg-muted/40 p-2 text-xs">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="font-medium text-foreground">JWT</span>
        {typeof decoded.header.alg === 'string' && <span className="font-mono text-muted-foreground">{decoded.header.alg}</span>}
        {exp !== undefined && (
          <span className={`inline-flex items-center gap-1 ${expired ? 'text-destructive-text' : 'text-success-text'}`}>
            {expired ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
            {expired ? `Expired ${relativeTime(now - exp)} ago` : `Expires in ${relativeTime(exp - now)}`}
          </span>
        )}
      </div>
      <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] text-muted-foreground">{JSON.stringify(decoded.payload, null, 2)}</pre>
    </div>
  );
};

export const AuthorizationPanel: React.FC<AuthorizationPanelProps> = ({ auth, onAuthChange, variables = [] }) => {
  const id = useId();
  const { addToast } = useToast();
  const [isFetchingToken, setIsFetchingToken] = useState(false);
  const typeInfo = AUTH_TYPES.find((t) => t.value === auth.type) ?? AUTH_TYPES[0];
  const oauth2 = auth.oauth2 ?? { grantType: 'client_credentials' as GrantType };

  const setOauth = (patch: Partial<NonNullable<AuthDetails['oauth2']>>) => onAuthChange({ ...auth, oauth2: { ...oauth2, ...patch } });

  const handleTypeChange = (value: string) => {
    // Keep previously entered credentials so switching type back and forth loses nothing.
    onAuthChange({ ...auth, type: value as AuthType, oauth2: value === 'oauth2' ? oauth2 : auth.oauth2 });
  };

  const preview = useMemo(() => {
    const vars = buildVariableMap(variables);
    const mask = (v: string) => (v.length > 12 ? `${v.slice(0, 6)}…${v.slice(-4)}` : v);
    switch (auth.type) {
      case 'bearer':
      case 'jwt':
        return auth.token?.trim() ? `Authorization: Bearer ${mask(interpolateString(auth.token.trim(), vars))}` : null;
      case 'oauth2':
        return oauth2.accessToken?.trim() ? `Authorization: Bearer ${mask(interpolateString(oauth2.accessToken.trim(), vars))}` : null;
      case 'basic':
        return auth.basicUser || auth.basicPass
          ? `Authorization: Basic ${mask(base64Utf8(`${interpolateString(auth.basicUser || '', vars)}:${interpolateString(auth.basicPass || '', vars)}`))}`
          : null;
      case 'apiKey':
        if (!auth.apiKeyKey?.trim()) return null;
        return auth.apiKeyAddTo === 'query'
          ? `?${interpolateString(auth.apiKeyKey, vars)}=${mask(interpolateString(auth.apiKeyValue || '', vars))}`
          : `${interpolateString(auth.apiKeyKey, vars)}: ${mask(interpolateString(auth.apiKeyValue || '', vars))}`;
      default:
        return null;
    }
  }, [auth, oauth2.accessToken, variables]);

  const canFetchToken = oauth2.grantType === 'client_credentials' || oauth2.grantType === 'password_credentials';

  const fetchToken = async () => {
    const vars = buildVariableMap(variables);
    const i = (v?: string) => interpolateString(v || '', vars);
    if (!oauth2.accessTokenUrl?.trim()) {
      addToast('Enter the access token URL first.', 'info');
      return;
    }
    const params = new URLSearchParams();
    params.set('grant_type', oauth2.grantType === 'password_credentials' ? 'password' : 'client_credentials');
    if (oauth2.clientId) params.set('client_id', i(oauth2.clientId));
    if (oauth2.clientSecret) params.set('client_secret', i(oauth2.clientSecret));
    if (oauth2.scope) params.set('scope', i(oauth2.scope));
    if (oauth2.grantType === 'password_credentials') {
      params.set('username', i(oauth2.username));
      params.set('password', i(oauth2.password));
    }
    setIsFetchingToken(true);
    try {
      const response = await realApiCall({
        method: 'POST',
        url: i(oauth2.accessTokenUrl),
        headers: [
          { id: 1, key: 'Content-Type', value: 'application/x-www-form-urlencoded', enabled: true },
          { id: 2, key: 'Accept', value: 'application/json', enabled: true },
        ],
        body: params.toString(),
        settings: { followRedirects: true, sslVerification: true },
      });
      let body = response.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          body = Object.fromEntries(new URLSearchParams(body));
        }
      }
      const token = body && typeof body === 'object' ? (body as Record<string, unknown>).access_token : undefined;
      if (response.status >= 200 && response.status < 300 && typeof token === 'string') {
        setOauth({ accessToken: token });
        addToast('Access token received', 'success');
      } else if (response.status === 0) {
        addToast(`Token request failed: ${(body as { message?: string })?.message ?? response.statusText}`, 'error');
      } else {
        const err = body && typeof body === 'object' ? (body as Record<string, unknown>).error_description ?? (body as Record<string, unknown>).error : undefined;
        addToast(`Token request failed: ${response.status} ${err ? String(err) : response.statusText}`, 'error');
      }
    } finally {
      setIsFetchingToken(false);
    }
  };

  const renderFields = () => {
    switch (auth.type) {
      case 'bearer':
      case 'jwt':
        return (
          <Field label="Token" htmlFor={`${id}-token`}>
            <VarField id={`${id}-token`} value={auth.token || ''} onChange={(token) => onAuthChange({ ...auth, token })} variables={variables} placeholder="Token or {{variable}}" aria-label="Token" />
            <JwtSummary token={auth.token || ''} />
          </Field>
        );
      case 'basic':
        return (
          <>
            <Field label="Username" htmlFor={`${id}-user`}>
              <VarField id={`${id}-user`} value={auth.basicUser || ''} onChange={(basicUser) => onAuthChange({ ...auth, basicUser })} variables={variables} aria-label="Username" />
            </Field>
            <Field label="Password" htmlFor={`${id}-pass`}>
              <SecretInput id={`${id}-pass`} value={auth.basicPass || ''} onChange={(basicPass) => onAuthChange({ ...auth, basicPass })} />
            </Field>
          </>
        );
      case 'apiKey':
        return (
          <>
            <Field label="Key" htmlFor={`${id}-key`}>
              <VarField id={`${id}-key`} value={auth.apiKeyKey || ''} onChange={(apiKeyKey) => onAuthChange({ ...auth, apiKeyKey })} variables={variables} placeholder="X-API-Key" aria-label="Key name" />
            </Field>
            <Field label="Value" htmlFor={`${id}-value`}>
              <VarField id={`${id}-value`} value={auth.apiKeyValue || ''} onChange={(apiKeyValue) => onAuthChange({ ...auth, apiKeyValue })} variables={variables} placeholder="Key value or {{variable}}" aria-label="Key value" />
            </Field>
            <Field label="Add to">
              <SegmentedControl
                size="sm"
                aria-label="Add API key to"
                options={[
                  { value: 'header', label: 'Header' },
                  { value: 'query', label: 'Query params' },
                ]}
                value={auth.apiKeyAddTo || 'header'}
                onChange={(v) => onAuthChange({ ...auth, apiKeyAddTo: v as 'header' | 'query' })}
              />
            </Field>
          </>
        );
      case 'oauth2':
        return (
          <>
            <Field label="Access token" htmlFor={`${id}-access`} hint="This is what gets sent. Paste one, or request it below.">
              <VarField id={`${id}-access`} value={oauth2.accessToken || ''} onChange={(accessToken) => setOauth({ accessToken })} variables={variables} placeholder="Access token" aria-label="Access token" />
              <JwtSummary token={oauth2.accessToken || ''} />
            </Field>
            <div className="border-t border-border" />
            <Field label="Grant type">
              <Select value={oauth2.grantType} onValueChange={(v) => setOauth({ grantType: v as GrantType })}>
                <SelectTrigger className="w-full sm:w-64" aria-label="Grant type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRANT_TYPES.map((gt) => (
                    <SelectItem key={gt.value} value={gt.value}>
                      {gt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {!canFetchToken && (
              <Field label="Authorization URL" htmlFor={`${id}-authurl`}>
                <VarField id={`${id}-authurl`} value={oauth2.authUrl || ''} onChange={(authUrl) => setOauth({ authUrl })} variables={variables} placeholder="https://auth.example.com/authorize" aria-label="Authorization URL" />
              </Field>
            )}
            {oauth2.grantType !== 'implicit' && (
              <Field label="Access token URL" htmlFor={`${id}-tokenurl`}>
                <VarField id={`${id}-tokenurl`} value={oauth2.accessTokenUrl || ''} onChange={(accessTokenUrl) => setOauth({ accessTokenUrl })} variables={variables} placeholder="https://auth.example.com/oauth/token" aria-label="Access token URL" />
              </Field>
            )}
            <Field label="Client ID" htmlFor={`${id}-cid`}>
              <VarField id={`${id}-cid`} value={oauth2.clientId || ''} onChange={(clientId) => setOauth({ clientId })} variables={variables} aria-label="Client ID" />
            </Field>
            {oauth2.grantType !== 'implicit' && (
              <Field label="Client secret" htmlFor={`${id}-secret`}>
                <SecretInput id={`${id}-secret`} value={oauth2.clientSecret || ''} onChange={(clientSecret) => setOauth({ clientSecret })} />
              </Field>
            )}
            {oauth2.grantType === 'password_credentials' && (
              <>
                <Field label="Username" htmlFor={`${id}-ouser`}>
                  <VarField id={`${id}-ouser`} value={oauth2.username || ''} onChange={(username) => setOauth({ username })} variables={variables} aria-label="Username" />
                </Field>
                <Field label="Password" htmlFor={`${id}-opass`}>
                  <SecretInput id={`${id}-opass`} value={oauth2.password || ''} onChange={(password) => setOauth({ password })} />
                </Field>
              </>
            )}
            {!canFetchToken && (
              <Field label="Callback URL" htmlFor={`${id}-cb`}>
                <VarField id={`${id}-cb`} value={oauth2.callbackUrl || ''} onChange={(callbackUrl) => setOauth({ callbackUrl })} variables={variables} aria-label="Callback URL" />
              </Field>
            )}
            <Field label="Scope" htmlFor={`${id}-scope`}>
              <VarField id={`${id}-scope`} value={oauth2.scope || ''} onChange={(scope) => setOauth({ scope })} variables={variables} placeholder="read write" aria-label="Scope" />
            </Field>
            <Field label="">
              {canFetchToken ? (
                <Button variant="secondary" size="sm" onClick={fetchToken} isLoading={isFetchingToken}>
                  {!isFetchingToken && <KeyRound className="h-3.5 w-3.5" />}
                  Get new access token
                </Button>
              ) : (
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Info className="mt-px h-3.5 w-3.5 flex-shrink-0" />
                  Browser redirect flows aren't supported yet. Complete the {oauth2.grantType === 'implicit' ? 'implicit' : 'authorization code'} flow with your provider and paste the access token above.
                </p>
              )}
            </Field>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div className="grid gap-1.5 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center sm:gap-3">
        <label htmlFor={`${id}-type`} className="text-xs font-medium text-muted-foreground">
          Type
        </label>
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Select value={auth.type} onValueChange={handleTypeChange}>
            <SelectTrigger id={`${id}-type`} className="w-full sm:w-64" aria-label="Authorization type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AUTH_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">{typeInfo.description}</span>
        </div>
      </div>

      {auth.type === 'none' ? (
        <EmptyState compact icon={<KeyRound />} title="No authorization" message="Pick a type above to add credentials to this request." className="!h-auto py-8" />
      ) : (
        <div className="space-y-3 border-t border-border pt-4">{renderFields()}</div>
      )}

      {preview && (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 text-xs">
          <span className="text-muted-foreground">{auth.type === 'apiKey' && auth.apiKeyAddTo === 'query' ? 'Adds query param' : 'Adds header'}</span>
          <code className="min-w-0 truncate font-mono text-foreground">{preview}</code>
        </div>
      )}
    </div>
  );
};
