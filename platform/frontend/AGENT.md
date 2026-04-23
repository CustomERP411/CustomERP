# Frontend AGENT.md

> Agent-facing reference for the **CustomERP platform frontend** (`platform/frontend`).
> Skim this before editing files in this directory. It captures the architecture,
> conventions, integration points, and gotchas a coding agent needs in order to
> make safe, idiomatic changes.

---

## 1. What this app is

The frontend is a **React 18 + TypeScript + Vite + Tailwind** SPA that drives the
CustomERP platform. End users:

1. Sign up / log in.
2. Create a project, pick ERP modules (inventory / invoice / hr).
3. Answer default + business questions, then describe their business in natural
   language.
4. The backend + AI gateway turn this into an **SDF** (System Definition File);
   the user reviews / edits / approves it.
5. The platform assembles a runnable ERP from the SDF — the user can launch a
   live **preview** in an iframe and download a generated ZIP.
6. Admins manage users, review **training sessions**, and triage **feature
   requests**.

The frontend talks to **`platform/backend`** over JSON HTTP (axios). The
backend in turn calls **`platform/ai-gateway`** and the **assembler**. The
frontend never calls the AI gateway directly.

---

## 2. Tech stack & versions

| Concern              | Choice                                       |
| -------------------- | -------------------------------------------- |
| Framework            | React 18 (StrictMode) + TypeScript ~5.6      |
| Bundler / dev server | Vite 6                                       |
| Routing              | `react-router-dom` v6                        |
| HTTP                 | `axios`                                      |
| Styling              | Tailwind 3 (`darkMode: 'class'`) + CSS vars  |
| i18n                 | `i18next` + `react-i18next` + browser lang detector |
| State                | React Context only — **no Redux / Zustand**  |
| Icons                | Inline SVG (preferred). `lucide-react` is used in one place but is **not** in `package.json` (see §10) |
| Lint                 | ESLint via `npm run lint` (config not committed; respect `noUnusedLocals`) |
| Container            | Multi-stage Docker → nginx (see `Dockerfile`) |

`package.json` scripts:

- `npm run dev` — Vite dev server on `0.0.0.0:5173`
- `npm run build` — `tsc -b && vite build`
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — ESLint, `--max-warnings 0`
- `npm run preview` — Vite preview server

Path alias: `@/*` → `src/*` (configured in both `tsconfig.json` and
`vite.config.ts`). Prefer relative imports for sibling files; use `@/` for
deeper cross-tree imports.

---

## 3. Directory map

```
platform/frontend/
├── Dockerfile              # prod build → nginx
├── Dockerfile.dev          # dev image
├── nginx.conf              # SPA fallback for prod
├── index.html              # Vite entry HTML
├── vite.config.ts          # alias @, dev proxy /preview → backend:3000
├── tailwind.config.js      # exposes app-bg / app-surface / app-accent-* tokens
├── tsconfig.json           # strict, noUnusedLocals/Parameters
├── public/
│   ├── brand/              # logo.png, favicon.png (referenced by BrandMark)
│   └── github-*.svg        # landing page assets
└── src/
    ├── main.tsx            # ReactDOM root + BrowserRouter + i18n side-effect
    ├── App.tsx             # ThemeProvider → AuthProvider → <Routes>
    ├── index.css           # Tailwind directives + CSS vars (light/dark)
    ├── vite-env.d.ts
    ├── context/            # AuthContext, ThemeContext, ChatContext
    ├── hooks/              # usePreviewHeartbeat (more to come)
    ├── services/           # axios client + per-domain API wrappers
    ├── types/              # Shared TS types (auth, project, aiGateway, …)
    ├── i18n/               # i18next bootstrap + en/tr JSON namespaces
    ├── components/
    │   ├── ProtectedRoute.tsx   # auth gate
    │   ├── PublicOnlyRoute.tsx  # inverse auth gate
    │   ├── ui/                  # Button, Input — generic primitives
    │   ├── layout/              # DashboardLayout, Sidebar, Header, MobileTopbar
    │   ├── common/              # ThemeToggle, LanguageSelector
    │   ├── brand/               # BrandMark
    │   ├── chat/                # ChatWidget (project-aware assistant)
    │   ├── projects/            # list-page widgets (NewProjectModal, ProjectCard)
    │   ├── project/             # detail-page widgets + buildPreview helpers
    │   └── training/            # ExportModal for admin training UI
    └── pages/              # Route-level components (one per route)
```

