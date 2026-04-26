# Coding Guidelines (Repo-Wide)

This is the default coding guideline for CustomERP. Follow these rules unless ASA
approves an exception. These rules reflect the current app structure:

- `platform/frontend`: Vite + React platform UI.
- `platform/backend`: Express platform API.
- `platform/ai-gateway`: FastAPI AI/SDF service.
- `platform/assembler`: project generation, templates, CodeWeaver, and SDF validation.
- `brick-library/frontend-bricks`: reusable/generated ERP UI bricks.
- `brick-library/backend-bricks`: reusable/generated ERP backend bricks.
- `test`, `tests/UnitTests`, and `platform/**/tests`: repo test suites and fixtures.

---

## 1) Purpose

- Keep code consistent across teams and layers.
- Avoid merge conflicts and cross-team breaks.
- Make changes testable, traceable, and reviewable.
- Preserve the separation between the platform app, the AI gateway, the assembler,
  and generated ERP bricks.
- Keep SDF-driven behavior deterministic where the system already uses deterministic
  validation, normalization, and merging.

---

## 2) Ownership and Boundaries

- **BTB:** `platform/ai-gateway/**`, `SDF_REFERENCE.md`, AI prompts, SDF schemas,
  SDF normalization/merge logic.
- **ODD:** `platform/backend/**`, `brick-library/backend-bricks/**`.
- **EA:** `platform/frontend/**`, `brick-library/frontend-bricks/**`.
- **ASA:** `platform/assembler/**`, generator wiring, CodeWeaver, templates,
  generated project structure.
- **TE:** tests and docs only: `docs/**`, `test/**`, `tests/**`,
  `platform/**/tests/**`.

**Rules:**

- Do not edit other owners' files without explicit approval and coordination.
- Platform UI belongs under `platform/frontend`.
- ERP module UI belongs under `brick-library/frontend-bricks/components/modules/<module>`
  and frontend generator templates, not directly inside platform pages.
- Platform API code belongs under `platform/backend`.
- Generated ERP backend behavior belongs in backend bricks, templates, or assembler
  generators, not in generated output.

---

## 3) Do Not Touch Without ASA Approval

- `.env` files and secret-bearing local config.
- Production compose files and deployment scripts.
- Database migrations already committed.
- Generated output under `generated/**`, unless the task is explicitly to inspect or
  verify generated artifacts.
- Other owners' folders listed in Section 2.
- Existing CodeWeaver hook markers in templates.

Do not commit secrets, tokens, local credentials, generated zip files, or machine-local
artifacts.

---

## 4) Git Workflow

1. `git checkout main`
2. `git pull`
3. `git checkout -b sprint1/<initials>/<task>`
4. Work only in your owned paths.
5. Run the relevant checks for the files you changed.
6. `git add -A`
7. `git commit -m "<short message>"`
8. `git push -u origin HEAD`
9. Open PR for ASA review.

**Rules:**

- No direct commits to `main`.
- Keep PRs small and focused on one feature, fix, or test objective.
- Rebase or merge `main` only if requested by ASA.
- Use one branch per task. Do not reuse a branch across phases.
- Do not use shared phase branches. Each person works in their own branch.
- ASA may create temporary integration branches only for combined testing.

---

## 5) Formatting and Whitespace

- **Indentation:** JS/TS/JSON/YAML = 2 spaces; Python = 4 spaces.
- **Tabs:** do not use tabs.
- **Line endings:** keep repo-standard line endings and add a newline at EOF.
- **Quotes:** JS/TS uses single quotes; JSX attributes use double quotes.
- **Trailing commas:** use trailing commas in multiline JS/TS objects and arrays where
  the existing file does.
- **Line length:** keep lines reasonably short, around 100 characters where practical.
- **Comments:** add comments only when they explain non-obvious behavior, generator
  contracts, test setup, or operational constraints.

Follow the style of the file you edit when an older file has local conventions.

---

## 6) Naming Conventions

- **Classes / React components:** `PascalCase`, e.g. `ProjectAssembler`,
  `ProjectDetailPage`.
- **JS/TS functions and variables:** `camelCase`, e.g. `generateProjectDir`.
- **Python functions and variables:** `snake_case`, e.g. `finalize_sdf`.
- **Constants:** `UPPER_SNAKE_CASE`.
- **Types and interfaces:** `PascalCase`.
- **SDF slugs:** lowercase `snake_case`, e.g. `stock_movements`.
- **Use-case test folders:** preserve the existing `UC-<number>` structure under
  `tests/UnitTests`.

**File naming:**

- React pages and components: `PascalCase.tsx`.
- Hooks: `useThing.ts`, either under `src/hooks` or colocated with the feature.
- Frontend services: `camelCase.ts`, e.g. `projectService.ts`.
- Platform backend routes/controllers/services: `camelCase.js` with role suffixes,
  e.g. `projectCrudController.js`, `authService.js`, `trainingRoutes.js`.
