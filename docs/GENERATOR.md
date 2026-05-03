# The ERP Generator

How [`platform/assembler/`](../platform/assembler) turns an SDF into a complete, runnable ERP.

This is the deep dive. For the conceptual framing see [`Blueprint.md`](../Blueprint.md). For the SDF JSON contract see [`SDF_REFERENCE.md`](../SDF_REFERENCE.md). For a 30-second overview of where it sits in the system see [`ARCHITECTURE.md`](ARCHITECTURE.md).

---

## 1. The pipeline in one page

```
SDF (JSON)
   │
   ▼
┌──────────────────────────────────────────────────────────────────┐
│  ProjectAssembler.assemble(projectId, sdf, options)              │
└──────────────────────────────────────────────────────────────────┘
   │
   ├── 1. SDF preprocessing
   │      ├── sdfLocalizationLint   warn on un-keyed user strings
   │      ├── sdfValidation         structural validation (1170 lines)
   │      ├── sdfActorMigration     promote `*_by` fields → references
   │      └── systemAndRuntime      add system entities for enabled packs
   │
   ├── 2. Normalize modules & entities
   │      ├── _resolveErpModules    which of inventory/invoice/hr are on
   │      ├── _normalizeEntitiesForModules  tag & filter by module
   │      └── _relaxCircularRequiredReferences  break FK deadlocks
   │
   ├── 3. BackendGenerator
   │      ├── scaffold(backendDir)         dirs + package.json + Dockerfile
   │      ├── generateEntity(...)          per entity:
   │      │     ├── load BaseController.js.hbs / BaseService.js.hbs
   │      │     ├── CodeWeaver: inject validation (validationCodegen)
   │      │     ├── MixinRegistry: resolve + inject mixins (mixinResolver)
   │      │     └── write Controller.js + Service.js + Routes.js
   │      ├── generateRoutesIndex          aggregate routes + RBAC wrap
   │      ├── generateDatabaseArtifacts    SQL migrations (PG + SQLite)
   │      └── generateMainEntry            src/index.js (Express boot)
   │
   ├── 4. FrontendGenerator
   │      ├── scaffold(frontendDir)        Vite + React + Tailwind shell
   │      ├── generateDynamicForm          shared form component (i18n-baked)
   │      ├── generateEntityPage(...)      per entity:
   │      │     ├── ListPage   (table + search + filter + paging)
   │      │     ├── FormPage   (DynamicForm + inline children)
   │      │     ├── DetailsPage (optional)
   │      │     └── module-specific pages (InventoryOps, Labels, Import…)
   │      ├── generateApp                  React App.tsx with routes
   │      ├── generateSidebar              navigation tree
   │      └── generateTopbar               project name + user display
   │
   ├── 5. Root files (Dockerfile, README, .env, docker-compose.yml)
   │
   └── 6. (optional) StandalonePackager
          ├── npm install backend, vite build frontend
          ├── copy frontend dist → app/public
          ├── fetch Node 20.18.1 binary for target OS+arch
          ├── swap better-sqlite3 native module for the same target
          └── write start.{sh,bat,command} launcher

→ generated/<projectId>/  (directory tree, optionally a zip,
                           optionally a standalone executable bundle)
```

The whole flow is deterministic: same SDF in, same code out. **No LLM calls happen during assembly** — the AI's job ends when the SDF is finalized.

---

## 2. Inputs and outputs

**Input.** A validated SDF object (see [`SDF_REFERENCE.md`](../SDF_REFERENCE.md)). Roughly:

```jsonc
{
  "project_name": "...",
  "language": "en" | "tr",
  "modules": {
    "inventory": { "enabled": true, ... },
    "invoice":   { "enabled": true, ... },
    "hr":        { "enabled": true, ... },
    "access_control": { "enabled": true, ... },
    "activity_log":   { "enabled": true, ... }
  },
  "entities": [
    {
      "slug": "products",
      "module": "inventory",
      "fields": [ { "name": "...", "type": "...", "required": true, ... } ],
      "features": { "stock_tracking": true, ... },
      "relations": [ { "kind": "reference_contract", ... } ],
      "children": [ ... ]
    }
  ]
}
```

**Output.** A directory tree at `generated/<projectId>/` containing a self-contained backend + frontend. See §10 for the concrete layout. The output runs without the platform — that's the whole point.

**Entry point.** [`platform/assembler/ProjectAssembler.js:18`](../platform/assembler/ProjectAssembler.js):

```js
new ProjectAssembler(brickRepo, outputPath)
  .assemble(projectId, sdf, { standalone, language });
```

The platform backend invokes this from `POST /api/projects/:id/generate` (and `/generate/standalone`).

---

## 3. The orchestrator: `ProjectAssembler`

Lives in [`platform/assembler/ProjectAssembler.js`](../platform/assembler/ProjectAssembler.js). 353 lines plus ~3,500 more mixed onto its prototype:

