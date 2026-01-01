# CustomERP

> An AI-powered Orchestration & Assembly Engine that generates customized ERP systems from natural language business descriptions.

[![Project Status](https://img.shields.io/badge/Status-In%20Development-yellow)]()
[![Increment](https://img.shields.io/badge/Increment-1%20(Inventory)-blue)]()
[![License](https://img.shields.io/badge/License-Academic-lightgrey)]()

---

## Overview

CustomERP bridges the gap between expensive custom ERP development and inflexible template solutions. Unlike traditional code-generation tools, CustomERP uses a unique **"Assembly Architecture"** where AI interprets business requirements into a structured **System Definition File (SDF)**, and the platform assembles functional modules from a curated library of pre-built, tested "Technical Bricks."

**Key Principle:** The AI acts as the *Architect* (generating the blueprint), and the Platform acts as the *Builder* (assembling pre-fabricated parts).

---

## Architecture Philosophy

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Business User  │────▶│   AI Architect  │────▶│  SDF Blueprint  │
│  (Plain English)│     │ (Gemini 2.5 Pro)│     │     (JSON)      │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Generated ERP   │◀────│ Assembly Engine │◀────│  Brick Library  │
│   (Artifacts)   │     │  (Orchestrator) │     │ (Pre-built Code)│
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

---

## Technology Stack

| Layer | Technology | Purpose |
|:------|:-----------|:--------|
| **Platform Core** | Node.js 20.x / Express.js | Project lifecycle & assembly engine |
| **Platform Database** | PostgreSQL 16 | User data, project states, SDF storage |
| **AI Component** | Python 3.11 / Google Gemini 2.5 Pro | Natural language → SDF translation |
| **Generated ERP (Backend)** | Node.js | Assembled from modular Service Bricks |
| **Generated ERP (Frontend)** | React 18 / Tailwind CSS | Metadata-aware UI components |
| **Data Layer (Increment 1)** | JSON Flat-Files | Persistence for generated ERP |
| **Deployment** | Docker / Docker Compose | Containerized artifact packaging |

---

## First Increment Scope (Fall 2025)

The first increment focuses on demonstrating the core assembly pipeline with **Inventory Management** as the target module.

### Use Cases

| ID | Use Case | Description |
|:---|:---------|:------------|
| UC-1 | View Project List | Display user's projects with status and timestamps |
| UC-2 | Create New Project | Initialize a new ERP generation project |
| UC-3 | Generate SDF via Chatbot | AI-powered requirement analysis and SDF creation |
| UC-4 | Generate Inventory Module | Assembly of flat-file schema & CRUD from SDF |
| UC-5 | Review Schema & API | Visual preview of generated entities and endpoints |
| UC-6 | Approve/Edit Module | Final review and configuration lock |

### Functional Scope

- **Module Focus:** Inventory Management (stock tracking, low-stock alerts)
- **AI Target:** 70% accuracy in SDF form completion
- **Data Strategy:** DAL-abstracted JSON flat-files (PostgreSQL-ready for Increment 2)
- **Frontend:** Metadata-driven React components adapting to user-defined fields
- **Output:** Standalone Docker container with assembled code

---

## Project Structure

```
CustomERP/
├── platform/                 # CustomERP Platform Core
│   ├── backend/             # Node.js/Express API server
│   │   ├── services/        # ProjectService, AuditService, etc.
│   │   ├── controllers/     # API route handlers
│   │   └── repository/      # DAL implementations
│   ├── frontend/            # React dashboard UI
│   └── ai-gateway/          # Python AI service wrapper
│
├── brick-library/           # Pre-built Technical Bricks
│   ├── backend-bricks/      # Service classes (StockValidation, AlertTrigger, etc.)
│   ├── frontend-bricks/     # React components (TableView, Dashboard, etc.)
│   └── templates/           # Dockerfile, docker-compose templates
│
├── generated/               # Output folder for assembled ERPs
│
└── docs/                    # Documentation & diagrams
```

---

## Database Schema (Platform)

The CustomERP platform uses PostgreSQL to manage:

| Table | Purpose |
|:------|:--------|
| `USERS` | User accounts and credentials |
| `ROLES` / `USER_ROLES` | RBAC permission management |
| `PROJECTS` | ERP generation projects |
| `SDFS` | System Definition Files (versioned) |
| `SDF_ENTITIES` / `SDF_ATTRIBUTES` | AI-extracted business entities |
| `SDF_RELATIONS` | Entity relationships |
| `QUESTIONS` / `ANSWERS` | AI clarification dialogue |
| `MODULES` / `SCHEMA_ARTIFACTS` | Generated module metadata |
| `GENERATION_JOBS` | Async generation task tracking |
| `LOG_ENTRIES` / `APPROVALS` | Audit trail |

---

## Getting Started

### Prerequisites

- Docker Engine v24+
- Node.js 20.x (for development)
- Python 3.11+ (for AI gateway)
- Google AI Studio API key

### Installation

```bash
# Clone the repository
git clone https://github.com/CustomERP411/CustomERP.git
cd CustomERP

# Copy environment template
cp .env.example .env

# Add your Google AI Studio API key to .env
# GOOGLE_AI_API_KEY=your_key_here

# Start the platform
docker compose up -d
```

### Development

```bash
# Install platform dependencies
cd platform/backend && npm install
cd ../frontend && npm install
cd ../ai-gateway && pip install -r requirements.txt

# Run in development mode
npm run dev
```

---

## Team

**Team 10 — Bilkent University CTIS Department**

| Name | Role |
|:-----|:-----|
| Ahmet Selim Alpkirişçi | Project Manager & AI Integration Lead |
| Elkhan Abbasov | Frontend Developer |
| Orhan Demir Demiröz | Backend Developer |
| Tunç Erdoğanlar | Backend Developer |
| Burak Tan Bilgi | QA & Documentation Coordinator |

**Academic Advisor:** Dr. Cüneyt Sevgi

---

## Development Timeline

| Period | Milestone |
|:-------|:----------|
| October 2025 | Requirements analysis & initial planning |
| November 2025 | SRS specification & prototyping |
| December 2025 | Architecture design & SPMP |
| **January 2026** | **First Increment Delivery (Inventory Module)** |
| February – May 2026 | Incremental development (Customer, Invoicing) |
| June 2026 | Final delivery & defense |

---

## Documentation

- **[Blueprint.md](./Blueprint.md)** — Technical architecture & assembly logic
- **[SRS](./srs.txt)** — Software Requirements Specification
- **[SPMP](./spmp.txt)** — Software Project Management Plan

---

## License

This is an academic proof-of-concept project developed as part of Bilkent University's CTIS Senior Project (October 2025 – June 2026). The system demonstrates the technical feasibility of AI-assisted ERP generation.

---

<p align="center">
  <em>CustomERP — Bridging Business Intent and Enterprise Software</em>
</p>
