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

## Quick Start

### Prerequisites

| Requirement | Version | Download |
|:------------|:--------|:---------|
| **Docker Desktop** | v24+ | [docker.com/download](https://www.docker.com/products/docker-desktop/) |
| **Git** | Latest | [git-scm.com](https://git-scm.com/downloads) |
| **Google AI API Key** | — | [aistudio.google.com](https://aistudio.google.com/app/apikey) |

> **Note:** Docker Desktop includes Docker Compose. No separate installation needed.

### 1. Clone the Repository

```bash
git clone https://github.com/CustomERP411/CustomERP.git
cd CustomERP
```

### 2. Configure Environment

```bash
# Copy the environment template
cp .env.example .env

# Edit .env and add your Google AI API key
# GOOGLE_AI_API_KEY=your_key_here
```

### 3. Start the Platform

Choose your operating system:

<details>
<summary><strong>🪟 Windows (PowerShell)</strong></summary>

```powershell
# Option 1: Using the dev script (recommended)
.\scripts\dev.ps1 start

# Option 2: Using Docker Compose directly
docker compose up -d

# View logs
.\scripts\dev.ps1 logs

# Stop services
.\scripts\dev.ps1 down
```

**Available Commands:**
```powershell
.\scripts\dev.ps1 help      # Show all commands
.\scripts\dev.ps1 start     # Start all services
.\scripts\dev.ps1 stop      # Stop all services  
.\scripts\dev.ps1 down      # Stop all services (alias)
.\scripts\dev.ps1 restart   # Restart all services
.\scripts\dev.ps1 logs      # View logs (follow mode)
.\scripts\dev.ps1 build     # Rebuild containers
.\scripts\dev.ps1 status    # Show running services
.\scripts\dev.ps1 migrate   # Run database migrations
.\scripts\dev.ps1 db        # Open PostgreSQL shell
.\scripts\dev.ps1 pgadmin   # Start pgAdmin UI
```

</details>

<details>
<summary><strong>🍎 macOS (Terminal)</strong></summary>

```bash
# Make the script executable (first time only)
chmod +x scripts/dev.sh

# Option 1: Using the dev script (recommended)
./scripts/dev.sh start

# Option 2: Using Docker Compose directly
docker compose up -d

# View logs
./scripts/dev.sh logs

# Stop services
./scripts/dev.sh down
```

**Available Commands:**
```bash
./scripts/dev.sh help      # Show all commands
./scripts/dev.sh start     # Start all services
./scripts/dev.sh stop      # Stop all services
./scripts/dev.sh down      # Stop all services (alias)
./scripts/dev.sh restart   # Restart all services
./scripts/dev.sh logs      # View logs (follow mode)
./scripts/dev.sh build     # Rebuild containers
./scripts/dev.sh status    # Show running services
./scripts/dev.sh migrate   # Run database migrations
./scripts/dev.sh db        # Open PostgreSQL shell
./scripts/dev.sh pgadmin   # Start pgAdmin UI
```

</details>

<details>
<summary><strong>🐧 Linux (Terminal)</strong></summary>

```bash
# Make the script executable (first time only)
chmod +x scripts/dev.sh

# Option 1: Using the dev script (recommended)
./scripts/dev.sh start

# Option 2: Using Docker Compose directly
docker compose up -d

# View logs
./scripts/dev.sh logs

# Stop services
./scripts/dev.sh down
```

**Available Commands:**
```bash
./scripts/dev.sh help      # Show all commands
./scripts/dev.sh start     # Start all services
./scripts/dev.sh stop      # Stop all services
./scripts/dev.sh down      # Stop all services (alias)
./scripts/dev.sh restart   # Restart all services
./scripts/dev.sh logs      # View logs (follow mode)
./scripts/dev.sh build     # Rebuild containers
./scripts/dev.sh status    # Show running services
./scripts/dev.sh migrate   # Run database migrations
./scripts/dev.sh db        # Open PostgreSQL shell
./scripts/dev.sh pgadmin   # Start pgAdmin UI
```

**Note for Linux users:** If you get permission errors with Docker, add your user to the docker group:
```bash
sudo usermod -aG docker $USER
# Log out and log back in for changes to take effect
```

</details>

<details>
<summary><strong>🔧 Using Make (Linux/macOS with make installed)</strong></summary>

```bash
make dev        # Start development environment
make down       # Stop all services
make logs       # View logs
make migrate    # Run database migrations
make clean      # Remove containers and volumes
make help       # Show all available commands
```

</details>

### 4. Access the Application

Once started, the services are available at:

| Service | URL | Description |
|:--------|:----|:------------|
| **Frontend** | http://localhost:5173 | React Dashboard UI |
| **Backend API** | http://localhost:3000 | Express.js REST API |
| **AI Gateway** | http://localhost:8000 | Python/FastAPI AI Service |
| **pgAdmin** | http://localhost:5050 | Database Management (optional) |

---

## Docker Services

The platform runs as a set of Docker containers:

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Network                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Frontend │  │ Backend  │  │    AI    │  │ Postgres │   │
│  │  :5173   │  │  :3000   │  │  :8000   │  │  :5432   │   │
│  │  (Vite)  │  │(Express) │  │(FastAPI) │  │  (DB)    │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                             │
│  ┌──────────┐                                              │
│  │ pgAdmin  │  (Optional - run with --profile tools)       │
│  │  :5050   │                                              │
│  └──────────┘                                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Container Details

| Container | Image | Port | Purpose |
|:----------|:------|:-----|:--------|
| `customwerp-frontend` | Node 20 Alpine | 5173 | React dev server with hot reload |
| `customwerp-backend` | Node 20 Alpine | 3000 | Express API with nodemon |
| `customwerp-ai-gateway` | Python 3.11 Slim | 8000 | FastAPI with uvicorn |
| `customwerp-postgres` | PostgreSQL 16 Alpine | 5432 | Platform database |
| `customwerp-pgadmin` | pgAdmin 4 | 5050 | Database UI (optional) |

---

## Development Without Docker

If you prefer to run services locally without Docker:

### Prerequisites for Local Development

- Node.js 20.x
- Python 3.11+
- PostgreSQL 16 (or use Docker just for the database)

### Windows

```powershell
# Start only PostgreSQL in Docker
docker compose up postgres -d

# Terminal 1: Backend
cd platform\backend
npm install
npm run dev

# Terminal 2: Frontend
cd platform\frontend
npm install
npm run dev

# Terminal 3: AI Gateway
cd platform\ai-gateway
python -m venv venv
.\venv\Scripts\Activate
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8000
```

### macOS / Linux

```bash
# Start only PostgreSQL in Docker
docker compose up postgres -d

# Terminal 1: Backend
cd platform/backend
npm install
npm run dev

# Terminal 2: Frontend
cd platform/frontend
npm install
npm run dev

# Terminal 3: AI Gateway
cd platform/ai-gateway
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8000
```

---

## Environment Variables

Create a `.env` file in the project root (copy from `.env.example`):

```env
# ─────────────────────────────────────────────────
# Database Configuration
# ─────────────────────────────────────────────────
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=customwerp

# ─────────────────────────────────────────────────
# Backend Configuration
# ─────────────────────────────────────────────────
JWT_SECRET=your-super-secret-jwt-key-change-in-production
NODE_ENV=development

# ─────────────────────────────────────────────────
# AI Gateway Configuration
# ─────────────────────────────────────────────────
GOOGLE_AI_API_KEY=your-google-ai-api-key-here

# ─────────────────────────────────────────────────
# Frontend Configuration
# ─────────────────────────────────────────────────
VITE_API_URL=http://localhost:3000/api

# ─────────────────────────────────────────────────
# pgAdmin (Optional)
# ─────────────────────────────────────────────────
PGADMIN_EMAIL=admin@customwerp.local
PGADMIN_PASSWORD=admin
```

---

## Project Structure

```
CustomERP/
├── 📄 docker-compose.yml       # Development environment
├── 📄 docker-compose.prod.yml  # Production environment
├── 📄 Makefile                 # Common commands (Linux/macOS)
├── 📄 .env.example             # Environment template
│
├── 📁 scripts/
│   ├── dev.ps1                 # PowerShell commands (Windows)
│   └── dev.sh                  # Bash commands (Linux/macOS)
│
├── 📁 platform/
│   ├── 📁 assembler/           # NEW: Decoupled Assembly Engine
│   │   ├── ProjectAssembler.js
│   │   ├── CodeWeaver.js
│   │   └── generators/         # Modular generators
│   │
│   ├── 📁 backend/             # Node.js/Express API (Platform)
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   └── ...
│   │
│   ├── 📁 frontend/            # React Dashboard (Platform)
│   │   ├── src/
│   │   └── ...
│   │
│   └── 📁 ai-gateway/          # Python/FastAPI AI Service
│       └── src/
│
├── 📁 brick-library/           # Pre-built code modules
│   ├── backend-bricks/
│   ├── frontend-bricks/
│   └── templates/
│
├── 📁 nginx/                   # Production reverse proxy
│   └── nginx.conf
│
└── 📁 generated/               # Output folder for assembled ERPs
```

---

## First Increment Scope

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

### Functional Scope (Implemented)

- **Module Focus:** Inventory Management (Stock wizards, Low-stock alerts, Expiry tracking)
- **AI Target:** 70% accuracy in SDF form completion
- **Data Strategy:** JSON Flat-Files with **Referential Integrity Protection**
- **Frontend:** Metadata-driven React components with **Modular Page Builders**
- **Key Features:**
    - **Inventory Wizards:** specialized UI for Receive, Issue (Sell), Transfer, Adjust.
    - **Reports Dashboard:** Time-travel diffs (Added/Removed/Changed) and Valuation.
    - **QR Code Support:** Label generation + In-browser scanning.
    - **Configurable UI:** Per-entity toggles for Search, Print, CSV Import/Export.
- **Output:** Standalone Docker container with assembled code

---

## Database Schema

The CustomERP platform uses PostgreSQL with the following tables:

| Table | Purpose |
|:------|:--------|
| `users` | User accounts and credentials |
| `roles` / `user_roles` | RBAC permission management |
| `projects` | ERP generation projects |
| `sdfs` | System Definition Files (versioned JSONB) |
| `sdf_entities` / `sdf_attributes` | AI-extracted business entities |
| `sdf_relations` | Entity relationships |
| `questions` / `answers` | AI clarification dialogue |
| `modules` / `schema_artifacts` | Generated module metadata |
| `generation_jobs` | Async generation task tracking |
| `log_entries` / `approvals` | Audit trail |

---

## Troubleshooting

<details>
<summary><strong>Docker containers won't start</strong></summary>

1. Make sure Docker Desktop is running
2. Check if ports are already in use:
   ```bash
   # Windows
   netstat -ano | findstr :3000
   netstat -ano | findstr :5173
   
   # Linux/macOS
   lsof -i :3000
   lsof -i :5173
   ```
3. Try rebuilding:
   ```bash
   docker compose down -v
   docker compose up --build
   ```

</details>

<details>
<summary><strong>Database connection failed</strong></summary>

1. Check if PostgreSQL container is running:
   ```bash
   docker compose ps
   ```
2. Wait a few seconds for PostgreSQL to initialize
3. Check logs:
   ```bash
   docker compose logs postgres
   ```

</details>

<details>
<summary><strong>Frontend not loading</strong></summary>

1. Check if the container is running:
   ```bash
   docker compose logs frontend
   ```
2. Try accessing http://localhost:5173 directly
3. Clear browser cache

</details>

<details>
<summary><strong>Permission denied (Linux)</strong></summary>

Add your user to the docker group:
```bash
sudo usermod -aG docker $USER
# Log out and log back in
```

</details>

<details>
<summary><strong>Scripts won't run (Windows)</strong></summary>

If PowerShell blocks the script, run:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

</details>

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
- **[SPRINT_TASKS.md](./SPRINT_TASKS.md)** — Development task breakdown
- **[SRS](./context_files/srs.txt)** — Software Requirements Specification
- **[SPMP](./context_files/spmp.txt)** — Software Project Management Plan

---

## License

This is an academic proof-of-concept project developed as part of Bilkent University's CTIS Senior Project (October 2025 – June 2026). The system demonstrates the technical feasibility of AI-assisted ERP generation.

---

<p align="center">
  <em>CustomERP — Bridging Business Intent and Enterprise Software</em>
</p>
