# Prompt Result
- Added explicit UI mode flow in `platform/frontend/src/pages/ProjectDetailPage.tsx` and `platform/frontend/src/components/project/BusinessQuestions.tsx`.
- Users now start in `Chat Mode` and must confirm `Switch to Build Mode` before generation is enabled.
- Added a confirmation modal for mode switch and a way to return from build mode back to chat mode.
- Code/Logic: generation trigger is now gated by UI mode.
- Visuals/UI: mode badge, mode helper text, and confirmation dialog were added.
- Data/Config: per-project mode is persisted in browser local storage key `project_mode:<projectId>`.
- Tests: frontend static checks/build were executed (see checklist).

# What User Must Add/Prepare
- Code/Logic: Not required in this prompt.
- Visuals/UI: Review copy text for your preferred wording if product/UX wants different labels.
- Data/Config: Not required in this prompt.
- Tests: Manual QA run in browser is still required.

# Setup Steps
1. Open platform frontend: `cd platform/frontend`.
2. Install dependencies if needed: `npm install`.
3. Start dev server: `npm run dev`.
4. Open project detail page (`/projects/:id`), complete required module/business inputs.
5. Verify the action is `Switch to Build Mode`, not direct generation.
6. Click switch action and confirm in modal.
7. Verify button changes to `Generate My ERP Setup`.

# Test Checklist
- Code/Logic:
  - Confirm generation cannot be started while mode is `chat`.
  - Confirm generation starts only after `Confirm & Switch to Build`.
- Visuals/UI:
  - Confirm mode badge displays `Chat Mode` initially.
  - Confirm mode badge switches to `Build Mode` after confirmation.
  - Confirm `Back to Chat Mode` is visible in build mode.
  - Confirm modal dismisses correctly with `Stay in Chat Mode`.
- Data/Config:
  - Refresh the page and verify mode persists for the same project.
  - Open another project and verify mode is independent per project id.
- Tests:
  - `npm run typecheck` passes.
  - `npm run build` passes.

# Expected vs Not Expected
- Expected:
  - User must perform explicit confirmation before generation flow.
  - User can switch back to chat mode before generating if edits are needed.
- Not Expected:
  - Direct generation from chat mode without confirmation.
  - Shared mode state across all projects.

# Known Risks / Follow-up
- Local storage is client-side only; backend session mode persistence is not part of this change.
- If backend introduces authoritative mode state later, frontend should sync to backend and resolve conflicts.
- Optional follow-up: auto-reset mode back to `chat` when key answers/modules change after build mode is enabled.

# Blocked Dependencies
- None for this prompt.