```js
// at the bottom of ProjectAssembler.js
Object.assign(ProjectAssembler.prototype, require('./assembler/sdfValidation'));
Object.assign(ProjectAssembler.prototype, require('./assembler/inventoryConfig'));
Object.assign(ProjectAssembler.prototype, require('./assembler/invoiceConfig'));
Object.assign(ProjectAssembler.prototype, require('./assembler/hrConfig'));
Object.assign(ProjectAssembler.prototype, require('./assembler/inventoryEntities'));
Object.assign(ProjectAssembler.prototype, require('./assembler/invoiceEntities'));
Object.assign(ProjectAssembler.prototype, require('./assembler/hrEntities'));
Object.assign(ProjectAssembler.prototype, require('./assembler/systemAndRuntime'));
```

Why split? `ProjectAssembler.js` keeps a clean `assemble()` flow; the per-module SDF defaults, system-entity injection, and the heavy validation rules live in focused files. They're mixed in so callers see one class.

`assemble()` (lines 18–120) is the linear flow shown in §1. The interesting helpers on the same class:

| Method | What it does |
|---|---|
| `_validateSdf` *(from sdfValidation.js)* | 1,170 lines of structural checks — see §4 |
| `_resolveErpModules` | which of `inventory`/`invoice`/`hr` are enabled (`modules.<key>.enabled !== false`); defaults to `inventory` if no module config |
| `_normalizeEntitiesForModules` | tag each entity with its module, drop entities whose module is disabled |
| `_buildModuleMap` | map `{ enabled, entitiesByModule }` consumed by both generators |
| `_withSystemEntities` *(from systemAndRuntime.js)* | inject hidden `__erp_users`, `__audit_logs`, etc. for enabled packs |
| `_relaxCircularRequiredReferences` | break create-time deadlocks: self-required FKs and mutual required FKs (e.g. `employee.manager_id` ↔ `employee.subordinate_id`) get `required: false` |

The "relax circular references" rule prefers to relax fields named `manager`, `approver`, `supervisor`, `lead`, `owner`, `reviewer` (line 257) — the heuristic for "the soft side of a hierarchical relationship."

---

## 4. SDF preprocessing

### 4.1 Localization lint — [`sdfLocalizationLint.js`](../platform/assembler/assembler/sdfLocalizationLint.js)

Runs **before** structural validation. Walks the SDF for every user-facing string (project name, entity `display_name`, field `label`, enum options, status values, action labels, invariant messages, section headings) and checks they're keyed (dot-path like `entity.products.label` or present in `i18n/en.json`). Currently emits warnings, not errors — Plan J for per-project key enforcement is not yet wired.

### 4.2 Structural validation — [`sdfValidation.js`](../platform/assembler/assembler/sdfValidation.js)

The largest single file in the assembler (1,172 lines). Validates, in order:

- **Uniqueness:** no duplicate entity slugs.
- **Module entities present:** if `modules.invoice.enabled` then `invoices` and `customers` must exist; if `modules.hr.enabled` then `employees` and `departments`; if `modules.inventory.enabled` then `products`.
- **Child FKs:** child entities declared in `entity.children[]` have a foreign-key field pointing back at the parent.
- **References:** every `type: "reference"` field's `reference_entity` exists in the SDF.
- **Actor fields:** fields with names ending in `_by` or `_by_id` against `actorRegistry.js` specs (e.g., `leaves.approved_by` is a known actor → must be a reference to `__erp_users`).
- **Relation rules:** strings like `no_overlap_with(entity=leaves, group_by=employee_id, status_in=[Pending,Approved])` parse via the grammar in [`relationRuleParser.js`](../brick-library/backend-bricks/mixins/relationRuleParser.js).
- **Permission scopes:** `relations[]` of kind `permission_scope` use only `self`, `department`, `manager_chain`, `module`, `all`.
- **Visibility predicates:** `visibility_when` uses only `equals`, `not_equals`, `in`, `not_in`, `is_set`, `is_unset`.
- **Patterns:** field `pattern` strings compile as valid regexes.

Throws on the first error with a message naming the offending entity / field / index.

### 4.3 Actor migration — [`sdfActorMigration.js`](../platform/assembler/assembler/sdfActorMigration.js)

Idempotent. For each known actor field in [`actorRegistry.js`](../platform/assembler/assembler/actorRegistry.js), promotes the field to `type: "reference", reference_entity: "__erp_users"` and adds `reference_contract` + `permission_scope` relations. Only runs when access control is enabled (or `force: true`). Returns a deep-cloned SDF — original is untouched.

Why a separate pass: it lets the AI emit "soft" actor fields (`requested_by: "string"`) and the assembler hardens them into real FKs at build time, keeping the SDF AI-friendly.

### 4.4 System entities — [`systemAndRuntime.js`](../platform/assembler/assembler/systemAndRuntime.js)

Injects hidden entities (slug starts with `__`) that the runtime needs but the user never sees:

| Entity | When | Purpose |
|---|---|---|
| `__erp_users` | always | RBAC users + actor FK targets |
| `__audit_logs` | `activity_log.enabled` or any AuditMixin | append-only audit table |
| `__permissions`, `__roles`, `__user_roles` | `access_control.enabled` | RBAC schema |

