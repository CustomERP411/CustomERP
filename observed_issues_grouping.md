# Observed-Issues Grouping (post-coherence triage)

## Purpose

Plans A–D shipped the coherence foundation (SDF schema extension, runtime rule runner + actor migration + RBAC, wizard wiring + pack versioning + cascade rules, localization lint + module precheck). The issues below were observed in the generated ERP **before** any of that landed — Plans A–D fix the *machinery*, but the AI prompts, generator templates, and pack questionnaires still need to *use* that machinery to actually solve each symptom.

This document groups the user-reported issues by the **shape of the fix** so each grouping maps cleanly to a single future plan. Each group references the coherence primitive it would be built on (see [`module_coherence_design.md`](module_coherence_design.md) §2), the SDF field it would touch (see [`SDF_REFERENCE.md`](SDF_REFERENCE.md)), and the rough complexity / blast radius.

> **Rule of grouping:** issues that share the *fix shape* are grouped, not issues that share the *symptom*. Two missing form fields plus a missing tax rate plus a status-driven discount all live in different groups because their fix shapes are different — even though the user encounters all three on the invoice form.

---

## Issue inventory (raw)

For traceability — every group below cites these IDs:

| # | Module | User report (verbatim summary) |
|---|---|---|
| **1** | Inventory | Adding a product: `total_value` field should auto-fill from `cost * quantity`. |
| **2** | Inventory | Creating a purchase order goes to a blank page. |
| **3** | Invoice | Invoice form shows "Customer ID" — should show "Customer name" (the resolved display value). |
| **4** | (cross-cutting) | Turkish and English are mixed in the generated ERP. |
| **5** | Invoice | Tax total is entered manually. Should be `subtotal * tax_rate`. |
| **6** | Invoice | Subtotal, tax total, grand total should auto-compute from selected products (qty × unit price), with a project-level standard tax rate that is editable per invoice. |
| **7** | HR | Shift assignments form has a `work_date` field even though there's already `assignment_start` / `assignment_end`. |
| **8** | Invoice | Invoice payment method should be a multi-choice (credit card / debit card / cash). When credit card is chosen, an installments dropdown should appear. |
| **9** | Invoice ↔ Inventory | Posting an invoice for a stocked product should decrement stock. |
| **10** | Inventory | Cycle count: creating one goes to a blank page; lines only appear after a second pass / re-open. |
| **11** | Invoice | Invoice-line form has too many fields (manual UoM, discount %, tax %, etc.) and you cannot pick a product. Should be: pick product → auto-fill price/tax/total; one invoice-level discount; auto grand total. |
| **12** | HR | Leave request: `leave_days` should auto-calc from start/end. `Approval id` should be relabeled `Approved by` and the picker should list employees. |
| **13** | HR | Department detail page should list the employees assigned to that department. |
| **14** | Invoice ↔ Inventory | When a stocked product has multiple inventory locations, the invoice should ask which location to issue from. |
| **15** | HR | Employees should expose a salary section. |
| **16** | HR | When `employment_status` is set to `Terminated`, a termination-date field should appear. |
| **17** | Invoice | Customer detail page should list that customer's invoices. |
| **18** | Invoice | On the sales-order page you can't pick products without first creating the SO (probably a "save before adding lines" flow bug). |
| **19** | Invoice | Creating a sales order goes to a blank page. |
| **20** | (chatbot) | The chatbot recorded an unrelated political question as a feature request ("Personal asset tracking for public figures"); chatbot replies are always English regardless of project language; feature requests should be stored bilingually (EN + project language) and rendered in whatever language the user is currently using. |

---

## Group A — Derived fields (auto-calculated values)

**Fix shape.** Every issue here is "this field is currently free-text or hand-entered, but it is fully determined by other fields on the same row (or its child rows)." That is exactly what the **`derived_field`** coherence primitive is for. The runtime rule runner (`RelationRuleRunnerMixin`, Plan B) already evaluates derived-field formulas on create / update; the AI generator just isn't emitting them.

**Includes:**

