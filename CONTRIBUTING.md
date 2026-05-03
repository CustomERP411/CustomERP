# Contributing to CustomERP

Welcome. This is the dev handbook — what to install, where to put things, how to ship a change. For deep code style rules see [docs/coding_guidelines.md](docs/coding_guidelines.md).

---

## 1. Local setup

### Prerequisites

- **Docker Desktop 24+** (preferred path)
- **Node.js 20.x** + npm (if running services bare-metal)
- **Python 3.11+** (if hacking on the AI gateway bare-metal)
- **PostgreSQL 16** (or just use the Postgres container)
- A **Google AI** or **Azure OpenAI** API key

### First time

```bash
git clone https://github.com/CustomERP411/CustomERP.git
cd CustomERP
cp .env.example .env
# fill in GOOGLE_AI_API_KEY (or AZURE_OPENAI_*)

docker compose up -d
docker compose exec backend npm run migrate     # apply DB migrations
./scripts/seed.sh                                # seed mock data (PowerShell on Windows)
```

Open http://localhost:5173. Register an account (the first one becomes admin).

### Day-to-day commands

| | |
|---|---|
| `make dev` / `scripts/dev.ps1 start` | Start all services |
| `make logs` / `scripts/dev.ps1 logs` | Tail container logs |
| `make migrate` | Run pending DB migrations |
| `make db-shell` | Open `psql` against the dev DB |
| `make pgadmin` | Boot pgAdmin (port 5050) |
| `make down` | Stop everything |
| `make clean` | Stop + remove volumes (wipes DB) |

---

## 2. Repo map (where code lives)

```
platform/frontend     → Vite + React 18 + TS    (PLATFORM dashboard)
platform/backend      → Express 5 + PG          (PLATFORM API)
platform/ai-gateway   → FastAPI + Pydantic      (NL → SDF)
platform/assembler    → Node + Handlebars       (SDF → generated ERP)
brick-library         → Pre-built parts the assembler stitches in
docs/                 → Living developer docs
Documents/            → Formal academic deliverables (don't edit casually)
diagrams/             → UML diagrams
test/                 → Smoke / integration / sample SDFs
tests/UnitTests/      → Per-UC Jest unit tests
```

Hard rule: **platform code stays in `platform/`. Generated-ERP code lives in `brick-library/` or assembler templates** — never inside platform pages.

---

## 3. Ownership

Default ownership of source paths (don't edit other owners' code without coordination):

| Owner | Paths |
|---|---|
| **BTB** | `platform/ai-gateway/**`, `SDF_REFERENCE.md`, AI prompts, SDF schemas, normalization/merge |
| **ODD** | `platform/backend/**`, `brick-library/backend-bricks/**` |
| **EA**  | `platform/frontend/**`, `brick-library/frontend-bricks/**` |
| **ASA** | `platform/assembler/**`, generators, CodeWeaver, templates |
| **TE**  | `docs/**`, `test/**`, `tests/**`, `platform/**/tests/**` |

**Never touch without ASA approval:** `.env`, prod compose files, deployment scripts, committed migrations, anything under `generated/**`, CodeWeaver hook markers in templates.

---

## 4. Git workflow

1. `git checkout main && git pull`
2. `git checkout -b sprintN/<initials>/<task>`
3. Work only in your owned paths.
4. Run the relevant checks (`npm run lint`, `npm run typecheck`, `pytest`, etc.) for what you touched.
5. Commit small, focused changes.
6. `git push -u origin HEAD` and open a PR for ASA review.

**Rules**

- No direct commits to `main`.
- One branch per task — don't reuse branches across phases.
- Don't use shared phase branches; everyone has their own.
- Keep PRs small and focused on one feature, fix, or test objective.
- Never commit secrets, tokens, generated zips, or `.env*` (only `.env*.example`).

---

## 5. Code style at a glance

Full rules: [docs/coding_guidelines.md](docs/coding_guidelines.md). The essentials:

