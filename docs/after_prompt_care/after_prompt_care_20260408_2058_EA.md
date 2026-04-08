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