- **#1** Product `total_value = cost * quantity`.
- **#5** Invoice `tax_total = subtotal * tax_rate`.
- **#6** Invoice `subtotal = sum(lines.line_total)`, `grand_total = subtotal + tax_total - discount` (and its line-level partner: `line_total = qty * unit_price`).
- **#11** Same shape as #6 — the user is describing the same auto-calc behavior, just from the form-design angle.
- **#12 (partial — leave_days)** `duration_days = end_date - start_date`.

**Touches.**

- AI prompts (`hr_generator_prompt.txt`, `invoice_generator_prompt.txt`, `inventory_generator_prompt.txt`) — generator must emit `relations: [{ kind: "derived_field", computed_field, formula }]` for every column the SDF reference flags as `computed: true`.
- Generated frontend forms — these fields need to render read-only (the `formPage` generator already respects the `computed: true` flag; need to confirm the AI is setting it).
- `RelationRuleLibrary` — confirm the existing formula runtime supports `sum_of_child(<entity_slug>, <field>)`, `multiply`, `add`, `subtract`, `date_diff_days`. Some of these may need new helpers.

**Complexity.** Medium. Mostly prompt + template work; the rule-runner backbone is in place.

**Blast radius.** Touches every module — every entity that has roll-ups gets edits.

---

## Group B — Standard tax rate as a project-level setting

**Fix shape.** A single number that lives at SDF level (or `modules.invoice` level), is set during the wizard, and is the *default* for `tax_rate` on invoice lines / invoices. Editable per row.

**Includes:**

- **#6** "There should be a standard tax rate which the customer chooses when creating the ERP, and it should be available to change."

**Touches.**

- New question in `invoice.v3` pack: `invoice_default_tax_rate` (number, percent).
- New `modules.invoice.default_tax_rate` config path.
- Invoice line `tax_rate` field → `default: t('modules.invoice.default_tax_rate')`-style runtime resolution in the generated frontend.
- AI prompt: when generating the invoice-line schema, set `tax_rate.default_from = "modules.invoice.default_tax_rate"`.

**Why its own group.** This is a **default-value-from-config** pattern, not a `derived_field` (the user can override per row). It is small and self-contained, but pre-requisite for Group A's `tax_total` formula to be sensible out of the box.

**Complexity.** Small. One wizard question + one config path + one generator hint.

**Blast radius.** Invoice module only.

---

## Group C — Reference fields rendered as IDs (display-field resolution)

**Fix shape.** A `reference` column is being rendered as a raw `*_id` value in list and detail UIs instead of resolving to the target entity's display field. Today the SDF supports this (every entity has a `display_field`; the assembler's `entityPages` generator reads it), so the bug is either (a) the AI is emitting the column as `string` instead of `reference` or (b) the page is rendering the foreign-key value before the join is applied.

**Includes:**

- **#3** Invoice form: "Customer ID" should be "Customer name".
- **#12 (partial)** Leave request `approver_id` → labeled "Approved by" and rendered as the employee's name; the dropdown must list the actor (employee) registry.

**Touches.**

- AI prompt (`invoice_generator_prompt.txt`, `hr_generator_prompt.txt`) — every `*_id` field with a real foreign key must be emitted as `type: "reference"` with `reference_entity` set, plus a `reference_contract` relation in `entity.relations[]` (Plan B already runs the rule).
- `entityPages/listPage.js`, `entityPages/formPage.js` — confirm reference columns render via `display_field` not raw id.
- `actorRegistry.js` — actor fields (`approved_by`, `posted_by`, `cancelled_by`, etc.) must be `reference` to `__erp_users` AND surface their `__erp_users.employee.full_name` (Plan B already does the link via `UserEmployeeLinkMixin`).
- AI label hint: every reference field's frontend label should default to the target entity's `label` (e.g. "Customer", "Approved by"), never the raw column name (`customer_id`, `approver_id`).

**Complexity.** Small. Mostly a label/render-mode bug.

**Blast radius.** Every module — but a single fix in the form/list generator catches all of them.

---

## Group D — Status-driven conditional fields

**Fix shape.** A field is required / visible / mandatory **only** when another field has a specific value. The `derived_field` primitive handles "always computable"; this group needs a sibling: a `conditional_required` or `conditional_visible` rule. We have two paths: (i) extend `invariant` with a `severity: "block"` "must be set when X = Y" rule (server-side enforcement), and (ii) emit a `visibility_when` flag on the field (frontend conditional rendering, Plan A schema).

