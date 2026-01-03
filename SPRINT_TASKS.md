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

## ⚠️ IMPORTANT: TypeScript Required

All frontend code MUST be written in TypeScript (`.ts` / `.tsx` files).

**Key Rules:**
- Use `.tsx` for React components, `.ts` for utilities/services
- Define types in `src/types/` directory
- Use proper type annotations for props, state, and API responses
- Avoid `any` type - use `unknown` if type is truly unknown
- Import types with `import type { ... }` for type-only imports

## Domain Ownership

```
platform/
└── frontend/
    ├── src/
    │   ├── components/     ← YOUR DOMAIN (.tsx files)
    │   ├── pages/          ← YOUR DOMAIN (.tsx files)
    │   ├── hooks/          ← YOUR DOMAIN (.ts files)
    │   ├── context/        ← YOUR DOMAIN (.tsx files)
    │   ├── services/       ← YOUR DOMAIN (.ts files)
    │   ├── types/          ← YOUR DOMAIN (type definitions)
    │   └── styles/         ← YOUR DOMAIN
    ├── package.json        ← YOUR DOMAIN
    ├── tsconfig.json       ← YOUR DOMAIN
    └── vite.config.ts      ← YOUR DOMAIN
```

---

## Task A1: Project Scaffolding

**Day:** 1 (Jan 1)  
**Duration:** 4-6 hours  
**Dependencies:** None  

### What to Do

1. Initialize React project with Vite + TypeScript template
2. Install and configure Tailwind CSS
3. Set up folder structure as shown above
4. Configure environment variables for API URL
5. Create basic `App.tsx` with React Router

### Commands

```bash
cd platform
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install react-router-dom axios
npm install -D @types/react @types/react-dom
```

### Files to Create

```
frontend/
├── src/
│   ├── App.tsx                 # Router setup
│   ├── main.tsx                # Entry point
│   ├── index.css               # Tailwind imports
│   ├── vite-env.d.ts           # Vite environment types
│   ├── types/
│   │   └── auth.ts             # Auth type definitions
│   ├── components/
│   │   └── .gitkeep
│   ├── pages/
│   │   └── .gitkeep
│   ├── hooks/
│   │   └── .gitkeep
│   ├── context/
│   │   └── AuthContext.tsx     # Skeleton
│   └── services/
│       └── api.ts              # Axios instance
├── .env.example
├── tsconfig.json
├── tsconfig.node.json
└── tailwind.config.js
```

### Configuration

**tailwind.config.js:**
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
}
```

**src/services/api.ts:**
```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
```

**src/types/auth.ts:**
```typescript
export interface User {
  id: string;
  name: string;
  email: string;
  role?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthResponse>;
  register: (name: string, email: string, password: string) => Promise<AuthResponse>;
  logout: () => void;
}
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

1. Create `LoginPage.tsx` with email/password form
2. Create `RegisterPage.tsx` with name/email/password form
3. Implement `AuthContext.tsx` for token storage with proper types
4. Create `ProtectedRoute.tsx` wrapper
5. Style with Tailwind (clean, modern look)

### Files to Create/Modify

```
src/
├── types/
│   └── auth.ts                 # Type definitions
├── context/
│   └── AuthContext.tsx         # Full implementation with types
├── pages/
│   ├── LoginPage.tsx
│   └── RegisterPage.tsx
├── components/
│   ├── ProtectedRoute.tsx
│   └── ui/
│       ├── Input.tsx           # Reusable input with types
│       └── Button.tsx          # Reusable button with types
└── App.tsx                     # Add auth routes
```

### AuthContext Pattern

```typescript
// src/context/AuthContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/api';
import type { User, AuthResponse, AuthContextType } from '../types/auth';

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      setUser(JSON.parse(savedUser) as User);
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<AuthResponse> => {
    const res = await api.post<AuthResponse>('/auth/login', { email, password });
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data;
  };

  const register = async (name: string, email: string, password: string): Promise<AuthResponse> => {
    const res = await api.post<AuthResponse>('/auth/register', { name, email, password });
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
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

1. Create `DashboardLayout.tsx` with sidebar + main area
2. Create `ProjectListPage.tsx` showing user's projects
3. Create `ProjectCard.tsx` component
4. Create `NewProjectModal.tsx` for project creation
5. Implement project list fetching with proper types

### Files to Create

```
src/
├── types/
│   └── project.ts              # Project type definitions
├── components/
│   ├── layout/
│   │   ├── DashboardLayout.tsx
│   │   ├── Sidebar.tsx
│   │   └── Header.tsx
│   ├── projects/
│   │   ├── ProjectCard.tsx
│   │   └── NewProjectModal.tsx
├── pages/
│   └── ProjectListPage.tsx
└── services/
    └── projectService.ts       # API calls for projects
