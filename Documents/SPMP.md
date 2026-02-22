**Executive Summary**

This Software Project Management Plan (SPMP) document provides the administrative and technical foundation for the development of CustomERP, an AI-powered platform designed to generate customized Enterprise Resource Planning systems through natural language processing. The plan serves as an operational roadmap for the project duration from September 2025 through June 2026, detailing the coordination of work packages, resources, and cost estimation models. A significant finding of our planning process was the variation identified between estimation methodologies: the bottom-up Work Breakdown Structure (WBS) decomposition yielded a total effort of 1,520 person-hours, whereas the top-down Use Case Point (UCP) method predicted 2,500 hours based on the thirteen use cases defined in the SRS. After comparing these results with Agile Story Point estimates, we determined the WBS estimate to be the most realistic because it accounts for the granular sub-tasks required for academic documentation and the part-time availability of the student development team. Regarding financial planning, the project requires a nominal expenditure of 16,490 TL, primarily for Anthropic AI API tokens, hosting services, and technical overhead. A formal Net Present Value (NPV) analysis normalized these costs back to the project start date of September 1, 2025, using a 3 percent monthly interest rate, resulting in a present value of 15,262.68 TL. The project schedule is divided into three functional milestones, with the first 20 percent increment—focusing on the core AI pipeline, project intake logic, and inventory schema generation—scheduled for completion and presentation by January 7th, 2026. To manage progress efficiently, we have adopted a simplified monitoring strategy that focuses strictly on schedule variance and task lead times. These practical metrics allow us to identify bottlenecks in real-time and make necessary adjustments to our workload without the overhead of excessive data collection. By synthesizing these schedule, effort, and cost findings, the SPMP ensures that the project maintains a steady development pace and technical stability. This document establishes a clear path for risk mitigation and quality assurance, ensuring that the final prototype remains aligned with departmental standards while delivering a functional solution for automated software production.[1](#sdfootnote1sym)

**Table of Contents**

**Page Number**

  
  

**List of Tables**

**Page Number**

  
  

**List of Figures**

**Page Number**

  

**Abbreviations**

  
  

|   |   |
|---|---|
 
|API|Application Programming Interface|
|CRUD|Create, Read, Update, Delete|
|CTIS|(Department of) Information Systems and Technologies|
|ERD|Entity Relationship Diagram|
|ERP|Enterprise Resource Planning|
|FR|Functional Requirement|
|GUI|Graphical User Interface|
|HR|Human Resources|
|IDE|Integrated Development Environment|
|JSON|JavaScript Object Notation|
|MVP|Minimum Viable Product|
|NFR|Non-Functional Requirement|
|NLP|Natural Language Processing|
|PDF|Portable Document Format|
|REST|Representational State Transfer|
|SDD|Software Design Document|
|SDF|System Definition File|
|SDLC|Software Development Lifecycle|
|SP|Story Points|
|SPMP|Software Project Management Plan|
|SQL|Structured Query Language|
|SRS|Software Requirements Specification|
|UC|Use Case|
|UCP|Use Case Points|
|UI|User Interface|
|UML|Unified Modeling Language|
|UX|User Experience|
|WBS|Work Breakdown Structure|
|WP|Work Package|

  

1. # Project Schedule
    
    1. ## Work Packages & Dependencies
        

This subsection specifies the work packages for the activities and tasks required to satisfy the project agreement for CustomERP. Each work package is uniquely identified using a hierarchical numbering scheme and a descriptive title to ensure clarity in tracking and execution. The project is decomposed into logical units ranging from initial documentation and requirement analysis to technical implementation and final deployment packaging.

The schedule and work distribution are designed to meet three critical milestones:

- Milestone-1 (Fall 2025): Represents the 1st Increment, delivering 20% of the system’s functionality. This phase focuses on the core AI orchestration pipeline, natural language interpretation, and the initial Inventory schema generator.
    
- Milestone-2 (Spring 2026): Represents the 2nd Increment, delivering an additional 40% of the functionality. Key tasks include user authentication, dashboard development, and the implementation of the module export engine.
    
- Milestone-3 (Spring 2026): Represents the Final Increment, delivering the final 40% of the functionality. This includes multi-module support (Customer and Invoice), advanced AI predictive suggestions, and comprehensive system-level security.
    

Table 1 details the work packages, identifies the predecessor relationships to account for technical interdependencies, and specifies the team members assigned to each task. These tasks are mapped directly to the Use Case Diagram (UCD_1-13) provided in the SRS V2 to ensure full traceability between project management and software requirements.

Table 1 Work Packages and Dependencies

|   |   |   |   |
|---|---|---|---|
   
|**Work**<br><br>**Package**<br><br>**ID**|**Work Package Name**|**Predecessor**<br><br>**Work**<br><br>**Package**<br><br>**IDs**|**Team Member(s) Assigned**|
|1.1|Analysis & Documentation Phase|||
|1.1.1|Project Scope & Initial Planning|–|All Members|
|1.1.2|Functional & Non-Functional Requirements Specification|1.1.1|Selim, Elkhan|
|1.1.3|System Interface & Communication Protocol Design|1.1.2|Demir, Selim|
|1.1.4|UI Logical Characteristics & Navigation Wireframing|1.1.3|Burak, Demir|
|1.1.5|Database Requirement Analysis & Entity Modeling|1.1.4|Tunç|
|1.1.6|Verification Planning & Traceability Matrix (RTM)|1.1.5|Tunç|
|1.1.7|SPMP Financials & NPV Calculation|1.1.6|All Members|
|1.1.8|SPMP Effort Estimation (WBS/UCP/Agile)|1.1.7|All Members|
|1.1.9|SDD: High-Level System Architecture Design|1.1.8|Selim, Demir, Tunç|
|1.2|Increment-1: AI Pipeline & Core Generation (Jan 7 Milestone)|||
|1.2.1|Dev Environment Setup & Docker Configuration|1.1.9|Tunç|
|1.2.2|Main Application Dashboard & Layout Development|1.1.4|Burak|
|1.2.3|Project Metadata Handling & State Persistence Logic|1.2.1|Demir|
|1.2.4|Natural Language Input Interface & Real-time Validation|1.2.2|Burak, Elkhan|
|1.2.5|Anthropic API Orchestration & Token Management|1.1.9|Selim, Elkhan|
|1.2.6|Prompt Engineering for Precise Entity Extraction|1.2.5|Selim, Demir|
|1.2.7|System Definition File (SDF) JSON Schema Implementation|1.2.6|Demir, Tunç|
|1.2.8|AI-Driven Relationship & Cardinality Inference Engine|1.2.7|Selim, Elkhan|
|1.2.9|Relational Schema Generation & 3NF Transformation Logic|1.2.8|Tunç|
|1.2.10|Backend API Template Engine & Route Generator|1.2.9|Tunç|
|1.2.11|Dynamic ERD (Entity Relationship Diagram) Rendering|1.2.3|Burak|
|1.2.12|Module Review Interface & Attribute Editing Service|1.2.11|Burak, Demir|
|1.2.13|Artifact Packaging Service (ZIP/Docker-Compose)|1.2.10|Tunç|
|1.2.14|Deployment Guide (README) Auto-Generation Service|1.2.13|Demir, Tunç|
|1.2.15|Increment-1 End-to-End System Integration Testing|1.2.1-1.2.14|All Members|
|1.2.16|Milestone-1 Presentation & Demo Readiness|1.2.15|All Members|
|1.3|Increment-2: User Infrastructure & Security (Spring Milestone)|||
|1.3.1|Identity Management & Secure Authentication (JWT/Bcrypt)|1.2.16|Demir, Elkhan|
|1.3.2|Role-Based Access Control (RBAC) & Permission Logic|1.3.1|Elkhan|
|1.3.3|Administrative Control Panel for User & Project Oversight|1.3.2|Burak, Selim|
|1.3.4|Centralized Audit Logging & System Event Tracking|1.3.1|Selim|
|1.3.5|Advanced Error Boundary & Notification Framework|1.3.3|Burak|
|1.3.6|Increment-2 Integration & Regression Testing|1.3.5|All Members|
|1.4|Final Increment: Expansion & Optimization (Spring Milestone)|||
|1.4.1|Customer & Invoicing Module Generation Logic|1.3.6|Selim, Demir|
|1.4.2|Predictive AI Suggestion Engine for Missing Logic|1.4.1|Elkhan|
|1.4.3|Automated PDF/HTML Project Summary Generation|1.3.5|Burak|
|1.4.4|Security Hardening & API Key Encryption|1.3.1|Tunç|
|1.4.5|Final System Validation & User Acceptance Testing (UAT)|1.4.4|All Members|
|1.4.6|Final Deliverable Packaging & Documentation Review|1.4.5|All Members|

  
  

2. ## Resource Requirements
    

## 1.2.1 Personnel Resources

The project team consists of five members: **Selim, Burak, Tunç, Demir, and Elkhan**.  
Each member contributes to design, implementation, documentation, testing, and demonstration tasks.

Table 2 Personnel Resources

|   |   |   |   |
|---|---|---|---|
   
|**Personnel Type**|**Quantity**|**Time Period Used**|**Estimated Cost (TL)**|
|Student Developers|5|Throughout the project (Sep 2025 – Jun 2026)|0 TL (no external labor cost)|
|Academic Advisor|1|Bi-weekly meetings|0 TL|

_Note:_ Student time is not assigned monetary cost, consistent with CTIS course expectations.

## 1.2.2 Software Resources

The project uses a combination of free, student-licensed, and cloud-based tools.

Table 3 Software Resources

|   |   |   |   |
|---|---|---|---|
   
|**Software / Service**|**Purpose**|**Time of Use**|**Estimated Cost**|
|GitHub|Version control|Entire project|0 TL|
|VS Code / PyCharm|Backend & AI coding|Entire project|0 TL|
|Node.js + npm|Frontend and generator modules|Entire project|0 TL|
|Anthropic API (Claude)|NLP, AI pipeline for requirement interpretation|Mainly Increment-1 & Increment-2|~1,000 TL (API tokens)|
|Draw.io|Diagrams|Increment-1|0 TL|
|Postman|API testing|Increment-1 & Increment-2|0 TL|
|Microsoft Office / Word|Documentation|Whole project|0 TL (student license)|

  
  

## 1.2.3. Hardware Resources

Table 4 Hardware Resources

|   |   |   |   |
|---|---|---|---|
   
|**Hardware**|**Purpose**|**Usage Period**|**Estimated Cost**|
|Personal Laptops (5 units)|Development & testing|Entire project|0 TL (already owned)|
|External SSD (optional)|Backup & storage|As needed|1,500 TL|
|Internet Access|Cloud API calls, meetings|Entire project|0 TL (student home networks)|

  
  

## 1.2.4. Cloud & Computational Resources

Table 5 Cloud & Computational Resources

|   |   |   |   |
|---|---|---|---|
   
|**Resource**|**Purpose**|**Usage Period**|**Cost Estimate**|
|Cloud Compute (Local tests only)|Running generated modules|Increment-2 & Increment-3|0 TL|
|AI Inference Cost (Anthropic API)|NLP pipeline operations|Increment-1 → Final|~1,000 TL|
|GitHub Storage|Repository hosting|Whole project|0 TL|

  
  

## 1.2.5. Office & Workspace Resources

Table 6 Office & Workspace Resources

|   |   |   |   |
|---|---|---|---|
   
|**Resource**|**Purpose**|**Time Period**|**Estimated Cost**|
|Bilkent Computer Labs|Team meetings, development sessions|As needed|0 TL|
|Meeting Rooms (CTIS)|Sprint reviews, milestone discussions|Throughout project|0 TL|
|Whiteboard / Markers|Design discussions|Increment-1|0 TL|

  
  

## 1.2.6. Travel Resources

Table 7 Travel Resources

|   |   |   |
|---|---|---|
  
|**Travel Need**|**Purpose**|**Estimated Cost**|
|Local transportation inside campus|Meetings with advisor, team work|0 TL (walk)|

Travel cost is effectively zero because all meetings occur on campus.

## 1.2.7. Maintenance & Contingency Resources

Table 8 Maintenance & Contingency Resources

|   |   |   |
|---|---|---|
  
|**Resource**|**Purpose**|**Estimated Cost**|
|Backup storage renewal|Data safety|300 TL|
|Unexpected API overuse charges|AI model usage|200 TL|
|Miscellaneous expenses (printing, stationery)|Documentation|200 TL[2](#sdfootnote2sym)|

3. ## Cost Estimation, Net Present Value, Budget and Resource Allocation
    

Table 9 Project Expenditures

|   |   |   |
|---|---|---|
  
|**Expenditure**<br><br>**ID**|**Explanation**|**Cost**<br><br>**(in TL or USD)**|
|EXP-1|Transportation for 3 weekly group meetings (Round trip: 60 TL × 5 people × 3 meetings × 12 weeks)|10,800 TL|
|EXP-2|Food and beverage expenses for team meetings (150 TL × 12 weeks)|1,800 TL|
|EXP-3|AI Tools and API testing credits (Anthropic/Claude API: 180 TL/month × 3 months)|540 TL|
|EXP-4|Cloud services for AI inference and backend testing (200 TL × 2 months)|400 TL|
|EXP-5|Printing and stationery costs (Hard copies of SRS, SPMP, diagrams, etc.)|250 TL|
|EXP-6|Stock image and icon licenses for presentation and visual content|150 TL|
|EXP-7|Project promotional video equipment (Lighting, tripod, etc.)|500 TL|
|EXP-8|Domain registration and hosting fees for the 3-month demo presentation|600 TL|
|EXP-9|Hardware maintenance and laptop cleaning expenses for development machines|300 TL|
|EXP-10|Technical equipment for final demo day (HDMI cables, adapters, etc.)|200 TL|
|EXP-11|Academic source books and reference material purchases|400 TL|
|EXP-12|Contingency fund for unexpected expenses (5% safety margin)|750 TL|
|TOTAL||16,490 TL|

  
  

![](file:///tmp/lu307109c83n.tmp/lu307109c85w_tmp_b30f15a2.png)

Figure 1 Cash Flow Diagram of Project

To calculate the total cost of the project relative to the start date of September 1, 2025, a formal Net Present Value (NPV) analysis was performed. Following the "End-of-Month" approach, all expenses for the semester were grouped into single monthly cash flows. A monthly interest rate of 3 percent (0.03) was applied as the discount rate.

The total project expenditure of 16,490 TL is distributed across the semester as follows:

- September 2025 (Month 1): 3,500 TL
    
- October 2025 (Month 2): 4,000 TL
    
- November 2025 (Month 3): 4,000 TL
    
- December 2025 (Month 4): 4,990 TL
    

The Present Value (PV) for each month is calculated using the formula: PV = Cash Flow / (1.03 raised to the power of the month number).

- September Calculation: 3,500 / (1.03 to the power of 1) = 3,500 / 1.03 = 3,398.06 TL
    
- October Calculation: 4,000 / (1.03 to the power of 2) = 4,000 / 1.0609 = 3,770.38 TL
    
- November Calculation: 4,000 / (1.03 to the power of 3) = 4,000 / 1.0927 = 3,660.66 TL
    
- December Calculation: 4,990 / (1.03 to the power of 4) = 4,990 / 1.1255 = 4,433.58 TL
    

The total NPV is the sum of the individual present values:

3,398.06 + 3,770.38 + 3,660.66 + 4,433.58 = 15,262.68 TL

The NPV analysis indicates that the total value of our project costs as of September 1, 2025, is 15,262.68 TL.[3](#sdfootnote3sym)

  
  

2. # Project Effort Estimation
    

This section estimates the required effort for the CustomERP project using three different estimation techniques: WBS Decomposition-Based, Use Case Based (UCP), and Agile (Story Points).

1. ## WBS Decomposition-Based Estimation
    

Based on the Work Breakdown Structure (WBS), the following table provides effort estimates for each work package.

Table 10 WBS Decomposition-Based Estimation

|   |   |   |   |   |   |   |
|---|---|---|---|---|---|---|
      
|**Work Package ID**|**Work Package Name**|**Estimated Effort (Person-Hours)**|**Assigned # of Team Members**|**Estimated Duration (Days)**|**Projected Start Date**|**Projected End Date**|
|1.1|Documentation Phase||||||
|1.1.1|Project Scope & Planning|30|5|5|2025-09-15|2025-09-20|
|1.1.2|Requirements Spec|40|2|10|2025-09-21|2025-10-01|
|1.1.3|Interface Design|30|2|7|2025-10-02|2025-10-09|
|1.1.4|UI Wireframing|35|2|10|2025-10-10|2025-10-20|
|1.1.5|DB Requirement Analysis|25|1|5|2025-10-21|2025-10-26|
|1.1.6|Verification/RTM|20|1|4|2025-10-27|2025-10-31|
|1.1.7|Financial/NPV Analysis|25|5|3|2025-11-01|2025-11-04|
|1.1.8|Effort Estimation|30|5|4|2025-11-05|2025-11-09|
|1.1.9|SDD Design|45|3|10|2025-11-10|2025-11-20|
|1.2|Increment-1 (Jan 7)||||||
|1.2.1|Environment/Docker Setup|20|1|4|2025-11-21|2025-11-25|
|1.2.2|Main Dashboard Layout|30|1|10|2025-11-26|2025-12-06|
|1.2.3|Project Persistence Logic|35|1|7|2025-11-26|2025-12-03|
|1.2.4|Input Interface/Validation|40|2|8|2025-12-04|2025-12-12|
|1.2.5|Anthropic API Service|45|2|7|2025-12-04|2025-12-11|
|1.2.6|Prompt Engineering|35|2|5|2025-12-12|2025-12-17|
|1.2.7|SDF Schema Implementation|30|2|4|2025-12-18|2025-12-22|
|1.2.8|Relation Inference Engine|50|2|6|2025-12-23|2025-12-29|
|1.2.9|Schema Generation Logic|45|1|4|2025-12-30|2026-01-02|
|1.2.10|Backend Code Gen Engine|50|1|3|2026-01-03|2026-01-05|
|1.2.11|Dynamic ERD Rendering|40|1|3|2026-01-03|2026-01-05|
|1.2.12|Review/Editing Interface|35|2|2|2026-01-05|2026-01-06|
|1.2.13|Artifact Packaging Service|40|1|2|2026-01-05|2026-01-06|
|1.2.15|Integration Testing|50|5|1|2026-01-06|2026-01-06|
|1.2.16|Milestone-1 Demo|20|5|1|2026-01-07|2026-01-07|
|1.3|Increment-2 (Spring)||||||
|1.3.1|Auth System (JWT)|40|2|10|2026-02-16|2026-02-26|
|1.3.2|RBAC Implementation|30|1|7|2026-02-27|2026-03-06|
|1.3.3|Admin Panel Development|45|2|10|2026-03-07|2026-03-17|
|1.3.4|Audit Logging System|30|1|7|2026-03-18|2026-03-25|
|1.3.5|Error/Notify Framework|30|1|7|2026-03-26|2026-04-02|
|1.3.6|Inc-2 Integration Test|50|5|5|2026-04-03|2026-04-08|
|1.4|Final Increment (Spring)||||||
|1.4.1|Module Generation Logic|80|2|14|2026-04-09|2026-04-23|
|1.4.2|Predictive AI Logic|60|1|10|2026-04-24|2026-05-04|
|1.4.3|Report Generation (PDF)|40|1|7|2026-05-05|2026-05-12|
|1.4.4|Security Hardening|35|1|7|2026-05-13|2026-05-20|
|1.4.5|Final UAT Testing|80|5|10|2026-05-21|2026-05-31|
|1.4.6|Final Packaging|40|5|5|2026-06-01|2026-06-05|
|**Total**|**Estimated Effort**|**1520**|||||

  
  

Total Estimated Effort: 1,520 Person-Hours

  
  

2. ## Use Case Based Estimation
    

Based on the Use Case Diagram from SRS B v2, the Use Case Points (UCP) are calculated as follows.

Use Case Diagram Reference:

![](file:///tmp/lu307109c83n.tmp/lu307109c85w_tmp_4634f9bb.png)

Figure 2 UCD_1-13 – CustomERP Overall Use Case Diagram [1]

  
  

The CustomERP system has 13 use cases organized into 5 groups:

• UCD_1-3: Project Intake & Analysis (UC-1: View Project List, UC-2: Create New Project, UC-3: Generate SDF using Chatbot)

• UCD_4-6: Generate Schema & CRUD and Review (UC-4: Generate Schema & CRUD, UC-5: Review Schema & API Summary, UC-6: Approve or Edit Module Set)

• UCD_7: Artifacts Export (UC-7: Export Generated ERP)

• UCD_8-10: Admin: Users and Logs (UC-8: Manage Users, UC-9: Manage User Projects, UC-10: View Activity and Error Logs)

• UCD_11-13: Account (UC-11: Register Account, UC-12: Login, UC-13: Logout)

Table 11 Unadjusted Actor UCP

|   |   |   |   |   |
|---|---|---|---|---|
    
|Actor Classification|Type of Actor|Weight|Number|Total|
|Simple|External system that must interact with the system using a well-defined API|1|1|1|
|Average|External system that must interact with the system using standard communication protocols|2|0|0|
|Complex|Human actor using a GUI application interface|3|2|6|
|Total Unadjusted Actor Weight (UAW)||||7|

Actor Breakdown:

• Simple (1): Anthropic API - External AI service with well-defined REST API

• Complex (2): Business User (GUI), System Administrator (GUI)

Table 12 Unadjusted Use Cases UCP

|   |   |   |   |   |
|---|---|---|---|---|
    
|Use Case Classification|No. of Transactions|Weight|Number|Total|
|Simple|1 to 3 transactions|5|3|15|
|Average|4 to 7 transactions|10|8|80|
|Complex|8 or more transactions|15|2|30|
|Total Unadjusted Use Case Weight (UUCW)||||125|

  
  

Table 13 Use Case Classification Breakdown

|   |   |   |   |
|---|---|---|---|
   
|Use Case ID|Use Case Name|# of Transactions|Classification|
|UC-1|View Project List|3|Simple|
|UC-2|Create New Project|4|Average|
|UC-3|Generate SDF using Chatbot|11|Complex|
|UC-4|Generate Schema & CRUD from SDF|11|Complex|
|UC-5|Review Schema & API Summary|4|Average|
|UC-6|Approve or Edit Module Set|4|Average|
|UC-7|Export Generated ERP|5|Average|
|UC-8|Manage Users|6|Average|
|UC-9|Manage User Projects|5|Average|
|UC-10|View Activity and Error Logs|4|Average|
|UC-11|Register Account|7|Average|
|UC-12|Login|3|Simple|
|UC-13|Logout|2|Simple|

Unadjusted Use Case Points (UUCP) = UAW + UUCW = 7 + 125 = 132

  
  

Table 14 Technical Factor Table

|   |   |   |   |   |
|---|---|---|---|---|
    
|Factor|Description|Weight|Assigned Value (0-5)|Weight × Assigned Value|
|T1|Distributed system|2.0|3|6.0|
|T2|Response time/performance objectives|1.0|4|4.0|
|T3|End-user efficiency|1.0|4|4.0|
|T4|Internal processing complexity|1.0|4|4.0|
|T5|Code reusability|1.0|3|3.0|
|T6|Easy to install|0.5|4|2.0|
|T7|Easy to use|0.5|5|2.5|
|T8|Portability to other platforms|2.0|3|6.0|
|T9|System maintenance|1.0|3|3.0|
|T10|Concurrent/parallel processing|1.0|2|2.0|
|T11|Security features|1.0|4|4.0|
|T12|Access for third parties|1.0|3|3.0|
|T13|End user training|1.0|3|3.0|
|Total Technical Factor (TFactor)||||46.5|

Technical Complexity Factor (TCF) = 0.6 + (0.01 × TFactor) = 0.6 + (0.01 × 46.5) = 1.065

  
  

Table 15 Environmental Factor Table

|   |   |   |   |   |
|---|---|---|---|---|
    
|Factor|Description|Weight|Assigned Value (0-5)|Weight × Assigned Value|
|E1|Familiarity with development process used|1.5|3|4.5|
|E2|Application experience|0.5|2|1.0|
|E3|Object-oriented experience of team|1.0|3|3.0|
|E4|Lead analyst capability|0.5|3|1.5|
|E5|Motivation of the team|1.0|5|5.0|
|E6|Stability of requirements|2.0|4|8.0|
|E7|Part-time staff|-1.0|5|-5.0|
|E8|Difficult programming language|-1.0|1|-1.0|
|Total Environmental Factor (EFactor)||||17.0|

Environmental Complexity Factor (ECF) = 1.4 + (-0.03 × EFactor) = 1.4 + (-0.03 × 17.0) = 0.89

UCP Calculation

Adjusted Use Case Points (UCP) = UUCP × TCF × ECF

UCP = 132 × 1.065 × 0.89 = 125.13 ≈ 125 UCP

Effort Conversion

Using industry standard conversion factor of 20 person-hours per UCP:

Total Effort = UCP × 20 = 125 × 20 = 2,500 person-hours

3. ## Agile Estimation
    

User Stories derived from Functional Requirements with Story Points.

Table 16 User Stories

|   |   |   |   |
|---|---|---|---|
   
|Functional Requirement ID|User Story ID|User Story Description|Estimated SP|
|FR1.1|US-1.1|As a Business User, I want to submit a business description (500-5000 words) so that the system can analyze my requirements.|5|
|FR1.2|US-1.2|As a Business User, I want the system to validate my input and provide corrective guidance so that I can submit proper input.|3|
|FR1.3|US-1.3|As a Business User, I want my description securely sent to the AI service so that my business information is protected.|3|
|FR1.4|US-1.4|As a Business User, I want to receive structured data from the AI in JSON format so that my requirements are formally captured.|5|
|FR1.5|US-1.5|As a Business User, I want the structured data stored in staging so that I can proceed with generation.|3|
|FR1.6|US-1.6|As a Business User, I want to see processing status while AI works so that I know the system is working.|2|
|FR2.1|US-2.1|As a Business User, I want the system to generate a relational database schema from AI output so that my data model is created.|8|
|FR2.2|US-2.2|As a Business User, I want the system to generate CRUD operations and REST API endpoints for each entity.|8|
|FR2.3|US-2.3|As a Business User, I want the system to generate frontend UI code in React.js without deploying it.|8|
|FR2.4|US-2.4|As a Business User, I want the system to generate the three predefined modules (Customer, Inventory, Invoicing).|5|
|FR2.5|US-2.5|As a Business User, I want to see a visual ERD and API summary so that I can review the generated structure.|5|
|FR2.6|US-2.6|As a Business User, I want Dockerfiles and Docker Compose files generated so that deployment is simplified.|5|
|FR2.7|US-2.7|As a Business User, I want to download all generated source files in a project folder.|3|
|FR3.1|US-3.1|As a Business User, I want the AI to identify business entities from my description with ≥70% accuracy.|5|
|FR3.2|US-3.2|As a Business User, I want the AI to infer relationships between entities with ≥70% accuracy.|5|
|FR3.3|US-3.3|As a Business User, I want to receive clarifying questions when ambiguity is detected.|5|
|FR3.4|US-3.4|As a Business User, I want my clarification answers stored for schema refinement.|3|
|FR3.5|US-3.5|As a Business User, I want the system to generate a structured JSON file with all entities and assumptions.|3|
|FR4.1|US-4.1|As a User, I want to access a web dashboard to submit descriptions and manage my projects.|5|
|FR4.2|US-4.2|As a Business User, I want clarification dialogs displayed as modal pop-ups with form fields.|3|
|FR4.3|US-4.3|As a System Administrator, I want role-based authentication (Business User, Admin) for access control.|5|
|FR4.4|US-4.4|As a System Administrator, I want all user actions logged with timestamps in an audit log.|3|
|FR5.1|US-5.1|As a Business User, I want a Docker Compose file generated describing all containers and dependencies.|3|
|FR5.2|US-5.2|As a Business User, I want a README deployment guide generated so that I know how to run the ERP.|2|
|FR5.3|US-5.3|As a Business User, I want summary reports in PDF or HTML format of generated entities and schemas.|3|
|FR5.4|US-5.4|As a Business User, I want to export project metadata in JSON and SQL formats.|3|

  
  

Total Story Points: 111 SP

Story Point to Effort Conversion

Conversion Approach: Based on the team's anticipated velocity and sprint capacity:

Team Size: 5 developers

Sprint Duration: 2 weeks

Available Hours per Sprint: 5 developers × 15 hours/week × 2 weeks = 150 person-hours/sprint

Estimated Velocity: 20-25 SP per sprint (based on similar student projects)

Using 20 SP per sprint:

Number of Sprints = 111 SP ÷ 20 SP/sprint ≈ 6 sprints

Total Duration = 6 sprints × 2 weeks = 12 weeks

Total Effort = 6 sprints × 150 hours = 900 person-hours

Using conservative 15 SP per sprint (accounting for learning curve):

Number of Sprints = 111 SP ÷ 15 SP/sprint ≈ 8 sprints

Total Duration = 8 sprints × 2 weeks = 16 weeks

Total Effort = 8 sprints × 150 hours = 1,200 person-hours

Alternative conversion using 10 person-hours per SP:

Total Effort = 111 SP × 10 hours/SP = 1,110 person-hours

4. ## Discussion
    

Comparison of Estimation Results

Table 17 Comparison of Estimation Results

|   |   |
|---|---|
 
|Estimation Method|Total Effort (Person-Hours)|
|WBS Decomposition-Based|1,520|
|Use Case Point (20 hrs/UCP)|2,500|
|Agile Story Points (20 SP/sprint)|900|
|Agile Story Points (15 SP/sprint)|1,200|
|Agile Story Points (10 hrs/SP)|1,110|

  
  

Analysis of Differences

WBS vs. UCP Estimation:

- The WBS-based estimation (1,520 hours) is lower than the UCP estimation (2,500 hours). This difference arises because:
    

• WBS is bottom-up: It estimates effort for specific, well-defined work packages.

• UCP is top-down: It applies industry-standard conversion factors (20 hrs/UCP) calibrated for professional developers.

• Student project context: Standard UCP factors assume full-time professional developers with higher productivity.

WBS vs. Agile Estimation:

- The WBS estimate (1,520 hours) is higher than Agile estimates (900-1,200 hours) because:
    

• WBS includes documentation, planning, and project management tasks

• Agile story points focus primarily on development effort

• WBS captures broader project activities not reflected in user stories

UCP vs. Agile Estimation:

- The UCP estimate is notably higher than Agile estimates because:
    

• UCP conversion factors are conservative and industry-averaged

• Agile estimation is calibrated to this specific team's expected velocity

Which Estimation is More Accurate?

- For this student project, the WBS estimate is likely most realistic for the following reasons:
    

- Comprehensive scope: WBS includes documentation, testing, and project management activities that the Agile method may underestimate.
    
- Part-time development: All team members are students with limited weekly availability (~15 hours/week).
    
- Defined scope: The project has well-defined increments with clear milestones.
    

Recommended estimate: Based on this analysis, a reasonable total effort estimate for CustomERP is 1,200-1,500 person-hours.[4](#sdfootnote4sym)

  
  

  
  

3. # Project Monitoring and Measuring
    
    1. ## Monitoring Progress
        

To ensure continuous visibility into the project’s status, the team will use the following monitoring mechanisms:

1. ## Weekly Scrum Meetings
    

A 30–45 minute meeting will be held every week where each member discusses:

· What tasks were completed,

· What tasks are planned for next week,

· Any blockers or dependencies.

These meetings help identify schedule risks early and allow reallocation of tasks when needed.

2. ## Bi-Weekly Advisor Meetings
    

Every two weeks, the team meets with the academic advisor to:

· Present the current sprint outcomes,

· Demonstrate prototypes or completed modules,

· Validate whether the project is progressing according to expectations,

· Receive corrective feedback.

Advisor input is used to refine the next sprint scope.

3. ## Online Communication (WhatsApp)
    

Daily coordination occurs through team channels to:

· Track urgent issues,

· Discuss small design decisions,

· Communicate progress and blockers in real time.

4. ## Task Tracking via GitHub Projects
    

Each Work Package and subtask is represented as a card with:

· Assigned team member,

· Priority level,

· Deadline,

· Current status (To Do → In Progress → Review → Done).

This enables transparent progress tracking and automatic burn-down visualization.

5. ## Weekly Commit & Merge Tracking
    

Git commit history is reviewed weekly to ensure expected development pace and detect slowdowns.

2. ## Metrics Collection
    

The team will collect a minimal set of practical metrics focused on schedule performance and functional completeness.

1. ## Schedule Variance (Project Metric):
    

- **What:** We will compare the "Projected End Date" of work packages in our WBS against the "Actual Completion Date."
    
- **When & How:** Collected weekly during scrum meetings by checking the status of tasks in GitHub Projects.
    
- **Storage:** Recorded in a shared Progress Tracking Sheet.
    
- **Why:** This is the primary metric to determine if we are ahead or behind. If a task is delayed by more than 3 days, we immediately adjust the workload for the following week.
    

1. ## Functional Completion Rate (Product Metric):
    

- **What:** The percentage of Functional Requirements (from the SRS) that have passed basic verification.
    
- **When & How:** Measured at the end of each milestone (e.g., Jan 7th) by checking the Requirement Traceability Matrix (RTM).
    
- **Storage:** Documented in our Verification Logs.
    
- **Why:** To ensure that being "ahead" on the schedule actually reflects working software, not just unfinished code.
    

1. ## Task Lead Time (Process Metric):
    

- **What:** The time elapsed from when a task is moved to "In Progress" until it is marked "Done."
    
- **When & How:** Automatically tracked via GitHub Projects' board activity.
    
- **Storage:** GitHub Projects Analytics.
    
- **Why:** If lead times are increasing, it indicates a technical bottleneck (e.g., AI API complexity), prompting us to seek advisor feedback or simplify the implementation.[5](#sdfootnote5sym)
    

4. # Software Development Environment
    

This section identifies the technical environment used to develop CustomERP. The team selected these tools to support the project's requirements for AI processing, full-stack development, and documentation. The following table provides the specific versions and descriptions of the programming languages, frameworks, and management software used throughout the development process.

Table 18 Software Development Environment Table

|   |   |   |   |
|---|---|---|---|
   
|**Name**|**Type**|**Version**|**Description**|
|Python|Programming Language|3.11|Used for backend services, AI orchestration logic, SDF processing, and NLP utilities.|
|Node.js|Programming Language / Runtime|20.x|Used for generating UI/CRUD modules, running the frontend, and implementing the module builder.|
|TypeScript|Programming Language|5.x|Used in frontend components and API client logic for improved type safety.|
|React|Frontend Framework|18.x|Used for building the user interface of project screens, review pages, and CRUD pages.|
|FastAPI|Backend Framework|0.110+|Used for implementing backend endpoints, SDF processing API, and AI pipeline routing.|
|Anthropic Claude API|AI API|2025 API|Used for NLP, entity extraction, clarification questions, and schema inference.|
|JSON Schema|Data Definition|Draft-2020-12|Used as the internal structure for System Definition File (SDF).|
|SQLite (Local Testing)|Database|3.x|Used for temporary storage during development; replaced by JSON-based storage in MVP.|
|Local JSON Storage Engine|File-Based Database|Custom|Used as the primary storage system for generated Inventory CRUD modules in Increment-1.|
|GitHub|Version Control|Latest|Used for repository hosting, issue tracking, pull requests, and progress monitoring.|
|Git|Version Management Tool|2.x|Used for local version tracking and team collaboration.|
|Postman|V&V / API Testing|Latest|Used to test backend endpoints, AI requests, and CRUD generation outputs.|
|Jest|V&V / Frontend Testing Framework|29.x|Used to test React components and CRUD UI generation logic.|
|PyTest|V&V / Backend Testing|8.x|Used to test SDF generator, AI orchestration, and API behavior.|
|VS Code|IDE|Latest|Main development environment for both backend and frontend tasks.|
|PyCharm|IDE|2024.x|Used by backend developers for Python project structure and debugging.|
|Figma|UI Design Tool|Latest|Used for creating interface mockups, wireframes, and Prototype screen designs.|
|draw.io|Diagramming Tool|Latest|Used for preparing UML diagrams: use case, activity diagrams, and ERD visualizations.|
|Github|Collaboration|Latest|Used for documentation sharing, metric tracking, and meeting notes.|
|GitHub Projects|Project Management|Latest|Used for Work Package tracking, sprint planning, and backlog management.|
|Zoom|Communication|Latest|Used for remote meetings, sprint reviews, and debugging sessions within the team.[6](#sdfootnote6sym)|

  
  

  
  

[1](#sdfootnote1anc) ChatGPT 5.1: Generate a one-paragraph Executive Summary for this SPMP that summarizes only the content of the document its project specific work packages, dependencies, monitoring approach, and development environment without adding information not included in the file. (Continues below)  
Gemini 3 Pro: considering this whole document can you write me a new executive summary that is slightly longer

[2](#sdfootnote2anc) ChatGPT 5 Prompt : This subsection of the SPMP shall provide, as a function of time, estimates of the total resources required to complete the project. Numbers and types of personnel, computer time, support software, computer hardware, office and laboratory facilities, travel, and maintenance requirements for the project resources are typical resources that should be specified. Assign cost items for each of the resource requirements by using estimations or by doing market research.

[3](#sdfootnote3anc) Gemini 3 Pro: Srs_v2 + Spmp Cost Estimation, Net Present Value, Budget and Resource Allocation explanation

[4](#sdfootnote4anc) Opus 4.5: this chapter’s requirements with explanation on what kind of plan we had in mind with context initial plan v2 project scope and srsv2 functional requirements.

[5](#sdfootnote5anc) ChatGPT5 Prompt: 3. Project Monitoring and Measuring This is the section that you will discuss how you will control if your project is on schedule or if you are moving too fast or too slow. 1. Explain how you will monitor progress (such as Scrum meetings, weekly meetings, Zoom meetings). 2. List and describe project, product, and process metrics that you will be collecting, when and how. How and where you will be storing these metrics? Why are you collecting these metrics?  
Gemini 3 Pro:I am not happy with this part at all

1. List and describe project, product, and process metrics that you will be collecting, when and how. How and where you will be storing these metrics? Why are you collecting these metrics?
    

only metric I want to see is that are we behind or ahead how behind are we how ahead are we so that we can make adjustments these all feel like bs

  
  

  
  

[6](#sdfootnote6anc) ChatGPT5 Prompt : 4.Software Development Environment Create a categorized table with version number and description of your software development environment such as Programming Languages, Frameworks, APIs, Databases, Cloud Services, Version Management, V&V, Project Management software, etc. Use the structure of Table 9. Table 9 Software Development Environment Name Type Version Description