**Includes:**

- **#16** Termination date appears when `employment_status = "Terminated"`.
- **#8 (partial)** Installments field appears when `payment_method = "credit_card"`.
- **#12 (partial)** Approver picker appears once `requires_approval` is on (already covered by Plan C cross-pack toggles, but the field-level visibility piece may not be wired).

**Touches.**

- New SDF field property: `visibility_when: { field: <slug>, equals: <value> }` on `EntityField` (Plan A schema may already allow it; verify in [`platform/ai-gateway/src/schemas/sdf.py`](platform/ai-gateway/src/schemas/sdf.py)).
- New `invariant` shape: `{ kind: "invariant", on: "create"|"update", when: <expr>, require: [<field>], severity: "block", message: ... }`.
- `RelationRuleLibrary` — implement the new invariant kind in the runtime layer.
- `formPage.js` generator — render the field conditionally.

**Complexity.** Medium. Touches schema, prompts, runtime, and form generator.

**Blast radius.** All three modules.

---

## Group E — Cross-module stock movement (invoice ↔ inventory)

**Fix shape.** This is exactly what the `modules.invoice.stock_link.enabled` toggle in [`module_coherence_design.md` §5.1](module_coherence_design.md) was designed for. The toggle exists (Plan C wired the question), and the runtime rule runner can fire `status_propagation` actions; the question is whether the *actual rule* — "posting an invoice line whose `product_id` points at a stocked SKU emits a stock-issue movement" — is in `relationRuleLibrary.js` and that the AI prompt actually emits the rule into the SDF.

**Includes:**

- **#9** Invoice posted → stock decremented for stocked products.
- **#14** When the product has multiple inventory locations, the invoice line must ask which location to issue from (a *prerequisite* for #9 to be unambiguous).

**Touches.**

- AI prompt: `invoice_generator_prompt.txt` must emit a `status_propagation` relation on `invoices` whose `on: { status: "posted" }` triggers an `issue_stock` action against the `products`/`stock_movements` entities.
- `relationRuleLibrary.js` — confirm `issue_stock` action handler exists; if not, add it.
- Invoice line schema: when `modules.inventory.locations.enabled`, append a `location_id` reference field with `validation_when: { product.stocked = true, locations > 1, required: true }`.
- The frontend invoice-line modal should render the location picker only when needed (cross-references Group D).

**Complexity.** High. Real cross-pack invariant + new action handler + multi-location branch.

**Blast radius.** Invoice + Inventory.

---

## Group F — Detail-page rollups (one-to-many sections)

**Fix shape.** A parent entity's detail page should embed a list of related child rows. Today the entity-detail template only renders the entity's own fields. We need a generic "related-rows section" the entity-detail generator emits when an `entity.relations[].kind == "reference_contract"` exists pointing INTO this entity.

**Includes:**

- **#13** Department detail → list of employees in that department (via `employees.department_id`).
- **#17** Customer detail → list of invoices for that customer (via `invoices.customer_id`).
- **(latent, by symmetry)** Product detail → list of stock movements; Invoice detail → list of payments; Employee detail → list of leave requests.

**Touches.**

- AI prompt: the AI does not need to do anything new — `reference_contract` relations are already emitted (Plan A schema). The fix is purely in the generator.
- New generator: `entityPages/relatedSection.js` (or extend `detailPage.js`) — for each inbound `reference_contract`, render a sub-list with the child entity's `display_field` and 2–3 most relevant columns.
- Template: clickable rows (deep-link to the child detail page).

**Complexity.** Medium. New generator + tests; no schema or runtime work.

**Blast radius.** Every module benefits at zero per-module cost.

---

## Group G — Schema corrections (incorrect / missing fields per pack)

**Fix shape.** The pack questionnaire / generator emits fields that don't match the canonical entity model — either redundant (`work_date` on shift assignments) or missing (no `salary` / `termination_date` / `customer.invoices_link`). Each is a small AI-prompt or pack-config fix.

**Includes:**