`src/components/.gitkeep` and `src/pages/.gitkeep` are intentional. Don't delete them.

---

## 4. Routing (`src/App.tsx`)

```
/                               LandingPage          (public)
/login                          LoginPage            (PublicOnlyRoute)
/register                       RegisterPage         (PublicOnlyRoute)
                                ── DashboardLayout (ProtectedRoute) ──
/projects                       ProjectListPage
/projects/:id                   ProjectDetailPage
/projects/:id/preview           PreviewPage
/settings                       SettingsPage
/my/requests                    MyRequestsPage
/admin                          AdminPage            (admin-only nav, server enforces)
/admin/training                 TrainingDataPage     (admin-only)
/admin/feature-requests         FeatureRequestsAdminPage (admin-only)
*                               redirect to /
```

Route guards:

- **`ProtectedRoute`** — redirects to `/login` (with `state.from`) if no user.
  Renders a spinner while `AuthContext.loading` is true.
- **`PublicOnlyRoute`** — redirects authenticated users to `state.from` or
  `/projects`. Renders `null` while loading (intentional — avoids flicker).
- Admin pages are gated only in the **sidebar** (`user?.is_admin`). Authorization
  is enforced server-side; never rely on this for security.

When adding a new authenticated page:

1. Create `src/pages/<Name>Page.tsx`.
2. Add an i18n namespace in `src/i18n/locales/{en,tr}/<name>.json`, register it
   in `src/i18n/index.ts` (resources + `ns` array).
3. Add the `<Route>` inside the `DashboardLayout` block in `App.tsx`.
4. Add a sidebar entry in `src/components/layout/Sidebar.tsx` (`navItems`) — and
   conditionally inside `if (user?.is_admin) { navItems.push(...) }` for admin.

---

## 5. Application shell

`DashboardLayout` (`src/components/layout/DashboardLayout.tsx`) wraps all
authenticated pages and provides:

- `Sidebar` (desktop rail, collapsible; mobile drawer).
- `MobileTopbar` (only visible `<md`).
- `<Outlet />` for the routed page.
- `ChatProvider` + the floating `ChatWidget` — every authenticated page can use
  `useChatContext()`.

Sidebar specifics:

- Persists collapsed state in `localStorage` under `sidebar_collapsed`
  (`'1'` / `'0'`).
- Listens for global `sidebar-collapse` / `sidebar-expand` window events —
  pages (notably the SDF preview) dispatch these to auto-collapse during
  long-running flows. Re-use the same event names rather than inventing new
  ones.

`Header` exists but is **not** mounted by `DashboardLayout` today (the rail
hosts the user/avatar). Treat it as a reusable component that is currently
unused; do not add it to the layout without a discussion.

---

## 6. Authentication

Single source of truth: `src/context/AuthContext.tsx`.

- `useAuth()` exposes `{ user, loading, isAuthenticated, login, register, logout, deleteAccount, updateUser }`.
- Tokens and the user object live in `localStorage` under keys **`token`** and
  **`user`**. `AuthProvider` rehydrates from localStorage on mount.
- After login/register, the user's `preferred_language` is applied via
  `setAppLanguage(normalizeLanguage(...))`.

API integration — the axios instance in `src/services/api.ts`:

- Base URL: `import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'`.
- Request interceptor injects `Authorization: Bearer <token>` from
  `localStorage`.
- Response interceptor handles two failure modes:
  - **403 + `code === 'ACCOUNT_BLOCKED'`** → wipe session, hard-redirect to
    `/login`.
  - **401** (except on `/auth/login`) → wipe session, hard-redirect to
    `/login`.

When you add a new authenticated request, just `import api from '../services/api'`
and call it — auth and the 401/403 handling are automatic.

---

## 7. Data services

All HTTP lives in `src/services/`:

| File                       | Responsibility                                                        |
| -------------------------- | --------------------------------------------------------------------- |
| `api.ts`                   | Axios singleton + auth/error interceptors.                            |
| `projectService.ts`        | Project CRUD, analyze/clarify/regen, SDF save / AI-edit, generate ZIP, preview lifecycle, review approval, conversations, project chat. |
| `adminService.ts`          | Admin user/project listing + block / unblock / set-admin.             |
| `trainingService.ts`       | Admin training-session inspection, per-step review, Azure export.     |
| `featureRequestService.ts` | User & admin views of feature requests + per-request message threads. |

