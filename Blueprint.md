# CustomERP Technical Blueprint

> **Architectural Blueprint for CustomERP** — the authoritative technical reference for the platform.
>
> This doc covers stable architecture. For the current state of shipped modules see §12; for in-flight work see `git log` and the issue tracker. For the SDF JSON contract see [`SDF_REFERENCE.md`](SDF_REFERENCE.md). For day-to-day onboarding see [`README.md`](README.md), [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), and [`CONTRIBUTING.md`](CONTRIBUTING.md).

---

## Table of Contents

1. [Project Mission & Core Philosophy](#1-project-mission--core-philosophy)
2. [Technical Stack](#2-technical-stack)
3. [System Architecture](#3-system-architecture)
4. [The Brick Library & Assembly Logic](#4-the-brick-library--assembly-logic)
5. [System Definition File (SDF) Specification](#5-system-definition-file-sdf-specification)
6. [Platform Database Schema](#6-platform-database-schema)
7. [Generated ERP Data Layer](#7-generated-erp-data-layer)
8. [API Specifications](#8-api-specifications)
9. [Use Case Workflows](#9-use-case-workflows)
10. [Component Architecture](#10-component-architecture)
11. [Security & Error Handling](#11-security--error-handling)
12. [Current State](#12-current-state)

---

## 1. Project Mission & Core Philosophy

### 1.1 The Assembly Paradigm

CustomERP is an **Orchestration & Assembly Engine**. Unlike traditional code generation tools that use AI to write code (which is prone to syntax errors and inconsistencies), CustomERP uses AI to **interpret** business requirements into a structured **System Definition File (SDF)**. The platform then **assembles** a functional ERP by selecting, configuring, and linking pre-written, high-quality "Technical Bricks" from a curated library.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        THE ASSEMBLY PARADIGM                           │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   ❌ Traditional: AI writes code → Syntax errors, inconsistencies     │
│                                                                        │
│   ✅ CustomERP:  AI fills a form (SDF) → Platform assembles bricks    │
│                                                                        │
│   "The AI is the Architect; the Platform is the Builder"              │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Design Principles

| Principle | Description |
|:----------|:------------|
| **Separation of Concerns** | AI interprets; Platform assembles; Bricks execute |
| **Repository Pattern** | All data access through abstracted interfaces |
| **Config-Driven UI** | Frontend renders based on metadata, not hardcoded layouts |
| **Strategy Pattern** | Business logic injected as swappable service mixins |
| **Future-Proofing** | DAL allows storage backend swap without code changes |

---

## 2. Technical Stack

### 2.1 Platform Components

| Layer | Technology | Version | Specification |
|:------|:-----------|:--------|:--------------|
| **Platform Core** | Node.js / Express.js | 20.x / 5.x | Manages project lifecycle, assembly engine, REST API |
| **Platform Database** | PostgreSQL | 16.x | Stores users, projects, SDFs, conversations, training data, audit logs |
| **AI Gateway** | Python / FastAPI / Google GenAI / Azure OpenAI | 3.11 / 0.115 / 0.8 / 1.40 | Translates natural language → SDF JSON |
| **Platform Frontend** | React / Vite / TypeScript / Tailwind | 18.3 / 6.x / 5.x / 3.x | Dashboard SPA, i18next (English + Turkish) |
| **Generated ERP (BE)** | Node.js / Express.js | 20.x / 5.x | Assembled from modular Service Bricks + Mixins |
| **Generated ERP (FE)** | React / Tailwind CSS | 18.x / 3.x | Assembled from Metadata-Aware Components |
| **Data Layer** | Flat-File / SQLite / PostgreSQL | — | Three providers shipped — selected per generated ERP |
| **Containerization** | Docker / Docker Compose | 24+ / 2.x | Artifact packaging and deployment |

### 2.2 External Dependencies

| Service | Purpose | Interface |
|:--------|:--------|:----------|
| **Google AI Studio (Gemini)** | NLP processing, entity extraction, SDF generation | HTTPS REST, JSON |
| **Azure OpenAI (alternative)** | Drop-in replacement for Gemini; supports reasoning models (gpt-5*, o-series) | HTTPS REST, JSON |
| **Docker Hub** | Base images (node:20-alpine, postgres:16-alpine, python:3.11-slim) | Docker pull |

---

## 3. System Architecture

### 3.1 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CUSTOM ERP PLATFORM                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │   React UI   │◀──▶│  Express.js  │◀──▶│  PostgreSQL  │                  │
│  │  (Dashboard) │    │   (API)      │    │  (Platform)  │                  │
│  └──────────────┘    └──────┬───────┘    └──────────────┘                  │
│                             │                                               │
│                             ▼                                               │
│  ┌──────────────────────────────────────────────────────┐                  │
│  │              CORE SERVICES                           │                  │
│  ├──────────────┬──────────────┬──────────────┬────────┤                  │
│  │ ProjectSvc   │ AIGateway    │ Assembler    │ Audit  │                  │
│  └──────────────┴──────┬───────┴──────┬───────┴────────┘                  │
│                        │              │                                     │
│                        ▼              ▼                                     │
│  ┌──────────────┐    ┌──────────────────────────┐                          │
│  │  AI Provider │    │     BRICK LIBRARY        │                          │
│  │ Gemini /     │    ├──────────────────────────┤                          │
│  │ Azure OpenAI │    │ • Backend Bricks         │                          │
│  │  (External)  │    │ • Frontend Bricks        │                          │
│  └──────────────┘    │ • Template Bricks        │                          │
│                      │ • Mixins (Inv/Inv/HR)    │                          │
│                      └────────────┬─────────────┘                          │
│                                   │                                         │
│                                   ▼                                         │
│  ┌──────────────────────────────────────────────────────┐                  │
│  │              GENERATED ERP ARTIFACT                  │                  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐ │                  │
│  │  │ Backend │  │Frontend │  │ Config  │  │  Data   │ │                  │
│  │  │  (JS)   │  │ (React) │  │ (JSON)  │  │ (JSON)  │ │                  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘ │                  │
│  │  └─────────────── Docker Container ─────────────────┘                  │
│  └──────────────────────────────────────────────────────┘                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Component Responsibilities

| Component | Responsibility |
|:----------|:---------------|
| **React Dashboard** | User interface for project management, description input, preview |
| **Express API** | RESTful endpoints, request validation, orchestration |
| **ProjectService** | CRUD for projects, status management, ownership |
| **AIServiceGateway** | Communication with Google Gemini API, prompt engineering |
| **SDFInterpreter** | Validates AI output against SDF schema requirements |
| **ProjectAssembler** | Reads SDF, selects bricks, generates artifacts |
| **BrickRepository** | File-system library of pre-written code templates |
| **AuditService** | Logging of all system events and user actions |
| **FlatFileRepository** | DAL implementation for JSON file storage |

### 3.3 Coherence Layer

Above the bricks sits a thin **coherence layer** that turns the SDF from a flat list of capabilities into an interconnected system. It is expressed declaratively in `entity.relations[]` (five primitives: `reference_contract`, `status_propagation`, `derived_field`, `invariant`, `permission_scope`) and interpreted at runtime by a single new factory mixin — `RelationRuleRunnerMixin` — which dispatches on relation kind via small in-memory libraries (invariants, derived-field formulas, status-propagation actions). A companion **actor migration** sweep (driven by `actorRegistry.js` plus `sdfActorMigration.js`) promotes every actor field — `requested_by`, `approver_id`, `posted_by`, etc. — to a `reference -> __erp_users` field with matching `reference_contract` and `permission_scope` relations, and ensures `__erp_users.employee_id` ↔ `employees.user_id` stay in sync via `UserEmployeeLinkMixin`. The result: a leave request is a real link to the user who submitted it, an approver's permission honors the manager chain, and the same status change that flips a leave to "approved" automatically materializes the right attendance rows — all without per-feature wiring in generated code. See `module_coherence_design.md` for the full rule library.

### 3.4 Wizard coherence (Plan C)

The wizard itself is now wired into the coherence layer through one declarative table: `platform/backend/src/defaultQuestions/dependencyGraph.js`. It enumerates `HARD_REQUIRES` (forward auto-enable + backward cascade-off — turning Leave Approvals on enables Leave Engine; turning Leave Engine off disables Leave Approvals), `FEEDS_HINTS` (advisory "this would amplify that" hints rendered next to questions), `LINK_TOGGLES` (the five new cross-pack `modules.<module>.<link>.enabled` keys, each fronted by a wizard question that only appears when both ends are on), and `ACTOR_DRIVEN_PACKS` (the set whose presence forces explicit `modules.access_control.enabled = true` in the prefilled SDF). The save endpoint normalises answers through `applyDependencyCoercion` and ships `coerced[]` events back — `{ key, was, now, direction: 'auto_enable' | 'cascade_off', driver, reason_key, question_id }` — which the frontend renders as inline notices. The same graph is shipped down on every state response so `dependencyMirror.ts` can re-run coercion client-side for instant feedback while the user is still clicking. Pack versions bumped to `hr.v3` / `invoice.v3` / `inventory.v4`; legacy pack rows still resolve so in-flight projects are not broken.

### 3.5 Localization enforcement (Plan D)

Plan D made customer-facing copy a first-class concern of the SDF pipeline. Three changes in concert:

1. **Codified key convention** — every user-facing string in an SDF (entity labels, field labels/help/placeholders, enum option labels, action labels/confirms, invariant messages, wizard prompts, status enum displays, generated backend validation messages) MUST resolve to a key in `platform/assembler/i18n/en.json` and its companion locale files. The full key naming convention is documented in [SDF_REFERENCE.md → "Localization keys (Plan D)"](SDF_REFERENCE.md).
2. **Assembler localization lint** — `platform/assembler/assembler/sdfLocalizationLint.js` walks the SDF, collects every user-facing string at the canonical paths, and flags anything that is neither a known dot-path key nor a value resolving in `en.json`. For non-English projects (`project.language !== 'en'`), unkeyed strings are a **block** error before final SDF acceptance; for English projects, they are warnings (the raw text is itself the en label, which is acceptable). The lint is wired into `_validateSdf` in `platform/assembler/assembler/sdfValidation.js`.
3. **Generated-code i18n** — frontend templates emit `t()` calls instead of hardcoded English strings (top ~15 offenders converted in `rbacPages` / `hrPages` / `inventoryPriorityPages` / `invoicePriorityPages` / `entityPages/formPage`). A new `statusFormatter.js` builder bakes a localized `STATUS_LABELS` dictionary into `src/utils/statusFormatter.ts` at codegen time so the generated frontend renders status enums in the project language. The backend `validationCodegen.js` resolves `validation.required` / `min_length` / `max_length` / `must_be_one_of` / `must_be_number` / `must_be_unique` at codegen time so the generated `validation.js` returns localized error messages.

Cross-cutting reinforcement: the AI language directive (`platform/ai-gateway/src/prompts/language_directive_*.txt`) explicitly forbids English label leakage in non-English projects and references the Plan D key convention. The combined effect is that any SDF reaching the assembler is guaranteed to be either fully keyed or composed of strings resolvable to canonical keys — every customer-facing surface in the generated ERP renders in the project's chosen language.

### 3.6 Module precheck (Plan D)

Plan D also adds an advisory **module precheck** + an **audit trail** for the existing user-selected_modules clamp. The user's specific concern — "how many people will use the system?" generic questions causing the AI to silently add HR — is solved by isolating the precheck endpoint at the prompt-input layer and adding a service-side regex defense for the residual cases.

```mermaid
sequenceDiagram
    participant UI as Wizard UI (ProjectDetailPage)
    participant BE as Backend (projectAiController.precheckModules)
    participant GW as AI Gateway (/ai/precheck_modules)
    participant LLM as LLM client (distributor config)

    UI->>UI: User edits business answers (description recomputed)
    UI->>UI: Debounce 1.2s on description / selectedModules change
    UI->>BE: POST /api/projects/:id/ai/precheck-modules<br/>{ description, selected_modules }
    BE->>BE: Project ownership check
    BE->>GW: POST /ai/precheck_modules<br/>{ business_description, selected_modules, language }
    Note over GW: NO default_question_answers<br/>NO wizard metadata<br/>(platform-meta cues blocked at the source)
    GW->>LLM: module_precheck_prompt.txt<br/>(SIGNALS + GUARD)
    LLM-->>GW: { inferred_modules: [...] }
    GW->>GW: PrecheckService._normalize<br/>+ _looks_like_platform_meta regex
    GW-->>BE: PrecheckResponse (filtered)
    BE-->>UI: same shape
    UI->>UI: Render dismissable banner above business questions<br/>[Add module] / [Continue without it] / ×

    Note over UI,GW: --- Pre-Analyze trigger ---
    UI->>BE: One final precheck on Analyze click (advisory; never blocks)
    UI->>BE: POST /api/projects/:id/analyze (selected_modules confirmed)

    Note over GW: --- Audit trail (defense-in-depth) ---
    GW->>GW: Distributor still inferred a module the user didn't select?<br/>Orchestration clamp drops it silently.
    GW->>GW: Postfilter in sdf_service drops anything residual.
    GW->>BE: SDF carries inferred_dropped_modules: [<slug>, ...]
    BE->>BE: SDF.create persists field in JSONB column
    UI->>UI: SdfPreviewSection renders "Modules left out" panel
```

Two layers of false-positive defense in the gateway:

1. **Prompt GUARD** — `platform/ai-gateway/src/prompts/module_precheck_prompt.txt` enumerates banned cues ("X people will use the system", "logins for our team", Turkish equivalents) and forbids the LLM from inferring HR / Invoice / Inventory from platform-usage language.
2. **Service-level regex** — `PrecheckService._looks_like_platform_meta` strips suggestions whose `reason` text matches platform-meta patterns even when the LLM disregards the prompt's GUARD. The endpoint accepts ONLY the description + selected modules, so wizard answers (the original false-positive vector) cannot enter the prompt at all.

The audit field `sdf.inferred_dropped_modules: List[str]` carries the union of orchestration-clamp and postfilter drops so the user can audit what was clamped — never a hard block, always advisory. The backend persists it through the SDF JSONB column and the frontend's generation report renders it as a "Modules left out" panel.

---

## 4. The Brick Library & Assembly Logic

### 4.1 Brick Categories

The Brick Library contains pre-written, tested code modules. Three flavors:

```
brick-library/
├── backend-bricks/
│   ├── core/                         # CRUD scaffolding templates
│   │   ├── BaseController.js.hbs
│   │   └── BaseService.js.hbs
│   ├── rbac/                         # Role-based access control
│   │   ├── rbacMiddleware.js
│   │   ├── rbacRoutes.js
│   │   ├── rbacSeed.js
│   │   └── scopeEvaluator.js
│   ├── repository/                   # Pluggable storage providers
│   │   ├── RepositoryInterface.js
│   │   ├── FlatFileProvider.js       # JSON-on-disk
│   │   ├── SQLiteProvider.js         # Embedded SQLite (standalone packaging)
│   │   ├── PostgresProvider.js       # PostgreSQL
│   │   ├── runMigrations.js
│   │   └── runSQLiteMigrations.js
│   └── mixins/                       # 30+ reusable feature modules
│       ├── Inventory: InventoryMixin, InventoryInboundWorkflow,
│       │             InventoryReservationWorkflow, InventoryCycleCount,
│       │             InventoryTransactionSafety, InventoryLifecycle,
│       │             InventoryReservation, BatchTracking, SerialTracking,
│       │             InventoryCycleCountLine
│       ├── Invoice:   InvoiceMixin, InvoiceCalculationEngine,
│       │             InvoicePaymentWorkflow, InvoiceNoteWorkflow,
│       │             InvoiceTransactionSafety, InvoiceLifecycle,
│       │             InvoiceItems, SalesOrderCommitment
│       ├── HR:        HREmployeeMixin, HREmployeeStatus, HRDepartment,
│       │             HRLeaveMixin, HRLeaveBalance, HRLeaveApproval,
│       │             HRAttendanceTimesheet, HRCompensationLedger
│       └── Cross-cut: AuditMixin, RelationRuleRunnerMixin,
│                     UserEmployeeLinkMixin, LocationMixin
│
├── frontend-bricks/
│   ├── components/
│   │   ├── DynamicForm.tsx           # Metadata-driven form builder
│   │   ├── ImportCsvTool.tsx         # CSV import with field mapping
│   │   ├── derivedFieldEvaluator.ts  # Computed columns
│   │   ├── modules/                  # Pre-built UI per module
│   │   │   ├── inventory/
│   │   │   ├── invoice/
│   │   │   └── hr/
│   │   └── ...modal, toast, helpers
│   └── layouts/                      # Dashboard, sidebar, navigation
│
└── templates/
    ├── Dockerfile.template
    ├── docker-compose.template.yml
    ├── dev.{sh,ps1}.template
    ├── index.js.template
    ├── package.json.template
    ├── README.template.md
    └── standalone/                   # Self-contained executable starter
        ├── index.js.template
        ├── package.json.template
        └── start.{sh,bat,command}    # OS-specific launchers
```

### 4.2 Backend Assembly: The Strategy Pattern

Instead of one monolithic controller, the backend uses **composition over inheritance**:

```javascript
// Assembly Logic (Pseudocode)
function assembleController(sdf, entity) {
  const controller = copy(BaseController);
  
  if (entity.features.stock_tracking) {
    inject(controller, StockValidationLogic);
    inject(controller, InventoryService);
  }
  
  if (entity.features.low_stock_threshold) {
    inject(controller, AlertTriggerLogic);
  }
  
  if (sdf.assembly_hints.include_services.includes('AuditLogger')) {
    inject(controller, AuditTrailLogic);
  }
  
  return controller;
}
```

**How it works:**
1. The Assembler reads `assembly_hints` from the SDF
2. It copies the `BaseController.js` template
3. It injects required service mixins based on SDF flags
4. The final controller is written to the output folder

### 4.3 Frontend Assembly: Metadata-Driven UI (CDUI)

The UI is not hardcoded—it uses a **Config-Driven UI** approach:

```javascript
// ui-config.json (Generated by Assembler)
{
  "entities": {
    "product": {
      "display_name": "Electronic Items",
      "view_component": "InventoryDashboard",
      "fields": [
        { "key": "serial_no", "label": "Serial Number", "type": "text" },
        { "key": "quantity", "label": "In Stock", "type": "number" },
        { "key": "price", "label": "Price ($)", "type": "currency" }
      ],
      "features": {
        "show_alerts": true,
        "alert_threshold": 5
      }
    }
  },
  "navigation": [
    { "path": "/products", "label": "Products", "icon": "box" }
  ]
}
```

**At Runtime:**
1. React app loads `ui-config.json`
2. `EntityRegistry` maps entity slugs to component bricks
3. Components render dynamically based on field definitions
4. User-defined fields (e.g., "Weight", "Color") appear automatically

---

## 5. System Definition File (SDF) Specification

The SDF is the "Form" that the AI fills out. It defines the assembly instructions for the entire generated ERP.

### 5.1 Complete SDF Schema

```json
{
  "$schema": "https://customwerp.io/schemas/sdf-v1.json",
  "version": "1.0",
  "project": {
    "name": "My Electronics Shop",
    "description": "Inventory tracking for phone and accessories retail",
    "generated_at": "2026-01-01T12:00:00Z"
  },
  "entities": [
    {
      "slug": "product",
      "display_name": "Electronic Item",
      "description": "Items tracked in inventory",
      "fields": [
        {
          "name": "id",
          "type": "uuid",
          "required": true,
          "auto_generated": true
        },
        {
          "name": "name",
          "type": "string",
          "required": true,
          "max_length": 255
        },
        {
          "name": "serial_no",
          "type": "string",
          "required": true,
          "unique": true
        },
        {
          "name": "price",
          "type": "decimal",
          "precision": 10,
          "scale": 2
        },
        {
          "name": "quantity",
          "type": "integer",
          "default": 0,
          "min": 0
        },
        {
          "name": "category_id",
          "type": "reference",
          "references": "category"
        }
      ],
      "features": {
        "stock_tracking": true,
        "low_stock_threshold": 5,
        "audit_trail": true
      }
    },
    {
      "slug": "category",
      "display_name": "Product Category",
      "description": "Grouping for products",
      "fields": [
        {
          "name": "id",
          "type": "uuid",
          "required": true,
          "auto_generated": true
        },
        {
          "name": "name",
          "type": "string",
          "required": true
        }
      ],
      "features": {}
    }
  ],
  "relations": [
    {
      "name": "product_category",
      "type": "many-to-one",
      "source": "product",
      "target": "category",
      "source_field": "category_id"
    }
  ],
  "assembly_hints": {
    "modules": ["inventory"],
    "include_services": [
      "InventoryService",
      "StockValidationLogic",
      "AlertTriggerLogic",
      "AuditTrailLogic"
    ],
    "frontend_layout": "InventoryDashboard",
    "data_layer": "flat-file"
  },
  "clarifications": [
    {
      "question_id": "q1",
      "question": "Do your products have unique serial numbers?",
      "answer": "Yes, each item has a serial number",
      "impact": "Added serial_no field with unique constraint"
    }
  ]
}
```

### 5.2 Field Type Reference

| Type | Description | Validation |
|:-----|:------------|:-----------|
| `uuid` | Unique identifier | Auto-generated if `auto_generated: true` |
| `string` | Text field | `max_length`, `min_length`, `pattern` |
| `integer` | Whole number | `min`, `max` |
| `decimal` | Floating point | `precision`, `scale` |
| `boolean` | True/False | — |
| `date` | Date only | `format: YYYY-MM-DD` |
| `datetime` | Date and time | `format: ISO8601` |
| `reference` | Foreign key | `references: entity_slug` |
| `enum` | Predefined options | `options: [...]` |

### 5.3 Feature Flags

| Flag | Effect on Assembly |
|:-----|:-------------------|
| `stock_tracking: true` | Injects `InventoryService`, adds quantity decrement logic |
| `low_stock_threshold: N` | Injects `AlertTriggerLogic`, triggers when qty < N |
| `audit_trail: true` | Injects `AuditTrailLogic`, logs all CRUD operations |
| `unique_serial: true` | Adds unique constraint to serial field |

---

## 6. Platform Database Schema

The CustomERP platform (not the generated ERP) uses PostgreSQL to manage its own data:

### 6.1 Entity-Relationship Diagram

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│    USERS     │       │    ROLES     │       │  USER_ROLES  │
├──────────────┤       ├──────────────┤       ├──────────────┤
│ user_id (PK) │──┐    │ role_id (PK) │──┐    │ user_id (FK) │
│ name         │  │    │ name         │  │    │ role_id (FK) │
│ email        │  │    │ description  │  │    └──────────────┘
│ password_hash│  │    └──────────────┘  │           │
│ created_at   │  │                      │           │
└──────────────┘  │                      │           │
       │          └──────────────────────┴───────────┘
       │
       ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│   PROJECTS   │──────▶│    SDFS      │──────▶│ SDF_ENTITIES │
├──────────────┤       ├──────────────┤       ├──────────────┤
│ project_id   │       │ sdf_id (PK)  │       │ entity_id(PK)│
│ owner_id(FK) │       │ project_id   │       │ sdf_id (FK)  │
│ name         │       │ version      │       │ name         │
│ status       │       │ created_at   │       └──────┬───────┘
│ created_at   │       └──────────────┘              │
│ updated_at   │                                     ▼
└──────────────┘                            ┌──────────────┐
       │                                    │SDF_ATTRIBUTES│
       │                                    ├──────────────┤
       ▼                                    │ attribute_id │
┌──────────────┐       ┌──────────────┐     │ entity_id(FK)│
│  APPROVALS   │       │ LOG_ENTRIES  │     │ name         │
├──────────────┤       ├──────────────┤     │ data_type    │
│ approval_id  │       │ log_id (PK)  │     └──────────────┘
│ project_id   │       │ project_id   │
│ user_id      │       │ user_id      │     ┌──────────────┐
│ decision     │       │ level        │     │SDF_RELATIONS │
│ timestamp    │       │ message      │     ├──────────────┤
└──────────────┘       │ created_at   │     │ relation_id  │
                       └──────────────┘     │ sdf_id (FK)  │
                                            │ name         │
┌──────────────┐       ┌──────────────┐     │ relation_type│
│  QUESTIONS   │──────▶│   ANSWERS    │     │ source_entity│
├──────────────┤       ├──────────────┤     │ target_entity│
│ question_id  │       │ answer_id    │     └──────────────┘
│ project_id   │       │ question_id  │
│ text         │       │ project_id   │
│ created_at   │       │ text         │
└──────────────┘       │ created_at   │
                       └──────────────┘

┌──────────────┐       ┌──────────────┐     ┌──────────────┐
│   MODULES    │──────▶│SCHEMA_ARTFCTS│     │GENERATION_JOB│
├──────────────┤       ├──────────────┤     ├──────────────┤
│ module_id    │       │ artifact_id  │     │ job_id (PK)  │
│ project_id   │       │ module_id    │     │ project_id   │
│ name         │       │ path         │     │ status       │
│ type         │       │ format       │     │ started_at   │
└──────────────┘       └──────────────┘     │ finished_at  │
                                            │ error_message│
                                            └──────────────┘
```

### 6.2 Table Definitions

```sql
-- Core User Management
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE roles (
    role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT
);

CREATE TABLE user_roles (
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(role_id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- Project Management
CREATE TABLE projects (
    project_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'Draft', -- Draft, Analyzing, Generated, Approved
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SDF Storage
CREATE TABLE sdfs (
    sdf_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    version INTEGER DEFAULT 1,
    sdf_json JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sdf_entities (
    entity_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sdf_id UUID REFERENCES sdfs(sdf_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE sdf_attributes (
    attribute_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID REFERENCES sdf_entities(entity_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    data_type VARCHAR(50) NOT NULL
);

CREATE TABLE sdf_relations (
    relation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sdf_id UUID REFERENCES sdfs(sdf_id) ON DELETE CASCADE,
    name VARCHAR(255),
    relation_type VARCHAR(50), -- one-to-one, one-to-many, many-to-many
    source_entity_id UUID REFERENCES sdf_entities(entity_id),
    target_entity_id UUID REFERENCES sdf_entities(entity_id)
);

-- Clarification Dialogue
CREATE TABLE questions (
    question_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE answers (
    answer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID REFERENCES questions(question_id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Generation Artifacts
CREATE TABLE modules (
    module_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) -- inventory, customer, invoicing
);

CREATE TABLE schema_artifacts (
    artifact_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id UUID REFERENCES modules(module_id) ON DELETE CASCADE,
    path VARCHAR(500) NOT NULL,
    format VARCHAR(50) -- json, js, jsx, yml
);

CREATE TABLE generation_jobs (
    job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending', -- pending, running, completed, failed
    started_at TIMESTAMP,
    finished_at TIMESTAMP,
    error_message TEXT
);

-- Audit & Approval
CREATE TABLE approvals (
    approval_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    decided_by_user_id UUID REFERENCES users(user_id),
    decision VARCHAR(50), -- approved, rejected, revision_requested
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE log_entries (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(project_id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    level VARCHAR(20), -- info, warn, error
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 6.3 Schema evolution (migrations 002–017)

The base schema above is migration `001`. Sixteen further migrations have shipped — see `platform/backend/migrations/` for the canonical source:

| # | What it adds |
|---|---|
| 002 | Soft-delete columns (`is_deleted`) on core tables |
| 003 | Review workflow (`reviews`, status transitions) |
| 004 | Mode flag and `project_conversations` table |
| 005 | Fix soft-delete columns |
| 006 | `admin_flag` on users |
| 007 | `training_data` table for prompt-tuning feedback |
| 008 | Corrective-instruction column on training data |
| 009 | `feature_requests` table |
| 010 | Feature-request enhancements + `feature_request_messages` |
| 011 | `training_step_reviews` |
| 012 | Fix `feature_request.source` |
| 013 | `user_blocks` (admin moderation) |
| 014 | `user_language` preference |
| 015 | `project_language` preference |
| 016 | `answer_review` |
| 017 | Bilingual `feature_requests` (`name_en`, `name_native`, `language`) |

The ERD in §6.1 shows the original spine; treat the migration files as authoritative for current shape.

---

## 7. Generated ERP Data Layer

### 7.1 Data Access Layer (DAL) Architecture

The generated ERP uses a **Repository Pattern** to abstract data storage:

```javascript
// RepositoryInterface.js (Contract)
class RepositoryInterface {
  async findAll(entitySlug) { throw new Error('Not implemented'); }
  async findById(entitySlug, id) { throw new Error('Not implemented'); }
  async create(entitySlug, data) { throw new Error('Not implemented'); }
  async update(entitySlug, id, data) { throw new Error('Not implemented'); }
  async delete(entitySlug, id) { throw new Error('Not implemented'); }
}
```

Three concrete providers ship today; the assembler picks one per generated ERP based on SDF configuration:

| Provider | File | When |
|---|---|---|
| **Flat-File** | `FlatFileProvider.js` | Quick prototypes, demo mode |
| **SQLite** | `SQLiteProvider.js` | Standalone packaging (single-file embedded DB, runs without external services) |
| **PostgreSQL** | `PostgresProvider.js` | Multi-user / production deployments |

Migration runners ship alongside the SQL providers (`runMigrations.js`, `runSQLiteMigrations.js`).

### 7.2 Flat-File Provider

```javascript
// FlatFileProvider.js
class FlatFileProvider extends RepositoryInterface {
  constructor(dataPath = './data') {
    super();
    this.dataPath = dataPath;
  }

  _getFilePath(entitySlug) {
    return path.join(this.dataPath, `${entitySlug}.json`);
  }

  async findAll(entitySlug) {
    const filePath = this._getFilePath(entitySlug);
    if (!fs.existsSync(filePath)) return [];
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  }

  async create(entitySlug, data) {
    const items = await this.findAll(entitySlug);
    const newItem = { id: uuid(), ...data, created_at: new Date().toISOString() };
    items.push(newItem);
    await fs.writeFile(this._getFilePath(entitySlug), JSON.stringify(items, null, 2));
    return newItem;
  }

  // ... update, delete implementations
}
```

### 7.3 Generated Data Structure

```
generated-erp/
└── data/
    ├── product.json       # [{ id, name, serial_no, price, quantity, ... }]
    ├── category.json      # [{ id, name }]
    └── _audit_log.json    # [{ entity, action, data, timestamp }]
```

### 7.4 SQL Providers (SQLite & PostgreSQL)

```javascript
// PostgresProvider.js (sketch)
class PostgresProvider extends RepositoryInterface {
  constructor(connectionString) {
    super();
    this.pool = new Pool({ connectionString });
  }

  async findAll(entitySlug) {
    const result = await this.pool.query(`SELECT * FROM ${entitySlug}`);
    return result.rows;
  }
  // ... other methods using parameterised SQL
}

// SQLiteProvider.js — same shape, embedded better-sqlite3 backend.
// Used by StandalonePackager.js to ship a generated ERP as a single
// executable with no external DB dependency.
```

**Why three?** They share `RepositoryInterface`, so business-logic bricks don't care which one is wired in. Swap is a one-line config change in the generated ERP.

---

## 8. API Specifications

### 8.1 Platform API Endpoints

Routes mounted from `platform/backend/src/routes/`: `authRoutes`, `projectRoutes`, `previewRoutes`, `adminRoutes`, `featureRequestRoutes`, `trainingRoutes`.

**Auth** (`authRoutes.js`)

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `POST` | `/api/auth/register` | Create new user account |
| `POST` | `/api/auth/login` | Authenticate and receive JWT |
| `GET` | `/api/auth/me` | Current user from token |

**Projects** (`projectRoutes.js`)

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `GET` | `/api/projects` | List user's projects |
| `POST` | `/api/projects` | Create new project |
| `GET\|PUT\|DELETE` | `/api/projects/:id` | Project CRUD |
| `POST` | `/api/projects/:id/analyze` | Send description to AI |
| `POST` | `/api/projects/:id/clarify` | Submit clarification answer |
| `POST` | `/api/projects/:id/chat` | Conversational refinement |
| `POST` | `/api/projects/:id/ai/precheck-modules` | Module feasibility precheck |
| `GET` | `/api/projects/:id/sdf/latest` | Get latest SDF |
| `POST` | `/api/projects/:id/sdf/save` | Persist SDF revision |
| `POST` | `/api/projects/:id/sdf/ai-edit` | Targeted AI rewrite of SDF section |
| `POST` | `/api/projects/:id/generate` | Assemble + zip standard ERP |
| `POST` | `/api/projects/:id/generate/standalone` | Assemble standalone executable |
| `POST` | `/api/projects/:id/regenerate` | Regenerate from current SDF |
| `GET` | `/api/projects/:id/download` | Download generated artifact |
| `POST` | `/api/projects/:id/approve` | Approval workflow |
| `*` | `/api/projects/:id/reviews/...` | Review workflow |

**Preview proxy** (`previewRoutes.js`)

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `*` | `/preview/:previewId/...` | Token-gated reverse proxy to a locally running generated ERP |

**Admin / training / feature requests** — see `adminRoutes.js`, `trainingRoutes.js`, `featureRequestRoutes.js` for moderation, feedback collection, and user-submitted feature requests.

### 8.2 Generated ERP API Endpoints (Template)

For each entity in the SDF, the assembler generates:

| Method | Endpoint | Operation |
|:-------|:---------|:----------|
| `GET` | `/api/{entity}` | List all records |
| `GET` | `/api/{entity}/:id` | Get single record |
| `POST` | `/api/{entity}` | Create record |
| `PUT` | `/api/{entity}/:id` | Update record |
| `DELETE` | `/api/{entity}/:id` | Delete record |

**Example for `product` entity:**
```
GET    /api/products         → List all products
GET    /api/products/abc-123 → Get product by ID
POST   /api/products         → Create product
PUT    /api/products/abc-123 → Update product
DELETE /api/products/abc-123 → Delete product
```

### 8.3 AI Gateway API

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `GET` | `/health` | Service status |
| `POST` | `/ai/precheck_modules` | Feasibility check before analysis |
| `POST` | `/ai/analyze` | First-pass SDF (entities, fields, relations) |
| `POST` | `/ai/clarify` | Refine via Q&A |
| `POST` | `/ai/finalize` | Polish, normalize, lint |
| `POST` | `/ai/edit` | Targeted rewrite of an existing SDF section |
| `POST` | `/ai/chat` | Conversational mode (streaming) |
| `GET` | `/ai/progress/{project_id}` | Generation progress tracker |
| `GET` | `/ai/training/{sessions, sessions/:id, stats}` | Training-data inspection |

**Request/Response Example:**

```json
// POST /ai/analyze
// Request:
{
  "project_id": "uuid",
  "description": "We run a small electronics shop...",
  "prior_answers": []
}

// Response:
{
  "status": "needs_clarification",
  "questions": [
    {
      "id": "q1",
      "text": "Do your products have unique serial numbers?",
      "type": "yes_no"
    }
  ],
  "partial_sdf": { ... }
}
```

---

## 9. Use Case Workflows

> **Scope note.** §9 documents the original UC-1 through UC-6 spine (intake → generation → review). The working test suite has grown to UC-1 through UC-13 — see [`tests/UnitTests/`](tests/UnitTests) for the full list, and [`docs/customerp_use_cases.md`](docs/customerp_use_cases.md) for a current catalog. The diagrams below remain accurate for the core flow.

### 9.1 UC-1 to UC-3: Project Intake & SDF Generation

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PROJECT INTAKE & SDF GENERATION                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [User opens Dashboard]                                                 │
│         │                                                               │
│         ▼                                                               │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐               │
│  │ UC-1: View  │────▶│ UC-2: Create│────▶│ UC-3: Chat  │               │
│  │ Project List│     │ New Project │     │ Generate SDF│               │
│  └─────────────┘     └─────────────┘     └──────┬──────┘               │
│                                                  │                      │
│                                    ┌─────────────┼─────────────┐       │
│                                    │             ▼             │       │
│                                    │    [Send to Gemini AI]   │       │
│                                    │             │             │       │
│                                    │             ▼             │       │
│                                    │    ┌───────────────┐     │       │
│                                    │    │Need Clarify?  │     │       │
│                                    │    └───────┬───────┘     │       │
│                                    │      Yes   │   No        │       │
│                                    │       │    │    │        │       │
│                                    │       ▼    │    ▼        │       │
│                                    │  [Ask User]│ [Save SDF]  │       │
│                                    │       │    │    │        │       │
│                                    │       └────┼────┘        │       │
│                                    │            │             │       │
│                                    └────────────┼─────────────┘       │
│                                                 │                      │
│                                                 ▼                      │
│                                    [Ready for Generation]              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 9.2 UC-4 to UC-6: Inventory Generation & Review

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    INVENTORY GENERATION & REVIEW                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [SDF Ready]                                                            │
│       │                                                                 │
│       ▼                                                                 │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │ UC-4: Generate Inventory Schema & CRUD                       │      │
│  ├──────────────────────────────────────────────────────────────┤      │
│  │  1. Load SDF from database                                   │      │
│  │  2. Validate inventory section completeness                  │      │
│  │  3. Call InventoryGenerator.generate(sdf)                    │      │
│  │     ├─ Write flat-file schemas                               │      │
│  │     ├─ Generate CRUD scaffolds                               │      │
│  │     ├─ Generate API contracts                                │      │
│  │     └─ Generate visualization data                           │      │
│  │  4. Store artifacts in SCHEMA_ARTIFACTS table                │      │
│  └──────────────────────────────────────────────────────────────┘      │
│       │                                                                 │
│       ▼                                                                 │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │ UC-5: Review Inventory Schema & API Summary                  │      │
│  ├──────────────────────────────────────────────────────────────┤      │
│  │  • Display entity list with attributes                       │      │
│  │  • Show relationship diagram (ERD-style)                     │      │
│  │  • Present API endpoint summary                              │      │
│  │  • Allow non-breaking label edits                            │      │
│  └──────────────────────────────────────────────────────────────┘      │
│       │                                                                 │
│       ▼                                                                 │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │ UC-6: Approve or Edit Inventory Module                       │      │
│  ├──────────────────────────────────────────────────────────────┤      │
│  │  [User Decision]                                             │      │
│  │       │                                                      │      │
│  │  ┌────┴────┐                                                 │      │
│  │  │         │                                                 │      │
│  │  ▼         ▼                                                 │      │
│  │ [Approve] [Request Edit]                                     │      │
│  │   │           │                                              │      │
│  │   │           └──▶ Return to UC-5                           │      │
│  │   ▼                                                          │      │
│  │ [Lock Config, Log Decision]                                  │      │
│  │   │                                                          │      │
│  │   ▼                                                          │      │
│  │ [Package for Download]                                       │      │
│  └──────────────────────────────────────────────────────────────┘      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 9.3 State Diagram: Project Lifecycle

```
                    ┌─────────────────────────────────────────────┐
                    │                                             │
                    ▼                                             │
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  DRAFT  │───▶│ANALYZING│───▶│CLARIFY  │───▶│GENERATED│───▶│APPROVED │
└─────────┘    └─────────┘    └────┬────┘    └────┬────┘    └─────────┘
     │              │              │              │
     │              │              │              │
     │              ▼              │              ▼
     │         ┌─────────┐        │         ┌─────────┐
     │         │  ERROR  │        │         │ REVISION│
     │         └─────────┘        │         │REQUESTED│
     │                            │         └────┬────┘
     │                            │              │
     └────────────────────────────┴──────────────┘
                     (User can restart)
```

---

## 10. Component Architecture

### 10.1 Platform Service Classes

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PLATFORM SERVICES                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────┐                                                    │
│  │  ProjectService │─────────────────────────────────────────┐         │
│  ├─────────────────┤                                         │         │
│  │ + createProject()                                         │         │
│  │ + getProjects(userId)                                     │         │
│  │ + updateStatus(projectId, status)                         │         │
│  │ + getProjectWithSDF(projectId)                            │         │
│  └─────────────────┘                                         │         │
│                                                              │         │
│  ┌─────────────────┐     ┌─────────────────┐                 │         │
│  │AIServiceGateway │────▶│ Gemini / OpenAI │                │         │
│  ├─────────────────┤     │   (External)    │                │         │
│  │ + analyze(desc) │     └─────────────────┘                │         │
│  │ + clarify(q, a) │                                        │         │
│  │ + finalize()    │                                        │         │
│  └─────────────────┘                                        │         │
│                                                               │         │
│  ┌─────────────────┐     ┌─────────────────┐                │         │
│  │SDFInterpreter   │     │InventoryGen    │                │         │
│  ├─────────────────┤     ├─────────────────┤                │         │
│  │ + validate(sdf) │     │ + generate(sdf) │                │         │
│  │ + extractHints()│     │ + writeBricks() │                │         │
│  └─────────────────┘     │ + writeConfig() │                │         │
│                          └────────┬────────┘                │         │
│  ┌─────────────────┐              │                         │         │
│  │  AuditService   │              ▼                         │         │
│  ├─────────────────┤     ┌─────────────────┐                │         │
│  │ + log(event)    │     │ BrickRepository │                │         │
│  │ + getHistory()  │     ├─────────────────┤                │         │
│  └─────────────────┘     │ + getBrick(name)│                │         │
│                          │ + listBricks()  │                │         │
│                          └─────────────────┘                │         │
│                                                               │         │
│  ┌─────────────────┐                                         │         │
│  │FlatFileRepo     │◀────────────────────────────────────────┘         │
│  ├─────────────────┤     (Implements DAL for generated ERP)            │
│  │ + saveSDF()     │                                                    │
│  │ + loadSDF()     │                                                    │
│  └─────────────────┘                                                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 10.2 Frontend Component Hierarchy

```
App
├── AuthProvider (Context)
│   ├── LoginPage
│   └── RegisterPage
│
└── DashboardLayout
    ├── Sidebar
    │   ├── ProjectList
    │   └── NewProjectButton
    │
    ├── MainContent
    │   ├── ProjectDashboard
    │   │   ├── DescriptionInput
    │   │   ├── AnalysisStatus
    │   │   └── ClarificationDialog
    │   │
    │   ├── PreviewPane
    │   │   ├── SchemaVisualization (ERD)
    │   │   ├── APIEndpointList
    │   │   └── EntityFieldEditor
    │   │
    │   └── ApprovalPanel
    │       ├── ApproveButton
    │       ├── RequestEditButton
    │       └── DownloadButton
    │
    └── AssistantPanel
        ├── StatusIndicator
        └── GuidanceMessages
```

---

## 11. Security & Error Handling

### 11.1 Security Measures

| Layer | Measure |
|:------|:--------|
| **Authentication** | JWT tokens with 24h expiry |
| **Password Storage** | bcrypt hashing with individual salts |
| **API Communication** | HTTPS only, TLS 1.3 |
| **API Keys** | Environment variables, never in code |
| **Authorization** | Role-based access (Business User, Admin) |
| **Input Validation** | Server-side validation on all inputs |

### 11.2 Error Handling Requirements

| Error | Response |
|:------|:---------|
| Description < 500 words | Disable submit, show word count guidance |
| Gemini API timeout (60s) | Abort request, show "Service Busy", offer retry |
| Invalid JSON from AI | Catch parse error, log for debug, show "Generation Failed" |
| React component crash | Error Boundary catches, shows "Something went wrong" card |
| Database connection failure | Return 503, log connection error |
| File system write failure | Notify user, provide error code |

### 11.3 Logging Strategy

```javascript
// Log levels
{
  info: "Normal operations (project created, SDF saved)",
  warn: "Recoverable issues (AI needed clarification, retry succeeded)",
  error: "Failures requiring attention (API timeout, validation failure)"
}

// Log entry structure
{
  log_id: "uuid",
  project_id: "uuid | null",
  user_id: "uuid | null",
  level: "info | warn | error",
  message: "Human-readable description",
  metadata: { ... },  // Additional context
  created_at: "ISO8601 timestamp"
}
```

---

## 12. Current State

> **Note.** The original Blueprint framed scope as "Increment 1 — Inventory only." That framing is obsolete. The platform has shipped Inventory + Invoice + HR. This section reflects current reality.

### 12.1 Modules in production

| Module | Mixins | Notable features |
|:---|:---|:---|
| **Inventory** | `InventoryMixin`, `InventoryInboundWorkflow`, `InventoryReservationWorkflow`, `InventoryCycleCount`, `InventoryTransactionSafety`, `InventoryLifecycle`, `BatchTracking`, `SerialTracking` | Receive / Issue / Transfer / Adjust wizards, low-stock alerts, expiry tracking, cycle counts, reservations, QR labels + scanning, time-travel diffs |
| **Invoice** | `InvoiceMixin`, `InvoiceCalculationEngine`, `InvoicePaymentWorkflow`, `InvoiceNoteWorkflow`, `InvoiceTransactionSafety`, `InvoiceLifecycle`, `InvoiceItems`, `SalesOrderCommitment` | Lifecycle states, calculation engine, payments, notes, transaction safety, PDF / print |
| **HR** | `HREmployeeMixin`, `HREmployeeStatus`, `HRDepartment`, `HRLeaveMixin`, `HRLeaveBalance`, `HRLeaveApproval`, `HRAttendanceTimesheet`, `HRCompensationLedger` | Employees, leave balance + approvals, attendance / timesheets, compensation ledger, user ↔ employee linking |
| **Cross-cutting** | `AuditMixin`, `RelationRuleRunnerMixin`, `UserEmployeeLinkMixin`, `LocationMixin` | Audit trail, declarative cross-entity rules, role-based access, multi-location |

### 12.2 Capabilities shipped

- Auth (register, login, JWT, RBAC, admin moderation, user blocks)
- Project CRUD + status tracking + soft delete
- AI pipeline: precheck → analyze → clarify → finalize → edit
- Conversational chat mode (streaming)
- SDF persistence (versioned JSONB) + AI-driven targeted edits
- Three-module assembly (Inventory + Invoice + HR) with mixin composition
- Schema + API preview via iframe proxy with token-gated routing
- Approval / review workflow
- Docker packaging + standalone executable packaging (single-file, embedded SQLite)
- ZIP download of generated artifact
- Bilingual (English + Turkish) — UI, SDF localization linting, generated app i18n
- Training-data collection for prompt tuning
- User-submitted feature requests (bilingual)

### 12.3 Generated artifact structure (current)

Standard mode (Docker-deployed):

```
generated-erp.zip
├── docker-compose.yml
├── Dockerfile
├── README.md
├── package.json
├── src/
│   ├── index.js
│   ├── routes/             # one file per entity, generated
│   ├── services/           # base + composed mixins
│   ├── controllers/
│   ├── middleware/         # auth, RBAC, audit
│   └── repository/         # one of FlatFile / SQLite / Postgres
├── frontend/
│   └── src/                # React + Tailwind, metadata-driven
└── data/                   # entity JSON (flat-file mode only)
```

Standalone mode (no external services):

```
generated-erp-standalone-<os>-<arch>/
├── start.{sh,bat,command}  # OS-specific launcher
├── server                  # Embedded Node.js binary
├── app.db                  # SQLite database
└── public/                 # Bundled frontend
```

### 12.4 Success criteria (current targets)

| Metric | Target |
|:-------|:-------|
| SDF generation accuracy | ≥70% of entities correctly identified |
| Assembly success rate | 100% of generated artifacts compile and start |
| Docker deployment | Artifact runs with `docker compose up` |
| Standalone executable | Runs on Windows / macOS / Linux without external deps |
| End-to-end time | < 15 minutes from approval to download |
| Localization | English + Turkish parity on platform UI and generated apps |

---

## Appendix A: Glossary

| Term | Definition |
|:-----|:-----------|
| **SDF** | System Definition File — JSON blueprint for ERP assembly |
| **Brick** | Pre-written, tested code module in the library |
| **DAL** | Data Access Layer — abstraction over storage mechanism |
| **CDUI** | Config-Driven UI — UI rendered from metadata |
| **Assembly** | Process of selecting and combining bricks based on SDF |
| **Clarification** | AI-driven Q&A to resolve ambiguous requirements |

---

## Appendix B: References

- Google AI Studio / Gemini API Documentation
- Azure OpenAI Service Documentation (alternative AI backend)
- PostgreSQL 16 Official Documentation
- Express.js 5.x API Reference
- React 18 Documentation
- FastAPI 0.115 Documentation
- Docker Compose Specification

---

*Last reviewed: May 2026 — Inventory + Invoice + HR modules in production. See `git log` for ongoing changes; this document captures stable architecture, not in-flight work.*