Frontend filters them out (`startsWith('__')`) so they never appear as nav items.

---

## 5. Module + entity normalization

After preprocessing, the orchestrator decides what actually gets generated:

1. **`_resolveErpModules`** reads `sdf.modules.{inventory,invoice,hr}` and produces `{ enabledModules: ['inventory', 'invoice'], hasErpConfig: true }`. If the SDF mentions no module config at all, it defaults to `['inventory']` for backwards compatibility.

2. **`_normalizeEntitiesForModules`** tags each entity with `entity.module`. The tag comes from `entity.module || entity.module_slug || entity.moduleSlug` (lowercased). Unknown modules log a warning and fall back to the default. Entities tagged with `module: 'shared'` go through if at least one ERP module is enabled.

3. **Module map** is built: `{ enabled: ['inventory', 'invoice'], entitiesByModule: { inventory: ['products', 'stock'], invoice: ['invoices', 'invoice_items'], hr: [], shared: [] } }`. Both generators consume this.

4. **`_relaxCircularRequiredReferences`** scans for required FKs that form deadlock cycles. Self-required (`x.parent_id REFERENCES x` with `required: true`) → relax. Mutual required (`a.b_id ↔ b.a_id`, both required) → relax the "softer" one (manager/approver/etc).

---

## 6. Backend generation — `BackendGenerator`

Top-level: [`platform/assembler/generators/BackendGenerator.js`](../platform/assembler/generators/BackendGenerator.js) (445 lines). Per-domain helpers split out under [`generators/backend/`](../platform/assembler/generators/backend).

### 6.1 Scaffold

Creates the directory skeleton and writes the static-but-templated files:

```
backend/
├── src/
│   ├── controllers/
│   ├── services/
│   ├── routes/
│   ├── repository/      (provider chosen by SDF: FlatFile | SQLite | Postgres)
│   └── rbac/            (only if access_control.enabled)
├── modules/
│   ├── inventory/src/{controllers,routes,services,repository}/
│   ├── invoice/src/...
│   └── hr/src/...
├── package.json         (rendered from templates/package.json.template)
├── Dockerfile           (rendered from templates/Dockerfile.template)
└── .env                 (PORT, DB credentials)
```

In standalone mode the backend dir is `app/` instead of `backend/` (line 22 of `ProjectAssembler.js`).

### 6.2 Per-entity generation

For every entity, the loop in `assemble()` (line 67-75) calls `generateEntity(backendDir, entity, allEntities)`. Inside, three things happen:

**a. Load templates.** [`BrickRepository`](../platform/assembler/BrickRepository.js) reads `BaseController.js.hbs` and `BaseService.js.hbs` from `brick-library/backend-bricks/core/`. The repository searches a fixed list of locations in order (templates/, backend-bricks/core/, backend-bricks/services/, …) — see [`BrickRepository.js:11-22`](../platform/assembler/BrickRepository.js).

**b. Inject validation via CodeWeaver.** [`validationCodegen.js`](../platform/assembler/generators/backend/validationCodegen.js) (866 lines) walks `entity.fields` and emits inline JS for `BEFORE_CREATE_VALIDATION` and `BEFORE_UPDATE_VALIDATION` hooks: required-field checks, length/pattern/enum, numeric ranges, uniqueness lookups, reference existence, computed-field stripping. All checks are gated by `__isDraft` so Draft rows can be saved with holes.

**c. Inject mixins via MixinRegistry.** [`mixinResolver.js`](../platform/assembler/generators/backend/mixinResolver.js) (641 lines) decides which mixins apply, then [`MixinRegistry`](../platform/assembler/MixinRegistry.js) loads them and CodeWeaver injects each mixin's `hooks` and `methods` blocks into the service template.

The CodeWeaver hook system is dead simple. Templates contain markers like `// @HOOK: AFTER_CREATE_LOGGING`. CodeWeaver's `inject(name, code)` finds the marker and appends after it. It fails fast on missing or duplicated markers — see [`CodeWeaver.js:11-32`](../platform/assembler/CodeWeaver.js). Critical implementation note (line 35): the replacement uses the *function* form of `String.replace()` to avoid `$` token expansion, since injected code legitimately contains regex patterns.

### 6.3 Mixins — what they actually are

A mixin is a CommonJS module under [`brick-library/backend-bricks/mixins/`](../brick-library/backend-bricks/mixins) exporting a shape:

