# 3.2 Process View

This section details the **Use Case Realization** for the five Use Cases defined in the First Increment. For each use case, we provide a textual explanation of the object interactions and a **UML Communication Diagram** (visualized here using message-sequence notation) to illustrate the dynamic behavior of the system.

## 3.2.1 Use Case 1: Submit Business Description

**Use Case Realization:**
The realization of this use case initiates the project lifecycle. The **Business User** interacts with the **Frontend** (Project Wizard) to input their natural language description. The **Frontend** sends a POST request to the **ProjectController**. The controller delegates the creation logic to the **ProjectService**, which persists a new `Project` entity in the **Database** with a 'DRAFT' or 'ANALYZING' status. Crucially, the **ProjectService** then triggers an asynchronous call to the **SDFService** to begin AI processing without blocking the user interface, returning an immediate "Accepted" status to the user.

**UML Communication Diagram:**

```mermaid
sequenceDiagram
    autonumber
    actor User as Business User
    participant UI as Frontend
    participant PC as ProjectController
    participant PS as ProjectService
    participant DB as Database
    participant SDFS as SDFService

    Note over User, SDFS: Scenario: User submits description
    
    User->>UI: 1: Enter description & Submit
    activate UI
    UI->>PC: 2: POST /api/projects
    activate PC
    
    PC->>PS: 3: createProject(userId, text)
    activate PS
    
    PS->>PS: 4: validate(text)
    PS->>DB: 5: INSERT INTO projects
    activate DB
    DB-->>PS: 6: return projectId
    deactivate DB
    
    PS->>SDFS: 7: async generateSDF(projectId)
    
    PS-->>PC: 8: return projectDetails
    deactivate PS
    
    PC-->>UI: 9: 202 Accepted
    deactivate PC
    
    UI-->>User: 10: Display "Analyzing..."
    deactivate UI
```

---

## 3.2.2 Use Case 2: Clarify Requirements

**Use Case Realization:**
This use case realizes the interactive clarification loop. When the **User** submits answers to clarification questions via the **Frontend**, the **ProjectController** receives the payload. It invokes the **SDFService**, which retrieves the current project context from the **Database**. The **SDFService** then acts as a client to the external **AI Service** (AI Gateway), sending the context and answers. The AI determines if further ambiguity exists. If so, new questions are generated; if not, the SDF is finalized. The system updates the project state accordingly.

**UML Communication Diagram:**

```mermaid
sequenceDiagram
    autonumber
    actor User as Business User
    participant UI as Frontend
    participant PC as ProjectController
    participant SDFS as SDFService
    participant DB as Database
    participant AI as AI Service

    Note over User, AI: Scenario: User answers clarification questions
    
    User->>UI: 1: Submit Answers
    activate UI
    UI->>PC: 2: POST /api/projects/{id}/clarify
    activate PC
    
    PC->>SDFS: 3: processClarification(projectId, answers)
    activate SDFS
    
    SDFS->>DB: 4: FETCH project_context
    activate DB
    DB-->>SDFS: 5: return context
    deactivate DB
    
    SDFS->>AI: 6: POST /ai/clarify
    activate AI
    AI-->>SDFS: 7: return (UpdatedSDF OR NewQuestions)
    deactivate AI
    
    alt Ambiguity Resolved
        SDFS->>DB: 8: UPDATE projects SET status='READY'
    else More Questions
        SDFS->>DB: 8: INSERT INTO questions
    end
    
    SDFS-->>PC: 9: return result
    deactivate SDFS
    
    PC-->>UI: 10: 200 OK
    deactivate PC
    UI-->>User: 11: Update View
    deactivate UI
```

---

## 3.2.3 Use Case 3: Review & Edit SDF

**Use Case Realization:**
This use case allows the user to modify the generated data model. The **User** issues an edit command (e.g., "Add an expiry date field") via the **Frontend**. The **ProjectController** routes this to the **SDFService**. The service sends a "Modification Prompt" to the **AI Service**, which returns a modified JSON schema. The **SDFService** performs strict schema validation on this JSON. If valid, it persists the new schema as a new version in the **Database** (table `sdfs`), maintaining a history of changes.

**UML Communication Diagram:**

