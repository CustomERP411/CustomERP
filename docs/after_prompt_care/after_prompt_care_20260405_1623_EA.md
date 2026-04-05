# Prompt Result
- Added generated ERP runtime start/health tracking UI inside the Download & Run area in `platform/frontend/src/components/project/SdfPreviewSection.tsx`.
- New UI supports:
  - Health URL input (default: `http://localhost:3000/health`)
  - Manual health checks
  - Auto polling every 7 seconds
  - Runtime badge states (`Not Started`, `Starting`, `Checking`, `Running`, `Unreachable`, `Unhealthy`)
  - Last checked timestamp + status message panel
- Code/Logic: Health check calls browser `fetch` to target URL and evaluates HTTP status + `{ status: "ok" }` payload.
- Visuals/UI: Added a dedicated "ERP Runtime Status" card under post-download instructions.
- Data/Config: No backend schema or env changes.
- Tests: Frontend typecheck/build completed.

# What User Must Add/Prepare
- Code/Logic: Not required in this prompt.
- Visuals/UI: Optional copy edits if product wants different wording.
- Data/Config: If ERP is started on a non-default port, set the health URL in the new input accordingly.
- Tests: Manual runtime verification is required after launching the generated ERP.

# Setup Steps
1. Open a project and generate/download a standalone ERP package.
2. Start the generated ERP using the provided start script (`start.bat`, `start.sh`, or `start.command`).
3. In platform UI, go to the "ERP Runtime Status" card.
4. Confirm health URL points to your running ERP health endpoint.
5. Click `Check Health` or enable `Auto-check every 7 seconds`.

# Test Checklist
- Code/Logic:
  - `Check Health` triggers a network request and updates state.
  - Healthy endpoint returns `Running`.
  - Non-200 response returns `Unhealthy`.
  - Timeout/network failure returns `Unreachable`.
- Visuals/UI:
  - Runtime badge changes color/text per state.
  - Last checked time appears after a check.
  - Status message updates with actionable text.
- Data/Config:
  - Changing health URL updates target for subsequent checks.
  - No DB/API contracts changed in platform backend.
- Tests:
  - `npm run typecheck` passes.
  - `npm run build` passes.

# Expected vs Not Expected
- Expected:
  - UI indicates whether generated ERP is running and healthy based on health endpoint response.
  - Auto tracking continues until user disables it.
- Not Expected:
  - Server-side health aggregation in platform backend.
  - Guaranteed cross-network checks when browser private-network policies block access (example: remote platform origin checking `localhost`).

# Known Risks / Follow-up
- Browser security rules (CORS/PNA) may block checks from remote platform origins to local `localhost` ERP targets.
- If needed later, backend-owned proxy endpoints can be added by ODD to make checks network-space independent.

# Blocked Dependencies
- None for this prompt.
