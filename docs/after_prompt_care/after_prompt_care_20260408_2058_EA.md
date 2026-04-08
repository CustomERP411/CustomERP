# Prompt Result
- Updated account delete wiring in frontend auth context:
  - `deleteAccount()` now calls `DELETE /auth/account` instead of `POST /auth/logout`.
  - Local session cleanup still runs after successful backend account soft-delete.

# Validation
- Frontend typecheck: `cmd /c npm run typecheck` passed.
- Frontend build: `cmd /c npm run build` passed.

# Notes
- This aligns EA frontend behavior with ODD backend soft-delete implementation for accounts.
- Project delete flow remains unchanged and already calls project delete endpoint.

# Future Follow-up / Dependencies
- Review + approval UI is already wired to current backend endpoints. If ODD/BTB change response payloads or status transitions later, EA should update frontend mapping in `ProjectDetailPage.tsx` and `projectService.ts`.
- Generated ERP admin pages are currently produced through assembler RBAC templates. If ASA decides to switch generation to reuse EA frontend-brick admin components, a follow-up integration pass will be needed.
- Final UX polish is still dependent on TE end-to-end regression feedback (cross-flow validation after all owners finish).
