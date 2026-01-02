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
├── frontend-bricks/
└── templates/

platform/backend/src/assembler/                  ← YOUR DOMAIN
│   ├── ProjectAssembler.js
│   ├── BrickRepository.js
│   ├── TemplateEngine.js       ← NEW: Handle substitutions
│   └── generators/             ← NEW: Logic for specific files
│       ├── BackendGenerator.js
│       └── FrontendGenerator.js
```

---

## Task C1: Brick Library Structure & Template Engine

**Day:** 1 (Jan 1)  
**Duration:** 6-8 hours  
**Dependencies:** None  

### What to Do

1. Create folder structure for brick library
2. Implement `TemplateEngine.js` (simple regex-based replacement)
3. Create `BaseController.js.hbs` (Handlebars-style template)
4. Create `RepositoryInterface.js` (DAL contract)
5. Create `manifest.json` for bricks to declare dependencies

### The Architecture Change: "Bricks are Templates"

Instead of copying static files, we will treat bricks as templates.

**brick-library/backend-bricks/controllers/BaseController.js.hbs**
```javascript
// Note the placeholders: {{EntityName}}, {{entitySlug}}
const FlatFileProvider = require('../repository/FlatFileProvider');

class {{EntityName}}Controller {
  constructor() {
    this.repository = new FlatFileProvider('./data');
    this.entitySlug = '{{entitySlug}}';
  }

  async getAll(req, res) {
    const items = await this.repository.findAll(this.entitySlug);
    res.json(items);
  }
  // ... other methods ...
}

