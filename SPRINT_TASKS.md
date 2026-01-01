# CustomERP — First Increment Sprint Plan

> **Sprint Duration:** January 1-6, 2026 (6 days)  
> **Team Size:** 4 developers  
> **Goal:** Deliver working Inventory Module with AI-powered SDF generation

---

## Team Assignment

| Code | Developer | Primary Focus |
|:-----|:----------|:--------------|
| **DEV-A** | Elkhan Abbasov | Frontend (React Dashboard) |
| **DEV-B** | Orhan Demir Demiröz | Backend (Platform API & Services) |
| **DEV-C** | Tunç Erdoğanlar | Backend (Brick Library & Assembler) |
| **DEV-D** | Burak Tan Bilgi | AI Gateway & Integration Testing |

---

## Critical Rules for All Developers

### ⛔ DO NOT TOUCH (Shared Resources — Coordinate First)

| Resource | Reason |
|:---------|:-------|
| `Blueprint.md`, `README.md` | Documentation is finalized |
| `package.json` (root) | Coordinate dependency additions |
| `.env` / `.env.example` | Add keys only via PR discussion |
| Database migrations | Run in sequence; don't edit others' migrations |
| `brick-library/` structure | Only DEV-C modifies brick organization |

### ✅ SAFE TO MODIFY (Your Domain)

Each developer has isolated directories. Work freely within your domain.

---

## Task Overview by Day

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         6-DAY SPRINT TIMELINE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  DAY 1 (Jan 1) ─────────────────────────────────────────────────────────── │
│  │ DEV-A: Project scaffolding (React + Vite + Tailwind)                    │
│  │ DEV-B: Express scaffolding + PostgreSQL schema + Auth                   │
│  │ DEV-C: Brick library folder structure + Base bricks                     │
│  │ DEV-D: AI Gateway scaffolding + Gemini connection test                  │
│                                                                             │
│  DAY 2 (Jan 2) ─────────────────────────────────────────────────────────── │
│  │ DEV-A: Auth UI (Login/Register) + Dashboard layout                      │
│  │ DEV-B: Auth endpoints + Project CRUD API                                │
│  │ DEV-C: FlatFileProvider + Repository interface                          │
│  │ DEV-D: Prompt engineering + SDF schema validation                       │
│                                                                             │
│  DAY 3 (Jan 3) ─────────────────────────────────────────────────────────── │
│  │ DEV-A: Project list view + Create project modal                         │
│  │ DEV-B: AI Gateway integration + /analyze endpoint                       │
│  │ DEV-C: InventoryService brick + StockValidation brick                   │
│  │ DEV-D: Clarification flow + Question/Answer handling                    │
│                                                                             │
│  DAY 4 (Jan 4) ─────────────────────────────────────────────────────────── │
│  │ DEV-A: Chat interface + Clarification dialog                            │
│  │ DEV-B: SDF storage + /generate endpoint                                 │
│  │ DEV-C: Assembler engine + Brick injection logic                         │
│  │ DEV-D: End-to-end AI flow testing + Error handling                      │
│                                                                             │
│  DAY 5 (Jan 5) ─────────────────────────────────────────────────────────── │
│  │ DEV-A: Schema preview UI + ERD visualization                            │
│  │ DEV-B: Download endpoint + ZIP packaging                                │
│  │ DEV-C: Frontend bricks (BasicTable, EntityForm)                         │
│  │ DEV-D: Integration testing + Docker setup                               │
│                                                                             │
│  DAY 6 (Jan 6) ─────────────────────────────────────────────────────────── │
│  │ ALL: Integration + Bug fixes + Documentation + Demo prep                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Task Breakdown

---

# DEV-A: Frontend (Elkhan Abbasov)

## Domain Ownership

```
platform/
└── frontend/
    ├── src/
    │   ├── components/     ← YOUR DOMAIN
    │   ├── pages/          ← YOUR DOMAIN
    │   ├── hooks/          ← YOUR DOMAIN
    │   ├── context/        ← YOUR DOMAIN
    │   ├── services/       ← YOUR DOMAIN (API calls)
    │   └── styles/         ← YOUR DOMAIN
    ├── package.json        ← YOUR DOMAIN
    └── vite.config.js      ← YOUR DOMAIN
```

---

## Task A1: Project Scaffolding

**Day:** 1 (Jan 1)  
**Duration:** 4-6 hours  
**Dependencies:** None  

### What to Do

1. Initialize React project with Vite
2. Install and configure Tailwind CSS
3. Set up folder structure as shown above
4. Configure environment variables for API URL
5. Create basic `App.jsx` with React Router

### Commands

```bash
cd platform
npm create vite@latest frontend -- --template react
cd frontend
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install react-router-dom axios
```

### Files to Create

```
frontend/
├── src/
│   ├── App.jsx                 # Router setup
│   ├── main.jsx                # Entry point
│   ├── index.css               # Tailwind imports
│   ├── components/
│   │   └── .gitkeep
│   ├── pages/
│   │   └── .gitkeep
│   ├── hooks/
│   │   └── .gitkeep
│   ├── context/
│   │   └── AuthContext.jsx     # Skeleton
│   └── services/
│       └── api.js              # Axios instance
├── .env.example
└── tailwind.config.js
```

### Configuration

**tailwind.config.js:**
```javascript
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: { extend: {} },
  plugins: [],
}
```

**src/services/api.js:**
```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
```

### ⛔ Do NOT

- Do NOT add dependencies to root `package.json`
- Do NOT create backend files
- Do NOT hardcode API URLs (use env vars)

### ✅ Definition of Done

- [ ] `npm run dev` starts frontend on port 5173
- [ ] Tailwind styles work (test with a colored div)
- [ ] Router navigates between `/` and `/login`
- [ ] Axios instance exported and ready

---

## Task A2: Authentication UI

**Day:** 2 (Jan 2)  
**Duration:** 6-8 hours  
**Dependencies:** A1 complete, B2 (Auth API) in progress  

### What to Do

1. Create `LoginPage.jsx` with email/password form
2. Create `RegisterPage.jsx` with name/email/password form
3. Implement `AuthContext.jsx` for token storage
4. Create `ProtectedRoute.jsx` wrapper
5. Style with Tailwind (clean, modern look)

### Files to Create/Modify

