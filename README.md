# SmartReq

A browser-based API client for debugging single requests, running a request template against a dataset, chaining requests into flows, and discovering endpoints.

Everything runs in the browser. Workspaces, history and settings are stored in `localStorage`; nothing is sent anywhere except the APIs you call (and Google's Gemini API, only if you add a key for the AI features).

## Modes

### Request
- Method, URL and Send in one bar. `{{variables}}` are highlighted by source (environment, data row, built-in) with their resolved value on hover; type `{{` for suggestions. Paste a `curl` command into the URL field to import it.
- Params (kept in sync with the URL), path variables (`:id`), auth (Bearer, Basic, API key, JWT, OAuth 2.0 client-credentials/password), headers (with the auto-generated ones listed), body (JSON, form-data, urlencoded, raw text/XML/HTML/CSV, GraphQL), pre-request scripts, tests, per-request timeout and redirect settings.
- Response viewer: status/time/size with breakdowns, pretty/raw/table views with search (`Ctrl/Cmd+F`), headers, tests, real resource timing (when the server sends `Timing-Allow-Origin`), charts, compare with earlier responses, export to CSV/XLS.
- Cancel an in-flight request; network, CORS, timeout and script errors are reported with likely causes.

### Bulk
- Load data by upload (CSV/JSON), paste, or editing the grid directly. Every `{{column}}` the template uses is checked against your columns and globals before the run.
- Run with 1–50 concurrent requests and an optional delay. Pause, resume, stop (in-flight requests are aborted), and retry only failed rows.
- Live progress with rate and ETA, a filterable results grid, per-row request/response detail, a summary with p50/p95 latency and status distribution, and a flattened CSV export.

### Flow
- Chain saved or flow-only requests and run them in order.
- Pass data between steps with extraction rules (`{{token}}` from a body path or header) or direct references such as `{{steps.1.body.id}}`.
- Per-step status, timing, request, response and tests; optional stop on failure; sequence diagram view.

### Discovery
- Give it a base URL and it crawls same-host GET endpoints (up to 40 requests), using Gemini to suggest further paths from each response, then drafts an OpenAPI spec. Results can be opened in the Request tab or saved as a collection. Requires a Gemini API key (Settings → AI).

## Workspace
- Collections and folders with drag and drop, inline rename, duplicate and keyboard navigation.
- Environments plus globals; secret-looking values are masked.
- History grouped by day; clicking an entry restores the request or bulk run.
- Import OpenAPI 3 / Swagger (JSON or YAML), Postman collections (v2.0/v2.1) and cURL. Export/import the whole workspace as JSON from Settings.
- Command palette (`Ctrl/Cmd+K`), light/dark/system themes, mobile layout.

| Shortcut | Action |
| --- | --- |
| `Ctrl/Cmd+K` | Command palette |
| `Ctrl/Cmd+Enter` | Send request |
| `Ctrl/Cmd+S` | Save request |
| `Ctrl/Cmd+B` | Toggle sidebar |

## Browser limits
SmartReq makes requests with `fetch` from the page, so the browser's rules apply:
- The API must allow your origin via CORS.
- `Set-Cookie` and some headers are hidden from JavaScript; certain request headers (e.g. `Host`, `Cookie`) can't be set.
- TLS verification can't be turned off.
- Detailed timing is only available when the server sends `Timing-Allow-Origin`.

## Development

```bash
npm ci
npm run dev        # http://localhost:5173
npm run typecheck
npm test
npm run build      # production bundle in dist/
```

Stack: React 19, TypeScript (strict), Vite 7, Tailwind CSS 3, Vitest. Fonts (Inter, JetBrains Mono) are self-hosted.

## License

MIT
