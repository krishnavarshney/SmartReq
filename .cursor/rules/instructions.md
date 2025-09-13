## SmartReq – Engineering Guide (Best Practices & Roadmap)

### Principles
- **Safety first**: never log secrets; isolate untrusted code (scripts) from the main UI thread.
- **Consistency**: one way to do things (headers lowercased, single source of UI components, single Vite version).
- **User trust**: clear loading states, progress, and error messages. Don’t fake metrics without labeling them.
- **Performance**: avoid unnecessary allocations and re-renders; measure before optimizing.

---

### Project Conventions
- **TypeScript**: explicit function/prop typing for public APIs; avoid `any`.
- **Headers**: normalize to lowercase on ingestion; access with lowercase keys only.
- **Env vars (Vite)**: use `import.meta.env.VITE_*`. Never read `process.env` in browser code.
- **IDs**: prefer `uuid` for persisted entities; timestamps are fine for ephemeral UI keys.
- **Error handling**:
  - Network: show “Timeout” vs “Network Error” distinctly; surface cause text when available.
  - Bulk runs: per-item status with counts; never block whole queue on one failure.
- **Security**:
  - Test scripts run in a Web Worker sandbox with a timeout. No direct `window` access.
  - Remove sensitive `console.log` calls; guard any optional debug logs with a dev flag.
- **UI**:
  - Skeletons while loading, spinners on buttons during async actions, and toasts for outcomes.
  - Use confirmation modals instead of `window.confirm`.
  - Icon-only buttons must have `aria-label`.
  - Label simulated metrics (e.g., timing) as “Simulated”.

---

### Folder Structure Hygiene
- Keep response-related components under `src/components/response/` only.
- Avoid nested duplicate directories (e.g., `response/response/`). Delete duplicates and fix imports.
- Share generic primitives (like `JsonNode`) under `src/components/ui/` and reuse.

---

### Coding Patterns
- **Interpolation**:
  - Replace `{{var}}` using a precomputed lowercase variable map.
  - Do not log templates/variables. Optionally expose a “preview interpolations” UI for debugging.
- **Request builder**:
  - JSON body: validate before sending; block send and show a toast if invalid.
  - Prefer `TextEncoder().encode(str).length` to compute byte sizes instead of `Blob`.
- **Headers**:
  - Merge order: body headers → auth headers → user headers, last one wins.
  - Never set `Content-Type` for `FormData` (browser sets boundary).

---

### Accessibility & Responsiveness
- All interactive controls have focus rings and `aria-label`s as needed.
- Modals trap focus and restore focus on close; ESC closes.
- Keyboard shortcuts: `Ctrl/Cmd+S` to save, with visual confirmation.
- Responsive splits: default to 50/50 on desktop; stack on mobile.

---

### Testing & QA
- Unit-test utilities (interpolation, formatting, scripting wrapper) with edge cases.
- Snapshot test critical UI (Request/Response panels) in typical and empty states.
- Manual QA checklist: slow network, timeouts, 4xx/5xx, large JSON, HTML preview, CSV export.

---

### Security Notes
- Browser cannot read `Set-Cookie` headers; don’t promise cookie inspection. If needed, route via a proxy that surfaces cookie-like data in a safe custom header.
- Mark any simulated data (e.g., timings) clearly.

---

### Prioritized Roadmap (Enhancements & Fixes)
1) Build/env hygiene
   - Align to a single Vite version; keep in `devDependencies` only.
   - Switch to `import.meta.env.VITE_GEMINI_API_KEY`; add `.env.example`.

2) Observability & safety
   - Remove sensitive logs from interpolation and elsewhere.
   - Normalize response headers (lowercase) and update consumers.

3) UI consolidation
   - Consolidate response components under `src/components/response/`; remove duplicates.
   - Merge duplicate `JsonNode` into a single reusable component.

4) UX polish
   - Replace `window.confirm` with a confirmation modal.
   - Bulk mode: progress bar, counters (success/error), ETA, per-row status badges.
   - Disable buttons with inline spinners during async actions; richer toasts.

5) Robustness
   - Block send on invalid JSON body; toast details.
   - Compute sizes with `TextEncoder`.
   - Label “Simulated timing” or add a toggle in Settings.

6) Security hardening
   - Run test scripts in a Web Worker with a 2s timeout and a minimal `pm` API.

---

### Definition of Done (per change)
- No TypeScript or linter errors.
- Loading/empty/error states handled.
- Accessible and responsive.
- Tests updated/added where applicable.
- Changelog entry (in PR or commit notes).


