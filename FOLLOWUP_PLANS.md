# Follow-up Plans — April 22–23, 2026

This document consolidates the feedback messages into **5 focused plans**.
Each item below the plan heading is a work unit; under each work unit the
original chat message is preserved verbatim as a `Reference` so nothing is
lost in translation.

Legend:
- `Reference` — the exact user message (Turkish/English preserved).
- `Intent` — a one-line summary of what needs to change.
- `Scope` — which part of the system this touches.

---

## Plan 1 — Generated ERP: RBAC, Employees & Admin Safety

All four items are tightly coupled: they all live inside the generated ERP
(`platform/assembler` templates + generated frontend/backend), they all
touch the `users` / `employees` / `roles` entities, and they should ship
together so RBAC and admin protections stay consistent.

### 1.1 Role editor placement / visibility in generated ERP
- **Reference:** `[23:25, 22/04/2026] A. Selim: Preview role edite basılınca yukarıda açılıyor yeterince belli olmuyor`
- **Intent:** When a role is edited in the generated ERP, the editor opens way up top / off-screen and users don't notice it. Replace the inline-at-top pattern with a clearly-visible modal (or at least scroll-into-view + highlighted panel).
- **Scope:** generated-ERP role management page template.

### 1.2 Better RBAC — block unpermitted users at the route level
- **Reference:** `[00:13, 23/04/2026] A. Selim: users that is not permitted access can still access it through dashboard etc we need a much better rbac`
- **Intent:** Users without a permission can still navigate to forbidden pages via direct URL / dashboard links. Add a real route-level permission guard + hide nav entries the user can't use + server-side authorization on every endpoint.
- **Scope:** generated-ERP frontend router, sidebar/nav, and backend middleware.

### 1.3 Superadmin self-lockout protection
- **Reference:** `[00:19, 23/04/2026] A. Selim: superadmin can remove their permission which makes the erp unusuable superadmin should not have role change allowed same with active option`
- **Intent:** A superadmin can currently demote themselves or deactivate their own account, leaving the ERP unusable. Disable (UI) + reject (API) both the role-change and the `active` toggle when acting on self, and refuse to demote the last remaining superadmin.
- **Scope:** generated-ERP user admin page + user-update endpoint.

### 1.4 Employee creation → optional user account
- **Reference:** `[00:13, 23/04/2026] A. Selim: employees creation should come with an option to add that employee as a user upon selecting new fields should open related to password role etc`
- **Intent:** In HR, creating an employee should have an "Also create a login for this employee" checkbox; ticking it reveals password + role + active fields, and on submit a linked `user` record is created.
- **Scope:** generated-ERP HR create/edit form + HR backend service. Cross-cuts with 1.2/1.3 because the user created here must respect RBAC rules.

---

## Plan 2 — Generated ERP: Inventory Semantics & Module Distributor Discipline

These two are about what the AI/generator *produces*, not UI. Grouped
together because both require changes in the ai-gateway distributor /
SDF prompts and the assembler templates.

### 2.1 Inventory: calculated vs hand-entered stock fields
- **Reference:** `[00:10, 23/04/2026] A. Selim: stock availability does not make sense everything being hand entered some things should be calculated for example what is available if it can be hand entered I understand on hand stock reserved committed available what is reserved committed difference what is aavailable if it is not calculated`
- **Intent:** The generated inventory module currently exposes `reserved`, `committed`, `available` as manual inputs. They should be derived:
  - `on_hand` — manual / adjusted via stock movements (the only input).
  - `reserved` — sum of open sales/transfer reservations (computed).
  - `committed` — sum of approved but not yet shipped order lines (computed).
  - `available = on_hand − reserved − committed` (computed, read-only).
- Also document the `reserved` vs `committed` distinction inside the generated ERP (tooltip / help panel).
- **Scope:** assembler inventory templates + SDF field annotations (`computed: true`) + the ai-gateway prompt so the LLM stops emitting them as manual fields.

### 2.2 Module distributor must respect user-selected modules
- **Reference:** `[00:39, 23/04/2026] A. Selim: because in business description we ask users how many people will be working the system and users answer because of this information even if hr module is not selected distributor generates hr module which we do not want so we do not want modules generated if user did not select it add this rule`
- **Intent:** The ai-gateway distributor silently adds modules (e.g. HR) when the business description hints at them, even if the user explicitly didn't select HR. Make the selected-modules list authoritative — the distributor may only generate entities inside the selected set; any inferred extras must be dropped (or surfaced as a "consider adding module X" suggestion, never auto-added).
- **Scope:** `platform/ai-gateway` distributor + prompts, plus a post-processing pass in the backend that strips non-allowed modules before persisting the SDF.

---

## Plan 3 — Preview Experience & Linux Packaging

Grouped because both are about how the generated ERP is *delivered* to the
user — one through the live preview iframe, the other through the
downloadable standalone bundle.

### 3.1 Stop preview iframe from autofilling platform credentials
- **Reference:** `[00:18, 23/04/2026] A. Selim: on preview page whatevers users mail and password was and they saved it to google password it comes to preview auto filled`
- **Intent:** Chrome/Google Password autofills the platform login credentials into the preview ERP's login form because the iframe is same-origin under `/preview/:id/`. Stop this by e.g. using `autocomplete="new-password"` / `autocomplete="off"` + a distinct `<form>` name on the generated login, and/or namespacing the iframe origin.
- **Scope:** assembler login-page template + (optionally) preview proxy to send `Cross-Origin-Opener-Policy` / `Cross-Origin-Resource-Policy` headers.

