**Project Details**

|   |   |
|---|---|
 
|**Project Name**|**Customizable ERP Provider**|
|**Software Product Name**|**CustomERP**|
|**Company Name**|**No sponsor company**|
|**Academic Advisor**|**Dr. Cüneyt Sevgi**|
|**Github URL**|**https://github.com/CustomERP411/CustomERP**|
|**WEB page**||
|**Software Product Information**|CustomERP is an AI-powered platform that enables small and medium businesses to generate custom Enterprise Resource Planning (ERP) systems through natural language descriptions. Business owners simply describe their processes in plain language, and the platform’s AI translates this into a complete system by identifying business entities, workflows, and rules. It then automatically assembles the necessary modules—such as inventory, sales, invoicing, and HR—configures them to match the business’s operations, and generates user interfaces and data flows. Within hours, a deployment-ready ERP is produced without coding or complex setup. By bridging the gap between costly custom development and rigid template solutions, CustomERP makes enterprise-grade software accessible and adaptable to every business. [1](#sdfootnote1sym)|

  

**Team Number: 10**

|   |   |   |
|---|---|---|
  
|**Name, Surname**|**Bilkent e-mail**|**Alternative e-mail**|
|Ahmet Selim Alpkirişçi|selim.alpkirisci@ug.bilkent.edu.tr|salpkirisci@gmail.com|
|Burak Tan Bilgi|tan.bilgi@ug.bilkent.edu.tr|bilgi.tanburak@gmail.com|
|Elkhan Abbasov|elkhan.abbasov@ug.bilkent.edu.tr|elxan2004abbasov@gmail.com|
|Orhan Demir Demiröz|demir.demiroz@ug.bilkent.edu.tr|demirdemiroz2014@gmail.com|
|Tunç Erdoğanlar|tunc.erdoganlar@ug.bilkent.edu.tr|tunc.erdoganlar@hotmail.com|

  

**Individual Contributions Overview**

|   |   |
|---|---|
 
|**Name, Surname**|**Summary of Contributions to the Initial Plan Document**|
|Ahmet Selim Alpkirişçi|We all did everything together.|
|Burak Tan Bilgi|We all did everything together.|
|Elkhan Abbasov|We all did everything together.|
|Orhan Demir Demiröz|We all did everything together.|
|Tunç Erdoğanlar|We all did everything together.|

  
  

  
  

**Executive Summary**

The Initial Plan document presents the foundation for the development of CustomERP, an AI-assisted platform designed to enable small and medium-sized businesses to automatically generate basic, customized Enterprise Resource Planning (ERP) systems from natural language descriptions. The document defines the project's purpose, scope, requirements, development methodology, organization, milestones, and associated risks for the two-semester senior project period. The motivation behind the project originated from one team member's professional experience working with small businesses, which revealed a significant gap between two extremes of business software solutions: low-cost generic systems that offer minimal flexibility and locally installed maintenance-heavy setups, and expensive, fully custom-built solutions that are inaccessible to small enterprises due to high costs and long development times. In response, our project aims to demonstrate that artificial intelligence can serve as an intermediary—bridging this gap by translating human-readable business descriptions into basic but functional ERP components, without requiring technical expertise from users. The document outlines measurable objectives, including accurate parsing of business requirements, automatic generation of database schemas, creation of simple CRUD interfaces, and the deployment of a working prototype within four hours of requirement submission. Our initial planning phase has focused on defining realistic boundaries for the prototype's functionality, selecting appropriate technologies, and structuring a Scrum development model to balance flexibility with academic deliverable requirements. Through early analysis and internal discussion, we have determined that limiting scope to a small set of core business modules—Customer Management, Inventory, and Invoicing—will allow us to demonstrate the system's core technical feasibility while remaining achievable within the project's timeline. Our findings so far indicate that integrating existing AI APIs for natural language understanding and schema inference is feasible, though constrained by API limitations and cost factors. The Initial Plan concludes that with clear task division and consistent communication, the team can produce a working proof-of-concept validating the practicality of conversational ERP generation within academic and resource limits.[2](#sdfootnote2sym)

**Table of Contents**

**Page Number**

  
  

  
  

**List of Tables**

**Page Number**

  
  

  
  

**List of Figures**

**Page Number**

  
  

**Abbreviations**

  

|   |   |
|---|---|
 
|AI  <br>API  <br>CRUD  <br>CTIS  <br>CV  <br>ERP  <br>GDPR  <br>GPU  <br>HIPAA  <br>HR  <br>MoSCoW  <br>MVP  <br>SDLC  <br>SPMP  <br>SRS  <br>UI  <br>UML  <br>WBS|Artificial Intelligence  <br>Application Programming Interface  <br>Create, Read, Update, Delete  <br>Information Systems and Technologies  <br>Curriculum Vitae  <br>Enterprise Resource Planning  <br>General Data Protection Regulation  <br>Graphics Processing Unit  <br>Health Insurance Portability and Accountability Act  <br>Human Resources  <br>Must have, Should have, Could have, Won't have  <br>Minimum Viable Product  <br>Software Development Lifecycle  <br>Software Project Management Plan  <br>Software Requirements Specification  <br>User Interface  <br>Unified Modeling Language  <br>Work Breakdown Structure[3](#sdfootnote3sym)|
|||
|||
|||
|||
|||
|||
|||
|||
|||
|||

1. # Product Purpose
    

Small and medium-sized businesses face a fundamental challenge in digitalizing their operations: they must choose between generic software that doesn't match their workflows or custom development that costs tens of thousands of dollars. This project aims to bridge this gap by creating a proof-of-concept system that can understand business requirements expressed in natural language and automatically generate basic ERP functionality.

The primary objective is to demonstrate that AI can successfully translate business descriptions into functional software components without requiring technical expertise from users. Specifically, we aim to achieve: (1) successful parsing of business requirements from text descriptions with 70% accuracy, (2) automatic generation of database schemas that correctly model basic business relationships, (3) creation of simple CRUD interfaces for data management, and (4) local deployment of a working prototype within 4 hours of requirement submission.

Unlike existing solutions such as Odoo or ERPNext that require extensive configuration knowledge, or platforms like Salesforce that force businesses into predefined templates, our product will accept plain English descriptions and generate custom schemas automatically. However, we acknowledge that as a student project, our scope will be limited to basic business operations rather than comprehensive enterprise functionality.

The measurable success criteria include: generating correct database relationships for 5 common business patterns (customer-order, inventory-product, employee-department, etc.), supporting at least 3 complete business workflows end-to-end, and achieving user satisfaction scores above 60% in usability testing with non-technical users.[4](#sdfootnote4sym)

2. # Product Requirements
    

3. ## Functional Requirements
    
    1. ### Prototype-Specific Requirements
        

- FReq P.1: The prototype shall accept a business description in plain English text.
    
- FReq P.2: The prototype shall use the AI component to parse the description and identify entities.
    
- FReq P.3: The prototype shall generate a single, functional Inventory Management module.
    
- FReq P.4: The prototype shall store all generated data and schema information in flat files (e.g., JSON or XML).[5](#sdfootnote5sym)
    

1. ### Core System Requirements:
    

- FReq1.1: The system shall accept business descriptions in plain English text format (minimum 500 words, maximum 5000 words)
    
- FReq1.2: The system shall generate clarifying questions based on the business description to resolve ambiguities
    
- FReq1.3: The system shall create database schemas with appropriate tables, fields, and relationships based on processed requirements
    
- FReq1.4: The system shall generate basic CRUD (Create, Read, Update, Delete) interfaces for all identified entities
    
- FReq 1.5: The system shall provide a visual, interactive preview of the generated modules and schema before final artifact generation.[6](#sdfootnote6sym)
    

1. ### Module Requirements:
    

- FReq2.1: The system shall provide a basic Customer Management module with contact information and interaction tracking
    

- FReq2.2: The system shall provide a simple Inventory Management module supporting product catalog and stock levels
    
- FReq2.3: The system shall provide a basic Invoice Generation module with line items and totals calculation
    
- FReq2.4: The system shall implement user authentication and role-based access control
    
- FReq2.5: The system shall generate simple reports showing data summaries and basic analytics
    

1. ### AI Processing Requirements:
    

- FReq3.1: The AI component shall identify business entities (customers, products, employees) from text descriptions
    
- FReq3.2: The AI shall infer relationships between entities (one-to-many, many-to-many) with reasonable accuracy
    
- FReq3.3: The AI shall map business processes to available module functionality
    

1. ## Non-Functional Requirements
    

- NFReq1: The system shall generate a complete set of deployment artifacts (source code, Dockerfiles, and configuration) within 4 hours of the user submitting validated requirements. The user will be responsible for the manual deployment of these artifacts.[7](#sdfootnote7sym)
    
- NFReq2: The generated application shall support at least 10 concurrent users
    
- NFReq3: The system shall provide clear documentation for self-hosting the generated application
    
- NFReq4: The interactive preview (FReq 1.5) shall load and be ready for user review within 20 minutes of the user submitting their validated requirements.[8](#sdfootnote8sym)
    

3. ## Context Diagram
    

![](file:///tmp/lu2778194qoa.tmp/lu2778194qqk_tmp_b2ea2a67.png)

Figure 1 Basic Context Diagram

  
  

4. ## Exclusions and Limitations
    

The following functionalities are explicitly excluded from the current project scope. These features will not be implemented, tested, or supported as part of the CustomERP MVP that will be finished in May:

- Advanced workflow automation or rule-based processing beyond basic Create, Read, Update, and Delete (CRUD) operations are excluded.
    
- Any features related to legal or regulatory compliance (e.g., HIPAA, GDPR, SOX) are not supported.
    
- Business intelligence tools, custom dashboards, or predictive analytics are excluded.
    
- The prototype will be provided in English only; no localization or translation features will be developed.
    
- Mobile application generation (Android/iOS) is outside the scope of this prototype.
    

- Integration with third-party systems, services, or APIs beyond a basic API framework is not included.[9](#sdfootnote9sym)
    

3. # Software Development Process Model
    

We will adopt the Scrum framework as our software development process model. Scrum is an Agile methodology designed for projects that require adaptability, continuous feedback, and rapid iteration—qualities that align closely with our project’s experimental nature. Since our product involves AI integration and dynamic requirement discovery, a flexible and feedback-driven process is essential.

1. ## We chose Scrum for the following reasons:
    

- Iterative Development: Our project deliverables (Initial Plan, SRS, SPMP, SDD, and final prototype) naturally align with Scrum’s sprint-based delivery structure. Each document or module acts as a tangible sprint deliverable.
    
- Adaptability to Change: Because AI integration is experimental, requirements and approaches will likely evolve. Scrum allows us to adapt quickly through sprint reviews and retrospectives.
    
- Continuous Feedback: Bi-weekly advisor meetings and milestone evaluations provide the same function as Scrum sprint reviews, ensuring academic and technical feedback loops.
    
- Transparency and Accountability: Scrum artifacts—such as the Product Backlog, Sprint Backlog, and Burndown Charts—help the team and advisor track progress and manage workload effectively.
    
- Team Collaboration: The short feedback cycles and defined roles (Scrum Master, Product Owner, Developers) fit our team structure and academic workflow.
    

  
  

2. ## Customization for our project’s Scrum:
    

- Sprint Duration: Each sprint will last two weeks during active development phases (from January to June 2026). During the current semester (Initial Plan → SPMP), sprints will align with document deadlines (roughly 3–4 weeks per sprint).
    
- Scrum Meetings:
    

- Weekly Scrum Meeting (1 hour): Every Monday to review progress and set sprint goals.
    
- Daily Stand-ups: Quick 5-minute updates via Whatsapp.
    

- Sprint Review & Retrospective: At the end of each deliverable cycle to review progress and define improvements.
    

- Roles:
    
    - Product Owner: Dr. Cüneyt Sevgi
        
    - Project Manager: Ahmet Selim Alpkirişçi
        
    - Scrum Master: Rotates every sprint (Ahmet Selim Alpkirişçi excluded).
        
    - AI Integration Lead: Ahmet Selim Alpkirişçi
        
    - Developers: All team members contribute across frontend, backend, and testing.
        
- Artifacts:
    
    - Product Backlog: Includes all features and deliverables (AI schema generation, CRUD UI, reports, etc.).
        
    - Sprint Backlog: Subset of tasks defined for each two-week cycle.
        
    - Increment: A functional component or deliverable (e.g., SRS document, working prototype, or module).
        

1. ## Advantages:
    

- Promotes rapid iteration and learning, especially useful when experimenting with AI.
    
- Encourages frequent validation of assumptions through advisor and user feedback.
    
- Enables early detection of integration or architectural issues.
    
- Improves team communication and workload distribution.
    

1. ## Disadvantages
    

- Scrum requires consistent commitment from all team members and advisor availability for feedback.
    
- Academic constraints (fixed deliverable dates) may reduce flexibility in adjusting sprint goals.
    
- Overhead from documentation and meetings may slow down coding progress slightly.[10](#sdfootnote10sym)
    

![](file:///tmp/lu2778194qoa.tmp/lu2778194qqk_tmp_e59f184b.png)

Figure 2 Scrum Visual

  
  

  
  

4. # Project Scope
    

5. ## Scope of Work
    

The CustomERP project will be developed over two semesters (October 2025 – June 2026) and will focus on delivering a working proof-of-concept system demonstrating AI-based generation of customizable ERP modules. The work is divided into five major phases:

1. ### Requirements Analysis and Planning (October 2025)
    

- Identify project objectives, scope, stakeholders, and risks.
    
- Conduct research on AI-based requirement interpretation and ERP modularity.
    
- Prepare the Initial Plan Document, including risk analysis, stakeholder mapping, and the selected development process model (Scrum).
    

1. ### Requirements Specification and Prototyping (October–November 2025)
    

- Elicit and document detailed functional and non-functional requirements.
    
- Create UML models (Use Case, Activity, Sequence diagrams).
    
- Develop an early prototype illustrating text-to-entity extraction.
    
- Deliverable: Software Requirements Specification (SRS) and requirements prototype.
    

1. ### Project Management and Architectural Design (November 2025 – January 2026)
    

- Define overall architecture and development roadmap.
    
- Produce Software Project Management Plan (SPMP) and Software Design Description (SDD).
    
- Establish development and testing environments.
    
- Develop first MVP proposed in the prototype.
    

1. ### Incremental Implementation and Integration (February – May 2026)
    

- Implement AI processing, database schema generation, CRUD interface generation, and three ERP modules (Customer, Inventory, Invoice).
    
- Conduct iterative testing and sprint reviews under Scrum.
    
- Deliver working increments at each sprint milestone.
    

1. ### Testing, Documentation, and Final Delivery (May – June 2026)
    

- Perform system integration, validation, and usability testing.
    
- Prepare technical documentation and final deployment package.
    
- Deliver final prototype, report, and presentation.
    

1. ### Out of Scope
    

- Commercialization, marketing, or post-June 2026 maintenance.
    
- Enterprise-scale optimizations or advanced security.
    
- Custom AI model training or mobile app development.
    

1. ## Work Breakdown Structure
    

2. Project Management and Planning
    
    1. Define project objectives and scope
        
    2. Identify stakeholders and assign roles
        
    3. Develop risk management plan
        
    4. Prepare and submit Initial Plan document
        
3. Requirements Engineering
    
    1. Conduct requirements elicitation sessions
        
    2. Define functional and non-functional requirements
        
    3. Create UML diagrams (Use Case, Activity, Sequence)
        
    4. Validate requirements with advisor and peers
        
    5. Deliver SRS document
        
4. System Architecture and Design
    
    1. Define system architecture (backend, frontend, AI integration)
        
    2. Select tools and technologies
        
    3. Create data models and component diagrams
        
    4. Prepare SPMP and SDD documents
        
5. Implementation
    
    1. Develop AI Requirement Processor
        
    2. Implement Database Schema Generator
        
    3. Implement CRUD UI Generator
        
    4. Build ERP modules
        
        1. Customer Management
            
        2. Inventory Management
            
        3. Invoice Management
            
    5. Integrate modules and perform internal testing
        
6. Verification and Validation
    
    1. Unit and integration testing
        
    2. Usability testing with sample users
        
    3. Sprint review and retrospective meetings
        
    4. Issue tracking and bug fixing
        
7. Documentation and Delivery
    
    1. Prepare technical and user documentation
        
    2. Finalize Docker deployment package
        
    3. Conduct final evaluation and presentation
        
    4. Submit final report and deliverables
        

8. ## Milestones & Deliverables
    
    1. ### Initial Plan Document (Sprint 0 – Planning Phase)
        

**Timeline:** September 16 - October 6, 2025

**Goal:** Define the project's vision, scope, and initial plan.

**Deliverable:** **Initial Plan Document (v1)**

**Sprint Goals:**

- Define project scope and objectives
    
- Create initial Product Backlog
    
- Assign team roles (Product Owner, Scrum Master, Developers)
    
- Conduct risk analysis
    

2. ### Software Requirements Specification – SRS (Sprint 1)
    

**Timeline:** October 7 - November 10, 2025 (5 weeks)

**Goal:** Define _what_ the system will do. Create the complete SRS and a low-fidelity (lo-fi) prototype to validate the requirements and user flow with the advisor.

**Deliverables:**

- **Software Requirements Specification (SRS) Document**
    
- **Requirements Prototype**
    

**Sprint Goals:**

- Elicit and finalize all functional and non-functional requirements.
    
- Create all UML diagrams (Use Case, Activity, Sequence).
    
- Develop UI/UX mockups and wireframes (e.g., in Figma) for the chatbot, the generation process, and the resulting modules.
    
- Use the prototype to confirm the user journey and system concept with the advisor.
    

3. ### SPMP & Increment Product Implementation (Sprint 2)
    

**Timeline:** November 11 - December 1, 2025 (3 weeks)

**Goal:** Fulfill academic document requirements while simultaneously starting the high-risk technical development. This is a **parallel-track sprint**.

**Deliverables:**

- **Initial Plan Document (v2)**
    
- **Software Project Management Plan (SPMP)**
    

**Sprint Goals (Parallel Tracks):**

**Track 1: Documentation (approx. 60% focus)**

- Incorporate feedback and submit **Initial Plan v2**.
    
- Create the detailed WBS, cost analysis, PERT/CPM charts, and team schedules for the **SPMP document**.
    

**Track 2: Increment Product Development (approx. 40% focus)**

- Establish the full development environment (Git, Docker).
    
- Begin implementation of the **AI Requirement Processor** (e.g., connecting to the Anthropic/OpenAI API).
    
- Develop the core backend (e.g., FastAPI) and define initial API endpoints.
    
- _Goal:_ By Dec 1, have a basic backend that can take a text string and get a parsed response from the AI API.
    

4. ### SDD & Increment Product Completion (Sprint 3)
    

**Timeline:** December 2, 2025 - January 5, 2026 (5 weeks)

**Goal:** Complete the full technical design document (SDD) while finishing the functional "First Increment" product for the January presentation. This is the second **parallel-track sprint**.

**Deliverables:**

- **Software Design Description (SDD) Document**
    

**Internal Milestone:** _Functional First Increment Product_

**Sprint Goals (Parallel Tracks):**

**Track 1: Documentation (approx. 50% focus)**

- Design the full system architecture (frontend, backend, AI) and document it in the **SDD**.
    
- Create component, data model, and deployment diagrams.
    
- Define the plan for transitioning from flat files (first increment product) to a database (Spring 2026).
    

**Track 2: Increment Product Development (approx. 50% focus)**

- Develop the frontend **chatbot interface**.
    
- Integrate the frontend with the backend AI processor.
    
- Implement the **flat file generation** logic (e.g., writing JSON files) based on the AI's output.
    
- Develop the frontend UI to read the flat file and dynamically render the **Inventory Management module**.
    
- Test the complete, end-to-end flow for the presentation.
    

5. ### Presentation & Spring Planning (Sprint 4)
    

**Timeline:** January 6 - January 19, 2026 (2 weeks)

**Goal:** Successfully present the First Increment Product and plan the detailed backlog for Semester 2.

**Deliverables:**

- **First Increment Product Presentation**
    

**Sprint Goals:**

- Prepare and deliver a successful presentation on Jan 7.
    
- Gather and document all feedback from the advisor.
    
- Perform code cleanup and refactoring on the first increment product.
    
- Create the detailed Product Backlog for Sprints 5-9.
    

6. ### The "Second Increment" Schema Generator (Sprint 5)
    

**Timeline:** January 20 - February 24, 2026 (5 weeks)

**Goal:** Rip out the flat-file system and implement the core "magic" of the project: the automatic database schema and CRUD interface generator.

**Deliverables:**

- **Working Schema Generator**
    
- **CRUD System**
    

**Sprint Goals:**

- Implement the **Database Schema Generation** logic (e.g., AI output -> SQL Schema).
    
- Implement the **CRUD Interface Generator** (e.g., SQL Schema -> API Endpoints + Basic UI).
    
- Migrate the prototype to be fully database-backed.
    
- Integrate the AI processor from Sprint 2 with the new schema generator.
    
- **Test:** Ensure the Inventory module can be generated, this time with a real database.Second Increment – Schema Generator and CRUD System
    

7. ### The "Third Increment" Customer Module (Sprint 6)
    

**Timeline:** February 25 - March 24, 2026 (4 weeks)

**Goal:** Prove the generator is scalable by adding a second, distinct ERP module.

**Deliverables:**

- **Generated Customer Management Module**
    

**Sprint Goals:**

- "Teach" the AI processor to understand requirements for customer management (contacts, tracking, etc.).
    
- Test the generation of the Customer Management module from natural language.
    
- Ensure the system can now manage _two_ distinct modules.
    
- Test for any basic relationships between Customer and Inventory (if any).
    

8. ### The "Fourth Increment" Invoice Module (Sprint 7)
    

**Timeline:** March 25 - April 28, 2026 (5 weeks)

**Goal:** Complete the core ERP loop by adding the most complex module, which integrates the previous two.

**Deliverables:**

- **Generated Invoice Management Module**
    

**Sprint Goals:**

- "Teach" the AI processor to understand invoicing (line items, totals, etc.).
    
- Implement logic for relationships (an invoice _links to_ a Customer and _links to_ Inventory items).
    
- Test the full, end-to-end ERP workflow (e.g., "Create a customer," "Add inventory," "Create an invoice for that customer using that inventory").
    

9. ### Buffer Sprint & User Acceptance Testing (Sprint 8)
    

**Timeline:** April 29 - May 26, 2026 (4 weeks)

**Goal:** Create a dedicated buffer for delays and conduct validation with real users.

**Deliverables:**

- Completed system ready for final delivery; UAT results.
    

**Sprint Goals:**

- Complete any unfinished implementation tasks from Sprints 5-7.
    
- Fix critical bugs found during integration testing.
    
- **If implementation is complete:** Conduct UAT with 2-3 target users (e.g., small business owners) to gather feedback.
    
- Prepare the final deployment package.
    

10. ### Final Report & Release (Sprint 9)
    

**Timeline:** May 27 - June 16, 2026 (3 weeks)

**Goal:** Finalize all documentation and prepare for final submission.

**Deliverables:**

- **Final Product**
    
- **Final Report**
    
- **Presentation**
    

**Sprint Goals:**

- Finalize all technical documentation (user manual, deployment guide).
    
- Prepare the complete final project report, including findings from the UAT.
    
- Prepare and practice the final project presentation.
    
- Submit the complete project.[11](#sdfootnote11sym)
    

  
  

  
  

![](file:///tmp/lu2778194qoa.tmp/lu2778194qqk_tmp_f57626a6.png)

Figure 3 Initial Gantt Chart First Semester

  

  
  

![](file:///tmp/lu2778194qoa.tmp/lu2778194qqk_tmp_d5dab33b.png)

Figure 4 Initial Gantt Chart Second Semester

  

5. # Project Stakeholders and Organization
    

6. ## Stakeholder Overview
    

Project stakeholders are all individuals or groups who have an active interest in the CustomERP project and can influence its success. These stakeholders play key roles in guiding, developing, evaluating, or benefiting from the system.

1. ### Primary Stakeholders
    

- Dr. Cüneyt Sevgi (Academic Advisor):  
    Provides academic guidance, evaluates project progress, and ensures that all deliverables meet the CTIS senior project standards. The advisor also offers feedback during sprint reviews and document submissions.
    
- Project Team (Team 10):  
    Responsible for all stages of the project, including research, design, implementation, testing, and documentation. Team members collaborate closely following the Scrum methodology to ensure iterative development and regular progress evaluation.
    
- CTIS Department:  
    Serves as the supervising body, evaluating project outcomes and deliverables according to academic criteria. The department also provides the infrastructure and tools necessary for project completion.
    

2. ## Team Composition and Roles
    

The CustomERP project team consists of five members working in a cross-functional and collaborative structure. Although each member has areas of primary responsibility, all contribute to various aspects of design, coding, integration, and documentation. This flexibility allows the team to adapt to workload fluctuations and ensures shared ownership of all deliverables.

- Ahmet Selim Alpkirişçi – Project Manager & AI Integration Lead  
    Oversees overall coordination, communication with the academic advisor, and scheduling of deliverables. Leads the development of the AI component responsible for natural language processing and schema generation. Also contributes to both frontend and backend development as needed.
    
- Elkhan Abbasov – Developer (Frontend Focus)  
    Primarily contributes to frontend development and user interface design, ensuring that generated ERP modules are accessible and user-friendly. Collaborates in backend tasks, integration testing, and design discussions.
    
- Orhan Demir Demiröz – Developer (Backend Focus)  
    Focuses on backend architecture, database schema design, and module logic implementation. Actively participates in system integration, testing, and general development activities beyond backend tasks.
    
- Tunç Erdoğanlar – Developer (Backend Focus)  
    Works on backend functionality and API development while contributing to other technical areas such as frontend integration, debugging, and optimization. Supports the AI integration process and helps maintain deployment consistency.
    
- Burak Tan Bilgi – Developer (Quality & Documentation Focus)  
    Oversees the preparation of reports, testing plans, and documentation deliverables. Participates in development and integration efforts, and ensures that each sprint’s output meets agreed quality and usability standards.
    

To promote equal engagement, the team has agreed that the Scrum Master role will rotate between members every sprint. The Scrum Master for each sprint will be responsible for facilitating Scrum ceremonies (stand-ups, sprint planning, and retrospectives) and ensuring smooth communication across the team.

This structure encourages shared accountability, knowledge exchange, and flexibility — all key values in Scrum-based development and essential for small academic project teams.[12](#sdfootnote12sym)

6. # Project Communication
    

The team will follow a structured communication plan to ensure coordination, transparency, and timely feedback throughout the project.

1. ## Internal Communication:
    

- Daily coordination will take place through a WhatsApp group, where team members share brief progress updates, blockers, and next steps in alignment with the Scrum methodology.
    
- Weekly meetings will be held on Zoom to review sprint progress, plan upcoming tasks, and discuss any technical or organizational issues.
    
- GitHub will be used for version control, issue tracking, and documenting development-related discussions.
    
- All project documents, reports, and meeting notes will be stored on Google Drive for shared access and traceability.
    

1. ## External Communication:
    

- Communication with the project advisor, Dr. Cüneyt Sevgi, will be conducted primarily via email. He typically responds within approximately 30 minutes, and the team expects meetings to be arranged within five days when necessary.
    
- Advisor meetings will be requested as needed to review milestones, receive feedback, and ensure that the project remains aligned with academic and technical expectations.
    

1. ## Roles and Responsibilities:
    

- Ahmet Selim Alpkirişçi will act as the main communicator within the team, responsible for scheduling meetings, contacting the advisor, and summarizing discussion outcomes.
    
- All team members are responsible for active participation in meetings and maintaining clear, consistent communication.[13](#sdfootnote13sym)
    

  
  

7. # Project Change Control
    

All project changes—both in codebase and documentation—will be managed and tracked using GitHub to ensure version control, accountability, and traceability throughout both semesters.

1. ## Codebase Change Management:
    

- Each new feature or bug fix will be implemented in a separate branch named according to its purpose (e.g., feature/module-inventory, fix/auth-bug).
    
- Changes will only be merged into the main branch after a peer review and successful completion of testing.
    
- All commits will include clear messages describing the purpose and scope of the change.
    
- Pull requests will be used to document discussions, code reviews, and approvals before integration.
    

1. ## Documentation Change Management:
    

- Project documentation (SRS, SPMP, SDD, etc.) will be stored in the same GitHub repository under a dedicated /docs folder.
    
- Each document update will be versioned using branches and pull requests, following the same review and approval process as the codebase.
    
- Meeting notes and advisor feedback will be documented in Google Drive and linked in the repository for reference.
    

1. ## Change Authorization:
    

- All proposed changes will be discussed during weekly Zoom meetings and must be approved by the team lead (Ahmet Selim Alpkirişçi) before merging.
    
- Major structural or requirement changes will also be communicated to Dr. Cüneyt Sevgi via email for review and approval.
    
- This structured process ensures that every change—technical or documentation-related—is properly reviewed, documented, and traceable across both semesters.[14](#sdfootnote14sym)
    

8. # Assumptions
    

9. ## Technical Assumptions
    

- Internet connectivity will remain stable to support access to cloud-based AI services, GitHub, and collaborative tools.
    

1. ## Non-Technical Assumptions
    

- The academic advisor, Dr. Cüneyt Sevgi, will remain available for feedback and meetings, typically responding to emails within 30 minutes and arranging meetings within five days when necessary.
    
- Bilkent University’s academic calendar and course schedule will remain stable without major disruptions.
    

1. ## External Dependencies
    

- Continuous availability and reliability of the Anthropic API for natural language understanding and schema generation.
    
- Availability of GitHub, Google Drive, and Zoom for communication, collaboration, and version control.
    
- Access to necessary open-source libraries and frameworks (React, FastAPI, PostgreSQL, etc.) for frontend, backend, and integration development.
    
- Timely feedback and approval from the academic advisor, ensuring progress alignment with academic and technical expectations.[15](#sdfootnote15sym)
    

  
  

9. # Risks
    

10. ## Risk Identification and Analysis
    

We identified risks through a combination of team brainstorming sessions and analysis of similar AI-based software projects. Each team member contributed potential risks based on their assigned roles and technical expertise. We then evaluated each risk using the following criteria:

**Probability Assessment (1-5 scale):**

- Our team’s social dynamic (for non-technical risks)
    
- Consideration of our team's current technical skills
    
- Simpler but similar projects’ report on AI reliability and limitations
    

**Impact Assessment (1-5 scale):**

- Effect on project timeline and deliverable dates
    
- Potential to compromise core functionality
    
- Recovery difficulty and available contingency options[16](#sdfootnote16sym)
    

1. ### Technical Risks
    

TR1: AI API Limitations and Performance Issues

- Description: The Anthropic API may not accurately parse complex business requirements or may have rate limits that slow development.
    
- Probability: 4 (High) | Impact: 4 (High) | Risk Score: 16
    
- Mitigation Strategy: Implement caching mechanisms, create fallback parsing rules, and design manual override capabilities. Maintain a local testing dataset to minimize API calls during development.
    
- Monitoring Indicators: API response times exceeding 5 seconds, accuracy below 70% on test cases, monthly API costs exceeding budget.
    

- Contingency Plan: Switch to alternative APIs (OpenAI GPT-4) or implement hybrid approach with rule-based parsing for common patterns.
    

TR2: Integration Complexity Between AI and Code Generation

- Description: Connecting AI-interpreted requirements to functional database schemas and UI generation may prove more complex than anticipated.
    
- Probability: 3 (Medium) | Impact: 5 (Critical) | Risk Score: 15
    
- Mitigation Strategy: Build modular architecture with clear interfaces between components. Create extensive mapping templates for common business patterns.
    
- Monitoring Indicators: Failed integration tests, schema generation errors exceeding 30%, inability to map requirements to modules.
    
- Contingency Plan: Simplify scope to focus on predefined templates with AI-assisted customization rather than full generation.
    

TR3: Technology Stack Incompatibilities

- Description: Conflicts between React, FastAPI, PostgreSQL, and Docker configurations may cause deployment issues.
    
- Probability: 2 (Low) | Impact: 3 (Medium) | Risk Score: 6
    
- Mitigation Strategy: Use proven technology combinations, maintain consistent version control, and test integration early in Sprint 3.
    
- Monitoring Indicators: Build failures, version conflicts in dependencies, Docker container crashes.
    
- Contingency Plan: Switch to simpler technology stack (e.g., monolithic architecture with Django).
    

2. ### Project Management Risks
    

PMR1: Team Member Availability Conflicts

- Description: Academic workload from other courses, exams, or personal commitments may reduce team availability.
    
- Probability: 4 (High) | Impact: 3 (Medium) | Risk Score: 12
    
- Mitigation Strategy: Create detailed task assignments with 20% buffer time, maintain skill overlap between members, and establish clear backup responsibilities.
    
- Monitoring Indicators: Missed sprint deadlines, incomplete weekly tasks, absence from meetings.
    
- Contingency Plan: Redistribute workload among available members, adjust sprint scope, request deadline extensions if critical.
    

PMR2: Scope Creep During Development

- Description: Attempting to add features beyond initial scope may delay core functionality development.
    
- Probability: 3 (Medium) | Impact: 4 (High) | Risk Score: 12
    
- Mitigation Strategy: Maintain strict adherence to documented requirements, implement change control process, prioritize features using MoSCoW method.
    
- Monitoring Indicators: New feature requests during sprints, deviation from SRS specifications, sprint velocity decline.
    
- Contingency Plan: Defer non-essential features to "future work" section, focus on MVP functionality.
    

PMR3: Inadequate Testing Time

- Description: Compressed timeline may not allow sufficient testing before final delivery.
    
- Probability: 3 (Medium) | Impact: 3 (Medium) | Risk Score: 9
    
- Mitigation Strategy: Implement continuous testing throughout development, automate unit tests, allocate dedicated testing sprint.
    
- Monitoring Indicators: Test coverage below 60%, unresolved bug count exceeding 20, failed integration tests.
    
- Contingency Plan: Reduce feature set to ensure quality of core modules, extend testing into documentation period.
    

3. ### External Risks
    

ER1: Advisor Availability Limitations

- Description: Dr. Sevgi may have limited availability during critical review periods.
    
- Probability: 2 (Low) | Impact: 3 (Medium) | Risk Score: 6
    
- Mitigation Strategy: Schedule meetings well in advance, prepare comprehensive written updates, utilize email communication effectively.
    
- Monitoring Indicators: Response delays exceeding 5 days, cancelled meetings, incomplete feedback cycles.
    
- Contingency Plan: Seek guidance from course assistants or other faculty members, proceed with documented decisions.
    

ER2: Third-Party Service Disruptions

- Description: GitHub, Google Drive, or Zoom services may experience outages affecting collaboration.
    
- Probability: 2 (Low) | Impact: 2 (Low) | Risk Score: 4
    
- Mitigation Strategy: Maintain local backups, use alternative communication channels (WhatsApp), implement redundant storage.
    
- Monitoring Indicators: Service downtime notifications, access failures, sync errors.
    
- Contingency Plan: Switch to alternative platforms temporarily (GitLab, Microsoft Teams, local development).
    

  
  

  
  

2. ## Risk Priority Matrix
    

Table 1 Risk Priority Matrix

|   |   |   |   |   |
|---|---|---|---|---|
    
|Priority|Risk ID|Risk Description|Score|Owner|
|1|TR1|AI API Limitations|16|AI Integration Lead|
|2|TR2|Integration Complexity|15|Backend Team|
|3|PMR1|Team Availability|12|Project Manager|
|4|PMR2|Scope Creep|12|Project Manager|
|5|PMR3|Testing Time|9|QA Coordinator|
|6|TR3|Stack Incompatibilities|6|Backend Team|
|7|ER1|Advisor Availability|6|Project Manager|
|8|ER2|Service Disruptions|4|All Members|

  
  

3. ## Risk Response Strategies
    

Based on our analysis, we will implement the following risk response strategies:

- Accept: Low-score risks (ER2) will be accepted with minimal mitigation.
    
- Mitigate: High-probability risks (TR1, PMR1) will have proactive mitigation measures.
    
- Transfer: API cost risks will be managed through budget allocation and limits.
    
- Avoid: Scope creep (PMR2) will be avoided through strict change control.[17](#sdfootnote17sym)
    

  
  

![](file:///tmp/lu2778194qoa.tmp/lu2778194qqk_tmp_a10601cb.png)

Figure 5 Risk Graph

#   

  
  

10. # Curriculum Vitae
    

  

Figure 6 Ahmet Selim Alpkirişçi CV

Figure 7 Burak Tan Bilgi CV

Figure 8 Elkhan Abbasov CV

Figure 9 Orhan Demir Demiröz CV

Figure 10 Tunç Erdoğanlar CV

  
  

[1](#sdfootnote1anc) Claude 4.5: “project general context” + **Software Product Information**

Provide a brief overview of your product. It should be concise and the reader by just reading this text should have an overall understanding of what your software product is about. **This text will be displayed on the CTIS web page as the information page of your project, it should be representative of “what” your software product will accomplish and “how”.** So the audience of this text is not only CTIS-related people but also people who visit CTIS web page.

this is just a table cell I mean its a big cell but still just a cell keep it short and concise around 100 words dont give too much detail and its a global goal so dont mention specific languages also dont go overboard by praising our solution its nothing groundbreaking

[2](#sdfootnote2anc) ChatGPT: “Opus 4.1 response’s executive summary (see footnote 4)” + “Initial Plan until chapter 5.” as context + executive summary description

[3](#sdfootnote3anc) Claude 4.5: “Initial Plan” + lets add any Abbreviations that might be missing

[4](#sdfootnote4anc) Opus 4.1: “My own project’s details document” + “Initial Plan Template chapters 1-4” + I need to fill this document fill what you can also we are just senior students we are very humble and we are not shooting for the stars we need to present a document to show that we are trying to do is not really all that amazing but it is a gap in the market and doable at least our goals for the senior project and not the entire startup is doable so fill what you can in the document

[5](#sdfootnote5anc) Gemini 2.5 Pro: we had our initial plan v1 and now we are doing v2 and I gave it to you and I also gave you our srs which we had done after v1 and before srs I want to ask you specifically about our functional and non functional requirements is there anything I need to update change in v2 what do you think

[6](#sdfootnote6anc) Gemini 2.5 Pro: we had our initial plan v1 and now we are doing v2 and I gave it to you and I also gave you our srs which we had done after v1 and before srs I want to ask you specifically about our functional and non functional requirements is there anything I need to update change in v2 what do you think

[7](#sdfootnote7anc) Gemini 2.5 Pro: we had our initial plan v1 and now we are doing v2 and I gave it to you and I also gave you our srs which we had done after v1 and before srs I want to ask you specifically about our functional and non functional requirements is there anything I need to update change in v2 what do you think

[8](#sdfootnote8anc) Gemini 2.5 Pro: we had our initial plan v1 and now we are doing v2 and I gave it to you and I also gave you our srs which we had done after v1 and before srs I want to ask you specifically about our functional and non functional requirements is there anything I need to update change in v2 what do you think

[9](#sdfootnote9anc) Opus 4.1: “My own project’s details document” + “Initial Plan Template chapters 1-4” + I need to fill this document fill what you can also we are just senior students we are very humble and we are not shooting for the stars we need to present a document to show that we are trying to do is not really all that amazing but it is a gap in the market and doable at least our goals for the senior project and not the entire startup is doable so fill what you can in the document

[10](#sdfootnote10anc) Opus 4.1: “My own project’s details document” + “Initial Plan Template chapters 1-4” + I need to fill this document fill what you can also we are just senior students we are very humble and we are not shooting for the stars we need to present a document to show that we are trying to do is not really all that amazing but it is a gap in the market and doable at least our goals for the senior project and not the entire startup is doable so fill what you can in the document

[11](#sdfootnote11anc) Gemini 2.5 Pro: Context + and other than that I wrote a new one and it didnt really feel realistic like even if I plan everything perfectly implementing the prototype that we have proposed in sprint 1 or 2 idk is probably going to take a lot more time so this is the kind of milestones and deliverables I want everything doesnt have to be so linear like think of two tasks and two sprints it doesnt have to be one task for each sprint it can be 50 50 both tasks done alongside each other it can be 60 40 then 40 60 or idk there are many solutions to this and I want to have this kind of milestones and deliverables

[12](#sdfootnote12anc) ChatGPT: “Initial Plan until 5” + Primary Stakeholders: Dr. Cüneyt Sevgi (Academic Advisor) - Project oversight and guidance Team Members - Development and documentation CTIS Department - Academic evaluation Secondary Stakeholders: Potential small business users (for testing and feedback) Open-source community (future contributors) Team Organization: Project Manager (rotating monthly) - Coordination and planning AI Integration Lead - Natural language processing implementation Backend Development Lead - Database and module development Frontend Development Lead - UI generation and user experience Testing and Documentation Lead - Quality assurance and documentation Each team member will contribute to all areas while maintaining primary responsibility for their assigned domain. this is what I have written I am ahmet selim alpkirişçi I will be the project manager and ai integration lead Elkhan Abbasov will be responsible for frontend Orhan demir demiröz and tunç erdoğanlar will be responsible for backend Burak Tan Bilgi will be responsible for qa and doc each member will do a lot of things and not necessarily only responsible for their own stuff keep this in mind and lets rewrite this

[13](#sdfootnote13anc) ChatGPT: “Initial Plan until 6. as context” + detail it some use the parts that I have shared on scrum details also we will hold our weekly meetings on zoom and we will communicate with dr cüneyt sevgi our instructor using mail he responds around 30 mins and we expect him to arrange a meeting within 5 days we communicated with him in worst case our main communicator within the team will be ahmet selim alpkirişçöi

[14](#sdfootnote14anc) ChatGPT: “Initial Plan until 7. as context” + Change Control is the process that you will use to document, identify and authorize changes in an formalized way, with the use of a tool or different tools. Describe how project changes (including the documentation) will be handled. It is important that you provide details about the github page / address of your project. Clearly state how you are going to manage changes of the project codebase and changes of the documentation, both semesters.

[15](#sdfootnote15anc) ChatGPT: “Initial Plan until 8. as context” + List any assumptions that were made (as opposed to known facts). List any major external dependencies the project must rely upon for success, such as specific technologies, third-party vendors, etc.  lets write this when thinking of technical dependencies think only of things that are necessary that are mentioned in the current document also when thinking assumptions and dependencies think technical as well as non technical

[16](#sdfootnote16anc) Claude 4.5: In our feedback related to this part we were told that "risklerde we have identified nasıl yani nasıl identify ettiniz". so we need to explain how we identified meaning what was our way of thinking when defining a risk's probability and impact no need to give me the whole document just this part. Focus on our awareness regarding our lack of skill or experience and avoidance of overcomplicationg the project.

[17](#sdfootnote17anc) ChatGPT: “Initial Plan until 9. as context” + template’s explanation of risks.