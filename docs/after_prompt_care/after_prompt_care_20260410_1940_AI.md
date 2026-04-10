---
title: After Prompt Care - Generate Button + Inventory Question Fix
---

## 1. Prompt Result

- Consolidated generation UI flow to a single primary button in business questions:
  - `platform/frontend/src/components/project/BusinessQuestions.tsx`
- Fixed generation reliability by forcing backend mode to build before analyze call:
  - `platform/frontend/src/pages/ProjectDetailPage.tsx`
- Removed duplicate "generate" wording in clarification panel:
  - `platform/frontend/src/components/project/ClarificationQuestions.tsx`
- Updated inventory batch/lot question from yes/no to choice options:
  - `platform/backend/src/defaultQuestions/packs/inventory.v1.js`
- Activated new inventory questionnaire version so existing/new projects receive updated question template:
  - `platform/backend/src/services/moduleQuestionRegistry.js`
- Updated prefilled SDF mapping logic to treat batch/lot selections as batch tracking enabled:
  - `platform/backend/src/services/prefilledSdfService.js`

## 2. What User Must Add/Prepare

- Restart backend/frontend services after pulling these changes.
- Open project page and refresh to fetch latest question templates.
- For inventory module, re-answer default module questions if prompted (version bump applies).

## 3. Setup Steps

1. Start services:
   - Windows: `.\scripts\dev.ps1 start`
2. Open a project and go to:
   - Step 2: `Answer Questions`
   - Step 3: `Tell Us About Your Business`
3. Confirm there is only one primary generate action in step 3.
4. Click `Generate ERP`.

## 4. Test Checklist

- [ ] Only one primary generate button appears in business-question flow.
- [ ] Clicking `Generate ERP` starts analyze/generation directly (no dead-click behavior).
- [ ] Clarification panel action label shows `Finalize Setup` (not extra generate wording).
- [ ] Inventory question appears as choice (not yes/no):
  - "How do you track traceability for items?"
  - Options include no tracking/batch/lot/both.
- [ ] Selecting batch/lot options results in `features.batch_tracking = true` in generated/prefilled SDF.

## 5. Expected vs Not Expected

**Expected**

- Single clear generation action.
- Generation works even if project was previously in chat mode.
- Inventory batch/lot question is choice-based and semantically correct.

**Not Expected**

- Multiple generate buttons for same action.
- Generate click does nothing.
- Batch/lot question forced into yes/no response.

## 6. Known Risks / Follow-up

- Inventory questionnaire version bump can require users to re-answer inventory defaults on existing projects.
- If stale browser state exists, hard refresh once after deploy.

## 7. Blocked Dependencies

Not required in this prompt.
