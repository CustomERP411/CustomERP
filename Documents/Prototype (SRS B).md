1. # Use Cases and Functionalities Selected for First Increment Prototype
    

![](file:///tmp/lu302399bbyq.tmp/lu302399bc2m_tmp_41428a43.png)

Figure 1 UCD_1-3: Project Intake & Analysis

This use case is the same as the UC-1 we provided in the Team10_SRS_V2 document.

![](file:///tmp/lu302399bbyq.tmp/lu302399bc2m_tmp_ed8a0dd0.png)

Figure 2 UCD_4-6 Inventory Schema & CRUD from SDF and Review

This use case is similar to the UCD_4-6 provided in the Team10_SRS_V2 document. The difference is that in the final product the system will be able to generate more than one module with larger scopes, such as:

- Customer Management
    
- Inventory
    
- Invoicing
    

For our initial MVP of the Fall semester our product will be capable of generating under the scope of inventory. Another reduced functionality is related to database, for our initial MVP our generated ERP modules will be using flat file storage in multiple JSON files.

We have shown our advisor Dr. Cüneyt Sevgi our use cases and he approved the 20% chosen to use from the functional requirements we have presented from our Initial Plan.

We will be fully implementing every use case we have put in our use case diagrams, which is why we did not explicitly shown that in our diagrams.

To be able to view every diagram in this document clearly there is a link attached to the same diagram in our GitHub project.

2. # First Increment Prototype [![](file:///tmp/lu302399bbyq.tmp/lu302399bc2m_tmp_4de28e72.jpg)](https://github.com/CustomERP411/CustomERP/blob/main/prototype1_1.jpg)
    

Figure 3 Prototype 1.1 Screen Shot

This first view represents the system entry point where users manage or create projects.

The left sidebar lists all existing projects and allows creating a new one via “+ New Project.”

The center dashboard instructs users to describe their business requirements and provides a single button — “Start Analysis.”

The right panel (Assistant) introduces the prototype’s purpose: it currently supports only Inventory-related interactions.

At this stage, no backend process has begun; the system waits for the user’s natural-language input.

# [![](file:///tmp/lu302399bbyq.tmp/lu302399bc2m_tmp_289aa230.jpg)](https://github.com/CustomERP411/CustomERP/blob/main/prototype1_2.jpg)

Figure 4 Prototype 1.2 Screen Shot

The user provides the minimal inventory statement — “I have 3 bananas.”

The Assistant interprets this as an inventory entity (“banana”) with a quantity attribute = 3, confirming the NLP pipeline described under AI Processing Requirements (FR 3.1–FR 3.3).

The Assistant replies: “Thanks! Please add more details about product units, packaging, or supplier flow.”

This message corresponds to a clarifying question, ensuring data completeness before schema generation, in line with the system’s iterative clarification loop (UC-1.3 Generate Clarifying Questions)

# [![](file:///tmp/lu302399bbyq.tmp/lu302399bc2m_tmp_59fb7a4b.jpg)](https://github.com/CustomERP411/CustomERP/blob/main/prototype1_3.jpg)

Figure 5 Prototype 1.3 Screen Shot

After the first clarification, the user expands the description to:

“We run a small electronics shop. We buy phones and accessories from suppliers and keep them in stock. When a product is sold, the stock decreases automatically. We also want low-stock alerts when a product goes below 5 units, and a report of monthly sales.”

The Assistant now confirms understanding and proceeds with deeper analysis:

“Got it. Do you also manage returns and low-stock alerts?”

This exchange reflects the transition from requirement capture to analysis phase, activating the process defined in FR 1.3 (Send validated description to AI API) and FR 3.5 (Generate System Definition File – SDF).

[![](file:///tmp/lu302399bbyq.tmp/lu302399bc2m_tmp_fe31d208.png)](https://github.com/CustomERP411/CustomERP/blob/main/prototype2.png)

Figure 6 Prototype 2 Screen Shot

Prototype 2 (UC‑2) — Generated Module Review Page (Screenshot Description)

This page presents the automatically generated module for end‑user review prior to approval. It is designed for non‑technical users to understand what has been produced (data structures, relationships, and endpoints) and to decide whether the result matches their intent before locking the configuration.

What the user sees

- A summary panel listing the generated entities with their key attributes. Users can scan the list to confirm names and fields are sensible and complete.

- A central, simplified relationship diagram showing how entities connect (with clear labels and cardinalities). This helps the user validate that the overall structure reflects their real‑world data.

- An API summary panel that outlines the main endpoints the generated module will expose (read/list, create/update, operational actions). This provides a plain‑language view of how the module will be accessed later.

- Primary actions to Approve the module or Download the package. Approval locks the configuration for packaging; download provides the artifact bundle for deployment or further testing.

  
  

How it is used in the finished product

- Users review the entity list to verify naming, attribute presence, and basic data types at a glance.

- Users glance at the relationship diagram to confirm the connections between entities and whether the multiplicities (one‑to‑one, one‑to‑many) make sense for their scenario.

- Users read the API summary to ensure the available operations match their expected workflows (for example, that common reads and updates are available).

- If minor, non‑breaking edits are needed (such as renaming a label), the page allows inline edits with immediate visual refresh. If structural changes are needed, the user can return to the clarification flow to regenerate.

- Once satisfied, the user selects Approve to lock the configuration for this module, and optionally downloads the generated package to run locally or hand off to an administrator for deployment.

  
  

3. # System Model
    

# [![](file:///tmp/lu302399bbyq.tmp/lu302399bc2m_tmp_887da166.png)](https://github.com/CustomERP411/CustomERP/blob/main/activity1.png)

Figure 7 UC-1 Activity Diagram

  
  

# [![](file:///tmp/lu302399bbyq.tmp/lu302399bc2m_tmp_776633c4.png)](https://github.com/CustomERP411/CustomERP/blob/main/activity2.png)

Figure 8 UC-2 Activity Diagram

[![](file:///tmp/lu302399bbyq.tmp/lu302399bc2m_tmp_9741f890.png)](https://github.com/CustomERP411/CustomERP/blob/main/activity3.png)

Figure 9 UC-3 Activity Diagram

# [![](file:///tmp/lu302399bbyq.tmp/lu302399bc2m_tmp_49d2ff9c.png)](https://github.com/CustomERP411/CustomERP/blob/main/activity4.png)

Figure 10 UC-4 Activity Diagram

#   

[![](file:///tmp/lu302399bbyq.tmp/lu302399bc2m_tmp_11345cbf.png)](https://github.com/CustomERP411/CustomERP/blob/main/activity5.png)

Figure 11 UC-5 Activity Diagram

  
  

[![](file:///tmp/lu302399bbyq.tmp/lu302399bc2m_tmp_e498a1d9.png)](https://github.com/CustomERP411/CustomERP/blob/main/activity6.png)

Figure 12 UC-6 Activity Diagram

  
  

[![](file:///tmp/lu302399bbyq.tmp/lu302399bc2m_tmp_ead8f0e7.png)](https://github.com/CustomERP411/CustomERP/blob/main/sequence1.png)

Figure 13 UC-1 Sequence Diagram

[![](file:///tmp/lu302399bbyq.tmp/lu302399bc2m_tmp_b12f251d.png)](https://github.com/CustomERP411/CustomERP/blob/main/sequence2.png)

Figure 14 UC-2 Sequence Diagram

[![](file:///tmp/lu302399bbyq.tmp/lu302399bc2m_tmp_ae6bd4a9.png)](https://github.com/CustomERP411/CustomERP/blob/main/sequence3.png)

Figure 15 UC-3 Sequence Diagram

[![](file:///tmp/lu302399bbyq.tmp/lu302399bc2m_tmp_9b440cb4.png)](https://github.com/CustomERP411/CustomERP/blob/main/sequence4.png)

Figure 16 UC-4 Sequence Diagram

[![](file:///tmp/lu302399bbyq.tmp/lu302399bc2m_tmp_511567ff.png)](https://github.com/CustomERP411/CustomERP/blob/main/sequence5.png)

Figure 17 UC-5 Sequence Diagram

[![](file:///tmp/lu302399bbyq.tmp/lu302399bc2m_tmp_184995b1.png)](https://github.com/CustomERP411/CustomERP/blob/main/sequence6.png)

Figure 18 UC-6 Sequence Diagram

  
  

  
  

  
  

# [![](file:///tmp/lu302399bbyq.tmp/lu302399bc2m_tmp_2ebebec7.png)](https://github.com/CustomERP411/CustomERP/blob/main/class1.png)

Figure 19 Class Diagram

  
  

**Database**

- **USERS**
    
    - Columns: user_id (PK), name, email, password_hash, created_at
        
- **ROLES**
    
    - Columns: role_id (PK), name, description
        
- **USER_ROLES**
    
    - Columns: user_id (FK → USERS.user_id), role_id (FK → ROLES.role_id)
        
    - Primary key: (user_id, role_id); models the many-to-many between users and roles.
        
- **PROJECTS**
    
    - Columns: project_id (PK), owner_user_id (FK → USERS.user_id), name, status, created_at, updated_at
        
- **APPROVALS**
    
    - Columns: approval_id (PK), project_id (FK → PROJECTS.project_id), decided_by_user_id (FK → USERS.user_id), decision, timestamp
        
- **LOG_ENTRIES**
    
    - Columns: log_id (PK), project_id (FK → PROJECTS.project_id, nullable), user_id (FK → USERS.user_id, nullable), level, message, created_at
        
- **SDFS**
    
    - Columns: sdf_id (PK), project_id (FK → PROJECTS.project_id), version, created_at
        
- **SDF_ENTITIES**
    
    - Columns: entity_id (PK), sdf_id (FK → SDFS.sdf_id), name
        
- **SDF_ATTRIBUTES**
    
    - Columns: attribute_id (PK), entity_id (FK → SDF_ENTITIES.entity_id), name, data_type
        
- **SDF_RELATIONS**
    
    - Columns: relation_id (PK), sdf_id (FK → SDFS.sdf_id), name, relation_type, source_entity_id (FK → SDF_ENTITIES.entity_id), target_entity_id (FK → SDF_ENTITIES.entity_id)
        
- **QUESTIONS**
    
    - Columns: question_id (PK), project_id (FK → PROJECTS.project_id), text, created_at
        
- **ANSWERS**
    
    - Columns: answer_id (PK), question_id (FK → QUESTIONS.question_id), project_id (FK → PROJECTS.project_id), text, created_at
        
- **MODULES**
    
    - Columns: module_id (PK), project_id (FK → PROJECTS.project_id), name, type
        
- **SCHEMA_ARTIFACTS**
    
    - Columns: artifact_id (PK), module_id (FK → MODULES.module_id), path, format
        
- **GENERATION_JOBS**
    
    - Columns: job_id (PK), project_id (FK → PROJECTS.project_id), status, started_at, finished_at, error_message
        

Key relationships:

- One **User** can own many **Projects**; a **Project** belongs to exactly one owner.
    
- A **User** can have multiple **Roles** through **USER_ROLES**.
    
- Each **Project** can have multiple **SDFS**, **QUESTIONS**, **ANSWERS**, **MODULES**, **GENERATION_JOBS**, and **LOG_ENTRIES**.
    
- Each **SDF** contains many **SDF_ENTITIES** and **SDF_RELATIONS**; each **SDF_ENTITY** contains many **SDF_ATTRIBUTES**.
    
- Each **MODULE** can have multiple **SCHEMA_ARTIFACTS** that correspond to generated code/schema files for that project.