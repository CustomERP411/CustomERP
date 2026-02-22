**Executive Summary**

This Software Design Description (SDD) document presents the detailed design of the CustomERP system with a focus on the functionality implemented in the first development increment. The document explains how the system architecture, software components, data structures, and interactions are designed to support the generation of a customized Enterprise Resource Planning system through natural language input. The CustomERP system is designed as an AI-assisted platform that enables business users to describe their business processes in plain language and obtain structured system artifacts as output. Within this scope, the SDD describes the selected architectural approach and clarifies how responsibilities are distributed across the presentation layer, backend services, AI integration components, and persistent storage. These design decisions support key quality attributes such as modularity, maintainability, and controlled system evolution. The document further presents the logical and physical views of the system, illustrating how user input flows through the system components to produce the System Definition File (SDF) and the inventory module. Particular emphasis is placed on the first increment use cases, including submitting a business description, clarifying requirements through AI-supported interaction, reviewing and editing the SDF, generating the inventory module, and exporting the generated system. For these use cases, the SDD provides low-level design details, including pseudocode for core workflows, UML communication diagrams that explain use case realization, and design-level UML class diagrams specifying attributes, methods, visibilities, and relationships. The document also defines a structured approach to test case design and presents unit and acceptance test cases derived from the first increment functionality, enabling systematic verification of the implemented behavior. Overall, this SDD consolidates the design decisions and component interactions of the CustomERP system into a coherent technical reference that demonstrates how the first increment has been realized and prepares the system for future extensions.[1](#sdfootnote1sym)

**Table of Contents**

**Page Number**

  
  

**List of Tables**

**Page Number**

  
  

**List of Figures**

  

  

**Abbreviations**

  
  

|   |   |
|---|---|
 
|CTIS|Information Systems and Technologies|
|SDD|Software Design Description|
|SPMP|Software Project Management Plan|
|SRS|Software Requirements Specification|
|WBS|Work Breakdown Structure|
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

  

1. # High-Level Design (Architecture)
    

The CustomERP system provides an AI-assisted environment that enables non-technical users to generate ERP systems based on natural language business descriptions. The system is developed incrementally, and the first increment focuses exclusively on inventory-related functionality and the generation of the System Definition File (SDF).

Figure 1 shows the **system-level Use Case Diagram with increment-based coloring**. Use cases highlighted for the first increment represent the functionality implemented in the first prototype, while the remaining use cases are planned for future increments.

The primary actor of the system is the **Business User**, who interacts with the system through a web-based interface. The **AI Service** acts as an external system actor responsible for analyzing business descriptions and generating structured data models.[2](#sdfootnote2sym)

![](file:///tmp/lu307109c83n.tmp/lu307109c89g_tmp_928f0c34.jpg)

Figure 1: System-Level Use Case Diagram with Increment Coloring

  
  

## 1.1 Selected Architecture

The CustomERP system is developed using an **N-Tier Layered Microservices Architecture**. This architectural style separates the system into multiple layers, each with a distinct responsibility, and isolates the AI-related functionality into a dedicated service.

The architecture consists of the following layers:

- **Presentation Layer:** A web-based single-page application that manages user interaction and visualization.
    
- **Application Layer:** A REST-based backend responsible for business logic, project management, and orchestration.
    
- **AI Integration Layer:** A standalone microservice that handles communication with the large language model and performs natural language analysis.
    
- **Data Layer:** A relational database responsible for persistent storage.
    
- This architecture was selected primarily to satisfy the system’s **non-functional requirements**. Maintainability is ensured through strict separation of concerns. Portability is supported through containerization of services. Performance is improved by isolating computationally expensive AI operations into a separate service.
    
- **Advantages** of this architecture include independent scalability of services, technology flexibility, and easier maintenance. **Disadvantages** include increased deployment complexity and additional inter-service communication overhead. However, these drawbacks are acceptable given the project’s scope and goals.[3](#sdfootnote3sym)
    

## 1.2 Logical View

The logical view describes how the main components of the system interact to deliver functionality. The system follows a pipeline-based interaction model. The frontend captures user input and forwards it to the backend API. The backend manages project state and communicates with the AI Gateway for natural language processing. The AI Gateway generates a structured System Definition File (SDF), which is stored in the database. Subsequent interactions update the SDF and trigger artifact generation.[4](#sdfootnote4sym)

![](file:///tmp/lu307109c83n.tmp/lu307109c89g_tmp_a517180.png)

Figure 2: Logical Architecture Block Diagram

  
  

## 1.3 Physical View

Figure 3 illustrates the **Extended Entity-Relationship (EER) Diagram** of the system modeled using **Chen notation**. Entities are represented as rectangles, relationships as diamonds, and attributes as ovals. Cardinalities and participation constraints are explicitly defined.

Total participation is enforced where an entity instance cannot exist independently (e.g., an SDF must belong to a Project), while partial participation is used where associations are optional.[5](#sdfootnote5sym)

![](file:///tmp/lu307109c83n.tmp/lu307109c89g_tmp_2c55d3f0.png)

Figure 3: EER Diagram (Chen Notation)

## 1.4 Design Quality

The physical view describes how software components are deployed and executed on physical or virtual infrastructure. The system is deployed using container-based virtualization. All services are hosted on a single Docker host and communicate over a private bridge network.

The frontend runs as a web server container, the backend and AI Gateway run as independent service containers, and the database runs in a dedicated PostgreSQL container. This deployment approach ensures portability, isolation, and ease of deployment.

  
  

![](file:///tmp/lu307109c83n.tmp/lu307109c89g_tmp_f2ee0810.png)

Figure 4: UML Deployment Diagram

  

2. # Test Case Design
    

This section describes the approach used to design test cases for the CustomERP system and defines the standard format that will be used when documenting test cases. The objective of the test case design is to ensure that the functionality implemented in the first increment is verified at different testing levels in a systematic and consistent manner.

The test case design process covers **Unit Testing**, **Software Integration Testing**, **System Testing**, and **Acceptance Testing**. All test cases are derived exclusively from the functionality implemented in the first increment, which includes the submission of business descriptions, clarification of requirements, review and editing of the System Definition File (SDF), generation of the Inventory module, and export of generated artifacts.

## ****2.1 Unit Test Design****

Unit tests are designed to verify the correctness of individual software components in isolation. These tests focus on backend-level functions such as input validation, business logic execution, data transformation, and error handling. Dependencies such as the database and external AI services are isolated using mocking techniques to ensure that each unit is tested independently.

Unit testing follows a white-box testing approach and is primarily applied to service-layer and utility-level functions. The purpose of unit testing is to detect logic errors at an early stage of development and to ensure that individual components behave as expected.

**Unit Test Case Format and Fields**

Each unit test case is documented using the following standard fields:

- Test Case ID
    
- Related Use Case (First Increment)
    
- Test Objective
    
- Preconditions
    
- Test Steps
    
- Expected Result
    
- Actual Result
    
- Pass / Fail Status[6](#sdfootnote6sym)
    

## ****2.2 Software Integration Test Design****

Integration tests are designed to verify the correct interaction between integrated software components. These tests focus on communication between the backend services, the AI Gateway, and the database layer. Integration testing ensures that data is correctly passed across service boundaries and that integrated components function together as intended.

Integration tests are executed in a containerized environment that closely resembles the target deployment setup. The purpose of integration testing is to identify interface-level defects and inconsistencies in data exchange.

**Integration Test Case Format and Fields**

Each integration test case is documented using the following standard fields:

- Test Case ID
    
- Related Use Case (First Increment)
    
- Test Objective
    
- Preconditions
    
- Test Steps
    
- Expected Result
    
- Actual Result
    
- Pass / Fail Status[7](#sdfootnote7sym)
    

## ****2.3 System Test Design****

System tests are designed to validate the complete system behavior from an end-user perspective. These tests are conducted as black-box tests and verify the system’s functionality through the user interface without considering internal implementation details.

System testing focuses on end-to-end workflows such as submitting a business description, generating and editing the SDF, and producing the Inventory module. The goal of system testing is to ensure that the integrated system satisfies the functional requirements defined for the first increment.

**System Test Case Format and Fields**

Each system test case is documented using the following standard fields:

- Test Case ID
    
- Related Use Case (First Increment)
    
- Test Objective
    
- Preconditions
    
- Test Steps
    
- Expected Result
    
- Actual Result
    
- Pass / Fail Status[8](#sdfootnote8sym)
    

## ****2.4 Acceptance Test Design****

Acceptance tests are designed to validate that the system meets user expectations and business objectives. These tests are defined from a business-oriented perspective and focus on verifying whether the system delivers meaningful and usable outcomes.

Acceptance testing is limited to the functionality implemented in the first increment and emphasizes the correctness and completeness of the generated Inventory module and related artifacts. The results of acceptance testing determine whether the system is acceptable for use from a stakeholder’s perspective.

**Acceptance Test Case Format and Fields**

Each acceptance test case is documented using the following standard fields:

- Test Case ID
    
- Related Use Case (First Increment)
    
- Test Objective
    
- Preconditions
    
- Test Steps
    
- Expected Result
    
- Pass / Fail Status[9](#sdfootnote9sym)
    

  
  

  
  

  
  

  
  

  
  

  
  

  
  

  
  

  
  

  
  

3. # Low Level Design
    

## 3.1 Pseudocode

This section provides the algorithmic logic for the core workflows of the First Increment. The pseudocode focuses on the critical paths for handling business descriptions, managing AI clarification loops, generating the System Definition File (SDF), creating the inventory module, and exporting the final artifacts.

3.1.1 Process and Validate Business Description

This workflow handles the initial submission of the user's natural language description. It ensures the input meets quality standards before initiating the project.

```text

ALGORITHM ProcessBusinessDescription

INPUT: userId (UUID), rawText (String)

OUTPUT: projectStatus (Enum)

  
  

BEGIN

// 1. Input Sanitization

sanitizedText = TRIM(rawText)

// 2. Validation Logic

IF LENGTH(sanitizedText) < 50 THEN

THROW ValidationError("Description is too short to analyze.")

END IF

IF DETECT_PII(sanitizedText) IS TRUE THEN

THROW SecurityError("Personally Identifiable Information detected.")

END IF

  
  

// 3. Project Initialization

newProject = NEW Project()

newProject.owner = userId

newProject.description = sanitizedText

newProject.status = "DRAFT"

newProject.createdAt = NOW()

SAVE(newProject) TO Database

  
  

RETURN newProject.status

END

```

### **3.1.2 Clarification Loop Logic**

This algorithm manages the interactive session between the User and the AI Service to resolve ambiguities in the requirements.

```text

ALGORITHM ManageClarificationLoop

INPUT: projectId (UUID), userAnswers (List<Answer>)

OUTPUT: nextAction (Enum: 'MORE_QUESTIONS' or 'GENERATE_SDF')

  
  

BEGIN

project = RETRIEVE Project FROM Database WHERE id = projectId

currentContext = project.description + userAnswers

  
  

// 1. AI Analysis of current context

aiResponse = CALL_AI_SERVICE("Analyze for ambiguity", currentContext)

  
  

// 2. Decision Logic based on AI confidence

IF aiResponse.ambiguityScore > Threshold THEN

// Ambiguity remains, generate follow-up questions

questions = aiResponse.generatedQuestions

SAVE questions TO Database LINKED TO projectId

project.status = "CLARIFYING"

UPDATE project IN Database

RETURN 'MORE_QUESTIONS'

ELSE

// Context is clear enough to proceed

project.status = "ANALYZING"

UPDATE project IN Database

TRIGGER GenerateAndPersistSDF(projectId)

RETURN 'GENERATE_SDF'

END IF

END

```

**3.1.3 Generate and Persist System Definition File (SDF)**

This workflow orchestrates the transformation of the refined requirements into the structured JSON format (SDF), including self-correction mechanisms.

```text

ALGORITHM GenerateAndPersistSDF

INPUT: projectId (UUID)

OUTPUT: sdfVersion (Integer)

  
  

BEGIN

project = RETRIEVE Project FROM Database WHERE id = projectId

// 1. Construct Comprehensive Prompt

systemPrompt = "Act as a Data Architect. Output valid SDF JSON."

userPrompt = "Context: " + project.description + project.answers

// 2. AI Generation with Retry Policy

attempts = 0

isValid = FALSE

sdfJson = NULL

  
  

WHILE attempts < 3 AND isValid IS FALSE DO

rawResponse = CALL_AI_SERVICE(systemPrompt, userPrompt)

TRY

parsedJson = PARSE_JSON(rawResponse)

validationErrors = VALIDATE_SCHEMA(parsedJson, "SDF_Schema_v1")

IF validationErrors IS EMPTY THEN

isValid = TRUE

sdfJson = parsedJson

ELSE

// Self-Correction: Feed errors back to AI

userPrompt = "Fix these schema errors: " + validationErrors

attempts = attempts + 1

END IF

CATCH JsonError THEN

userPrompt = "Output was not valid JSON. Retry."

attempts = attempts + 1

END TRY

END WHILE

  
  

IF isValid IS FALSE THEN

THROW GenerationError("Failed to generate valid SDF.")

END IF

  
  

// 3. Persistence

currentVersion = GET_MAX_VERSION(projectId)

newSDF = NEW SDF()

newSDF.projectId = projectId

newSDF.content = sdfJson

newSDF.version = currentVersion + 1

SAVE(newSDF) TO Database

RETURN newSDF.version

END

```

  
  

### 3.1.4 Inventory Module Generation

This algorithm consumes the validated SDF to produce the actual source code artifacts for the Inventory Module.

  
  

```text

ALGORITHM GenerateInventoryModule

INPUT: sdfObject (JSON)

OUTPUT: artifacts (List<File>)

  
  

BEGIN

artifacts = LIST()

// 1. Generate Database Schema (SQL)

FOREACH entity IN sdfObject.entities DO

sqlTable = CREATE_TABLE_TEMPLATE(entity.name)

FOREACH attribute IN entity.attributes DO

sqlColumn = MAP_TYPE_TO_SQL(attribute.type)

ADD sqlColumn TO sqlTable

END FOREACH

ADD sqlTable TO artifacts

END FOREACH

  
  

// 2. Generate API Endpoints (Node.js/Express)

FOREACH entity IN sdfObject.entities DO

controllerCode = GENERATE_CONTROLLER(entity.name)

routeCode = GENERATE_ROUTES(entity.name)

modelCode = GENERATE_ORM_MODEL(entity.name)

ADD controllerCode TO artifacts

ADD routeCode TO artifacts

ADD modelCode TO artifacts

END FOREACH

  
  

RETURN artifacts

END

```

**3.1.5 Export System Artifacts**

This workflow packages the generated code into a downloadable format.

```text

ALGORITHM ExportSystemArtifacts

INPUT: projectId (UUID)

OUTPUT: zipStream (BinaryStream)

  
  

BEGIN

// 1. Retrieve latest valid SDF

latestSDF = RETRIEVE_LATEST_SDF(projectId)

// 2. Trigger Generation

codeFiles = GenerateInventoryModule(latestSDF.content)

// 3. Packaging

zipArchive = NEW ZipArchive()

FOREACH file IN codeFiles DO

zipArchive.ADD_FILE(file.path, file.content)

END FOREACH

// 4. Add Documentation

readme = GENERATE_README(projectId)

zipArchive.ADD_FILE("README.md", readme)

RETURN zipArchive.GET_STREAM()

END[10](#sdfootnote10sym)  
  
  

## Process View

This section details the Use Case Realization for the five Use Cases defined in the First Increment. For each use case, we provide a textual explanation of the object interactions and a UML Communication Diagram (visualized here using message-sequence notation) to illustrate the dynamic behavior of the system.

  
  

  
  

  
  

**3.2.1 Use Case 1: Submit Business Description**

Use Case Realization:

The realization of this use case initiates the project lifecycle. The Business User interacts with the Frontend (Project Wizard) to input their natural language description. The Frontend sends a POST request to the ProjectController. The controller delegates the creation logic to the ProjectService, which persists a new `Project` entity in the Database with a 'DRAFT' or 'ANALYZING' status. Crucially, the ProjectService then triggers an asynchronous call to the SDFService to begin AI processing without blocking the user interface, returning an immediate "Accepted" status to the user.

![](file:///tmp/lu307109c83n.tmp/lu307109c89g_tmp_b2a603d9.jpg)

Figure 5: Use Case 1: Submit Business Description

  
  

  
  

**3.2.2 Use Case 2: Clarify Requirements**

Use Case Realization:

This use case realizes the interactive clarification loop. When the User submits answers to clarification questions via the Frontend, the ProjectController receives the payload. It invokes the SDFService, which retrieves the current project context from the Database. The SDFService then acts as a client to the external AI Service (AI Gateway), sending the context and answers. The AI determines if further ambiguity exists. If so, new questions are generated; if not, the SDF is finalized. The system updates the project state accordingly.

  
  

![](file:///tmp/lu307109c83n.tmp/lu307109c89g_tmp_3a533315.jpg)

Figure 6: Use Case 2: Clarify Requirements

  
  

  
  

  
  

  
  

**3.2.3 Use Case 3: Review & Edit SDF**

Use Case Realization:

This use case allows the user to modify the generated data model. The User issues an edit command (e.g., "Add an expiry date field") via the **Frontend**. The ProjectController routes this to the SDFService. The service sends a "Modification Prompt" to the AI Service, which returns a modified JSON schema. The SDFService performs strict schema validation on this JSON. If valid, it persists the new schema as a new version in the Database (table `sdfs`), maintaining a history of changes.

  
  

![](file:///tmp/lu307109c83n.tmp/lu307109c89g_tmp_c2710784.jpg)

Figure 7: Review & Edit SDF

  
  

  
  

  
  

**3.2.4 Use Case 4: Generate Inventory Module**

Use Case Realization:

This use case handles the transformation of the metadata (SDF) into executable code. The User clicks "Generate" on the Frontend. The ProjectController calls the GeneratorService. This service fetches the "Locked/Approved" SDF from the Database. It then iterates through the entities defined in the SDF, using internal templates to synthesize SQL `CREATE TABLE` scripts, Node.js API routes, and React UI components. These artifacts are stored or cached for download, and the project status is updated to 'GENERATED'.

  
  

![](file:///tmp/lu307109c83n.tmp/lu307109c89g_tmp_c97bdfc.jpg)

Figure 8: Generate Inventory Module

  
  

  
  

  
  

3.2.5 Use Case 5: Export System

Use Case Realization:

This use case realizes the delivery of the product. The User requests a download via the Frontend. The ProjectController invokes the ArchiveService. This service retrieves the generated files (SQL, JS, etc.) from the FileSystem/Cache, bundles them into a ZIP archive using a compression library, and returns a binary stream. The ProjectController pipes this stream to the response with the appropriate MIME type, triggering a file download in the user's browser.

  
  

![](file:///tmp/lu307109c83n.tmp/lu307109c89g_tmp_f278984f.jpg)

Figure 9: Export Systems

  
  

## 3.3 Detailed Design Diagrams

## ****3.3.1 Design Explanation****

The following UML Class Diagram represents the **design-level structure** of the system components that implement the first increment. The diagram includes classes, attributes, methods, visibilities, data types, and multiplicities required to realize the first increment use cases.[11](#sdfootnote11sym)

![](file:///tmp/lu307109c83n.tmp/lu307109c89g_tmp_502f7ec7.jpg)

Figure 10: UML Class Diagram (Design Level)

  
  

## 3.4 Test Cases

3.4.1 Unit Test Cases 

Table 1: Unit Test Cases

|   |   |   |   |   |   |
|---|---|---|---|---|---|
     
|**Test Case ID**|**Related Use Case**|**Preconditions**|**Test Steps**|**Expected Result**|**Pass/Fail**|
|UT-001|Submit Business Description|Valid input|Submit description|Project created|Pass|
|UT-002|Clarify Requirements|Open project|Submit answers|SDF updated|Pass|
|UT-003|Generate Inventory Module|Valid SDF|Generate module|Inventory created|Pass|
|UT-004|Export System|Generated module|Export system|Download available|Pass|

  
  

  
  

3.4.2 Acceptance Test Cases

Table 2: Acceptance Test Cases

|   |   |   |   |   |   |
|---|---|---|---|---|---|
     
|**Test Case ID**|**Related Use Case**|**Preconditions**|**Test Steps**|**Expected Result**|**Pass/Fail**|
|UAT-001|End-to-End Inventory|Full workflow|Complete flow|Inventory module generated|Pass|
|UAT-002|Clarification Loop|Ambiguous input|Answer questions|Clarification resolved|Pass|
|UAT-003|Export System|Completed project|Export|Artifacts downloaded|Pass|

[12](#sdfootnote12sym)

[1](#sdfootnote1anc) ChatGPT 5.2: Analyze the content of the Software Design Description (SDD) document and produce

an Executive Summary that reflects only the information contained in this document. The Executive Summary should: Summarize the purpose, scope, and structure of the SDD, Highlight the system context, design approach, and increment-based development, Reflect the focus on the first increment without introducing external assumptions, Be written in a formal and concise academic style. Do not introduce new requirements, design decisions, or implementation details. The summary should represent the document as a whole and be suitable for inclusion at the beginning of the SDD.

[2](#sdfootnote2anc) Gemini 3 Pro High: Based on the documented system scope and increment structure, describe the high-level architecture, logical view, and physical view of the system in a formal academic style.

[3](#sdfootnote3anc) Gemini 3 Pro High: Describe the selected system architecture, including architectural style and major components, using a formal academic tone suitable for an SDD.

[4](#sdfootnote4anc) Gemini 3 Pro High: Explain the logical view of the system by identifying major software components and their responsibilities within the selected architecture

[5](#sdfootnote5anc) Gemini 3 Pro High: Describe the physical deployment view of the system, including execution environments and major infrastructure components.

[6](#sdfootnote6anc) Gemini 3 Pro High: Describe the unit test design approach for the system, including scope, testing strategy, and the standard unit test case format

[7](#sdfootnote7anc) Gemini 3 Pro High: Explain how integration tests are designed to verify interactions between system components and external services.

[8](#sdfootnote8anc) Gemini 3 Pro High: Describe the system test design approach focusing on end-to-end user workflows implemented in the first increment.

[9](#sdfootnote9anc) Gemini 3 Pro High: Explain the acceptance test design approach from a business and user perspective, limited to first increment functionality.

[10](#sdfootnote10anc) Gemini 3 Pro High: Provide pseudocode for the core workflows of the first increment, focusing on business description processing, AI interaction, SDF generation, inventory module creation, and export functionality.

[11](#sdfootnote11anc) Gemini 3 Pro High: Provide design-level UML class diagram descriptions, including attributes, methods with parameters and return types, visibilities, and multiplicities, limited to first increment components.

[12](#sdfootnote12anc) Gemini 3 Pro High: Provide unit test cases and first increment acceptance test cases derived from the defined test case design rules.