module.exports = {{EntityName}}Controller;
```

### TemplateEngine.js

```javascript
// platform/backend/src/assembler/TemplateEngine.js
class TemplateEngine {
  static render(template, context) {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return context[key] || match;
    });
  }
}
module.exports = TemplateEngine;
```

### ⛔ Do NOT

- Do NOT install a heavy template engine like EJS/Pug yet. Simple string replacement is enough for Increment 1.

### ✅ Definition of Done

- [ ] `TemplateEngine.render("Hello {{name}}", {name: "World"})` returns "Hello World"
- [ ] BaseController template created with placeholders
- [ ] Folder structure ready

---

## Task C2: FlatFileProvider Implementation

**Day:** 2 (Jan 2)  
**Duration:** 6-8 hours  
**Dependencies:** C1 complete  

### What to Do

1. Implement full `FlatFileProvider.js` (static file, no template needed)
2. Add `ensureDataDir` utility
3. Implement `findAll`, `findById`, `create`, `update`, `delete`
4. Add basic "transaction" safety (write to temp file then rename)

*Note: This task remains largely the same as the original plan, as the repository layer is generic.*

### ✅ Definition of Done

- [ ] CRUD operations work with JSON files in `./data`
- [ ] Auto-creates data directory and files
- [ ] IDs are auto-generated (UUID)

---

## Task C3: Inventory Service Bricks (Templates)

**Day:** 3 (Jan 3)  
**Duration:** 6-8 hours  
**Dependencies:** C2 complete  

### What to Do

1. Create `InventoryService.js.hbs`
2. Create `StockValidation.js.hbs`
3. Create `AlertLogic.js.hbs`
4. Define the **"Brick Manifest"** for Inventory

### The Brick Manifest Concept

We need to know *when* to use a brick.

**brick-library/manifest.json**
```json
{
  "inventory": {
    "feature_flag": "stock_tracking",
    "backend_files": [
      { "src": "services/InventoryService.js.hbs", "dest": "src/services/{{EntityName}}InventoryService.js" }
    ],
    "dependencies": ["uuid"]
  }
}
```

### InventoryService.js.hbs

```javascript
class {{EntityName}}InventoryService {
  constructor(repository) {
    this.repository = repository;
    this.slug = '{{entitySlug}}';
  }
  // ... logic ...
}
```

### ✅ Definition of Done

- [ ] Inventory templates created with placeholders
- [ ] Logic handles stock increment/decrement
- [ ] Manifest defines when these bricks should be injected

---

## Task C4: Assembler Engine - The "Wiring" Logic

**Day:** 4 (Jan 4)  
**Duration:** 10 hours (Heavy Load)  
**Dependencies:** C3 complete  

### What to Do

This is the most critical task. You aren't just copying files; you are generating the **Glue Code**.

1. **Scaffold:** Generate package.json, folders, server.js
2. **Hydrate:** Loop through SDF entities, render Controller/Service templates
3. **Wire Routes:** Generate `routes/index.js` that imports all entity routes
4. **Wire Server:** Generate `index.js` that uses the aggregated routes

### Key Challenge: Generating `routes/index.js`

You need to dynamically build the route registry.

**assembler/generators/BackendGenerator.js** (Pseudocode)
```javascript
async generateRoutesIndex(outputDir, entities) {
  let imports = '';
  let mappings = '';

  entities.forEach(entity => {
    // e.g. const productsRouter = require('./productsRoutes');
    imports += `const ${entity.slug}Router = require('./${entity.slug}Routes');\n`;
    // e.g. router.use('/products', productsRouter);
    mappings += `router.use('/${entity.slug}', ${entity.slug}Router);\n`;
  });

  const template = `
    const express = require('express');
    const router = express.Router();
    ${imports}
    ${mappings}
    module.exports = router;
  `;

  await writeFile(path.join(outputDir, 'src/routes/index.js'), template);
}
```

### ProjectAssembler.js

```javascript
async assemble(projectId, sdf) {
  // 1. Prepare
  const context = { projectId, entities: sdf.entities };
  
  // 2. Base Backend
  await this.backendGenerator.scaffold(outputDir);
  
  // 3. Entity Loop
  for (const entity of sdf.entities) {
    await this.backendGenerator.generateEntity(outputDir, entity);
  }
  
  // 4. THE GLUE (Crucial)
  await this.backendGenerator.generateRoutesIndex(outputDir, sdf.entities);
  await this.backendGenerator.generatePackageJson(outputDir, sdf.entities);
}
```

### ✅ Definition of Done

- [ ] Assembler creates a runnable Node.js project
- [ ] `routes/index.js` automatically includes ALL entities from SDF
- [ ] `npm install` and `npm start` work in the generated folder
- [ ] API responds to GET /api/{entity} for all entities

---

## Task C5: Frontend Generator - Routing & Sidebar

**Day:** 5 (Jan 5)  
**Duration:** 8 hours  
**Dependencies:** C4 complete  

### What to Do

1. Create `App.tsx.hbs` (The frontend glue)
2. Create `Sidebar.tsx.hbs` (The navigation glue)
3. Create `EntityPage.tsx.hbs` (Generic list/edit view)
4. Implement `FrontendGenerator.js`

### The "Glue" Logic for Frontend

Just like the backend, the hard part is the wiring.

**assembler/generators/FrontendGenerator.js** (Pseudocode)
```javascript
async generateAppRoutes(outputDir, entities) {
  // We need to inject <Route> components into App.tsx
  const routeLines = entities.map(e => 
    `<Route path="/${e.slug}" element={<EntityPage entity="${e.slug}" />} />`
  ).join('\n');

  // Render App.tsx template with this variable
  await this.renderTemplate('App.tsx.hbs', { routeDefinitions: routeLines });
}

async generateSidebar(outputDir, entities) {
  // Generate navigation links
  const links = entities.map(e => 
    `<Link to="/${e.slug}">${e.display_name}</Link>`
  ).join('\n');
  
  await this.renderTemplate('Sidebar.tsx.hbs', { navLinks: links });
}
```

### EntityPage.tsx.hbs

This should be a "Smart Component" that takes the entity slug and configures the `BasicTableView` (from Day 5 original plan).

```tsx
import BasicTableView from '../components/BasicTableView';

export default function {{EntityName}}Page() {
  const fields = [
    {{#each fields}}
    { key: '{{this.name}}', label: '{{this.name}}', type: '{{this.type}}' },
    {{/each}}
  ];

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">{{DisplayName}}</h1>
      <BasicTableView entitySlug="{{entitySlug}}" fields={fields} />
    </div>
  );
}
```

### ⛔ Do NOT

- Do NOT skip implementing relationship handling. If a field is `reference`, the `BasicTableView` MUST render a link or a lookup name, not just the raw UUID.
- Do NOT modify platform frontend (DEV-A's domain)

### ✅ Definition of Done

- [ ] Generated `App.tsx` has routes for all entities
- [ ] Generated `Sidebar.tsx` has links for all entities
- [ ] Generated `EntityPage` passes correct schema to BasicTableView
- [ ] `BasicTableView` handles `reference` type fields correctly (displays name instead of ID if possible, or link)
- [ ] Frontend compiles and runs

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