- **#7** Shift assignments has a redundant `work_date` (use `assignment_start` / `assignment_end`).
- **#15** Employees missing a salary field/section (likely belongs in `compensation_ledger` if HR `compensation_ledger` pack is on; otherwise a plain `employees.salary` field as a baseline).
- **#16 (schema part only)** Add `termination_date` field to `employees` (the visibility-rule part lives in Group D).

**Touches.**

- HR generator prompt — explicit "DO NOT emit `work_date` on `shift_assignments`; the start/end date fields are authoritative."
- HR generator prompt — when `compensation_ledger` is off, still emit a baseline `employees.salary` field.
- HR generator prompt — emit `termination_date` field on `employees` (computed visibility rule lives in Group D).

**Complexity.** Small. Pure prompt edits.

**Blast radius.** HR module only.

---

## Group H — Creation-flow blank pages and prerequisite UX bugs

**Fix shape.** Multi-step creation flows (PO, SO, cycle count) drop the user on a blank page or refuse to take child rows until the parent is saved. This is **template / runtime**, not SDF — but the symptom shows up consistently across packs that share the same generator template.

**Includes:**

- **#2** Create PO → blank page.
- **#10** Create cycle count → blank page; cycle-count lines only appear after the second open / save cycle.
- **#18** SO: cannot pick products without first creating the (empty) SO.
- **#19** Create SO → blank page.

**Touches.**

- `inventoryPriorityPages.js` (PO, GRN, cycle count) — confirm the create flow either (a) renders an inline create-then-add-lines wizard, or (b) auto-creates a draft and redirects to its detail page.
- `invoicePriorityPages.js` (SO) — same fix shape.
- Likely a single shared "draft-then-edit" pattern in `entityPages/` that needs to land for any entity whose lines reference the parent.

**Complexity.** Medium. Generator + UX work, possibly one shared component.

**Blast radius.** Invoice + Inventory packs that have a header-lines pattern.

---

## Group I — Payment method shape + installments

**Fix shape.** Combination of (i) an enum field with three options (handled today), (ii) a status-driven conditional field for installments (Group D), and (iii) a default UI rendering for the enum (radio chips, not a dropdown — UX nicety). The `payment_method` field already exists in Plan B's invoice payment schema; the missing parts are the third option and the conditional-installments piece.

**Includes:**

- **#8** Three payment methods (credit / debit / cash) and a credit-card-only installments field.

**Touches.**

- `invoice.v3` pack: invoice payment entity field `payment_method` enum updated to `["cash", "credit_card", "debit_card"]`.
- `installments` field added with `visibility_when: { payment_method: "credit_card" }` (Group D).
- Optional UX: render `payment_method` as radio chips when option count ≤ 4 (small generator tweak in `formPage.js`).

**Complexity.** Small. One field + one conditional from Group D.

**Blast radius.** Invoice module only.

---

## Group J — Localization completeness (extends Plan D §2)

**Fix shape.** Plan D §2 codified the keying convention, added a lint, and converted the top ~15 hardcoded strings. The remaining mixed-language artifacts are a long tail: AI-generated labels that slipped through the directive, status enums on minor pages, and the chatbot.

**Includes:**

- **#4** "Turkish and English is mixed" in the generated ERP — generic complaint, almost certainly the long tail of unkeyed strings the lint is now catching but the AI prompt is still emitting.
- **#20 (chatbot language)** "Chatbot replies are always English" — the chatbot prompt does not honor `project.language`.
- **#20 (feature-request bilingual storage)** "Record a feature in always both English and the user's language and show it in whichever language they are at."

**Touches.**

- `language_directive_*.txt` — already tightened in Plan D, but enforcement comes from the lint blocking the SDF; verify the lint fires hard-block on TR projects.
- Chatbot prompt (`chat_prompt.txt`) — inject the same `language_directive` Plan D tightened, plus a "respond in the project language" rule.
- Feature-request schema — add `description_en`, `description_native`, `language` columns; UI reads the column matching `i18n.language` with EN fallback.
- Long-tail string sweep — the lint output (post Plan D) is the work list; each blocking finding is a small follow-up.

**Complexity.** Medium. Schema + prompt + UI changes for the bilingual storage; small per-finding fixes for the long tail.