Conventions for new service code:

- Each file exports a single object (e.g. `projectService`) of named async
  methods. Don't introduce ad-hoc `axios.get()` calls in components.
- Prefer co-locating request/response **interfaces** in the same file; pull
  them into `src/types/` only if shared across services or contexts.
- Use the optional config (3rd axios arg) for things like
  `responseType: 'blob'` (ZIP downloads) or extended `timeout` for long AI
  calls — see `analyzeProject` (`timeout: 300000`) and
  `generateStandaloneErpZip` (5-minute timeout).

---

## 8. State management

There is **no global store**. State is split across three React Contexts plus
component-local `useState`:

- **`AuthContext`** — auth + current user.
- **`ThemeContext`** (`src/context/ThemeContext.tsx`) — `'light' | 'dark'`,
  persisted in `localStorage.theme`, applied as the `dark` class on
  `document.documentElement`. Initial value falls back to
  `prefers-color-scheme`. Components should style via the semantic `app-*`
  Tailwind classes (which already swap under `.dark`) rather than adding
  `dark:` modifiers or reading the context directly. See §10 for details.
- **`ChatContext`** (`src/context/ChatContext.tsx`) — provided by
  `DashboardLayout`. Manages an open/closed flag, a per-project chat history
  persisted under `chat_history:<projectId>` (capped at 50 messages),
  `projectContext` metadata, and a `pulsing` flag for the floating widget.
  - `setProjectContext(...)` is how a project page tells the chatbot which
    project it is currently working with — pages must call it on mount and
    null it on unmount.
  - `sendMessage` calls `projectService.chatWithProject` and appends both the
    user and assistant messages.

Local storage keys in use (avoid clashes when adding new ones):

- `token`, `user` — auth
- `theme` — current theme
- `customerp_language` — i18n persisted language (see `LANGUAGE_STORAGE_KEY`)
- `sidebar_collapsed` — sidebar rail state
- `chat_history:<projectId>` — chat history per project

---

## 9. Internationalisation

Bootstrapped from `src/i18n/index.ts` (imported for side-effects in
`main.tsx`). Languages: **`en`**, **`tr`** (`SUPPORTED_LANGUAGES`).

Namespaces (must stay in sync between `en` and `tr` and registered in
`index.ts`):

```
common, landing, auth, sidebar, projects, projectDetail, sdf,
chatbot, settings, admin, errors, myRequests, previewPage
```

Conventions:

- Use `useTranslation('<namespace>')` and key your strings under the namespace.
- `defaultNS` is `common` — use it for app-wide strings (Save / Cancel / etc).
- Persist user choice with `setAppLanguage(lang)` (writes to
  `localStorage.customerp_language` and updates `document.documentElement.lang`).
- Detection order: `localStorage` → `navigator` → `htmlTag`.
- `load: 'languageOnly'` — `tr-TR` collapses to `tr`. Use
  `normalizeLanguage()` whenever you accept a raw locale string from the
  backend or a form.

When adding a string:

1. Add the key to **both** `locales/en/<ns>.json` and `locales/tr/<ns>.json`.
   Missing translations fall back to `en` but introduce mixed-language UIs.
2. If you create a new namespace, register it in `resources` **and** in the
   `ns` array in `i18n/index.ts`.
3. Module identifiers (`inventory`, `invoice`, `hr`) and SDF status enums
   (`Draft`, `Generated`, …) are **slugs**, not translatable text — never
   localise them. Use `useModuleMeta()` (in
   `components/project/projectConstants.tsx`) to render localised module
   labels while passing the English slug to the backend.

---

## 10. Styling

The whole app is themed from a **single file** — `src/index.css` — via a
catalogue of semantic CSS variables. `tailwind.config.js` re-exports them as
`app-*` utility classes. Full reference lives in
[`platform/theme-refinement-plan.md`](../theme-refinement-plan.md).

### Rules

- Tailwind runs in `darkMode: 'class'`. Toggling `ThemeContext` adds the
  `dark` class to `<html>`.
- **Always** colour with semantic `app-*` classes
  (`bg-app-surface`, `text-app-text`, `border-app-border`,
  `bg-app-success-soft`, `text-app-mod-invoice`, …). Never hardcode raw
  Tailwind palette colours (`bg-slate-*`, `text-gray-*`, `bg-white`, …) and
  never hex values in components.
