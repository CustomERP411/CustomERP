# Architecture

How CustomERP is wired up. Reading order: top-down (the big picture, then each subsystem in detail, then how generated ERPs come out the other end).

For deep prose on the assembly pipeline, see [`Blueprint.md`](../Blueprint.md). For the SDF JSON contract, see [`SDF_REFERENCE.md`](../SDF_REFERENCE.md).

---

## 1. The big picture

```
                       ┌──────────────────────────────────┐
                       │   PLATFORM (the factory)         │
                       │                                  │
   user (browser)      │   Frontend (React/Vite)          │
        │              │        │                         │
        ▼              │        │ REST + JWT              │
   ┌────────────┐      │        ▼                         │
   │  iframe    │◀─────│   Backend (Express + PG)         │
   │  preview   │      │        │           ▲             │
   └────────────┘      │        │ proxy     │ persist     │
                       │        ▼           │             │
                       │   AI Gateway       │             │
                       │   (FastAPI)        │             │
                       │        │           │             │
                       │        ▼           │             │
                       │   Gemini /         │             │
                       │   Azure OpenAI     │             │
                       │                    ▼             │
                       │             PostgreSQL 16        │
                       │   (users, projects, SDFs,        │
                       │    conversations, training)      │
                       │                                  │
                       │            │                     │
                       │            ▼                     │
                       │   Assembler (Node.js)            │
                       │     reads SDF + Brick Library    │
                       │            │                     │
                       └────────────┼─────────────────────┘
                                    ▼
                       ┌──────────────────────────────────┐
                       │   GENERATED ERP (the product)    │
                       │  Node + React + SQLite/PG        │
                       │  packaged as docker img / .exe   │
                       └──────────────────────────────────┘
```

Two distinct things live in this repo:

- **Platform** — the long-running services that build ERPs (`platform/`).
- **Generated ERP** — the artifact produced for an end user. Source-of-truth for it lives in `brick-library/` and `platform/assembler/templates/`; the *output* is dropped into `generated/<projectId>/` (gitignored).

---

## 2. The four platform subsystems

### 2.1 `platform/frontend` — React dashboard

| | |
|---|---|
| Stack | React 18, Vite 6, TypeScript, Tailwind 3, react-router 6, axios, i18next (English + Turkish) |
| Entry | `src/main.tsx` → `src/App.tsx` |
| Run | `npm run dev` (port 5173) |

**Key paths**

- `src/pages/` — route-level screens (Login, ProjectDetail, Admin, Preview, Setup, Settings)
- `src/components/` — reusable UI; `DynamicForm` etc. live in [brick-library/frontend-bricks/](../brick-library/frontend-bricks)
- `src/context/` — auth, theme
- `src/services/` — API client (shared Axios instance in `services/api.ts`)
- `src/hooks/` — cross-cutting hooks
- `src/i18n/` — translation bundles
- `AGENT.md` — internal architecture cheat-sheet (kept up to date)

**Main routes**

| | |
|---|---|
| `/` | landing |
| `/login`, `/register` | auth |
| `/projects`, `/projects/:id` | project list, detail + SDF editor |
| `/projects/:id/preview` | iframe wrapper for the generated ERP |
| `/setup`, `/settings` | first-run + user prefs |
| `/admin`, `/admin/training`, `/admin/feature-requests` | admin |
| `/my/requests` | user feature requests |

### 2.2 `platform/backend` — Express API

| | |
|---|---|
| Stack | Node 20, Express 5, PostgreSQL 16 (`pg`), JWT (`jsonwebtoken`), `bcryptjs`, `archiver`, `http-proxy-middleware` |
| Entry | `src/index.js` |
| Run | `npm run dev` (nodemon, port 3000) |
| Module type | **CommonJS** |

**Key paths**

- `src/controllers/` — HTTP handlers (thin)
- `src/services/` — business logic, orchestration
- `src/routes/` — route mounting
- `src/middleware/` — auth, CORS, logging, RBAC
- `src/utils/` — logger, JWT helpers, preview token verification
- `src/defaultQuestions/` — seed questionnaires used during project setup
- `migrations/` — 17 sequential SQL migrations, runner in `migrations/run.js`

**Public routes**