```mermaid
sequenceDiagram
    autonumber
    actor User as Business User
    participant UI as Frontend
    participant PC as ProjectController
    participant SDFS as SDFService
    participant AI as AI Service
    participant DB as Database

    Note over User, DB: Scenario: User requests AI-driven edit
    
    User->>UI: 1: Request Edit ("Add field X")
    activate UI
    UI->>PC: 2: POST /api/projects/{id}/sdf/edit
    activate PC
    
    PC->>SDFS: 3: applyEdit(projectId, instruction)
    activate SDFS
    
    SDFS->>AI: 4: POST /ai/edit_schema
    activate AI
    AI-->>SDFS: 5: return modifiedJson
    deactivate AI
    
    SDFS->>SDFS: 6: validateSchema(modifiedJson)
    
    SDFS->>DB: 7: INSERT INTO sdfs (version=N+1)
    activate DB
    DB-->>SDFS: 8: success
    deactivate DB
    
    SDFS-->>PC: 9: return newSDF
    deactivate SDFS
    
    PC-->>UI: 10: 200 OK (New Model)
    deactivate PC
    UI-->>User: 11: Render Updated Diagram
    deactivate UI
```

---

## 3.2.4 Use Case 4: Generate Inventory Module

**Use Case Realization:**
This use case handles the transformation of the metadata (SDF) into executable code. The **User** clicks "Generate" on the **Frontend**. The **ProjectController** calls the **GeneratorService**. This service fetches the "Locked/Approved" SDF from the **Database**. It then iterates through the entities defined in the SDF, using internal templates to synthesize SQL `CREATE TABLE` scripts, Node.js API routes, and React UI components. These artifacts are stored or cached for download, and the project status is updated to 'GENERATED'.

**UML Communication Diagram:**

```mermaid
sequenceDiagram
    autonumber
    actor User as Business User
    participant UI as Frontend
    participant PC as ProjectController
    participant GS as GeneratorService
    participant DB as Database
    participant FS as FileSystem/Cache

    Note over User, FS: Scenario: User triggers code generation
    
    User->>UI: 1: Click "Generate Module"
    activate UI
    UI->>PC: 2: POST /api/projects/{id}/generate
    activate PC
    
    PC->>GS: 3: generateArtifacts(projectId)
    activate GS
    
    GS->>DB: 4: FETCH latest_sdf
    activate DB
    DB-->>GS: 5: return SDF
    deactivate DB
    
    loop For Each Entity
        GS->>GS: 6: generateSQL()
        GS->>GS: 7: generateNodeAPI()
    end
    
    GS->>FS: 8: Write/Cache Artifacts
    GS->>DB: 9: UPDATE projects SET status='GENERATED'
    
    GS-->>PC: 10: return success
    deactivate GS
    
    PC-->>UI: 11: 200 OK
    deactivate PC
    UI-->>User: 12: Enable "Export" button
    deactivate UI
```

---

## 3.2.5 Use Case 5: Export System

**Use Case Realization:**
This use case realizes the delivery of the product. The **User** requests a download via the **Frontend**. The **ProjectController** invokes the **ArchiveService**. This service retrieves the generated files (SQL, JS, etc.) from the **FileSystem/Cache**, bundles them into a ZIP archive using a compression library, and returns a binary stream. The **ProjectController** pipes this stream to the response with the appropriate MIME type, triggering a file download in the user's browser.

**UML Communication Diagram:**

```mermaid
sequenceDiagram
    autonumber
    actor User as Business User
    participant UI as Frontend
    participant PC as ProjectController
    participant AS as ArchiveService
    participant FS as FileSystem/Cache

    Note over User, FS: Scenario: User downloads the generated system
    
    User->>UI: 1: Click "Export ZIP"
    activate UI
    UI->>PC: 2: GET /api/projects/{id}/download
    activate PC
    
    PC->>AS: 3: createDownloadStream(projectId)
    activate AS
    
    AS->>FS: 4: Read Generated Files
    AS->>AS: 5: Compress to .ZIP
    
    AS-->>PC: 6: return Stream
    deactivate AS
    
    PC-->>UI: 7: HTTP 200 (Stream application/zip)
    deactivate PC
    UI-->>User: 8: Save File Dialog
    deactivate UI
```