```
src/
├── context/
│   └── AuthContext.jsx         # Full implementation
├── pages/
│   ├── LoginPage.jsx
│   └── RegisterPage.jsx
├── components/
│   ├── ProtectedRoute.jsx
│   └── ui/
│       ├── Input.jsx           # Reusable input
│       └── Button.jsx          # Reusable button
└── App.jsx                     # Add auth routes
```

### AuthContext Pattern

```javascript
// src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // Verify token with backend (implement later)
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
    return res.data;
  };

  const register = async (name, email, password) => {
    const res = await api.post('/auth/register', { name, email, password });
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

### ⛔ Do NOT

- Do NOT implement actual API calls until DEV-B confirms endpoints are ready
- Do NOT store passwords in state
- Do NOT skip form validation

### ✅ Definition of Done

- [ ] Login form submits and shows loading state
- [ ] Register form validates matching passwords
- [ ] Token stored in localStorage on success
- [ ] Protected routes redirect to login
- [ ] Logout clears token

---

## Task A3: Dashboard Layout + Project List

**Day:** 3 (Jan 3)  
**Duration:** 6-8 hours  
**Dependencies:** A2 complete, B3 (Project API) in progress  

### What to Do

1. Create `DashboardLayout.jsx` with sidebar + main area
2. Create `ProjectListPage.jsx` showing user's projects
3. Create `ProjectCard.jsx` component
4. Create `NewProjectModal.jsx` for project creation
5. Implement project list fetching

### Files to Create

```
src/
├── components/
│   ├── layout/
│   │   ├── DashboardLayout.jsx
│   │   ├── Sidebar.jsx
│   │   └── Header.jsx
│   ├── projects/
│   │   ├── ProjectCard.jsx
│   │   └── NewProjectModal.jsx
├── pages/
│   └── ProjectListPage.jsx
└── services/
    └── projectService.js       # API calls for projects
```

### Layout Structure

```jsx
// DashboardLayout.jsx
<div className="flex h-screen">
  <Sidebar />                    {/* Fixed left sidebar */}
  <div className="flex-1 flex flex-col">
    <Header />                   {/* Top bar with user menu */}
    <main className="flex-1 overflow-auto p-6">
      <Outlet />                 {/* Page content */}
    </main>
  </div>
</div>
```

### ⛔ Do NOT

- Do NOT implement project details page yet (Day 4)
- Do NOT add chat interface yet (Day 4)

### ✅ Definition of Done

- [ ] Sidebar shows "Projects" and "New Project" button
- [ ] Project list displays cards with name, status, date
- [ ] Empty state shows "No projects yet"
- [ ] New project modal creates project via API

---

## Task A4: Chat Interface + Clarification Dialog

**Day:** 4 (Jan 4)  
**Duration:** 8 hours  
**Dependencies:** A3 complete, B4 (AI integration) complete  

### What to Do

1. Create `ProjectDetailPage.jsx` as main workspace
2. Create `ChatPanel.jsx` for AI conversation
3. Create `ClarificationDialog.jsx` for AI questions
4. Create `MessageBubble.jsx` for chat messages
5. Implement real-time status updates

### Files to Create

```
src/
├── components/
│   ├── chat/
│   │   ├── ChatPanel.jsx
│   │   ├── MessageBubble.jsx
│   │   ├── DescriptionInput.jsx
│   │   └── ClarificationDialog.jsx
├── pages/
│   └── ProjectDetailPage.jsx
└── services/
    └── aiService.js            # API calls for AI operations
```

### Chat Flow

```
┌─────────────────────────────────────────────────────────┐
│ Project: "My Electronics Shop"           [Status: Draft]│
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Describe your business...                        │   │
│  │ ┌─────────────────────────────────────────────┐ │   │
│  │ │ I run a small electronics shop selling      │ │   │
│  │ │ phones and accessories. I need to track...  │ │   │
│  │ └─────────────────────────────────────────────┘ │   │
│  │                              [Analyze ▶]        │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  💬 AI: I've identified your inventory needs.          │
│     I have a few clarifying questions:                 │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Do your products have unique serial numbers?     │   │
│  │                                                  │   │
│  │   [Yes] [No] [Some do]                          │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### ⛔ Do NOT