```

### Type Definitions

```typescript
// src/types/project.ts
export interface Project {
  id: string;
  name: string;
  status: 'Draft' | 'Analyzing' | 'Ready' | 'Generated' | 'Approved';
  created_at: string;
  updated_at: string;
}

export interface CreateProjectRequest {
  name: string;
}
```

### Layout Structure

```tsx
// DashboardLayout.tsx
import { Outlet } from 'react-router-dom';

export default function DashboardLayout() {
  return (
    <div className="flex h-screen">
      <Sidebar />                    {/* Fixed left sidebar */}
      <div className="flex-1 flex flex-col">
        <Header />                   {/* Top bar with user menu */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />                 {/* Page content */}
        </main>
      </div>
    </div>
  );
}
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

1. Create `ProjectDetailPage.tsx` as main workspace
2. Create `ChatPanel.tsx` for AI conversation
3. Create `ClarificationDialog.tsx` for AI questions
4. Create `MessageBubble.tsx` for chat messages
5. Implement real-time status updates with proper types

### Files to Create

```
src/
├── types/
│   └── chat.ts                 # Chat/AI type definitions
├── components/
│   ├── chat/
│   │   ├── ChatPanel.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── DescriptionInput.tsx
│   │   └── ClarificationDialog.tsx
├── pages/
│   └── ProjectDetailPage.tsx
└── services/
    └── aiService.ts            # API calls for AI operations
```

### Type Definitions

```typescript
// src/types/chat.ts
export interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
}

export interface ClarificationQuestion {
  id: string;
  question: string;
  type: 'yes_no' | 'choice' | 'text';
  options?: string[];
}

export interface AnalyzeResponse {
  partial_sdf: Record<string, unknown>;
  questions: ClarificationQuestion[];
}
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

1. Create `PreviewPane.tsx` showing generated schema
2. Create `ERDVisualization.tsx` (simple box diagram)
3. Create `APIEndpointList.tsx` showing routes
4. Create `ApprovalPanel.tsx` with approve/download buttons
5. Implement download functionality with proper types

### Files to Create

```
src/
├── types/
│   └── schema.ts               # Schema/SDF type definitions
├── components/
│   ├── preview/
│   │   ├── PreviewPane.tsx
│   │   ├── ERDVisualization.tsx
│   │   ├── EntityCard.tsx
│   │   ├── APIEndpointList.tsx
│   │   └── ApprovalPanel.tsx
└── services/
    └── downloadService.ts      # Handle ZIP download
```

### Type Definitions

```typescript
// src/types/schema.ts
export interface EntityField {
  name: string;
  type: 'string' | 'integer' | 'decimal' | 'boolean' | 'date' | 'uuid' | 'reference';
  required: boolean;
}

export interface Entity {
  slug: string;
  display_name: string;
  fields: EntityField[];
}

export interface SDFPreview {
  entities: Entity[];
  relations: Relation[];
}
```

### ERD Visualization (Simple CSS Boxes)

No external library needed. Use flexbox/grid with CSS arrows:

```tsx
interface EntityCardProps {
  entity: Entity;
}

// Simple entity box
function EntityCard({ entity }: EntityCardProps) {
  return (
    <div className="border-2 border-gray-700 rounded-lg p-4 bg-white shadow">
      <div className="font-bold text-lg border-b pb-2">{entity.display_name}</div>
      <ul className="text-sm mt-2 space-y-1">
        {entity.fields.map(field => (
          <li key={field.name}>
            {field.name === 'id' ? '🔑' : '📝'} {field.name} ({field.type})
          </li>
        ))}
      </ul>
    </div>
  );
}
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
│   ├── core/                   ← Base classes
│   └── mixins/                 ← Feature traits (Batch, Serial, Audit)
├── frontend-bricks/
└── templates/

platform/assembler/                              ← YOUR DOMAIN (MOVED from backend)
│   ├── ProjectAssembler.js
│   ├── CodeWeaver.js           ← Advanced injection engine (Robust String Replacement)
│   ├── BrickRepository.js
│   ├── TemplateEngine.js
│   └── generators/
│       ├── BackendGenerator.js
│       ├── FrontendGenerator.js           ← Main orchestrator
│       └── frontend/                      ← NEW: Modular Page Builders
│           ├── dashboardHome.js
│           ├── reportsPage.js
│           ├── entityPages.js             ← Wizard generators (Issue, Receive, etc.)
│           └── ...
```

---

## Task C1: Core Architecture & The "Code Weaver"

**Day:** 1 (Jan 1)  
**Duration:** 8 hours  
**Dependencies:** None  

### Goal
Build the decoupled assembly engine in `platform/assembler` that can safely inject code snippets.

### What to Do

1.  **Implement `CodeWeaver.js`**: A utility that reads a template and injects code at defined markers.
    *   *Update:* Must use function-based replacement `str.replace(marker, () => ...)` to prevent regex `$` injection attacks.
2.  **Create `BaseService.js.hbs`**: The skeleton service with hook points (`BEFORE_CREATE_VALIDATION`, `AFTER_DELETE`, etc.).
3.  **Create `RepositoryInterface.js`**: Base interface for data access.

### Architecture: The Hook System

**brick-library/backend-bricks/core/BaseService.js.hbs**
```javascript
class {{EntityName}}Service {
  constructor(repository) {
    this.repository = repository;
  }

  async create(data) {
    // @HOOK: BEFORE_CREATE_VALIDATION
    
    const result = await this.repository.create(this.slug, data);
    
    // @HOOK: AFTER_CREATE_LOGGING
    
    return result;
  }
}
```

**platform/assembler/CodeWeaver.js**
```javascript
inject(hookName, codeSnippet) {
  const marker = `// @HOOK: ${hookName}`;
  // CRITICAL: Use callback to handle special chars like '$' in the snippet
  this.content = this.content.replace(marker, (match) => `${match}\n    ${codeSnippet}`);
}
```

### ✅ Definition of Done
- [x] `CodeWeaver` correctly handles snippets with `$` characters (regex/template literals).
- [x] `BaseService` has comprehensive hooks.
- [x] Assembler core is isolated in `platform/assembler`.

---

## Task C2: Data Layer with Referential Integrity

**Day:** 2 (Jan 2)  
**Duration:** 8 hours  
**Dependencies:** C1 complete  

### Goal
A `FlatFileProvider` that supports relational queries, atomic writes, and **Referential Integrity Protection**.

### What to Do

1.  **Implement `FlatFileProvider.js`**:
    *   `findAll`, `create`, `update`, `delete`.
    *   **Upsert Logic**: `create` must ignore system fields (`id`, `created_at`) to allow safe CSV imports.
2.  **Implement Delete Protection**:
    *   Before deleting, check if other entities reference this ID.
    *   If referenced, block delete and return 409 with a list of dependent records.
3.  **Implement Reference Resolution**:
    *   Helper to fetch "Display Fields" (e.g., product names instead of IDs) for UI.

### Key Logic: Delete Protection
```javascript
async delete(slug, id) {
  const dependencies = await this._findDependencies(slug, id);
  if (dependencies.length > 0) {
    throw new Error(`Cannot delete: Referenced by ${dependencies.length} records in ${dependencies[0].entity}`);
  }
  // ... proceed to delete
}
```

### ✅ Definition of Done
- [x] Provider ignores system fields on create (safe import).
- [x] Deletion is blocked if foreign key constraints exist.
- [x] "Display Field" lookup logic implemented.

---

## Task C3: The Mixin Library (Features & System Entities)

**Day:** 3 (Jan 3)  
**Duration:** 8 hours  
**Dependencies:** C2 complete  

### Goal
Create Traits that implement features like Audit Logging and Location Management, interacting with **System Entities**.

### What to Do

1.  **Create `AuditMixin.js`**:
    *   Intercepts `AFTER_CREATE`, `AFTER_UPDATE`, `AFTER_DELETE`.
    *   Writes to system entity `__audit_logs` (not just console).
2.  **Create `LocationMixin.js`**:
    *   Validates location references for `multi_location` enabled entities.
3.  **Define System Entities**:
    *   `__audit_logs`: Stores activity history.
    *   `__reports`: Stores scheduled report snapshots.

### Example: AuditMixin.js (Real Implementation)
```javascript
// brick-library/backend-bricks/mixins/AuditMixin.js
module.exports = {
  hooks: {
    'AFTER_CREATE_LOGGING': `
      const auditRepo = this.repository.getSystemRepository('__audit_logs');
      await auditRepo.create({
        action: 'CREATE',
        entity: this.slug,
        entity_id: result.id,
        message: \`Created \${this.slug} \${result.id}\`,
        at: new Date().toISOString(),
      });
    `
  }
}
```

### ✅ Definition of Done
- [x] `AuditMixin` writes to `__audit_logs` table.
- [x] System entities (`__audit_logs`, `__reports`) are supported by the repository.

---

## Task C4: The Modular Assembler Engine

**Day:** 4 (Jan 4)  
**Duration:** 10 hours  
**Dependencies:** C3 complete  

### Goal
The "Architect" that parses the advanced SDF (`modules`, `inventory_ops`, `scheduled_reports`) and orchestrates generation.

### What to Do

1.  **Decouple Generators**: Move logic out of backend source into `platform/assembler/generators/`.
2.  **Implement Global Module Support**:
    *   Check `sdf.modules.activity_log` -> Inject `AuditMixin` globally.
    *   Check `sdf.modules.scheduled_reports` -> Inject Cron jobs in `index.js`.
3.  **Implement Report Snapshotting**:
    *   Backend logic to calculate "Low Stock", "Inventory Value", and "Movements" summaries daily.
    *   Support `entity_snapshots` for time-travel diffs.

### Logic Flow
```javascript
// platform/assembler/ProjectAssembler.js
async assemble(projectId, sdf) {
  // 1. Generate Backend (Services, Controllers, Cron Jobs)
  await this.backendGenerator.generate(sdf);
  
  // 2. Generate Frontend (Pages, Dashboards, Wizards)
  await this.frontendGenerator.generate(sdf);
  
  // 3. Package and ZIP
}
```

### ✅ Definition of Done
- [x] Assembler respects global `modules` config.
- [x] Backend generates scheduled report snapshots (Value, Movements, Diffs).
- [x] Generators are decoupled from the template code.

---

## Task C5: Modular Frontend Generator

**Day:** 5 (Jan 5)  
**Duration:** 8 hours  
**Dependencies:** C4 complete  

### Goal
Generate a sophisticated React application with dynamic routing, wizards, and dashboards.

### What to Do

1.  **Modular Page Builders** (`generators/frontend/`):
    *   `dashboardHome.js`: Generates widgets for Low Stock, Expiry, Activity.
    *   `reportsPage.js`: Generates the **Date-Range Diff UI** and charts.
    *   `entityPages.js`: Generates standard CRUD + **Inventory Wizards**.
2.  **Inventory Wizards**:
    *   Generate `IssuePage` (Sell), `ReceivePage`, `TransferPage` based on `inventory_ops` config.
    *   Handle `quantity_mode` ("delta" vs "absolute").
3.  **UI Configuration**:
    *   Respect `ui.search`, `ui.print`, `ui.csv_import` flags.
    *   Generate **QR Code Labels** if `labels.enabled` is true (with scanning support).

### Key: Builder Pattern
```javascript
// generators/frontend/entityPages.js
function buildIssuePage(entity, config) {
  // Generates a specialized "Sell/Issue" wizard 
  // with validation against current stock levels
  // and support for "absolute" or "delta" quantity modes.
}
```

### ✅ Definition of Done
- [x] Frontend code is generated via modular builders, not giant strings.
- [x] **Inventory Wizards** (Receive, Issue, Adjust) are fully functional.
- [x] **Reports Page** allows diffing between two historical snapshots.
- [x] **Dashboard** widgets (Low Stock, Expiry) use real API data.

---

## Task C6: Integration & Testing

**Day:** 6 (Jan 6)  
**Duration:** Full day  
**Dependencies:** All C tasks complete  

### What to Do

1.  **Generate Complex ERPs**:
    *   **Milk Producer** (Perishables, Expiry, Batch Tracking).
    *   **Tire Business** (Non-perishable, Bin Locations, Absolute Quantities).
2.  **Verify**:
    *   Can I "Sell" an item via the Issue Wizard?
    *   Does the Report show what changed between yesterday and today?
    *   Does the QR Scanner work?
3.  **Run Tests**: Use `test/run_assembler.js` with specific SDFs.

### ✅ Definition of Done
- [x] Multiple business domains (Milk, Tires) generated successfully.
- [x] Advanced inventory features (Wizards, Reports) verified.

---

## Task C7: Advanced Features (Implemented)

**Day:** 6+ (Completed)
**Focus:** Delivery of High-Value ERP Features.

### 1. Operation Wizards
Instead of generic CRUD, we now generate specialized workflows:
*   **Receive Stock:** Updates inventory + creates `IN` movement.
*   **Issue/Sell Stock:** checks availability -> updates inventory -> creates `OUT` movement.
*   **Transfer Stock:** Move between locations (with validation).
*   **Adjust Stock:** Reason codes + audit trail.

### 2. Intelligent Reports
*   **Snapshot Engine:** Backend saves daily state.
*   **Diff UI:** Compare any two dates to see Added/Removed/Changed records.
*   **Valuation:** Real-time inventory value calculation.

### 3. Data Tools
*   **QR Labels:** Generate printable labels with QR codes.
*   **QR Scanning:** Built-in scanner using `BarcodeDetector` (with `jsQR` fallback).
*   **Smart CSV:** Upsert capability (Update existing IDs, Create new ones).


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