| Method + path | Purpose |
|---|---|
| `POST /api/auth/{register,login}`, `GET /api/auth/me` | auth |
| `GET\|POST /api/projects`, `GET\|PUT\|DELETE /api/projects/:id` | project CRUD |
| `POST /api/projects/:id/analyze`, `POST /api/projects/:id/clarify` | AI-driven SDF flow |
| `GET /api/projects/:id/sdf/latest`, `POST /api/projects/:id/sdf/save` | SDF persistence |
| `POST /api/projects/:id/sdf/ai-edit` | targeted AI rewrites |
| `POST /api/projects/:id/generate` | invoke assembler, return zip |
| `GET /preview/:previewId/...` | proxies iframe requests to the locally running generated ERP |
| `GET /health` | service health |

### 2.3 `platform/ai-gateway` — FastAPI service

| | |
|---|---|
| Stack | Python 3.11, FastAPI 0.115, Pydantic 2, `google-generativeai`, `openai` (Azure-compatible), `httpx`, `jsonschema` |
| Entry | `src/main.py` |
| Run | `uvicorn src.main:app --reload --port 8000` |

**Key paths**

- `src/services/` — AI client wrappers, SDF service, multi-agent orchestration
- `src/schemas/` — Pydantic models for SDF, clarify, precheck
- `src/prompts/` — prompt text files (versioned)
- `src/config.py` — settings + key management
- `training_data/` — JSONL session logs for prompt tuning
- `tests/` — pytest

**Pipeline (NL → SDF)**

```
POST /ai/precheck_modules     does this prompt look feasible?
        ↓
POST /ai/analyze              first-pass SDF (entities, fields, relations)
        ↓
POST /ai/clarify              ask user follow-ups, refine
        ↓
POST /ai/finalize             polish, lint, normalize
        ↓
POST /ai/edit                 targeted rewrites on existing SDF
```

Other endpoints: `GET /health`, `POST /ai/chat` (streaming), `GET /ai/progress/{project_id}`, `GET /ai/training/{sessions,sessions/:id,stats}`.

### 2.4 `platform/assembler` — codegen engine

| | |
|---|---|
| Stack | Node.js, Handlebars (via CodeWeaver), CommonJS |
| Run | imported by backend; not a standalone server |

**Module map**

| File | Role |
|---|---|
| `ProjectAssembler.js` | top-level orchestrator |
| `BackendGenerator.js` / `FrontendGenerator.js` | per-layer code emitters |
| `BrickRepository.js` | indexes everything in `brick-library/` |
| `CodeWeaver.js` | Handlebars rendering |
| `MixinRegistry.js` | resolves which mixins apply for an SDF |
| `StandalonePackager.js` | bundles standalone executable (Node + SQLite embedded) |
| `TemplateEngine.js` | template selection / variable substitution |
| `assembler/sdfValidation.js` | SDF schema validation |
| `assembler/sdfLocalizationLint.js` | catches mixed-language SDFs |
| `assembler/actorRegistry.js` | actor / role registry per SDF |
| `generators/` | domain-specific generators (entities, modules, RBAC, i18n) |
| `i18n/` | label translation for generated code |

**What it does in one breath:** validates the SDF → loads matching bricks via `BrickRepository` → applies mixins via `MixinRegistry` → renders Handlebars templates with `CodeWeaver` → writes a complete project tree → optionally packages with `StandalonePackager`.

---

## 3. The Brick Library

Pre-built, tested code that the assembler stitches together. Three flavors:

### 3.1 `backend-bricks/`

```
core/         BaseController.js.hbs, BaseService.js.hbs   (CRUD scaffolding)
rbac/         rbacMiddleware.js, rbacRoutes.js, rbacSeed.js, scopeEvaluator.js
repository/   PostgresProvider.js, SQLiteProvider.js, FlatFileProvider.js + migration runners
mixins/       30+ feature modules (see below)
```

**Mixins shipped:**

| Module | Mixins |
|---|---|
| Inventory | `InventoryMixin`, `InventoryInboundWorkflowMixin`, `InventoryReservationWorkflowMixin`, `InventoryCycleCountWorkflowMixin`, `InventoryTransactionSafetyMixin` |
| Invoice | `InvoiceMixin`, `InvoiceCalculationEngineMixin`, `InvoicePaymentWorkflowMixin`, `InvoiceNoteWorkflowMixin`, `InvoiceTransactionSafetyMixin` |
| HR | `HREmployeeMixin`, `HRLeaveBalanceMixin`, `HRLeaveApprovalMixin`, `HRAttendanceTimesheetMixin`, `HRCompensationLedgerMixin` |
| Cross-cutting | `AuditMixin`, `RelationRuleRunnerMixin`, `UserEmployeeLinkMixin` |

### 3.2 `frontend-bricks/`