- **Indent:** JS/TS/JSON/YAML = 2 spaces, Python = 4 spaces. No tabs. Newline at EOF.
- **Quotes:** JS/TS = single quotes; JSX attrs = double quotes.
- **Naming:** `PascalCase` for classes/components, `camelCase` for JS funcs/vars, `snake_case` for Python and SDF slugs, `UPPER_SNAKE_CASE` for constants.
- **Modules:** `platform/backend` is **CommonJS** (`require`/`module.exports`); frontend is ESM TypeScript.
- **Components:** functional only, hooks for side effects with cleanup, keep state immutable.
- **Routing (frontend):** main tree in `src/App.tsx`, use `ProtectedRoute` / `PublicOnlyRoute` / `AdminRoute` wrappers — no ad-hoc auth checks in pages.
- **Network I/O:** goes through `src/services` on frontend, the shared Axios instance, DTOs in `src/types`.
- **Styling:** Tailwind only; platform UI uses semantic `app-*` theme tokens — no raw hex in `tailwind.config.js`.
- **Generated ERP code:** lives in bricks/templates only, never inside platform pages.
- **Determinism:** SDF validation, normalization, and merge logic must remain deterministic — don't replace them with LLM-only behavior.
- **No silent catches.** Log, map to a user-safe error, or rethrow with context.
- **No new `any`** in TypeScript code.

---

## 6. Testing

Two test trees (live alongside the code they cover):

| Path | Runner | What's there |
|---|---|---|
| `tests/UnitTests/` | Jest (own `package.json`) | Per-UC unit tests for backend logic |
| `test/` | ad-hoc / scripted | Smoke + integration tests, sample SDFs (fixtures) |
| `platform/backend/tests/` | Jest | Backend service tests |
| `platform/ai-gateway/tests/` | pytest | AI gateway tests |

```bash
# Per-UC unit tests
cd tests/UnitTests && npm install && npm test

# AI gateway
cd platform/ai-gateway && pytest

# Manual UAT plan
docs/uat_test_plan_current.md
```

See [docs/testing_guide.md](docs/testing_guide.md) and [docs/local_testing_guide.md](docs/local_testing_guide.md).

---

## 7. SDF changes (the hot path)

The **System Definition File** is the contract between the AI gateway and the assembler. Touch carefully:

- Schema lives at `platform/ai-gateway/src/schemas/sdf.py` (Pydantic) and is mirrored in [`SDF_REFERENCE.md`](SDF_REFERENCE.md).
- Validation: `platform/assembler/assembler/sdfValidation.js`.
- Normalization: `platform/ai-gateway/src/services/sdf/normalization.py`.
- AI prompt: `platform/ai-gateway/src/prompts/analyze_prompt.txt`.

If you change the schema you must update all four. AI prompt expectations are documented in [docs/prompt_expectations.md](docs/prompt_expectations.md).

---

## 8. Adding a brick / mixin

1. Drop the file under `brick-library/backend-bricks/mixins/<Name>Mixin.js` (or `frontend-bricks/components/modules/<module>/`).
2. Register it in [`platform/assembler/MixinRegistry.js`](platform/assembler/MixinRegistry.js) so the assembler knows about it.
3. Add a generator hook in `platform/assembler/generators/` if it needs SDF-driven configuration.
4. Add a sample SDF that exercises it under `test/sample_sdf_*.json`.
5. Run the assembler against the sample SDF to confirm it produces a buildable ERP.

---

## 9. Environment variables

`.env.example` is the authoritative dev template; `.env.production.example` covers prod-only knobs. Keep them in sync when adding a variable. Required ones to know:

- `GOOGLE_AI_API_KEY` **or** `AZURE_OPENAI_API_KEY` + endpoint vars
- `JWT_SECRET` (must be changed in prod)
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- `VITE_API_URL` for the frontend

---

## 10. When in doubt

- Architecture question → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- "How does the generator actually turn an SDF into code?" → [docs/GENERATOR.md](docs/GENERATOR.md)
- "How does the assembly fit into the bigger picture?" → [Blueprint.md](Blueprint.md)
- "What can go in an SDF?" → [SDF_REFERENCE.md](SDF_REFERENCE.md)
- Cross-module behavior → [module_coherence_design.md](module_coherence_design.md)
- "What's broken right now?" → [observed_issues_grouping.md](observed_issues_grouping.md)
- Style nit → [docs/coding_guidelines.md](docs/coding_guidelines.md)
- Anything else → ask in the team chat, then update this file.