- **Never** add `dark:*` modifiers for theme tokens — the underlying CSS
  variable already swaps under `.dark`. (`dark:bg-slate-800` etc. is a code
  smell; remove it.)
- Body font colour is set in the base layer (`@layer base body`); pages
  should not redeclare backgrounds unless they need a card / surface look.

### Token groups (see `index.css` for full list + values)

- **Surfaces:** `app-bg`, `app-surface`, `app-surface-elevated`,
  `app-surface-muted`, `app-surface-sunken`, `app-surface-hover`.
- **Text:** `app-text`, `app-text-muted`, `app-text-subtle`,
  `app-text-inverse`.
- **Borders:** `app-border`, `app-border-strong`.
- **Brand accents (PRESERVED):** `app-accent-blue`, `app-accent-dark-blue`,
  `app-accent-orange`. Do not change these without sign-off.
- **Semantic states:** `app-success`, `app-warning`, `app-danger`,
  `app-info`, each with `-soft` and `-border` variants.
- **Module entity colours:** `app-mod-inventory`, `app-mod-invoice`,
  `app-mod-hr`, each with `-soft`, `-border`, and `-ring` variants. The
  canonical place to consume them is `MOD_STYLES` in
  `components/project/projectConstants.tsx`.

### Adding a new entity / module colour

1. Add four variables to **both** `:root` and `.dark` in `index.css`:
   `--app-mod-foo`, `--app-mod-foo-soft`, `--app-mod-foo-border`,
   `--app-mod-foo-ring`.
2. Mirror them under `theme.extend.colors.app.mod.foo` (and the matching
   `borderColor` / `ringColor` entries) in `tailwind.config.js`.
3. Use `bg-app-mod-foo-soft`, `text-app-mod-foo`, etc. throughout the UI.

### Primitives & icons

- `Button` (`components/ui/Button.tsx`) supports
  `variant: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'` and
  `size: 'sm' | 'md' | 'lg'` plus a `loading` spinner. `Input` supports a
  `label` and `error`. Re-use these primitives instead of crafting new
  buttons.
- Almost all icons are inline `<svg>` (Heroicons-style paths). Do not
  introduce a `lucide-react` dependency without adding it to
  `package.json` — `ThemeToggle.tsx` was already migrated to inline SVGs.

---

## 11. Project lifecycle UI (the big one)

The most complex page is **`ProjectDetailPage`** (~50 KB). It coordinates the
end-to-end flow described in §1, using the smaller widgets in
`src/components/project/`:

| Component                  | Role                                                                |
| -------------------------- | ------------------------------------------------------------------- |
| `ModuleSelector`           | Picks `inventory` / `invoice` / `hr`.                               |
| `DefaultQuestions`         | Renders module-template questions (`getDefaultQuestions` API).      |
| `BusinessQuestions`        | Free-text business questionnaire.                                   |
| `AccessRequirements`       | Roles / permissions matrix.                                         |
| `ClarificationQuestions`   | Follow-up questions returned by the AI.                             |
| `PrefilledConfigSummary`   | Summary of pre-filled SDF entries.                                  |
| `GenerationModal`          | Long-running analyze/generate progress (polls `analyze/progress`).  |
| `SdfPreviewSection`        | Editable SDF tree (entities/fields/relations).                      |
| `ReviewApprovalPanel`      | Approve / reject / request-revision flow with history.              |
| `PostGenerationPanel`      | After-approval actions (download, preview, regenerate).             |
| `PreviewBuildModal`        | Build-progress modal for the live preview.                          |
| `projectConstants.tsx`     | Module metadata + i18n hooks (`useModuleMeta`, `useSteps`).         |
| `buildPreview.ts`          | Helpers for assembling/diffing the SDF before submission.           |

All of these expect the parent page to thread `projectService` calls and
update local state. None of them reach into contexts other than `Auth`,
`Theme`, and (where relevant) `Chat`.

The **preview** flow uses `usePreviewHeartbeat(projectId, active)`
(`src/hooks/usePreviewHeartbeat.ts`) — while the preview is open, this hook
pings `POST /projects/:id/preview/heartbeat` every 20 s. The backend reaps
unattended previews ~60 s after heartbeats stop. Always pair `start` with
this hook so previews don't get killed mid-use.

Vite dev server proxies `/preview/*` to `http://backend:3000/preview/*`
(see `vite.config.ts`). The proxy is what makes the iframe URL on the
preview page work in dev — keep it intact.