```js
module.exports = {
  dependencies: ['AuditMixin'],     // optional, used for ordering
  hooks: {
    'AFTER_CREATE_LOGGING': `// inline JS string injected at the hook`,
    'BEFORE_DELETE_VALIDATION': `// ...`,
  },
  methods: `
    async myCustomMethod(arg) { ... }
  `,
};
```

A mixin can also export an async function `(config, context) => shape` if it needs to specialize on entity / module config. `MixinRegistry.loadMixin` handles both ([`MixinRegistry.js:39-50`](../platform/assembler/MixinRegistry.js)).

The 30+ shipped mixins, by family:

| Family | Mixins | Triggered by |
|---|---|---|
| Inventory | `InventoryMixin`, `InventoryLifecycleMixin`, `InventoryInboundWorkflowMixin`, `InventoryReservationMixin`, `InventoryReservationWorkflowMixin`, `InventoryCycleCountWorkflowMixin`, `InventoryCycleCountLineMixin`, `InventoryTransactionSafetyMixin`, `BatchTrackingMixin`, `SerialTrackingMixin` | entity has `quantity` field, or `features.stock_tracking/batch_tracking/serial_tracking/multi_location` |
| Invoice | `InvoiceMixin`, `InvoiceLifecycleMixin`, `InvoiceItemsMixin`, `InvoiceCalculationEngineMixin`, `InvoicePaymentWorkflowMixin`, `InvoiceNoteWorkflowMixin`, `InvoiceTransactionSafetyMixin`, `SalesOrderCommitmentMixin` | entity is the invoice header / item / payment |
| HR | `HREmployeeMixin`, `HREmployeeStatusMixin`, `HRDepartmentMixin`, `HRLeaveMixin`, `HRLeaveBalanceMixin`, `HRLeaveApprovalMixin`, `HRAttendanceTimesheetMixin`, `HRCompensationLedgerMixin` | entity is employee / leave / attendance / department |
| Cross-cutting | `AuditMixin`, `RelationRuleRunnerMixin`, `UserEmployeeLinkMixin`, `LocationMixin` | always (audit) / entity declares `relations[]` (rule runner) / user-employee linking enabled / multi-location |

**Ordering.** `mixinResolver.js` topologically sorts by `dependencies` with a `baseOrder` preference list that puts `RelationRuleRunnerMixin` last (it must observe other mixins' state changes).

**Aliases.** `MixinRegistry.NAME_ALIASES` maps SDF feature flag names to mixin filenames: `audit_trail` → `AuditMixin`, `stock_tracking` → `InventoryMixin`, `batch_tracking` → `BatchTrackingMixin`. Lets the SDF stay declarative without naming files.

### 6.4 Schema generation — [`schemaGenerator.js`](../platform/assembler/generators/backend/schemaGenerator.js)

Emits `001_initial_schema.sql` (and a couple of follow-up migrations) into the generated repository folder. Two dialects from one source:

| | Postgres | SQLite |
|---|---|---|
| Timestamps | `TIMESTAMPTZ DEFAULT NOW()` | `TEXT DEFAULT (datetime('now'))` |
| Booleans | `BOOLEAN` | `INTEGER` |
| Decimals | `NUMERIC(...)` | `REAL` |
| FKs | deferred via `DO $$ ... END $$;` | inline `FOREIGN KEY` |

**Draft awareness.** Entities whose `status` field includes `'Draft'` get NULLable FK columns — auto-draft POSTs insert before the user has filled in references. Composite indexes on `(foreign_key, status)` are added for performance.

**Follow-up migrations:** `002_committed_backfill.sql` zeros `committed_quantity` on stock entities (sales-order commitment prep). `003_relax_draft_fks.sql` (Postgres only) drops `NOT NULL` on FK columns for pre-existing databases — handles the Plan H upgrade case.

### 6.5 Route generation — [`routeGenerator.js`](../platform/assembler/generators/backend/routeGenerator.js)

Standard CRUD per entity: `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id`. Plus module-specific workflow routes:

| Module | Extra routes |
|---|---|
| Inventory | `/receive`, `/issue`, `/adjust`, `/transfer`, `/reservations`, cycle-count operations |
| Invoice | `/issue`, `/cancel`, `/payments`, `/notes` |
| HR | `/leave-balance`, `/approve`, `/reject`, `/record-attendance`, `/sync-timesheet`, `/compensate` |
| Auto-draft | `POST /draft` for entities with children + Draft status |

All routes wrap controller methods via `controller.runAction(req, res, methodName, ...)`. RBAC (when enabled) wraps with `requirePermission(slug)` middleware from [`brick-library/backend-bricks/rbac/`](../brick-library/backend-bricks/rbac).

### 6.6 Module-specific config

[`generators/backend/inventoryConfig.js`](../platform/assembler/generators/backend/inventoryConfig.js), `invoiceConfig.js`, `hrConfig.js` resolve "Priority A" configuration from the SDF — defaults like `stockEntity: 'products'`, `invoiceEntity: 'invoices'`, `employeeEntity: 'employees'`. [`mixinConfigBuilders.js`](../platform/assembler/generators/backend/mixinConfigBuilders.js) builds per-mixin payloads (e.g., `{ quantity_field, movement_types, allow_negative_stock }` for inventory transactions). These are passed as the `config` argument to `MixinRegistry.loadMixin(name, config, context)`.

> **Note on duplication.** There are *two* sets of inventory/invoice/hr config files: under `generators/backend/` (build mixin configs from SDF) and under `assembler/` (canonical SDF defaults, mixed onto `ProjectAssembler.prototype`). Same module, different layers — defaults live in one place, build-time decisions in the other.

---

## 7. Frontend generation — `FrontendGenerator`

Top-level: [`platform/assembler/generators/FrontendGenerator.js`](../platform/assembler/generators/FrontendGenerator.js) (748 lines). Module-specific generators under [`generators/frontend/`](../platform/assembler/generators/frontend).

### 7.1 Scaffold

```
frontend/
├── src/
│   ├── App.tsx                 (generated, with all routes)
│   ├── components/
│   │   ├── DynamicForm.tsx     (copied from brick-library, i18n labels baked)
│   │   ├── derivedFieldEvaluator.ts
│   │   ├── Sidebar.tsx, Topbar.tsx, StatusFormatter.tsx
│   │   └── layout/
│   ├── pages/
│   │   ├── DashboardHome.tsx, ReportsPage.tsx, ActivityLogPage.tsx
│   │   ├── LoginPage.tsx       (if RBAC)
│   │   └── admin/              (if RBAC: UsersAdminPage, GroupsAdminPage)
│   ├── modules/
│   │   ├── inventory/pages/    (per-entity List/Form/Ops/Labels/Import)
│   │   ├── invoice/pages/
│   │   └── hr/pages/
│   ├── config/entities.ts      (typed registry of entities)
│   ├── services/api.ts
│   ├── contexts/               (AuthContext, PermissionContext, if RBAC)
│   └── utils/
├── public/
├── index.html
├── package.json, vite.config.ts, tsconfig.json, tailwind.config.js
```

### 7.2 Per-entity page generation

[`generateEntityPage.js`](../platform/assembler/generators/frontend/generateEntityPage.js) (964 lines) is the workhorse. For each entity it can emit:

| Page | When | What |
|---|---|---|
| **ListPage** | always | Table with column defs, search bar, filter dropdowns, pagination, CRUD action buttons |
| **FormPage** | always | DynamicForm-driven create/edit. If entity has `children[]`, embeds inline child rows |
| **DetailsPage** | optional | Read-only detail view |
| **InventoryOpsPage** | stock entity | Receive / Issue / Transfer wizards |
| **LabelsPage** | inventory feature | Barcode / QR label printing |
| **ImportPage** | always | CSV upload with field mapping |

**Auto-draft mechanic.** Entities with children + a `Draft` status get a `POST /draft` call from `FormPage.tsx` on mount. The backend creates a placeholder row (autofilling required scalars with timestamped placeholders like `'FIELD-DRAFT-<ulid>'`), the form lets the user edit inline, and `PUT /:id` finalizes. This is what makes editing master/detail records (invoices with line items, GRNs with received lines) feel natural.

### 7.3 Module-specific pages

[`hrPages.js`](../platform/assembler/generators/frontend/hrPages.js) + [`hrPriorityPages.js`](../platform/assembler/generators/frontend/hrPriorityPages.js), and the same Invoice + Inventory pairs. The `Priority` variants wrap the generic page generator with module-specific config — if the SDF's module config specifies `leaveEntity: 'time_off'`, the priority generator uses that slug instead of the default `'leaves'`. "Priority" = module config takes precedence over SDF defaults.

### 7.4 The DynamicForm

[`brick-library/frontend-bricks/components/DynamicForm.tsx`](../brick-library/frontend-bricks/components/DynamicForm.tsx) is a real reusable React component, not a template. It reads field definitions (built by [`generateEntityPage.js`](../platform/assembler/generators/frontend/generateEntityPage.js) and [`fieldUtils.js`](../platform/assembler/generators/frontend/fieldUtils.js)) and renders the right widget per type — `Input`, `TextArea`, `NumberInput`, `Checkbox`, `DatePicker`, `Select`, `RadioGroup`, `EntitySelect`, `ComputedDisplay`. It auto-discovers `derivedFieldEvaluator.ts` for live recalculations of computed fields.

The form is **copied** into the generated app; i18n labels and validation messages are **baked at codegen time** so the running ERP needs no runtime translation library.

### 7.5 App, sidebar, topbar

- [`app.js`](../platform/assembler/generators/frontend/app.js) — generates `App.tsx`: react-router-dom v6 tree, route per entity per module, `RequireAuth` wrapper if RBAC enabled.
- [`sidebar.js`](../platform/assembler/generators/frontend/sidebar.js) — nav tree from the module map; system entities (`__*`) excluded.
- Topbar — project name, language toggle, user menu.
- [`dashboardHome.js`](../platform/assembler/generators/frontend/dashboardHome.js) — module-aware home with KPI cards.
- [`reportsPage.js`](../platform/assembler/generators/frontend/reportsPage.js) — time-travel diffs, valuation, low-stock summaries.
- [`rbacPages.js`](../platform/assembler/generators/frontend/rbacPages.js) — Users / Groups / Permissions admin (when access control on).
- [`activityLogPage.js`](../platform/assembler/generators/frontend/activityLogPage.js) — viewer for the `__audit_logs` table.

---

## 8. The brick library — what's actually consumed

### 8.1 Backend bricks ([`brick-library/backend-bricks/`](../brick-library/backend-bricks))

```
core/
├── BaseController.js.hbs   Handlebars template, hook markers for routes
└── BaseService.js.hbs      template with hooks: BEFORE_CREATE_VALIDATION,
                            BEFORE_UPDATE_VALIDATION, BEFORE_DELETE_VALIDATION,
                            AFTER_CREATE_LOGGING, ADDITIONAL_METHODS, ...