- Backend models: `PascalCase.js` when following the current model pattern.
- Python files: `snake_case.py`.
- Docs: `snake_case.md`.
- Handlebars templates: preserve existing `.js.hbs` names and generated class names.

Avoid introducing new lowercase React component filenames. Existing utility-style
exceptions can remain until they are touched for a related change.

---

## 7) Imports and Modules

**Frontend TypeScript:**

- Use ES modules.
- Put external imports before relative imports.
- Use `import type` for type-only imports.
- The `@/*` alias is configured, but most current frontend code uses relative imports.
  Prefer the local file's existing import style unless a deep relative path becomes
  hard to read.
- Keep feature-local helpers near the feature when they are not reusable elsewhere.

**Platform backend JavaScript:**

- `platform/backend` is CommonJS. Use `require` and `module.exports`.
- Do not mix ESM syntax into platform backend files.
- Load `dotenv` at bootstrap before reading environment variables.

**Assembler and backend bricks:**

- Follow existing CommonJS patterns.
- Keep generated-code templates and runtime code separate.
- Do not import generated output back into source modules.

**Python AI gateway:**

- Use normal Python imports and keep service code under `src/services`.
- Keep Pydantic schemas under `src/schemas`.
- Keep prompt text under `src/prompts`.

---

## 8) General Coding Style

- Prefer small, clear functions over large blocks.
- Keep controllers and routes thin. Put business rules in services, generators, or
  dedicated helpers.
- Validate inputs at boundaries: HTTP controllers, AI gateway endpoints, SDF ingestion,
  and assembler entry points.
- Reuse existing services, schemas, validators, and generator helpers before adding new
  abstractions.
- Keep deterministic behavior deterministic. Do not replace validation, normalization,
  or SDF merge code with LLM-only behavior.
- No silent catch blocks. Log, map to a user-safe error, or rethrow with context.
- Avoid broad `any` in new TypeScript. Existing brick `any` usage is technical debt,
  not a pattern to expand.
- Preserve backwards compatibility for persisted data, SDF schema contracts, public API
  responses, and generated app structure.

---

## 9) Frontend Platform App

The platform frontend is a Vite + React 18 app in `platform/frontend`.

**Tooling:**

- `npm run dev` starts Vite.
- `npm run build` runs `tsc -b` and Vite build.
- `npm run lint` runs ESLint with zero warnings.
- `npm run typecheck` runs TypeScript without emit.
- There is currently no platform UI test runner configured.

**Components and pages:**

- Use functional components only.
- Pages usually default-export `PageName`.
- Leaf components usually default-export the component.
- Context providers and hooks may use named exports, e.g. auth/theme/chat providers.
- Keep side effects in `useEffect` with proper cleanup for intervals, subscriptions,
  and event listeners.
- Keep state updates immutable.

**Routing:**

- Keep the main route tree in `src/App.tsx`.
- Use `react-router-dom` v6 patterns.
- Use layout routes with `Outlet`.
- Use route wrapper components such as `ProtectedRoute`, `PublicOnlyRoute`, and
  `AdminRoute` instead of ad-hoc auth checks in every page.

**Data access:**

- Put network I/O through `src/services`.
- Use the shared Axios instance in `src/services/api.ts` for platform API calls.
- Keep DTOs and shared shapes in `src/types` or near the owning service.
- Pages should orchestrate loading, empty, success, and error UI.
- Cross-cutting behavior belongs in `src/hooks`; feature-only behavior may be colocated
  as `use*.ts`.

**State and persistence:**

- Prefer local component state for page-level UI.
- Use React context for auth, theme, chat, and similar cross-cutting state.
- Store only stable session pointers or UX preferences in `localStorage`; do not add
  full domain caches there.

**Styling:**

- Use Tailwind classes.
- Platform UI should use semantic `app-*` theme tokens from `src/index.css` and
  `tailwind.config.js`.
- Do not add raw hex colors to `tailwind.config.js`; theme colors come from CSS
  variables.
- Avoid raw palette classes for platform surfaces when an `app-*` token exists.
- Inline `style` is acceptable only for dynamic values that Tailwind cannot express
  cleanly, such as calculated widths, positions, or canvas-like geometry.

**Copy and i18n:**

- New user-visible platform copy should go through `react-i18next` locale namespaces
  under `src/i18n/locales`.
- Avoid hard-coded user-facing strings on platform pages when a namespace already
  exists for that surface.

---

## 10) Frontend Bricks

Frontend bricks live in `brick-library/frontend-bricks` and are reused by generated ERP
apps.

- Keep module UI under `components/modules/<module>`.
- Do not move generated ERP module screens into `platform/frontend`.
- Use functional React components.
- Prefer `PascalCase.tsx` for component files.
- Bricks may use module-appropriate Tailwind palettes, but keep styling consistent
  within generated module UIs.
