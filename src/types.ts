export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

export interface KeyValueItem {
  id: number;
  key: string;
  value: string;
  enabled: boolean;
  encode?: boolean;
}

export type AuthType = 'none' | 'bearer' | 'basic' | 'apiKey' | 'jwt' | 'oauth2';
export type BodyType = 'none' | 'json' | 'form-data' | 'x-www-form-urlencoded' | 'graphql' | 'raw';
export type GrantType = 'authorization_code' | 'password_credentials' | 'client_credentials' | 'implicit';


export interface AuthDetails {
  type: AuthType;
  // Bearer & JWT
  token?: string;
  // Basic
  basicUser?: string;
  basicPass?: string;
  // API Key
  apiKeyKey?: string;
  apiKeyValue?: string;
  apiKeyAddTo?: 'header' | 'query';
  // OAuth 2.0
  oauth2?: {
      grantType: GrantType;
      accessToken?: string;
      accessTokenUrl?: string;
      clientId?: string;
      clientSecret?: string;
      scope?: string;
      username?: string;
      password?: string;
      callbackUrl?: string;
      authUrl?: string;
  }
}

export interface BodyDetails {
  type: BodyType;
  jsonBody?: string;
  formData?: KeyValueItem[];
  urlEncoded?: KeyValueItem[];
  // GraphQL
  graphqlQuery?: string;
  graphqlVariables?: string; // JSON string
  // Raw text (XML, plain text, HTML...)
  rawBody?: string;
  rawContentType?: string;
}

export interface RequestSettings {
    sslVerification: boolean;
    followRedirects: boolean;
    /** Request timeout in milliseconds. 0 disables the timeout; undefined uses the default (30s). */
    timeoutMs?: number;
}

export interface DependencyRule {
  key: string;
  template: string;
}

export interface ApiRequest {
  method: HttpMethod;
  url: string;
  queryParams: KeyValueItem[];
  headers: KeyValueItem[];
  auth: AuthDetails;
  body: BodyDetails;
  settings: RequestSettings;
  preRequestScript?: string;
  testScript?: string;
  bodyBuilderVariables?: Record<string, string[]>;
  dependencyRules?: DependencyRule[];
  /** Values for `:name` path segments in the URL. */
  pathVariables?: KeyValueItem[];
}

export interface FinalApiRequest {
    method: HttpMethod;
    url: string;
    headers: KeyValueItem[];
    body: string | FormData | undefined;
    bodyStructure?: KeyValueItem[];
    size?: {
        headers: number;
        body: number;
        total: number;
    };
    settings: RequestSettings;
    /** Set when the pre-request script threw; the request is not sent. */
    preRequestError?: string;
}

export interface TestResult {
    name: string;
    passed: boolean;
    error?: string;
}

export interface ResponseCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

export interface ApiResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: any;
  duration: number;
  size?: {
      headers: number;
      body: number;
      total: number;
  };
  timing?: Record<string, number>;
  testResults?: TestResult[];
  cookies?: ResponseCookie[];
}

interface BaseLog {
  id: number;
  timestamp: string;
}

export interface SingleRequestLog extends BaseLog {
  mode: 'single';
  requestId?: string; // Link to a saved request in a collection
  originalRequest: ApiRequest;
  request: FinalApiRequest;
  response: ApiResponse;
}

export interface BulkRunLog extends BaseLog {
    mode: 'bulk';
    requestTemplate: ApiRequest;
    data: Record<string, string>[];
    settings: BulkSettings;
    results: BulkResult[];
}

export type LogEntry = SingleRequestLog | BulkRunLog;


export interface BulkProgress {
  total: number;
  completed: number;
  success: number;
  errors: number;
  rps?: number; // Requests per second
}

export type BulkRunState = 'idle' | 'running' | 'paused' | 'finished' | 'stopped';

export interface BulkResult {
  id: number;
  data: Record<string, string>;
  request: FinalApiRequest;
  response: ApiResponse;
  status: 'pending' | 'running' | 'success' | 'error' | 'cancelled';
}

export interface BulkSettings {
    concurrency: number;
    delay: number; // in ms
}

export interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
  closing?: boolean;
  duration?: number; // Optional: duration in milliseconds before auto-dismissal
  dismissible?: boolean; // Optional: if true, a close button will be shown
}

// Flow Types
export interface VariableExtraction {
  id: string;
  name: string; // User-defined variable name (e.g., 'authToken')
  source: 'BODY_JSON' | 'HEADER';
  path: string; // JSONPath-like string (e.g., 'data.token') or header name
}

export interface FlowNode {
  id: string;
  requestId: string; // ID of the request in a collection ('' for a step with its own inline request)
  name: string; // name of the request, copied for convenience
  extractions: VariableExtraction[];
  /** Inline request owned by this step. Used when the step is not linked to a saved request. */
  request?: ApiRequest;
}

export interface Flow {
  id: string;
  name: string;
  nodes: FlowNode[];
  /** Stop the run at the first failing step (default true). */
  stopOnFailure?: boolean;
}

export interface FlowRunResult {
    nodeId: string;
    request: FinalApiRequest;
    response: ApiResponse;
    extractedVariables: Record<string, string>;
    timestamp: number; // Execution start time
}


// Discovery Types
export interface DiscoveredEndpoint {
    id: string;
    method: HttpMethod;
    url: string;
    status: 'discovered' | 'tested' | 'error';
    response?: ApiResponse;
}

export interface DiscoverySession {
    id: string;
    baseUrl: string;
    status: 'idle' | 'running' | 'finished' | 'error';
    endpoints: DiscoveredEndpoint[];
    log: string[];
    generatedSpec?: string;
}

// New Types for Collections & Workspaces

export interface RequestItem {
  id: string;
  type: 'request';
  name: string;
  request: ApiRequest;
  responses: SingleRequestLog[];
}

export interface Folder {
  id: string;
  type: 'folder';
  name: string;
  children: RequestNode[];
}

export type RequestNode = RequestItem | Folder;

export interface Collection {
  id: string;
  type: 'collection';
  name: string;
  children: RequestNode[];
}

export interface Environment {
  id: string;
  name: string;
  variables: KeyValueItem[];
}

export interface Workspace {
  id: string;
  name: string;
  collections: Collection[];
  globals: KeyValueItem[];
  environments: Environment[];
  activeEnvironmentId: string | null;
  flows: Flow[];
}

export interface Tab {
  id: string;
  name: string;
  request: ApiRequest;
  isDirty: boolean; // Has unsaved changes
  originalRequestId?: string; // if opened from a collection
  latestResponse?: ApiResponse;
  isRenaming?: boolean;
}