### 3.2 Linux download: broad distro support + clear unsupported list
- **Reference:** `[00:25, 23/04/2026] A. Selim: linux downloaded should be worked for both ubuntu and arch etc make it most compatible with most linux distrubitons and tell the user whatever distributions it wont work on`
- **Intent:** The Linux standalone bundle should run on common distros (Ubuntu, Debian, Fedora, Arch, openSUSE). Prefer distro-agnostic packaging (e.g. an AppImage, a self-contained tarball, or a Docker-optional runner). In the download modal / post-download instructions, explicitly list any distros we don't support (e.g. Alpine/musl, NixOS without extra steps).
- **Scope:** `platform/assembler` standalone packaging + `PostDownloadInstructions.tsx` i18n + Linux start script.

---

## Plan 4 — Platform Language UX Cleanup

Three related asks about where and how language is surfaced in the
platform UI after the multi-language rollout.

### 4.1 Landing page language selector — redesign
- **Reference:** `[23:53, 22/04/2026] A. Selim: main page language selector ui terrible`
- **Intent:** Replace the current landing-page language selector with a cleaner design (flag + name dropdown in the top-right nav, matching the rest of the landing page styling).
- **Scope:** `platform/frontend/src/pages/LandingPage.tsx` + `components/common/LanguageSelector.tsx`.

### 4.2 Localize the project language badge
- **Reference:** `[00:32, 23/04/2026] A. Selim: projects have language indicator which is nice but its ui should show for example if user setting language is english than it should write Turkish and English if user language is Türkçe then it should write on project language İngilizce or Türkçe okey I like that language selector states enlish and türkçe each language its own languaged thing but on ui it should not be like that`
- **Intent:** Keep the language *selector* rendering each option in its own native language (English / Türkçe). But the per-project language *badge* (shown on project cards, project header, etc.) must render in the *user's* platform language, so an English user sees "English / Turkish" and a Turkish user sees "İngilizce / Türkçe".
- **Scope:** `ProjectCard.tsx`, project header, anywhere a `project.language` is displayed. Add `projects:language.en` / `projects:language.tr` translation keys and use them instead of a raw code/native string.

### 4.3 Remove the in-platform language selector (after login)
- **Reference:** `[00:34, 23/04/2026] A. Selim: remove language selector inside the platform (I mean after login) because we do not want user to change language during project erp creation since it would be confusing for users it should be required to change language through settings`
- **Intent:** Drop the language dropdown from the Header / Sidebar for logged-in users. Language changes must go through **Settings → Language** only. Keep it on the public landing/login/register pages.
- **Scope:** `components/layout/Header.tsx` and/or `Sidebar.tsx` — remove the selector; keep `SettingsPage.tsx` + `LanguageSelector.tsx` as the only switching surface.

---

## Plan 5 — Platform Responsiveness & Targeted Fixes

Grouped as a "cleanup wave": the big responsive rebuild + two small bugs
that block specific flows.

### 5.1 Remove MobileGate, make the whole platform responsive
- **Reference:** `[00:21, 23/04/2026] A. Selim: you know what remove mobile restriction all together but make the ui usable make sure that everything is compatible with small screen and mobile ui etc`
- **Intent:** Delete the `MobileGate` component. Audit every page (landing, login, register, project list, project detail + every step/panel, preview, settings, admin pages, my-requests) and make them work on ≤640px. Use a responsive sidebar (drawer on mobile), stack form panels, shrink tables into cards, etc.
- **Scope:** `platform/frontend/src/components/MobileGate.tsx` (remove), `DashboardLayout`, `Sidebar`, `Header`, + a sweep across all pages/components.
- **Note:** This is the largest single work item; may warrant its own sub-plan when implemented.

### 5.2 "Need help" button on default module questions
- **Reference:** `[00:29, 23/04/2026] A. Selim: for default questions add a need help button that asks about the question and opens chatbot`
- **Intent:** Next to each default module question, show a small "Need help?" button. Clicking it opens the existing chatbot/`ChatWidget` pre-seeded with a message like *"Can you help me answer this question: \<question prompt\>"*, so the LLM can explain the question and suggest an answer.
- **Scope:** `components/project/DefaultQuestions.tsx` + `ChatContext` / `ChatWidget` (new entry point that accepts a seeded prompt).

### 5.3 Fix admin → user messaging in feature-request conversations
- **Reference:** `[00:37, 23/04/2026] A. Selim: Feature conversation through admin writing a message to user gives error`
- **Intent:** On `FeatureRequestsAdminPage`, admin replies are failing (error on send). Reproduce, fix the controller/service path, confirm the round-trip lands in the user's `MyRequestsPage` conversation thread.
- **Scope:** `platform/backend` feature-request messaging controller + `FeatureRequestsAdminPage.tsx` send handler.

---

## Suggested rollout order

1. **Plan 5.3** (admin messaging bug) + **Plan 4** (language UX) — quickest wins, low blast radius.
2. **Plan 3** (preview autofill + Linux packaging) — small surface, directly user-visible.
3. **Plan 2** (inventory semantics + module distributor rule) — improves quality of every newly-generated ERP.
4. **Plan 1** (RBAC + employees + admin safety) — largest generated-ERP change, lands together to keep invariants consistent.
5. **Plan 5.1** (responsive) — do last, in its own focused sprint, since it touches almost every page.
6. **Plan 5.2** (default-question help button) — sprinkle in whenever convenient.

## Nothing in this doc is implemented yet

This is a scoping document only. Treat each plan heading above as the
starting point for a proper plan file (with mermaid diagrams, todos,
etc.) when you pick it up.