- Keep generic brick components reusable and free of platform-only dependencies.
- Avoid hard-coding platform auth, chat, or preview concerns into module bricks.
- Treat existing broad `any` props as technical debt. New or modified brick APIs should
  use explicit prop types.

---

## 11) Platform Backend API

The platform backend is a CommonJS Express 5 API in `platform/backend`.

**Tooling:**

- `npm run dev` starts `nodemon src/index.js`.
- `npm start` starts `node src/index.js`.
- `npm run migrate` runs database migrations.
- The package-level `npm test` script is currently a placeholder; unit tests live under
  `tests/UnitTests`.

**Structure:**

- `src/index.js` owns app bootstrap, middleware, route mounting, 404 handling, and the
  global error handler.
- `src/routes` contains one router per area and aggregates under `/api`.
- `src/controllers` contains request handlers.
- `src/services` contains business logic.
- `src/models`, `src/middleware`, `src/config`, and `src/utils` hold shared platform
  concerns.

**Routes and controllers:**

- Use `express.Router()`.
- Controllers are named async functions using `req`, `res`, and `next`.
- Validate request input in controllers or shared validators before calling services.
- Keep controllers thin: parse input, call a service, map the result, and handle known
  status errors.
- Return consistent JSON errors, usually `{ error: "message" }`.
- Call `next(error)` for unexpected failures so the global handler can respond.

**Services and errors:**

- Services often use classes with instance methods. Follow the local service pattern.
- Put business rules, database calls, and workflow decisions in services.
- For expected failures, throw an `Error` with `statusCode` or `status`.
- Do not leak raw stack traces or internal exception text to clients.
- Log errors with route or request context where practical, but never log secrets.

**Auth and config:**

- Platform auth uses JWT bearer tokens and `req.user`.
- Use middleware from `src/middleware/auth.js` for authentication, role checks, and
  admin checks.
- Database config prefers discrete `PG*` variables when available and may fall back to
  `DATABASE_URL`.
- Read environment variables through config/bootstrap code, not scattered throughout
  controllers.

---

## 12) Backend Bricks and Generated ERP Backend

Backend bricks are not the platform API. They are source assets used by the assembler
to create generated ERP backends.

**Backend bricks:**

- Keep reusable backend behavior under `brick-library/backend-bricks`.
- Mixins are factories that return config, dependencies, hooks, and generated behavior.
- Mixins should not become Express route handlers.
- Repository providers, RBAC helpers, and core templates should stay generic.

**Generated ERP backend conventions:**

- Generated controllers are class-based and instantiated from templates.
- Generated routes use `express.Router()`.
- Generated service actions may be exposed through `runAction` when the template and
  SDF allow it.
- Generated RBAC uses `req.erpUser`, not the platform API's `req.user`.
- Keep platform API auth and generated ERP RBAC concepts separate.

**Template rules:**

- Edit templates, generators, or bricks, not generated output.
- Keep template behavior deterministic and covered by sample SDF tests when possible.
- Preserve template placeholders and hook markers.

---

## 13) Python AI Gateway

The AI gateway is a FastAPI service in `platform/ai-gateway`.

**Tooling:**

- Python 3.11+.
- Dependencies are listed in `requirements.txt`.
- Tests use `pytest` and `pytest-asyncio`.

**Structure:**

- `src/main.py` owns FastAPI routes and response models.
- `src/services` contains AI clients, multi-agent orchestration, and SDF services.
- `src/services/sdf` contains deterministic SDF filtering, normalization, merge, and
  integration logic.
- `src/schemas` contains Pydantic models.
- `src/prompts` contains prompt text and prompt-loading helpers.
- `scripts/generate_schema.py` exports the SDF JSON schema from Pydantic models.

**Rules:**

- Follow PEP8.
- Use type hints for public functions and service boundaries.
- Validate external data with Pydantic models.
- Keep API/provider calls centralized in service classes.
- Keep prompt text in `.txt` files and load it through prompt helpers.
- Parse, clean, normalize, and validate AI JSON before returning it to callers.
- Map `ValueError` and validation failures to 400-level responses where appropriate.
- Do not return raw exceptions to clients.
- Do not make the LLM the only source of truth for SDF structure. Preserve deterministic
  schema validation, normalization, and merge behavior.

---

## 14) Assembler, SDF, Templates, and CodeWeaver

The assembler turns SDFs and bricks into generated ERP projects.

**Assembler structure:**

- `ProjectAssembler.js` is the main orchestration entry point.
- `assembler/*.js` contains SDF validation and module-specific generation rules.
- `generators/backend` and `generators/frontend` own generated source structure.
- `generators/shared` contains shared generator helpers.
- `BrickRepository.js` and `MixinRegistry.js` resolve reusable bricks and mixins.