---

## 12. Chat widget

`ChatWidget` (`src/components/chat/ChatWidget.tsx`) is mounted globally
inside `DashboardLayout`. It reads from `useChatContext()` and talks to the
backend via `projectService.chatWithProject`. Key behaviours:

- Conversation history is trimmed to the last **10** messages on the wire and
  the last **50** in localStorage.
- Assistant replies can include `unsupported_features` — the widget surfaces
  these and they are also routed to the feature-request system.
- If a project page wants the bot to "pulse" (draw attention), set
  `setPulsing(true)` from the context.

Always `setProjectContext(null)` on page unmount to avoid the widget showing
stale project state on the next page.

---

## 13. Types

Shared TypeScript types live in `src/types/`:

- `auth.ts` — `User`, `AuthResponse`, `AuthContextType`, form types.
- `project.ts` — `Project` (with `status` union), `CreateProjectRequest`,
  `ProjectLanguage`.
- `aiGateway.ts` — `AiGatewaySdf`, clarification questions, token usage,
  `AnalyzeProjectResponse`.
- `defaultQuestions.ts` — module-template question schema returned by the
  backend (`DefaultQuestionStateResponse`, etc).

Conventions:

- Prefer `interface` for object shapes that may be extended; `type` for
  unions/aliases.
- Keep `Project['status']` and other backend-shared unions in sync with the
  backend enums. If the backend gains a new status, add it here too — TS
  `strict` will complain everywhere it matters.
- Use `import type { … }` for type-only imports (the codebase already does
  this consistently).

---

## 14. Build, dev, deploy

Local dev (from `platform/frontend`):

```bash
npm install
npm run dev          # http://localhost:5173
```

Type-check / lint before committing:

```bash
npm run typecheck
npm run lint
```

Production build:

```bash
npm run build        # outputs to dist/
npm run preview      # serves dist/ via Vite preview
```

Docker (multi-stage → nginx, see `Dockerfile`):

- Build arg `VITE_API_URL` is baked into the bundle at build time. Override
  with `--build-arg VITE_API_URL=https://api.example.com/api`.
- Runtime `nginx.conf` does SPA fallback to `index.html` and is what serves
  the built assets in production.

The Vite dev proxy (`/preview` → `http://backend:3000`) assumes the docker
service name `backend`. When running outside compose, point your dev API at
something the browser can reach (`VITE_API_URL`).

---

## 15. Conventions & gotchas

Do:

- Use the existing `Button` / `Input` primitives.
- Use `bg-app-*` / `text-app-accent-*` Tailwind tokens; pair every light
  utility with a `dark:` counterpart.
- Use `useTranslation('<ns>')`. Add new strings in **both** locales.
- Add new HTTP calls to a service module, not directly in components.
- `import type` for types (matches the rest of the codebase and avoids
  runtime-import side effects).
- Wrap long-running API calls (analyze / generate / standalone build) with an
  explicit axios `timeout` — the default 0/undefined isn't enough.
- Pair `projectService.startPreview` with `usePreviewHeartbeat`.

Don't:

- Don't introduce a global state library — Contexts + `useState` is the
  pattern here.
- Don't read `localStorage.token` directly from components; rely on
  `AuthContext` and the axios interceptors.
- Don't hard-redirect on 401/403 from your own code — the response
  interceptor already does it. Throwing from the call site is enough.
- Don't translate module slugs (`inventory`, `invoice`, `hr`) or SDF status
  values — they are protocol identifiers shared with the backend.
- Don't add admin-only routes without a server-side check; sidebar gating is
  cosmetic.
- Don't add new `lucide-react` imports without first declaring the dep in
  `package.json` (see §10).
- Don't violate `noUnusedLocals` / `noUnusedParameters` — `tsconfig.json`
  treats them as errors and the build script runs `tsc -b`.

---

## 16. When in doubt

- **Adding a page** → §4 checklist.
- **Adding an API call** → §7 conventions; reuse `api` from
  `services/api.ts`.
- **Adding a string** → §9; both locales, register the namespace if new.
- **Theming a new component** → §10; use the `app-*` tokens + `dark:` variants.
- **Touching the project flow** → read `ProjectDetailPage.tsx` first; the
  smaller widgets in `components/project/` are dumb-ish and rely on the page
  to coordinate state.
- **Touching auth** → §6; remember the interceptors do the redirect for you.
