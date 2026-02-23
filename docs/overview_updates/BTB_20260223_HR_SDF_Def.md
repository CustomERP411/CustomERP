# HR Module SDF Definition (Phase 5)

**Date:** 2026-02-23  
**Author:** Burak Tan Bilgi (BTB)  
**Related PR:** sprint1/btb/hr-sdf-def

## 1. Summary
This update introduces the official Schema Definition Format (SDF) specification for the **HR Module**. This allows the AI Gateway to understand, generate, and validate requests for HR features, paving the way for the implementation phase (Assembler/Bricks).

## 2. Key Changes

### SDF Reference Update
- Added **`modules.hr`** configuration:
  - `enabled` (boolean)
  - `work_days` (array, default ["Mon", "Tue", "Wed", "Thu", "Fri"])
  - `daily_hours` (number, default 8)
- Defined expected entities structure:
  - **`employees`**: Core employee data with status tracking.
  - **`departments`**: Organizational structure with manager references.
  - **`leaves`**: Time off requests with approval workflow.

### AI Prompts
- Updated `analyze`, `clarify`, `edit`, and `finalize` prompts with a specific **HR PATTERN**.
- The AI is now instructed to:
  - Recognize keywords like "employees", "staff", "leaves", "departments".
  - Automatically suggest the standard 3-entity structure (`employees`, `departments`, `leaves`).
  - Configure `features.audit_trail: true` for employees.

## 3. Usage
Developers and the AI can now use `module: "hr"` in entity definitions.
Example SDF snippet:
```json
{
  "modules": {
    "hr": { "enabled": true }
  },
  "entities": [
    {
      "slug": "employees",
      "module": "hr",
      "features": { "audit_trail": true },
      ...
    }
  ]
}
```

## 4. Next Steps
- **Backend Bricks (ODD):** Build HR backend bricks (employees, departments, leave/attendance).
- **Frontend Pages (EA):** Build HR frontend pages.
- **Assembler Wiring (ODD):** Wire HR module into generator.