mixins/                     30+ feature modules (see §6.3)

repository/                 Three providers, one interface
├── RepositoryInterface.js  findAll, findById, create, update, delete
├── FlatFileProvider.js     JSON files in data/
├── SQLiteProvider.js       better-sqlite3 (used in standalone)
├── PostgresProvider.js     pg client
├── runMigrations.js        Postgres migration runner
└── runSQLiteMigrations.js  SQLite migration runner

rbac/
├── rbacMiddleware.js       rbacLoader (attaches user context),
│                            requirePermission(scope) (gates routes)
├── rbacRoutes.js           /auth/login, /auth/me, user/group admin
├── rbacSeed.js             bootstrap superadmin + admin groups
└── scopeEvaluator.js       evaluates self/department/manager_chain/module/all
```

### 8.2 Frontend bricks ([`brick-library/frontend-bricks/`](../brick-library/frontend-bricks))

```
components/
├── DynamicForm.tsx         metadata-driven form (see §7.4)
├── derivedFieldEvaluator.ts  live computed-field recalculation
├── ImportCsvTool.tsx       CSV import with field mapping
├── ImportCsvModal.tsx
├── Modal.tsx, toast.tsx
└── modules/                pre-built UI fragments per module

layouts/                    dashboard / sidebar shells
```

### 8.3 Templates ([`brick-library/templates/`](../brick-library/templates))

```
Dockerfile.template                Node.js container
docker-compose.template.yml        multi-service orchestration
package.json.template              backend deps
README.template.md                 deployment guide for the generated ERP
dev.{sh,ps1}.template              dev convenience scripts
index.js.template                  Express boot
standalone/                        standalone packaging starter
├── index.js.template
├── package.json.template
└── start.{sh,bat,command}         OS-specific launchers
```

---

## 9. i18n at generation time

The generated ERP is **bilingual at compile time, not runtime.** Translations are resolved during assembly and baked into the output. Source: [`platform/assembler/i18n/`](../platform/assembler/i18n).

| File | Role |
|---|---|
| `en.json` / `tr.json` | Canonical flat-key dictionaries: `entity.products.label`, `validation.required`, `sidebar.modules.inventory` |
| `glossary.tr.json` | Turkish overrides for entity/field names: `products` → "Ürünler" |
| `glossaryI18n.js` | `pickTrEntityDisplayName(slug, fromSdf)`, `pickTrFieldLabel(name, fromSdf)` |
| `labels.js` | `tFor(language)` factory: returns `(key, fallback) → string` |

**When translations are applied:**

- **SDF lint** ([`sdfLocalizationLint.js`](../platform/assembler/assembler/sdfLocalizationLint.js)) walks the SDF before validation and warns about un-keyed user-facing strings.
- **Backend validation codegen** resolves messages via `tFor(project.language)` at codegen time and emits literal strings into the JS — the running app never imports an i18n library.
- **Frontend codegen** does the same for entity display names, field labels, status labels, action labels, sidebar entries — all literals in the generated TypeScript.

The `language` propagates from `options.language || sdf.language || sdf.locale`, normalized via [`labels.js:normalizeLanguage`](../platform/assembler/i18n/labels.js).

---

## 10. Output structure

For a project with Inventory + Invoice + HR enabled and access control on, the assembler produces:

```
generated/<projectId>/
├── backend/                       (or app/ in standalone mode)
│   ├── src/
│   │   ├── index.js               Express boot
│   │   ├── controllers/<Entity>Controller.js   (per entity)
│   │   ├── services/<Entity>Service.js         (per entity, mixins injected)
│   │   ├── routes/
│   │   │   ├── index.js                         (aggregator + RBAC wrap)
│   │   │   └── <entity>Routes.js                (per entity)
│   │   ├── repository/
│   │   │   ├── db.js (PG) or sqliteDb.js
│   │   │   ├── <Provider>.js
│   │   │   └── migrations/
│   │   │       ├── 001_initial_schema.sql
│   │   │       ├── 002_committed_backfill.sql
│   │   │       └── 003_relax_draft_fks.sql
│   │   └── rbac/                                (if access_control.enabled)
│   ├── modules/{inventory,invoice,hr}/src/...
│   ├── package.json, Dockerfile, .env
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/   DynamicForm.tsx, Sidebar.tsx, Topbar.tsx, ...
│   │   ├── pages/        DashboardHome, Reports, ActivityLog, Login, admin/
│   │   ├── modules/{inventory,invoice,hr}/pages/...
│   │   ├── config/entities.ts
│   │   ├── services/api.ts
│   │   └── contexts/     AuthContext, PermissionContext (if RBAC)
│   ├── public/
│   ├── package.json, vite.config.ts, tsconfig.json, tailwind.config.js
│
├── docker-compose.yml
├── Dockerfile
├── README.md
└── .env
```

For **standalone** mode:

```
generated/<projectId>/
├── app/                                 same as backend/, plus:
│   └── public/                          built frontend (from vite build)
├── runtime/
│   └── bin/node                         platform-specific Node.js v20.18.1
├── app.db                               SQLite DB (created on first run)
├── start.sh / start.command / start.bat OS-specific launcher
└── .env                                 PORT=3000
```

The OS targets are `macos-arm64`, `macos-x64`, `linux-x64`, `windows-x64` ([`StandalonePackager.js`](../platform/assembler/StandalonePackager.js)).

---

## 11. Standalone packaging — `StandalonePackager`

[`platform/assembler/StandalonePackager.js`](../platform/assembler/StandalonePackager.js) (283 lines). Triggered via `POST /api/projects/:id/generate/standalone` or `options.standalone: true`.

Pipeline:

1. **`npm install`** in the assembled `app/` directory.
2. **`vite build`** the frontend, copy `dist/` into `app/public/`.
3. **Fetch Node.js binary** for the target platform from the official releases (cached in `~/.customeerp-standalone-cache/`).
4. **Swap better-sqlite3 native binary** — fetch the matching prebuilt for the target OS+arch from GitHub releases (the version of `better-sqlite3` installed on the build machine ships with native bindings for the *build* machine; we have to swap them for the *target*).
5. **Write launcher scripts** — `.bat` for Windows, `.command` for macOS, `.sh` for Linux — each one boots the bundled Node and serves on `PORT=3000`.
6. **Write `.env`** with the standalone defaults.

The result is a directory that runs without Docker, without an external Postgres, without Node installed on the target machine.

---

## 12. Extending the generator

### Add a new mixin

1. Create `brick-library/backend-bricks/mixins/<Name>Mixin.js` exporting `{ hooks, methods, dependencies }`. See [`AuditMixin.js`](../brick-library/backend-bricks/mixins/AuditMixin.js) as the canonical example.
2. (Optional) Add an alias in `MixinRegistry.NAME_ALIASES` ([`MixinRegistry.js:4-15`](../platform/assembler/MixinRegistry.js)) so the SDF can refer to it by feature flag name.
3. Add a resolution rule in [`mixinResolver.js`](../platform/assembler/generators/backend/mixinResolver.js) so it's attached when the right entity / module / feature is present.
4. (Optional) Add a config builder in [`mixinConfigBuilders.js`](../platform/assembler/generators/backend/mixinConfigBuilders.js) if the mixin needs SDF-derived configuration.
5. Drop a sample SDF that exercises it under `test/sample_sdf_*.json`.

### Add a new module

1. Add the module key to `ERP_MODULE_KEYS` in [`ProjectAssembler.js:7`](../platform/assembler/ProjectAssembler.js).
2. Create `platform/assembler/assembler/<module>Config.js` and `<module>Entities.js` with SDF defaults + system entity injection. Mix them in at the bottom of `ProjectAssembler.js`.
3. Create `platform/assembler/generators/backend/<module>Config.js` for build-time decisions, and module-specific page generators under `generators/frontend/`.
4. Add the module's mixins under `brick-library/backend-bricks/mixins/`.
5. Add validation rules in [`sdfValidation.js`](../platform/assembler/assembler/sdfValidation.js) to enforce required entities for that module.
6. Add the module's prompt context in [`platform/ai-gateway/src/prompts/`](../platform/ai-gateway/src/prompts) so the AI knows to emit it.

### Add a new field type / widget

1. Backend: add the type to validation generation in [`validationCodegen.js`](../platform/assembler/generators/backend/validationCodegen.js).
2. Backend: add the SQL mapping in [`schemaGenerator.js`](../platform/assembler/generators/backend/schemaGenerator.js) (both Postgres and SQLite branches).
3. Frontend: add the widget in [`DynamicForm.tsx`](../brick-library/frontend-bricks/components/DynamicForm.tsx).
4. Frontend: handle column rendering in the list-page template generated by [`generateEntityPage.js`](../platform/assembler/generators/frontend/generateEntityPage.js).
5. Update [`SDF_REFERENCE.md`](../SDF_REFERENCE.md).

### Add a new repository provider

1. Implement the contract in [`brick-library/backend-bricks/repository/RepositoryInterface.js`](../brick-library/backend-bricks/repository/RepositoryInterface.js).
2. Add a migration runner if the provider is SQL-based.
3. Wire selection in `BackendGenerator.scaffold()` based on SDF config.

---

## 13. File reference quick index

**Orchestration**
- [`platform/assembler/ProjectAssembler.js`](../platform/assembler/ProjectAssembler.js) — `assemble()` entry point
- [`platform/assembler/BrickRepository.js`](../platform/assembler/BrickRepository.js) — template loader
- [`platform/assembler/CodeWeaver.js`](../platform/assembler/CodeWeaver.js) — hook injection
- [`platform/assembler/MixinRegistry.js`](../platform/assembler/MixinRegistry.js) — mixin loader
- [`platform/assembler/TemplateEngine.js`](../platform/assembler/TemplateEngine.js) — `{{key}}` substitution
- [`platform/assembler/StandalonePackager.js`](../platform/assembler/StandalonePackager.js) — standalone bundling

**SDF preprocessing**
- [`platform/assembler/assembler/sdfValidation.js`](../platform/assembler/assembler/sdfValidation.js) — structural checks
- [`platform/assembler/assembler/sdfActorMigration.js`](../platform/assembler/assembler/sdfActorMigration.js) — actor field promotion
- [`platform/assembler/assembler/sdfLocalizationLint.js`](../platform/assembler/assembler/sdfLocalizationLint.js) — i18n key check
- [`platform/assembler/assembler/actorRegistry.js`](../platform/assembler/assembler/actorRegistry.js) — known actor specs
- [`platform/assembler/assembler/computedFieldRegistry.js`](../platform/assembler/assembler/computedFieldRegistry.js) — computed-field specs
- [`platform/assembler/assembler/systemAndRuntime.js`](../platform/assembler/assembler/systemAndRuntime.js) — system entity injection

**Backend generators**
- [`platform/assembler/generators/BackendGenerator.js`](../platform/assembler/generators/BackendGenerator.js)
- [`platform/assembler/generators/backend/schemaGenerator.js`](../platform/assembler/generators/backend/schemaGenerator.js)
- [`platform/assembler/generators/backend/routeGenerator.js`](../platform/assembler/generators/backend/routeGenerator.js)
- [`platform/assembler/generators/backend/validationCodegen.js`](../platform/assembler/generators/backend/validationCodegen.js)
- [`platform/assembler/generators/backend/mixinResolver.js`](../platform/assembler/generators/backend/mixinResolver.js)
- [`platform/assembler/generators/backend/mixinConfigBuilders.js`](../platform/assembler/generators/backend/mixinConfigBuilders.js)

**Frontend generators**
- [`platform/assembler/generators/FrontendGenerator.js`](../platform/assembler/generators/FrontendGenerator.js)
- [`platform/assembler/generators/frontend/generateEntityPage.js`](../platform/assembler/generators/frontend/generateEntityPage.js)
- [`platform/assembler/generators/frontend/{hr,invoice,inventory}Pages.js`](../platform/assembler/generators/frontend) + `*PriorityPages.js`
- [`platform/assembler/generators/frontend/dashboardHome.js`](../platform/assembler/generators/frontend/dashboardHome.js)
- [`platform/assembler/generators/frontend/sidebar.js`](../platform/assembler/generators/frontend/sidebar.js)
- [`platform/assembler/generators/frontend/rbacPages.js`](../platform/assembler/generators/frontend/rbacPages.js)
- [`platform/assembler/generators/frontend/fieldUtils.js`](../platform/assembler/generators/frontend/fieldUtils.js)

**Bricks**
- [`brick-library/backend-bricks/core/BaseController.js.hbs`](../brick-library/backend-bricks/core/BaseController.js.hbs)
- [`brick-library/backend-bricks/core/BaseService.js.hbs`](../brick-library/backend-bricks/core/BaseService.js.hbs)
- [`brick-library/backend-bricks/mixins/`](../brick-library/backend-bricks/mixins) — 30+ mixins
- [`brick-library/backend-bricks/repository/`](../brick-library/backend-bricks/repository) — 3 providers
- [`brick-library/backend-bricks/rbac/`](../brick-library/backend-bricks/rbac) — RBAC stack
- [`brick-library/frontend-bricks/components/DynamicForm.tsx`](../brick-library/frontend-bricks/components/DynamicForm.tsx)

**i18n**
- [`platform/assembler/i18n/{en,tr}.json`](../platform/assembler/i18n)
- [`platform/assembler/i18n/glossary.tr.json`](../platform/assembler/i18n/glossary.tr.json)
- [`platform/assembler/i18n/labels.js`](../platform/assembler/i18n/labels.js) — `tFor()` factory
- [`platform/assembler/i18n/glossaryI18n.js`](../platform/assembler/i18n/glossaryI18n.js) — Turkish overrides

---

## Cross-references

- [`Blueprint.md`](../Blueprint.md) §3.3–3.6 — coherence/wizard/localization/precheck layers
- [`Blueprint.md`](../Blueprint.md) §4 — high-level brick library + assembly logic
- [`SDF_REFERENCE.md`](../SDF_REFERENCE.md) — full SDF schema
- [`module_coherence_design.md`](../module_coherence_design.md) — relation rules and cross-module invariants
- [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) — where the generator sits in the system
- [`docs/prompt_expectations.md`](prompt_expectations.md) — how the AI is expected to shape SDFs the generator can consume
- [`CONTRIBUTING.md`](../CONTRIBUTING.md) §8 — adding a brick / mixin
