@startuml
left to right direction

title UCD_1-13 – CustomERP Overall Use Case Diagram (Updated)

actor "User" as User <<abstract>>
actor "Business User" as BU
actor "System Administrator" as Admin
actor "Anthropic API" as API

BU --|> User
Admin --|> User

rectangle "CustomERP System" {

  ' Account (UC-11..UC-13)
  (UC-11: Register Account) as UC11_Register
  (UC-12: Login) as UC12_Login
  (UC-13: Logout) as UC13_Logout

  ' BMS Dashboard & SDF (UC-1..UC-3)
  (UC-1: View BMS List) as UC1_ViewList
  (UC-2: Create New BMS) as UC2_CreateBMS
  (UC-3: Generate SDF using Chatbot) as UC3_GenerateSDF

  ' Generation & Modules (UC-4)
  (UC-4: Generate ERP System) as UC4_Generate
  (UC-4.1: Generate Inventory Module) as UC4a_Inv
  (UC-4.2: Generate Invoice Module) as UC4b_Invoice
  (UC-4.3: Generate HR Module) as UC4c_HR

  ' Approve & Export (UC-6..UC-7)
  (UC-6: Approve or Edit Module Set) as UC6_Approve
  (UC-7: Export Generated BMS) as UC7_Export

  ' Admin: Users & Logs (UC-8..UC-10)
  (UC-8: View Registered Users) as UC8_ViewUsers
  (UC-9: View All BMS Instances) as UC9_ViewBMS
  (UC-10: View Activity and Error Logs) as UC10_ViewLogs
}

' Account Connections
BU -- UC11_Register
User -- UC12_Login
User -- UC13_Logout

' BMS Dashboard Connections
BU -- UC1_ViewList
BU -- UC2_CreateBMS
BU -- UC3_GenerateSDF

' FORCE Anthropic API TO THE RIGHT
' We place this connection here to pull the API actor to the right side of the diagram
UC3_GenerateSDF -- API

' Generation Flow with Includes
BU -- UC4_Generate
UC4_Generate ..> UC4a_Inv : <<include>>
UC4_Generate ..> UC4b_Invoice : <<include>>
UC4_Generate ..> UC4c_HR : <<include>>

' Approve & Export Connections
BU -- UC6_Approve
BU -- UC7_Export

' Admin Connections
Admin -- UC8_ViewUsers
Admin -- UC9_ViewBMS
Admin -- UC10_ViewLogs

@enduml