```
components/             DynamicForm.tsx, ImportCsvTool.tsx, modal/toast helpers,
                        derivedFieldEvaluator.ts (computed columns)
components/modules/     pre-built UI for inventory, invoice, HR
layouts/                dashboard, sidebar, navigation templates
```

### 3.3 `templates/`

```
Dockerfile.template, docker-compose.template.yml, dev.{sh,ps1}.template,
index.js.template, package.json.template
standalone/            standalone packaging: index.js, package.json,
                       start.{sh,bat,command} launchers
```

---

## 4. Database

PostgreSQL 16. Schema evolves through 17 sequential SQL files in `platform/backend/migrations/`. Run via `npm run migrate` (or `make migrate`).

**Domain tables (current state):**

| Table | Holds |
|---|---|
| `users`, `roles`, `user_roles` | accounts, RBAC |
| `projects` | one row per ERP-being-built |
| `sdfs` | versioned SDFs (JSONB) per project |
| `sdf_entities`, `sdf_attributes`, `sdf_relations` | parsed SDF for query/reporting |
| `questions`, `answers` | AI clarification dialogue |
| `conversations` | chat history |
| `modules`, `schema_artifacts` | generated module metadata |
| `generation_jobs` | async generation task tracking |
| `feature_requests` | user-submitted improvement requests (bilingual: `name_en`, `name_native`, `language`) |
| `training_data`, `training_step_reviews` | feedback for prompt tuning |
| `reviews`, `approvals`, `log_entries` | audit trail |

UUID primary keys; soft-delete via `is_deleted` columns; admin flag on `users`.

Latest migration: **017** — bilingual `feature_requests`.

---

## 5. End-to-end request flow

A representative path: user hits "Generate" on a project.

1. **Frontend** calls `POST /api/projects/:id/generate`.
2. **Backend** loads the latest SDF for that project from PostgreSQL.
3. **Backend** invokes the **Assembler** (`ProjectAssembler.assemble(sdf)`).
4. **Assembler** validates the SDF, asks `BrickRepository` for matching bricks, applies relevant mixins via `MixinRegistry`, renders templates with `CodeWeaver`.
5. Output written to `generated/<projectId>/`.
6. If standalone: `StandalonePackager` bundles a self-contained executable.
7. **Backend** zips the result (`archiver`), returns it.
8. For preview: backend spins up the generated app on a local port, mints a preview token, frontend embeds it in an iframe via the `/preview/:previewId` proxy.

The **AI flow** (precheck → analyze → clarify → finalize → edit) runs separately during SDF authoring, before the user clicks "Generate".

---

## 6. Deployment

- **Dev:** [`docker-compose.yml`](../docker-compose.yml) — frontend, backend, ai-gateway, postgres, optional pgadmin.
- **Prod:** [`docker-compose.prod.yml`](../docker-compose.prod.yml) + [`nginx/nginx.conf`](../nginx/nginx.conf) reverse proxy, optional TLS via `scripts/ssl-setup.sh`.
- Operational scripts live in [`scripts/`](../scripts/): `deploy.sh`, `backup.sh`, `restore.sh`, `health-monitor.sh`, `update.sh`.

---

## 7. Key design invariants

These are non-negotiable; if you find yourself fighting them, stop and re-read [`Blueprint.md`](../Blueprint.md):

1. **AI doesn't write code.** The AI emits an SDF. The assembler emits code. This separation is what keeps generated output reviewable and reproducible.
2. **SDF processing is deterministic.** Validation, normalization, and merge logic must not call the LLM. They live in regular Python/Node code.
3. **Platform code never leaks into generated ERPs.** Anything an end user sees comes from `brick-library/` or assembler templates. Anything *we* see (the dashboard) lives in `platform/`.
4. **Bricks are composable, not customized.** If you need new behavior, write a new mixin or a new brick — don't add SDF-specific branches inside an existing one.
5. **Generated ERPs are self-contained.** Once assembled, a generated ERP runs without the platform — that's the whole point.

---

## 8. Where to look next

- Conceptual overview, friendlier prose: [`docs/overview.md`](overview.md)
- The full assembly pipeline narrative: [`Blueprint.md`](../Blueprint.md)
- SDF JSON schema reference: [`SDF_REFERENCE.md`](../SDF_REFERENCE.md)
- Cross-module invariants (stock holds, payroll deductions, approver model): [`module_coherence_design.md`](../module_coherence_design.md)
- AI prompt expectations: [`prompt_expectations.md`](prompt_expectations.md)
- Use case catalog: [`customerp_use_cases.md`](customerp_use_cases.md)
- Known issues / triage: [`observed_issues_grouping.md`](../observed_issues_grouping.md)
