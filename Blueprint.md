# CustomERP Technical Blueprint

> **Project Context & Architectural Blueprint for CustomERP v1.0 — Increment 1**
> 
> This document serves as the authoritative technical reference for all current and future development of the CustomERP platform.

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
12. [Increment 1 Deliverables](#12-increment-1-deliverables)

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
| **Platform Core** | Node.js / Express.js | 20.x / 4.x | Manages project lifecycle, assembly engine, REST API |
| **Platform Database** | PostgreSQL | 16.x | Stores users, projects, SDFs, audit logs |
| **AI Gateway** | Python / Google GenAI SDK | 3.11 / latest | Translates natural language → SDF JSON |
| **Generated ERP (BE)** | Node.js / Express.js | 20.x | Assembled from modular Service Bricks |
| **Generated ERP (FE)** | React / Tailwind CSS | 18.x / 3.x | Assembled from Metadata-Aware Components |
| **Data Layer (Inc. 1)** | JSON Flat-Files | — | Persistence for generated ERP entities |
| **Containerization** | Docker / Docker Compose | 24+ / 2.x | Artifact packaging and deployment |

### 2.2 External Dependencies

| Service | Purpose | Interface |
|:--------|:--------|:----------|
| **Google AI Studio (Gemini 3 Pro)** | NLP processing, entity extraction, SDF generation | HTTPS REST, JSON |
| **Docker Hub** | Base images (node:20-alpine, postgres:16-alpine) | Docker pull |

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
│  │ Google AI    │    │     BRICK LIBRARY        │                          │
│  │ Gemini 3 Pro │    ├──────────────────────────┤                          │
│  │ (External)   │    │ • Backend Bricks         │                          │
│  └──────────────┘    │ • Frontend Bricks        │                          │
│                      │ • Template Bricks        │                          │
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

---

## 4. The Brick Library & Assembly Logic

### 4.1 Brick Categories

The Brick Library contains pre-written, tested code modules organized by function:

```
brick-library/
├── backend-bricks/
│   ├── controllers/
│   │   └── BaseController.js         # Generic CRUD entry point
│   ├── services/
│   │   ├── InventoryService.js       # Stock management logic
│   │   ├── StockValidationLogic.js   # Prevents negative stock
│   │   ├── AlertTriggerLogic.js      # Low-stock threshold alerts
│   │   └── AuditTrailLogic.js        # Entity change logging
│   └── repository/
│       ├── RepositoryInterface.js    # DAL contract
│       ├── FlatFileProvider.js       # JSON file implementation
│       └── PostgreSQLProvider.js     # SQL implementation (Inc. 2)
│
├── frontend-bricks/
│   ├── layouts/
│   │   ├── DashboardLayout.jsx       # Main app shell
│   │   └── EntityLayout.jsx          # Single-entity view wrapper
│   ├── components/
│   │   ├── BasicTableView.jsx        # Simple data list
│   │   ├── InventoryDashboard.jsx    # Stock + alerts view
│   │   ├── CategorizedListView.jsx   # Hierarchical entities
│   │   ├── EntityForm.jsx            # Dynamic CRUD form
│   │   └── AlertBanner.jsx           # Notification display
│   └── registry/
│       └── EntityRegistry.js         # Component-to-entity mapping
│
└── templates/
    ├── Dockerfile.template           # Node.js container
    ├── docker-compose.template.yml   # Multi-service orchestration
    ├── package.json.template         # Dependencies manifest
    └── README.template.md            # Deployment guide
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

### 7.2 Flat-File Provider (Increment 1)

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

### 7.4 Future: PostgreSQL Provider (Increment 2+)

```javascript
// PostgreSQLProvider.js
class PostgreSQLProvider extends RepositoryInterface {
  constructor(connectionString) {
    super();
    this.pool = new Pool({ connectionString });
  }

  async findAll(entitySlug) {
    const result = await this.pool.query(`SELECT * FROM ${entitySlug}`);
    return result.rows;
  }
  // ... other methods using SQL
}
```

**Migration Path:** Because we use a DAL, swapping `FlatFileProvider` for `PostgreSQLProvider` requires zero changes to business logic bricks.

---

## 8. API Specifications

### 8.1 Platform API Endpoints

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `POST` | `/api/auth/register` | Create new user account |
| `POST` | `/api/auth/login` | Authenticate and receive JWT |
| `GET` | `/api/projects` | List user's projects |
| `POST` | `/api/projects` | Create new project |
| `GET` | `/api/projects/:id` | Get project details |
| `PUT` | `/api/projects/:id` | Update project |
| `DELETE` | `/api/projects/:id` | Delete project |
| `POST` | `/api/projects/:id/analyze` | Send description to AI |
| `POST` | `/api/projects/:id/clarify` | Submit clarification answer |
| `GET` | `/api/projects/:id/sdf` | Get current SDF |
| `POST` | `/api/projects/:id/generate` | Trigger assembly |
| `GET` | `/api/projects/:id/preview` | Get schema/API preview |
| `POST` | `/api/projects/:id/approve` | Approve generated module |
| `GET` | `/api/projects/:id/download` | Download artifact ZIP |

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
| `POST` | `/ai/analyze` | Initial description analysis |
| `POST` | `/ai/clarify` | Process clarification answer |
| `POST` | `/ai/finalize` | Generate final SDF |

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
│  │AIServiceGateway │────▶│ Gemini 3 Pro API│                │         │
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

## 12. Increment 1 Deliverables

### 12.1 Scope Summary

| Aspect | Specification |
|:-------|:--------------|
| **Module Focus** | Inventory Management |
| **AI Accuracy Target** | 70% for SDF form completion |
| **Data Strategy** | DAL-abstracted JSON flat-files |
| **Frontend** | Metadata-driven React components |
| **Output** | Standalone Docker container |

### 12.2 Functional Deliverables

- [ ] User authentication (register, login, logout)
- [ ] Project CRUD with status tracking
- [ ] AI-powered description analysis
- [ ] Clarification dialogue system
- [ ] SDF generation and storage
- [ ] Inventory module assembly from bricks
- [ ] Schema visualization (ERD-style)
- [ ] API endpoint preview
- [ ] Module approval workflow
- [ ] Docker artifact packaging
- [ ] ZIP download of generated ERP

### 12.3 Generated Artifact Structure

```
my-electronics-shop-erp.zip
├── docker-compose.yml
├── Dockerfile
├── README.md                    # Deployment instructions
├── package.json
├── src/
│   ├── index.js                 # Express entry point
│   ├── routes/
│   │   └── productRoutes.js     # Generated CRUD routes
│   ├── services/
│   │   ├── InventoryService.js  # Stock management brick
│   │   └── AlertService.js      # Threshold alert brick
│   └── repository/
│       └── FlatFileProvider.js  # Data access layer
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/          # UI bricks
│   │   └── config/
│   │       └── ui-config.json   # Metadata for dynamic rendering
│   └── package.json
└── data/
    ├── product.json             # Empty initial data
    └── category.json
```

### 12.4 Success Criteria

| Metric | Target |
|:-------|:-------|
| SDF generation accuracy | ≥70% of entities correctly identified |
| Assembly success rate | 100% of generated artifacts compile |
| Docker deployment | Artifact runs with `docker compose up` |
| End-to-end time | < 15 minutes from approval to download |
| Documentation | README enables deployment without support |

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
- PostgreSQL 16 Official Documentation
- Express.js 4.x API Reference
- React 18 Documentation
- Docker Compose Specification

---

*Last Updated: January 2026 — Increment 1 Development Phase*