- Do NOT modify AI Gateway code (DEV-D's domain)
- Do NOT implement preview/ERD yet (Day 5)

### ✅ Definition of Done

- [ ] Description textarea with word count
- [ ] "Analyze" button sends to AI
- [ ] Loading state while AI processes
- [ ] Clarification questions display as cards
- [ ] Answers sent back to AI
- [ ] Chat history persists on page refresh

---

## Task A5: Schema Preview + ERD Visualization

**Day:** 5 (Jan 5)  
**Duration:** 8 hours  
**Dependencies:** A4 complete, B5 (generation) complete  

### What to Do

1. Create `PreviewPane.jsx` showing generated schema
2. Create `ERDVisualization.jsx` (simple box diagram)
3. Create `APIEndpointList.jsx` showing routes
4. Create `ApprovalPanel.jsx` with approve/download buttons
5. Implement download functionality

### Files to Create

```
src/
├── components/
│   ├── preview/
│   │   ├── PreviewPane.jsx
│   │   ├── ERDVisualization.jsx
│   │   ├── EntityCard.jsx
│   │   ├── APIEndpointList.jsx
│   │   └── ApprovalPanel.jsx
└── services/
    └── downloadService.js      # Handle ZIP download
```

### ERD Visualization (Simple CSS Boxes)

No external library needed. Use flexbox/grid with CSS arrows:

```jsx
// Simple entity box
<div className="border-2 border-gray-700 rounded-lg p-4 bg-white shadow">
  <div className="font-bold text-lg border-b pb-2">Product</div>
  <ul className="text-sm mt-2 space-y-1">
    <li>🔑 id (uuid)</li>
    <li>📝 name (string)</li>
    <li>🔢 quantity (integer)</li>
    <li>💲 price (decimal)</li>
  </ul>
</div>
```

### ⛔ Do NOT

- Do NOT use complex visualization libraries (D3, etc.)
- Do NOT modify brick library files

### ✅ Definition of Done

- [ ] Entity cards show all fields with types
- [ ] Relationships shown as lines between boxes
- [ ] API endpoints listed with method badges
- [ ] "Approve" button locks configuration
- [ ] "Download" button triggers ZIP download

---

## Task A6: Integration & Polish

**Day:** 6 (Jan 6)  
**Duration:** Full day  
**Dependencies:** All A tasks complete  

### What to Do

1. Fix any UI bugs found during integration
2. Add loading states everywhere
3. Add error boundaries
4. Improve responsive design
5. Polish animations/transitions
6. Prepare demo flow

### ⛔ Do NOT

- Do NOT add new features
- Do NOT refactor working code

### ✅ Definition of Done

- [ ] Full flow works: Login → Create → Chat → Preview → Download
- [ ] No console errors
- [ ] Mobile-friendly (basic)
- [ ] Error states handled gracefully

---

---

# DEV-B: Backend Platform (Orhan Demir Demiröz)

## Domain Ownership

```
platform/
└── backend/
    ├── src/
    │   ├── controllers/    ← YOUR DOMAIN
    │   ├── services/       ← YOUR DOMAIN
    │   ├── middleware/     ← YOUR DOMAIN
    │   ├── routes/         ← YOUR DOMAIN
    │   ├── models/         ← YOUR DOMAIN
    │   └── utils/          ← YOUR DOMAIN
    ├── migrations/         ← YOUR DOMAIN (coordinate sequence)
    ├── package.json        ← YOUR DOMAIN
    └── .env.example        ← COORDINATE CHANGES
```

---

## Task B1: Project Scaffolding + Database Schema

**Day:** 1 (Jan 1)  
**Duration:** 6-8 hours  
**Dependencies:** None  

### What to Do

1. Initialize Node.js/Express project
2. Set up PostgreSQL connection (use `pg` or `prisma`)
3. Create database migrations for all tables
4. Set up environment configuration
5. Create basic health check endpoint

### Commands

```bash
cd platform
mkdir backend && cd backend
npm init -y
npm install express cors dotenv pg bcryptjs jsonwebtoken uuid
npm install -D nodemon
```

### Database Tables (Priority Order)

Run migrations in this order:

1. `users` - User accounts
2. `roles` / `user_roles` - RBAC
3. `projects` - ERP projects
4. `sdfs` - System Definition Files
5. `sdf_entities` / `sdf_attributes` - Entity details
6. `sdf_relations` - Relationships
7. `questions` / `answers` - Clarification dialogue
8. `modules` / `schema_artifacts` - Generated artifacts
9. `generation_jobs` - Async tasks
10. `approvals` / `log_entries` - Audit

### Folder Structure

```
backend/
├── src/
│   ├── index.js                # Express entry point
│   ├── config/
│   │   └── database.js         # PG pool configuration
│   ├── controllers/
│   │   └── .gitkeep
│   ├── services/
│   │   └── .gitkeep
│   ├── middleware/
│   │   └── auth.js             # JWT verification
│   ├── routes/
│   │   └── index.js            # Route aggregator
│   ├── models/
│   │   └── .gitkeep
│   └── utils/
│       └── logger.js           # Winston or console wrapper
├── migrations/
│   └── 001_initial_schema.sql
├── package.json
└── .env.example
```

### .env.example

```env
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/customwerp
JWT_SECRET=your-secret-key-change-in-production
NODE_ENV=development
```

### ⛔ Do NOT

- Do NOT install frontend dependencies
- Do NOT create brick library files (DEV-C's domain)
- Do NOT implement AI calls (DEV-D's domain)

### ✅ Definition of Done

- [ ] `npm run dev` starts server on port 3000
- [ ] `GET /health` returns `{ status: "ok" }`
- [ ] All tables created in PostgreSQL
- [ ] Database connection pooling configured

---

## Task B2: Authentication Endpoints

**Day:** 2 (Jan 2)  
**Duration:** 6-8 hours  
**Dependencies:** B1 complete  

### What to Do

1. Implement `POST /api/auth/register`
2. Implement `POST /api/auth/login`
3. Implement `GET /api/auth/me` (verify token)
4. Create JWT middleware for protected routes
5. Password hashing with bcrypt

### Files to Create

```
src/
├── controllers/
│   └── authController.js
├── services/
│   └── authService.js
├── middleware/
│   └── auth.js
├── routes/
│   └── authRoutes.js
└── utils/
    └── jwt.js
```

### API Contracts

**POST /api/auth/register**
```json
// Request
{ "name": "John", "email": "john@example.com", "password": "secret123" }

// Response 201
{ "token": "jwt...", "user": { "id": "uuid", "name": "John", "email": "..." } }

// Response 400
{ "error": "Email already exists" }
```

**POST /api/auth/login**
```json
// Request
{ "email": "john@example.com", "password": "secret123" }

// Response 200
{ "token": "jwt...", "user": { "id": "uuid", "name": "John", "email": "..." } }

// Response 401
{ "error": "Invalid credentials" }
```

### ⛔ Do NOT

- Do NOT store plain-text passwords
- Do NOT skip input validation
- Do NOT expose password hash in responses

### ✅ Definition of Done

- [ ] Registration creates user and returns JWT
- [ ] Login validates password and returns JWT
- [ ] Invalid credentials return 401
- [ ] Protected routes reject missing/invalid tokens

---

## Task B3: Project CRUD API

**Day:** 3 (Jan 3)  
**Duration:** 6-8 hours  
**Dependencies:** B2 complete  

### What to Do

1. Implement `GET /api/projects` (list user's projects)
2. Implement `POST /api/projects` (create new)
3. Implement `GET /api/projects/:id` (get details)
4. Implement `PUT /api/projects/:id` (update)
5. Implement `DELETE /api/projects/:id` (soft delete or hard)

### Files to Create

```
src/
├── controllers/
│   └── projectController.js
├── services/
│   └── projectService.js
├── routes/
│   └── projectRoutes.js
└── models/
    └── Project.js              # Data access layer
```

### API Contracts

**GET /api/projects**
```json
// Response 200
{
  "projects": [
    {
      "id": "uuid",
      "name": "My Shop",
      "status": "Draft",
      "created_at": "2026-01-01T12:00:00Z",
      "updated_at": "2026-01-01T12:00:00Z"
    }
  ]
}
```

**POST /api/projects**
```json
// Request
{ "name": "My Electronics Shop" }

// Response 201
{ "id": "uuid", "name": "...", "status": "Draft", ... }
```

### ⛔ Do NOT

- Do NOT expose other users' projects
- Do NOT implement AI/SDF endpoints yet (Day 4)

### ✅ Definition of Done

- [ ] User can only see their own projects
- [ ] Project status defaults to "Draft"
- [ ] Update modifies `updated_at` timestamp
- [ ] Delete removes project (cascade to related tables)

---

## Task B4: AI Gateway Integration + Analyze Endpoint

**Day:** 4 (Jan 4)  
**Duration:** 8 hours  
**Dependencies:** B3 complete, D3 (AI Gateway) complete  

### What to Do

1. Create internal HTTP client to AI Gateway
2. Implement `POST /api/projects/:id/analyze`
3. Implement `POST /api/projects/:id/clarify`
4. Store questions/answers in database
5. Update project status on AI responses

### Files to Create

```
src/
├── controllers/
│   └── aiController.js
├── services/
│   ├── aiGatewayClient.js      # HTTP calls to Python service
│   └── sdfService.js           # SDF storage/retrieval
├── routes/
│   └── aiRoutes.js
└── models/
    ├── SDF.js
    ├── Question.js
    └── Answer.js
```

### Flow

```
Frontend                Platform API              AI Gateway
   │                         │                         │
   ├─POST /analyze──────────▶│                         │
   │                         ├─POST /ai/analyze───────▶│
   │                         │◀──questions/partial_sdf─┤
   │◀──questions─────────────┤                         │
   │                         │                         │
   ├─POST /clarify──────────▶│                         │
   │   (with answers)        ├─POST /ai/clarify───────▶│
   │                         │◀──final_sdf─────────────┤
   │◀──sdf_ready─────────────┤                         │
```

### ⛔ Do NOT

- Do NOT modify AI Gateway Python code
- Do NOT implement assembly logic (DEV-C's domain)

### ✅ Definition of Done

- [ ] Analyze endpoint forwards to AI Gateway
- [ ] Questions stored and returned to frontend
- [ ] Clarify endpoint processes answers
- [ ] SDF stored in database on completion
- [ ] Project status updates: Draft → Analyzing → Ready

---

## Task B5: Generation + Download Endpoints

**Day:** 5 (Jan 5)  
**Duration:** 8 hours  
**Dependencies:** B4 complete, C4 (Assembler) complete  

### What to Do

1. Implement `POST /api/projects/:id/generate`
2. Implement `GET /api/projects/:id/preview`
3. Implement `POST /api/projects/:id/approve`
4. Implement `GET /api/projects/:id/download`
5. Create generation job tracking

### Files to Create

```
src/
├── controllers/
│   └── generationController.js
├── services/
│   ├── assemblerClient.js      # Calls DEV-C's Assembler
│   └── downloadService.js      # ZIP packaging
├── routes/
│   └── generationRoutes.js
└── models/
    ├── Module.js
    ├── SchemaArtifact.js
    └── GenerationJob.js
```

### Download Flow

```javascript
// GET /api/projects/:id/download
async function download(req, res) {
  const project = await getProject(req.params.id);
  
  // Call Assembler to package artifacts
  const zipPath = await assemblerClient.package(project.id);
  
  // Stream ZIP file
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${project.name}.zip"`);
  fs.createReadStream(zipPath).pipe(res);
}
```

### ⛔ Do NOT

- Do NOT implement brick selection logic (DEV-C's domain)
- Do NOT modify AI Gateway

### ✅ Definition of Done

- [ ] Generate creates assembly job
- [ ] Preview returns entity list and API endpoints
- [ ] Approve locks project configuration
- [ ] Download streams ZIP file
- [ ] Generation job tracks status/errors

---

## Task B6: Integration & Bug Fixes

**Day:** 6 (Jan 6)  
**Duration:** Full day  
**Dependencies:** All B tasks complete  

### What to Do

1. Fix API bugs found during integration
2. Add proper error responses everywhere
3. Ensure all endpoints have logging
4. Test with frontend end-to-end
5. Document any API changes

### ⛔ Do NOT

- Do NOT add new endpoints
- Do NOT refactor working code

### ✅ Definition of Done

- [ ] All endpoints return proper HTTP status codes
- [ ] Errors logged with context
- [ ] Frontend can complete full flow

---

---

# DEV-C: Brick Library & Assembler (Tunç Erdoğanlar)

## Domain Ownership

```
brick-library/                  ← YOUR ENTIRE DOMAIN
├── backend-bricks/
├── frontend-bricks/
└── templates/

platform/backend/src/
├── assembler/                  ← YOUR DOMAIN
│   ├── ProjectAssembler.js
│   ├── BrickRepository.js
│   └── SDFInterpreter.js
```

---

## Task C1: Brick Library Structure + Base Bricks

**Day:** 1 (Jan 1)  
**Duration:** 6-8 hours  
**Dependencies:** None  

### What to Do

1. Create complete folder structure for brick library
2. Create `BaseController.js` brick (generic CRUD)
3. Create `RepositoryInterface.js` (DAL contract)
4. Create Dockerfile and docker-compose templates
5. Create package.json template

### Folder Structure

```
brick-library/
├── backend-bricks/
│   ├── controllers/
│   │   └── BaseController.js
│   ├── services/
│   │   └── .gitkeep
│   └── repository/
│       ├── RepositoryInterface.js
│       └── FlatFileProvider.js
├── frontend-bricks/
│   ├── layouts/
│   │   └── .gitkeep
│   ├── components/
│   │   └── .gitkeep
│   └── registry/
│       └── .gitkeep
└── templates/
    ├── Dockerfile.template
    ├── docker-compose.template.yml
    ├── package.json.template
    └── README.template.md
```

### BaseController.js

```javascript
// brick-library/backend-bricks/controllers/BaseController.js
class BaseController {
  constructor(repository, entitySlug) {
    this.repository = repository;
    this.entitySlug = entitySlug;
  }

  async getAll(req, res) {
    try {
      const items = await this.repository.findAll(this.entitySlug);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getById(req, res) {
    try {
      const item = await this.repository.findById(this.entitySlug, req.params.id);
      if (!item) return res.status(404).json({ error: 'Not found' });
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async create(req, res) {
    try {
      const item = await this.repository.create(this.entitySlug, req.body);
      res.status(201).json(item);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async update(req, res) {
    try {
      const item = await this.repository.update(this.entitySlug, req.params.id, req.body);
      if (!item) return res.status(404).json({ error: 'Not found' });
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async delete(req, res) {
    try {
      const deleted = await this.repository.delete(this.entitySlug, req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Not found' });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = BaseController;
```

### ⛔ Do NOT

- Do NOT modify platform backend files (DEV-B's domain)
- Do NOT create AI-related files (DEV-D's domain)

### ✅ Definition of Done

- [ ] Folder structure created
- [ ] BaseController has all CRUD methods
- [ ] RepositoryInterface defines contract
- [ ] Templates have placeholders for dynamic values

---

## Task C2: FlatFileProvider Implementation

**Day:** 2 (Jan 2)  
**Duration:** 6-8 hours  
**Dependencies:** C1 complete  

### What to Do

1. Implement full `FlatFileProvider.js`
2. Add file locking for concurrent access (optional)
3. Add data validation before write
4. Create test JSON files for validation

### FlatFileProvider.js

```javascript
// brick-library/backend-bricks/repository/FlatFileProvider.js
const fs = require('fs').promises;
const path = require('path');
const { v4: uuid } = require('uuid');

class FlatFileProvider {
  constructor(dataPath = './data') {
    this.dataPath = dataPath;
  }

  _getFilePath(entitySlug) {
    return path.join(this.dataPath, `${entitySlug}.json`);
  }

  async _ensureFile(entitySlug) {
    const filePath = this._getFilePath(entitySlug);
    try {
      await fs.access(filePath);
    } catch {
      await fs.mkdir(this.dataPath, { recursive: true });
      await fs.writeFile(filePath, '[]');
    }
  }

  async findAll(entitySlug) {
    await this._ensureFile(entitySlug);
    const data = await fs.readFile(this._getFilePath(entitySlug), 'utf8');
    return JSON.parse(data);
  }

  async findById(entitySlug, id) {
    const items = await this.findAll(entitySlug);
    return items.find(item => item.id === id) || null;
  }

  async create(entitySlug, data) {
    const items = await this.findAll(entitySlug);
    const newItem = {
      id: uuid(),
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    items.push(newItem);
    await fs.writeFile(this._getFilePath(entitySlug), JSON.stringify(items, null, 2));
    return newItem;
  }

  async update(entitySlug, id, data) {
    const items = await this.findAll(entitySlug);
    const index = items.findIndex(item => item.id === id);
    if (index === -1) return null;
    
    items[index] = {
      ...items[index],
      ...data,
      id: items[index].id, // Prevent ID change
      created_at: items[index].created_at, // Preserve original
      updated_at: new Date().toISOString()
    };
    
    await fs.writeFile(this._getFilePath(entitySlug), JSON.stringify(items, null, 2));
    return items[index];
  }

  async delete(entitySlug, id) {
    const items = await this.findAll(entitySlug);
    const index = items.findIndex(item => item.id === id);
    if (index === -1) return false;
    
    items.splice(index, 1);
    await fs.writeFile(this._getFilePath(entitySlug), JSON.stringify(items, null, 2));
    return true;
  }
}

module.exports = FlatFileProvider;
```

### ⛔ Do NOT

- Do NOT add PostgreSQL implementation yet (Increment 2)

### ✅ Definition of Done

- [ ] All CRUD operations work with JSON files
- [ ] Auto-creates data directory and files
- [ ] Adds `id`, `created_at`, `updated_at` automatically
- [ ] Handles file not found gracefully

---

## Task C3: Inventory Service Bricks

**Day:** 3 (Jan 3)  
**Duration:** 6-8 hours  
**Dependencies:** C2 complete  

### What to Do

1. Create `InventoryService.js` (stock quantity management)
2. Create `StockValidationLogic.js` (prevent negative stock)
3. Create `AlertTriggerLogic.js` (low stock threshold)
4. Create `AuditTrailLogic.js` (log all changes)

### Files to Create

```
brick-library/backend-bricks/services/
├── InventoryService.js
├── StockValidationLogic.js
├── AlertTriggerLogic.js
└── AuditTrailLogic.js
```

### InventoryService.js

```javascript
class InventoryService {
  constructor(repository, entitySlug) {
    this.repository = repository;
    this.entitySlug = entitySlug;
  }

  async adjustStock(id, delta) {
    const item = await this.repository.findById(this.entitySlug, id);
    if (!item) throw new Error('Item not found');
    
    const newQuantity = (item.quantity || 0) + delta;
    return this.repository.update(this.entitySlug, id, { quantity: newQuantity });
  }

  async setStock(id, quantity) {
    return this.repository.update(this.entitySlug, id, { quantity });
  }

  async getStockLevel(id) {
    const item = await this.repository.findById(this.entitySlug, id);
    return item?.quantity || 0;
  }
}

module.exports = InventoryService;
```

### StockValidationLogic.js

```javascript
class StockValidationLogic {
  static validate(currentQuantity, delta) {
    const newQuantity = currentQuantity + delta;
    if (newQuantity < 0) {
      throw new Error(`Insufficient stock. Current: ${currentQuantity}, Requested: ${Math.abs(delta)}`);
    }
    return true;
  }

  static wrap(inventoryService) {
    const originalAdjustStock = inventoryService.adjustStock.bind(inventoryService);
    
    inventoryService.adjustStock = async function(id, delta) {
      const item = await this.repository.findById(this.entitySlug, id);
      StockValidationLogic.validate(item?.quantity || 0, delta);
      return originalAdjustStock(id, delta);
    };
    
    return inventoryService;
  }
}

module.exports = StockValidationLogic;
```

### ⛔ Do NOT

- Do NOT add customer/invoice services (future increments)

### ✅ Definition of Done

- [ ] InventoryService can adjust/set stock
- [ ] StockValidation prevents negative quantities
- [ ] AlertTrigger checks threshold on updates
- [ ] AuditTrail logs changes to _audit_log.json

---

## Task C4: Project Assembler Engine

**Day:** 4 (Jan 4)  
**Duration:** 8 hours  
**Dependencies:** C3 complete  

### What to Do

1. Create `BrickRepository.js` (reads from brick-library)
2. Create `SDFInterpreter.js` (parses SDF, extracts hints)
3. Create `ProjectAssembler.js` (main orchestrator)
4. Implement brick injection logic
5. Generate output folder with assembled files

### Files to Create

```
platform/backend/src/assembler/
├── ProjectAssembler.js
├── BrickRepository.js
├── SDFInterpreter.js
└── ConfigGenerator.js
```

### ProjectAssembler.js (Core Logic)

```javascript
const fs = require('fs').promises;
const path = require('path');
const BrickRepository = require('./BrickRepository');
const SDFInterpreter = require('./SDFInterpreter');
const ConfigGenerator = require('./ConfigGenerator');

class ProjectAssembler {
  constructor(brickLibraryPath, outputPath) {
    this.brickRepo = new BrickRepository(brickLibraryPath);
    this.outputPath = outputPath;
  }

  async assemble(projectId, sdf) {
    const interpreter = new SDFInterpreter(sdf);
    const outputDir = path.join(this.outputPath, projectId);
    
    // Create output structure
    await this._createStructure(outputDir);
    
    // Copy base files
    await this._copyTemplates(outputDir, sdf);
    
    // Assemble backend
    await this._assembleBackend(outputDir, interpreter);
    
    // Assemble frontend
    await this._assembleFrontend(outputDir, interpreter);
    
    // Generate configs
    await this._generateConfigs(outputDir, interpreter);
    
    return outputDir;
  }

  async _assembleBackend(outputDir, interpreter) {
    const services = interpreter.getRequiredServices();
    
    // Always copy base controller
    await this.brickRepo.copyBrick('BaseController.js', 
      path.join(outputDir, 'src/controllers/'));
    
    // Always copy repository
    await this.brickRepo.copyBrick('FlatFileProvider.js',
      path.join(outputDir, 'src/repository/'));
    
    // Copy required services based on SDF
    for (const service of services) {
      await this.brickRepo.copyBrick(`${service}.js`,
        path.join(outputDir, 'src/services/'));
    }
    
    // Generate entity-specific routes
    for (const entity of interpreter.getEntities()) {
      await this._generateEntityRoutes(outputDir, entity);
    }
  }

  async _generateEntityRoutes(outputDir, entity) {
    const routeTemplate = `
const express = require('express');
const router = express.Router();
const BaseController = require('../controllers/BaseController');
const FlatFileProvider = require('../repository/FlatFileProvider');

const repository = new FlatFileProvider('./data');
const controller = new BaseController(repository, '${entity.slug}');

router.get('/', (req, res) => controller.getAll(req, res));
router.get('/:id', (req, res) => controller.getById(req, res));
router.post('/', (req, res) => controller.create(req, res));
router.put('/:id', (req, res) => controller.update(req, res));
router.delete('/:id', (req, res) => controller.delete(req, res));

module.exports = router;
`;
    
    await fs.writeFile(
      path.join(outputDir, `src/routes/${entity.slug}Routes.js`),
      routeTemplate
    );
  }

  // ... other methods
}

module.exports = ProjectAssembler;
```

### ⛔ Do NOT

- Do NOT modify platform API endpoints (DEV-B's domain)
- Do NOT add new AI prompts (DEV-D's domain)

### ✅ Definition of Done

- [ ] BrickRepository can list and copy bricks
- [ ] SDFInterpreter extracts entities and hints
- [ ] Assembler creates complete output folder
- [ ] Generated code is valid JavaScript/JSX

---

## Task C5: Frontend Bricks

**Day:** 5 (Jan 5)  
**Duration:** 8 hours  
**Dependencies:** C4 complete  

### What to Do

1. Create `BasicTableView.jsx` brick
2. Create `EntityForm.jsx` brick
3. Create `DashboardLayout.jsx` brick
4. Create `EntityRegistry.js` for component mapping
5. Create `ui-config.json` generator

### Files to Create

```
brick-library/frontend-bricks/
├── layouts/
│   └── DashboardLayout.jsx
├── components/
│   ├── BasicTableView.jsx
│   ├── EntityForm.jsx
│   └── AlertBanner.jsx
└── registry/
    └── EntityRegistry.js
```

### BasicTableView.jsx

```jsx
// brick-library/frontend-bricks/components/BasicTableView.jsx
import React, { useState, useEffect } from 'react';

function BasicTableView({ entitySlug, fields, apiUrl }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${apiUrl}/api/${entitySlug}`)
      .then(res => res.json())
      .then(data => {
        setItems(data);
        setLoading(false);
      });
  }, [entitySlug, apiUrl]);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white border">
        <thead className="bg-gray-100">
          <tr>
            {fields.map(field => (
              <th key={field.key} className="px-4 py-2 text-left">
                {field.label}
              </th>
            ))}
            <th className="px-4 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id} className="border-t">
              {fields.map(field => (
                <td key={field.key} className="px-4 py-2">
                  {item[field.key]}
                </td>
              ))}
              <td className="px-4 py-2">
                <button className="text-blue-600 mr-2">Edit</button>
                <button className="text-red-600">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default BasicTableView;
```

### ⛔ Do NOT

- Do NOT modify platform frontend (DEV-A's domain)

### ✅ Definition of Done

- [ ] BasicTableView renders any entity dynamically
- [ ] EntityForm creates forms from field definitions
- [ ] Registry maps entity slugs to components
- [ ] ui-config.json template generates correctly

---

## Task C6: Integration & Testing

**Day:** 6 (Jan 6)  
**Duration:** Full day  
**Dependencies:** All C tasks complete  

### What to Do

1. Test full assembly pipeline
2. Verify generated code runs in Docker
3. Fix any brick bugs
4. Ensure all templates have correct placeholders

### ✅ Definition of Done

- [ ] Assembled project runs with `docker compose up`
- [ ] CRUD operations work on generated entities
- [ ] UI renders all entities from config

---

---

# DEV-D: AI Gateway & Integration (Burak Tan Bilgi)

## Domain Ownership

```
platform/
└── ai-gateway/                 ← YOUR ENTIRE DOMAIN
    ├── src/
    │   ├── main.py            # FastAPI entry point
    │   ├── services/
    │   │   ├── gemini_client.py
    │   │   └── sdf_validator.py
    │   ├── prompts/
    │   │   ├── analyze_prompt.txt
    │   │   └── clarify_prompt.txt
    │   └── schemas/
    │       └── sdf_schema.json
    ├── requirements.txt
    └── Dockerfile
```

---

## Task D1: AI Gateway Scaffolding + Gemini Connection

**Day:** 1 (Jan 1)  
**Duration:** 6-8 hours  
**Dependencies:** None  

### What to Do

1. Initialize Python FastAPI project
2. Install Google GenAI SDK
3. Create basic health endpoint
4. Test Gemini API connection
5. Set up environment configuration

### Commands

```bash
cd platform
mkdir ai-gateway && cd ai-gateway
python -m venv venv
source venv/bin/activate  # or .\venv\Scripts\activate on Windows
pip install fastapi uvicorn google-generativeai python-dotenv pydantic
pip freeze > requirements.txt
```

### Folder Structure

```
ai-gateway/
├── src/
│   ├── main.py
│   ├── config.py
│   ├── services/
│   │   ├── __init__.py
│   │   └── gemini_client.py
│   ├── prompts/
│   │   └── .gitkeep
│   └── schemas/
│       └── .gitkeep
├── requirements.txt
├── Dockerfile
└── .env.example
```

### main.py

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="CustomERP AI Gateway")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok", "service": "ai-gateway"}

# Routes will be added in subsequent tasks
```

### gemini_client.py

```python
import os
import google.generativeai as genai

class GeminiClient:
    def __init__(self):
        api_key = os.getenv("GOOGLE_AI_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_AI_API_KEY not set")
        
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-2.5-pro-preview-06-05')
    
    async def generate(self, prompt: str) -> str:
        response = self.model.generate_content(prompt)
        return response.text
    
    async def test_connection(self) -> bool:
        try:
            response = await self.generate("Say 'OK' if you can read this.")
            return "OK" in response.upper()
        except Exception as e:
            print(f"Connection test failed: {e}")
            return False
```

### .env.example

```env
GOOGLE_AI_API_KEY=your-api-key-here
PORT=8000
```

### ⛔ Do NOT

- Do NOT commit API keys
- Do NOT modify backend/frontend code
- Do NOT add unnecessary dependencies

### ✅ Definition of Done

- [ ] `uvicorn src.main:app --reload` starts on port 8000
- [ ] `GET /health` returns status
- [ ] Gemini connection test passes
- [ ] Environment variable loading works

---

## Task D2: Prompt Engineering + SDF Schema

**Day:** 2 (Jan 2)  
**Duration:** 8 hours  
**Dependencies:** D1 complete  

### What to Do

1. Create SDF JSON schema for validation
2. Write `analyze_prompt.txt` for initial analysis
3. Write `clarify_prompt.txt` for clarification
4. Create `sdf_validator.py` using JSON Schema
5. Test prompts with sample descriptions

### Files to Create

```
src/
├── prompts/
│   ├── analyze_prompt.txt
│   └── clarify_prompt.txt
├── schemas/
│   └── sdf_schema.json
└── services/
    └── sdf_validator.py
```

### analyze_prompt.txt

```
You are an ERP requirements analyst. Your task is to analyze a business description and extract structured data.

Given the following business description, identify:
1. Business entities (things the user manages, e.g., Products, Customers)
2. Fields for each entity (properties like name, price, quantity)
3. Relationships between entities
4. Special features needed (stock tracking, alerts, etc.)

IMPORTANT RULES:
- Output ONLY valid JSON, no explanations
- Use the exact schema format provided below
- If information is unclear, add a question to the "clarifications_needed" array
- Do not invent data the user didn't mention

BUSINESS DESCRIPTION:
{description}

EXPECTED OUTPUT SCHEMA:
{
  "entities": [
    {
      "slug": "lowercase_underscore_name",
      "display_name": "Human Readable Name",
      "fields": [
        {"name": "field_name", "type": "string|integer|decimal|boolean|date|reference", "required": true|false}
      ],
      "features": {
        "stock_tracking": true|false,
        "low_stock_threshold": number|null
      }
    }
  ],
  "relations": [
    {"name": "relation_name", "type": "one-to-many|many-to-one|many-to-many", "source": "entity_slug", "target": "entity_slug"}
  ],
  "clarifications_needed": [
    {"id": "q1", "question": "Question text?", "type": "yes_no|choice|text"}
  ],
  "confidence": 0.0-1.0
}

OUTPUT JSON:
```

### sdf_schema.json

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["entities"],
  "properties": {
    "entities": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["slug", "display_name", "fields"],
        "properties": {
          "slug": { "type": "string", "pattern": "^[a-z_]+$" },
          "display_name": { "type": "string" },
          "fields": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["name", "type"],
              "properties": {
                "name": { "type": "string" },
                "type": { "enum": ["string", "integer", "decimal", "boolean", "date", "datetime", "uuid", "reference", "enum"] },
                "required": { "type": "boolean" }
              }
            }
          },
          "features": { "type": "object" }
        }
      }
    },
    "relations": { "type": "array" },
    "clarifications_needed": { "type": "array" },
    "confidence": { "type": "number", "minimum": 0, "maximum": 1 }
  }
}
```

### ⛔ Do NOT

- Do NOT hardcode business logic in prompts
- Do NOT skip JSON validation

### ✅ Definition of Done

- [ ] Prompts extract entities from test descriptions
- [ ] SDF schema validates AI output
- [ ] Invalid JSON is caught and retried
- [ ] Clarification questions are generated appropriately

---

## Task D3: Analyze & Clarify Endpoints

**Day:** 3 (Jan 3)  
**Duration:** 8 hours  
**Dependencies:** D2 complete  

### What to Do

1. Implement `POST /ai/analyze` endpoint
2. Implement `POST /ai/clarify` endpoint
3. Implement `POST /ai/finalize` endpoint
4. Add request/response models with Pydantic
5. Handle errors and retries

### Files to Create

```
src/
├── routes/
│   └── ai_routes.py
├── models/
│   ├── requests.py
│   └── responses.py
└── services/
    └── analysis_service.py
```

### ai_routes.py

```python
from fastapi import APIRouter, HTTPException
from ..models.requests import AnalyzeRequest, ClarifyRequest
from ..models.responses import AnalyzeResponse, SDFResponse
from ..services.analysis_service import AnalysisService

router = APIRouter(prefix="/ai", tags=["AI"])
service = AnalysisService()

@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest):
    try:
        result = await service.analyze(request.description, request.prior_context)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/clarify", response_model=AnalyzeResponse)
async def clarify(request: ClarifyRequest):
    try:
        result = await service.clarify(request.partial_sdf, request.answers)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/finalize", response_model=SDFResponse)
async def finalize(request: ClarifyRequest):
    try:
        result = await service.finalize(request.partial_sdf, request.answers)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### models/requests.py

```python
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class AnalyzeRequest(BaseModel):
    description: str
    prior_context: Optional[Dict[str, Any]] = None

class Answer(BaseModel):
    question_id: str
    answer: str

class ClarifyRequest(BaseModel):
    partial_sdf: Dict[str, Any]
    answers: List[Answer]
```

### ⛔ Do NOT

- Do NOT call Gemini for every small request (batch when possible)
- Do NOT expose internal errors to clients

### ✅ Definition of Done

- [ ] /analyze returns partial SDF + questions
- [ ] /clarify incorporates answers and re-analyzes
- [ ] /finalize returns complete, validated SDF
- [ ] All responses match defined schemas

---

## Task D4: Error Handling + Retry Logic

**Day:** 4 (Jan 4)  
**Duration:** 6-8 hours  
**Dependencies:** D3 complete  

### What to Do

1. Add retry logic for Gemini API failures
2. Add timeout handling (60s max)
3. Add JSON parsing error recovery
4. Add detailed error logging
5. Test edge cases (empty description, etc.)

### Error Recovery Flow

```python
async def analyze_with_retry(description: str, max_retries: int = 3):
    for attempt in range(max_retries):
        try:
            response = await gemini_client.generate(prompt)
            
            # Try to parse JSON
            try:
                sdf = json.loads(response)
            except json.JSONDecodeError:
                # Ask AI to fix the JSON
                fix_prompt = f"Fix this invalid JSON:\n{response}"
                response = await gemini_client.generate(fix_prompt)
                sdf = json.loads(response)
            
            # Validate against schema
            validate_sdf(sdf)
            return sdf
            
        except TimeoutError:
            if attempt == max_retries - 1:
                raise
            await asyncio.sleep(2 ** attempt)  # Exponential backoff
        except Exception as e:
            logger.error(f"Attempt {attempt + 1} failed: {e}")
            if attempt == max_retries - 1:
                raise
```

### ⛔ Do NOT

- Do NOT retry indefinitely
- Do NOT swallow errors silently

### ✅ Definition of Done

- [ ] API timeout after 60s
- [ ] Retry 3 times with backoff
- [ ] Invalid JSON triggers re-prompt
- [ ] All errors logged with context

---

## Task D5: Integration Testing + Docker

**Day:** 5 (Jan 5)  
**Duration:** 8 hours  
**Dependencies:** D4 complete, B4 ready for integration  

### What to Do

1. Create integration tests with platform backend
2. Create Dockerfile for AI Gateway
3. Add to docker-compose.yml
4. Test full flow: description → SDF
5. Document API for DEV-B

### Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/

ENV PYTHONPATH=/app

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Integration Test Script

```python
# tests/test_integration.py
import httpx
import asyncio

async def test_full_flow():
    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        # Test analyze
        response = await client.post("/ai/analyze", json={
            "description": "I run a small electronics shop selling phones and accessories. I need to track inventory and know when items are running low."
        })
        assert response.status_code == 200
        data = response.json()
        
        assert "entities" in data["partial_sdf"]
        assert len(data["partial_sdf"]["entities"]) > 0
        
        # If questions exist, answer them
        if data.get("questions"):
            response = await client.post("/ai/clarify", json={
                "partial_sdf": data["partial_sdf"],
                "answers": [{"question_id": q["id"], "answer": "yes"} for q in data["questions"]]
            })
            assert response.status_code == 200

if __name__ == "__main__":
    asyncio.run(test_full_flow())
```

### ⛔ Do NOT

- Do NOT skip Docker testing
- Do NOT assume network always works

### ✅ Definition of Done

- [ ] Docker container builds successfully
- [ ] Container runs and responds to health check
- [ ] Full analyze→clarify→finalize flow works
- [ ] Platform backend can call AI Gateway

---

## Task D6: End-to-End Testing + Documentation

**Day:** 6 (Jan 6)  
**Duration:** Full day  
**Dependencies:** All tasks complete  

### What to Do

1. Run full end-to-end tests with all services
2. Fix any integration bugs
3. Document API endpoints in code comments
4. Prepare demo scenarios
5. Create test description examples

### Test Scenarios

1. **Happy Path:** Clear description → Complete SDF
2. **Clarification Path:** Ambiguous description → Questions → Answers → SDF
3. **Error Path:** Invalid input → Proper error response
4. **Timeout Path:** Slow response → Timeout handled

### ✅ Definition of Done

- [ ] All scenarios pass
- [ ] Demo works end-to-end
- [ ] API documented
- [ ] No critical bugs

---

---

## Daily Standup Schedule

Each day at **9:00 AM**, quick 15-minute sync:

| Day | Focus |
|:----|:------|
| Day 1 | Scaffolding progress, blockers |
| Day 2 | Auth + Core services status |
| Day 3 | API integration points |
| Day 4 | AI flow testing |
| Day 5 | Assembly + Docker testing |
| Day 6 | Demo preparation, final fixes |

---

## Integration Points & Handoffs

| From | To | Interface | When |
|:-----|:---|:----------|:-----|
| DEV-A | DEV-B | Auth API calls | Day 2 evening |
| DEV-A | DEV-B | Project API calls | Day 3 evening |
| DEV-B | DEV-D | AI Gateway HTTP | Day 4 morning |
| DEV-B | DEV-C | Assembler invocation | Day 5 morning |
| DEV-C | DEV-B | Generated artifact path | Day 5 afternoon |
| DEV-D | DEV-B | SDF JSON format | Day 3 evening |

---

## Conflict Resolution

If two developers need to modify the same file:

1. **Stop** — Don't both edit
2. **Communicate** — Slack/call immediately
3. **Decide** — Who owns it? What's the interface?
4. **Document** — Update this file if ownership changes

---

## Success Criteria for Increment 1

| Criteria | Metric |
|:---------|:-------|
| User can register/login | Auth flow complete |
| User can create project | Project saved to DB |
| AI generates SDF from description | 70% entity accuracy |
| System generates Inventory module | Docker container runs |
| User can download ZIP | Valid, runnable code |

---

*Sprint Plan v1.0 — January 1, 2026*