**SDF rules:**

- Validate SDFs before generation.
- Keep SDF entity/module slugs lowercase `snake_case`.
- Add deterministic validation for new SDF capabilities.
- Keep `SDF_REFERENCE.md` aligned with schema and generator behavior.
- Update sample SDFs under `test/` when behavior changes.

**CodeWeaver and templates:**

- Never edit generated output directly.
- Inject logic through CodeWeaver, generator APIs, templates, or brick mixins.
- Keep `// @HOOK: NAME` markers intact.
- Do not rename hook markers unless all generators, templates, and tests are updated
  together.
- CodeWeaver expects missing or duplicate hooks to be treated as errors.
- Use template placeholders consistently and avoid ad-hoc string generation when a
  generator helper already exists.

---

## 15) Testing Expectations

Run the smallest reliable test set for the files you changed. If no automated test
exists for the changed area, explain the gap in the PR.

**Current test layout:**

- `tests/UnitTests`: Jest unit tests for platform backend use cases.
- `test`: assembler, generated output, SDF, and regression tests.
- `platform/ai-gateway/tests`: pytest tests for AI gateway and SDF services.
- `platform/backend/tests`: generated-backend/API verification scripts.
- `platform/frontend`: currently has lint/typecheck/build scripts, but no UI test runner.

**When you change:**

- **Platform frontend:** run `npm run lint`, `npm run typecheck`, and `npm run build`
  from `platform/frontend` when practical.
- **Platform backend controllers/services:** add or update Jest tests under
  `tests/UnitTests/<UC-...>` and run the relevant Jest command.
- **Backend bricks:** add or update unit tests that import the brick directly.
- **Assembler wiring or templates:** add or update assembler integration tests using
  sample SDFs under `test`.
- **AI output, prompts, SDF rules, or schema:** add or update AI gateway pytest tests,
  sample SDFs, and schema/reference docs.
- **Migrations:** document how the migration was tested and avoid editing committed
  migrations without ASA approval.

---

## 16) Documentation Expectations

When you change:

- **SDF schema or generator-supported SDF behavior:** update `SDF_REFERENCE.md`.
- **AI prompt expectations or SDF production rules:** update
  `docs/prompt_expectations.md` only if TE/ASA owns the change.
- **Architecture or cross-system flow:** update `docs/overview.md` only through the
  doc merge policy below.
- **New behavior:** add a short usage note in the relevant doc or an overview update.
- **Sprint-specific work:** update the current sprint doc if one is active and assigned.
- **Generated app behavior:** include the sample SDF used to verify it.

Docs should describe shipped behavior and accepted conventions, not temporary local
workarounds.

---

## 17) Security and Ops

- Never commit secrets, tokens, credentials, `.env`, or generated credential files.
- Validate external input at API, AI gateway, and generated ERP boundaries.
- Do not log secrets, raw tokens, passwords, database URLs, or full AI provider payloads
  when they may contain sensitive input.
- Use environment variables for provider keys, database settings, JWT secrets, and
  deployment-specific URLs.
- Coordinate dependency updates with the owning team.
- Keep CORS, proxy, Docker, and production compose changes small and reviewed.
- Do not weaken auth, RBAC, admin checks, or generated ERP permissions to make tests
  pass.

---

## 18) Review and Acceptance

Every PR should include:

- A short summary of what changed and why.
- The owned paths touched.
- Tests run, or a clear reason tests could not be run.
- Relevant screenshots for frontend UI changes.
- Relevant sample SDFs or generated artifact notes for assembler changes.
- Documentation updates when behavior, schema, or workflows changed.

ASA reviews every PR. Call out cross-owner changes explicitly.

---

## 19) Documentation Merge Policy

- **Doc integrator:** TE with ASA oversight.
- Only TE or ASA edits:
  - `docs/overview.md`
  - `docs/prompt_expectations.md`
- Everyone else adds change notes in:
  - `docs/overview_updates/<initials>_<YYYYMMDD>_<topic>.md`
- After-prompt-care files:
  - One file per prompt in `docs/after_prompt_care/`.
  - Use unique timestamp names:
    - `after_prompt_care_YYYYMMDD_HHMM_<initials>.md`
  - Do not edit or rename existing after-prompt-care files in feature branches.

---

## 20) Known Gaps and Existing Debt

These are known differences between current code and preferred new-code rules. Do not
expand them without approval:

- Platform frontend has no configured UI test runner yet.
- Some frontend brick props use broad `any` types.
- A few utility-style frontend brick filenames are lowercase.
- Some older frontend files use inline style objects for dynamic layout.
- Platform backend package-level `npm test` is a placeholder; use the Jest suite under
  `tests/UnitTests` for backend unit coverage.
- Some import ordering varies in older files. New files should follow Section 7.