**Blast radius.** Cross-cutting (every module, plus chatbot, plus feature-request flow).

---

## Group K — Chatbot scope guard

**Fix shape.** The chatbot is recording any user message as a feature request, including unrelated content (the user's example: a question about a Turkish politician's net worth). We need a relevance gate: classify the message before recording — only persist as a feature request when the message is on-topic for ERP / business-software functionality.

**Includes:**

- **#20 (chatbot scope)** "It requires features even though the stuff was unrelated."

**Touches.**

- Chatbot prompt (`chat_prompt.txt`) — add a classifier step: "Is this message describing a missing ERP capability for the user's business? Yes/No. Only emit `unsupported_features[]` when Yes."
- Defense-in-depth (mirror of Plan D §3.6's `_looks_like_platform_meta` regex) — strip recorded features whose text matches a "clearly off-topic" pattern (pop-culture, politics, geography, weather, casual chat).
- Backend `featureRequestService` — log dropped suggestions to the same audit trail Plan D §3.5 introduced (`inferred_dropped_modules`-style field on the chat response) so the UI could surface "we ignored: …" if needed for transparency.

**Complexity.** Small. One prompt rewrite + one regex defense + a tiny audit field.

**Blast radius.** Chatbot only — but high-visibility because every user touches it.

---

## Cross-reference table

| Group | Coherence primitive(s) | Modules | Issues | Plan-size hint |
|---|---|---|---|---|
| **A — Derived fields** | `derived_field` | HR, Invoice, Inventory | 1, 5, 6, 11, 12 (partial) | Medium |
| **B — Standard tax rate config** | (config default) | Invoice | 6 (partial) | Small |
| **C — Reference display rendering** | `reference_contract` | All | 3, 12 (partial) | Small |
| **D — Status-driven conditional fields** | `invariant` (new shape) + `visibility_when` | HR, Invoice | 8 (partial), 12 (partial), 16 | Medium |
| **E — Invoice → stock movement** | `status_propagation` | Invoice ↔ Inventory | 9, 14 | High |
| **F — Detail-page rollups** | (template, reads `reference_contract`) | All | 13, 17 | Medium |
| **G — Schema corrections** | (prompt-only) | HR | 7, 15, 16 (partial) | Small |
| **H — Creation-flow blank pages** | (template, no SDF) | Invoice, Inventory | 2, 10, 18, 19 | Medium |
| **I — Payment method + installments** | enum + Group D | Invoice | 8 | Small |
| **J — Localization completeness** | extends Plan D §2 | All + chatbot | 4, 20 (partial) | Medium |
| **K — Chatbot scope guard** | mirrors Plan D §3.6 | Chatbot | 20 (partial) | Small |

---

## Suggested rollout shape

The cleanest dependency-respecting order is roughly:

1. **C** (reference rendering) and **G** (schema corrections) first — both are pure prompt edits with the smallest blast radius and they unblock everything else by giving every other group correct field types to attach rules to.
2. **A** (derived fields) and **B** (tax-rate config) together — A leans on B's default-value path for `tax_rate`.
3. **D** (status-driven conditionals) — also adds the `visibility_when` machinery used by **I** and the schema half of **G**.
4. **F** (rollup sections) — independent, parallel to D.
5. **E** (invoice → stock) — depends on A (line totals), C (refs), D (location picker visibility).
6. **I** (payment method + installments) — depends on D's conditional machinery.
7. **H** (creation-flow bugs) — orthogonal; can run any time.
8. **J** (localization tail) and **K** (chatbot scope) — orthogonal; can run any time, but **K** is small and high-visibility, worth landing alongside **J**.

Groups **C, G, B, I, K** are each "single afternoon" sized. Groups **A, D, F, J, H** are each a focused multi-day plan. Group **E** is the largest because it spans two modules and adds a real cross-pack rule.

---

## Out of scope

- Any change to `module_coherence_design.md` (kept as a static reminder doc).
- Any change to Plans A–D — those are landed and tested.
- Reworking the wizard module-selection UX (covered separately by Plan D §3).
- Fine-tuning capture (#10 in the original design-doc roadmap).
