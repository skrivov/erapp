# Expense Reimbursement Conversational Agent: Exercise


## Analysis of Requirements

On one hand, there is a requirement to build a conversational agent for the analysis of taxi receipts from uber/lyft. On the other hand, there is an invitation to design a reliable and flexible system for submitting expense reimbursements.

**The core and most important requirement:** Make sure that submitted data trigger the appropriate rule(s).

**Reasonable requirement:** Get the country of the expense from the receipt.

**Unreasonable requirements:** Derive department and purpose of visit from an Uber/Lyft receipt. This is impossible.

**Dangerous requirement:** The invitation is to design an agent, which suggests that an LLM would drive the conversation and enforce the rules. However, LLMs are inherently nondeterministic. Relying on them to make financial decisions is risky at this stage. Reimbursement rules are deterministic and must be applied deterministically.

In addition, submitting financial data requires careful review and reevaluation of the entered information. Even when using a guided wizard, users often need to move back and forth between steps. Agentic chat technology is therefore not well-suited for this use case.

**Implicit and very important requirements:**
- US Office, EU Office, and Asia-Pacific Office use different currencies.
- The rules of the offices are expressed in their specific currencies.
- There are examples of departmental expenses that have nothing to do with Uber/Lyft receipts, such as detailed categorization and approval of IT expenses.

**The key goal:** Develop a software solution that significantly reduces human error in the expense reimbursement process. The system should be flexible and open to the addition of new rules. No hardcoded rules. The system should reasonably leverage LLM capabilities. It seems that Uber receipt submission is just a backdrop.

## Assumptions for the demo app

US Office uses USD.
EU Office uses Euro.
Asia-Pacific Office uses Indian Rupees.
Every department requires submissions in their specific currencies.

These assumptions are deduced from the fact that each department defines rules using regional currency.


## Architectural Choices

Financial and business decisions are based on rigid rules. We need to support deterministic rules; the rules should be extensible and ideally stored in a database. For demo purposes we will use JSON-based rules stored locally. We will add a linting script to verify the correctness of the rules.

We need to ensure that submitted reimbursement requests include all information to correctly trigger specific rules. This key information is the regional office that defines the relevant rules. The other fields are department and type of expense.

To trigger rules we need to supply information in structured form.

We will use OCR to extract text from the receipt. It will be plain text.

We will use an LLM to convert the text extracted from the receipt into a clean structured form, so that we can supply it to the rule engine that triggers routing of the expense.

We will use the structured information extracted by the LLM to prefill most fields on expense reimbursement forms.

Some fields like department cannot be derived from a taxi receipt. They will have to be filled manually. Some fields like regional office can be deduced from the country of expense, but they still have to be verified by the user because the expense may happen abroad.

We will make the form editable, which allows re-itemizing the expense as necessary or converting figures to different currencies manually.

**Evolution of Clarification Approach:** The initial design proposed using a conversational interface with 2-3 targeted clarification questions to resolve ambiguous fields. This evolved into a more user-friendly approach: an editable Expense Reimbursement Form presented at the review stage, with on-screen notices and visual indicators (confidence badges, highlights) flagging specific sections that need human attention. This allows users to see the complete context and make corrections in a single comprehensive view rather than answering sequential questions.


## Edge Cases

- An employee from a U.S. regional office travels to an EU country. The taxi receipt is issued in euros, but the expenses must be submitted in U.S. dollars.

- An employee receives a receipt itemized in a vendor-specific format, but the department requires a department-specific breakdown.

To handle these cases, we support an editable reimbursement form. The UI also prevents submitting a reimbursement request in a currency different from the required currency of the regional office.

**Out of scope for this demo:** 
- Automatic currency conversion would be a better solution than preventing user to submit reimbursement request in differnt currency
- Examples of rules that trigger department specific itemization


## Application Execution Flow

```mermaid
graph LR
    subgraph OCR["1. OCR PROCESSING"]
        A1[Upload Receipt<br/>PDF/Image/Text]
        A2[Tesseract.js<br/>Extract Text]
        A1 --> A2
    end

    subgraph LLM["2. LLM EXTRACTION"]
        B1[OpenAI API<br/>Structured Extraction]
        B2[Zod Schema<br/>Validation]
        B3[Confidence Scores<br/>Per Field]
        B1 --> B2 --> B3
    end

    subgraph FORM["3. REIMBURSEMENT FORM"]
        C1[Display Extracted<br/>Fields]
        C2[Visual Indicators<br/>Low Confidence]
        C3[User Review<br/>& Edits]
        C4[User Confirms]
        C1 --> C2 --> C3 --> C4
    end

    subgraph DECISION["4. DECISION ENGINE"]
        D1[Filter Active Rules<br/>Date & Selectors]
        D2[Apply Rule Effects<br/>Required/Skip/Route]
        D3[Approval Chain<br/>+ Explanations]
        D4[Audit Log<br/>audit.jsonl]
        D1 --> D2 --> D3 --> D4
    end

    OCR ==> LLM ==> FORM ==> DECISION
```

The flow demonstrates the key principle: **LLMs extract and suggest; deterministic rules decide.**

## Implementation Overview

### Technology Stack
- **Framework**: Next.js 15 (App Router) with TypeScript
- **Styling**: Tailwind CSS v4
- **Validation**: Zod for runtime schema validation
- **LLM Provider**: OpenAI API (server-side only)
- **OCR**: Tesseract.js for text extraction from images
- **PDF Processing**: PDF.js (pdfjs-dist) for PDF parsing

### Policy Management
- **Storage**: File-backed JSON rules in `policies/` directory
- **Versioning**: Effective date ranges (`effective_from`, `effective_to`) enable temporal rule changes
- **Evaluation**: Deterministic rule engine in `lib/evaluate.ts` with fixed approval step ordering
- **Policy Explorer**: `/policies` page with view modes (Active/Inactive/All) and on-demand LLM analysis
- **Quality Assurance**:
  - `npm run policy:lint` - Static validation of policy JSON structure
  - `npm run policy:eval` - Standalone policy evaluation script
  - `/api/policy-eval` - On-demand LLM-powered policy gap analysis with configurable models

### API Endpoints
- **`POST /api/extract`** - Accepts receipt image/text, returns structured extraction with confidence scores
- **`POST /api/submit`** - Evaluates expense against active rules, returns approval chain + audit entry
- **`GET /api/policies`** - Returns merged active policies for a given date (read-only)
- **`POST /api/policy-eval`** - Accepts `{policies, modelOverride?}`, returns analysis with warnings, conflicts, gaps, and optional illustrative suggested tests (no deterministic test execution)

### LLM Usage Philosophy
The system uses LLMs for extraction and rule development assistance only — never for business decisions:
- Extraction: Convert unstructured receipts into structured data (via `extraction.schema.ts`). Prompts: `lib/extractionLLM.ts`
- Policy QA for curently active rule: High‑reasoning analysis that flags conflicts, overlaps, and gaps; may include suggested example inputs for future QA. It does not execute tests. Prompts: `lib/policyQA.ts`

Critical: All approval routing decisions are made by deterministic rules in `lib/evaluate.ts`, not by LLMs.

### Data & Storage
- **No Database**: Demo application uses file-based storage only
- **Audit Trail**: Append-only `data/audit.jsonl` logs all submissions (demo purposes; ephemeral in serverless)
- **Policies**: JSON files version-controlled in `/policies`

### Evaluation Scripts
- **`npm run eval:taxi`** - Runs end-to-end evaluation on taxi receipt fixtures with ground truth comparison
- **`npm run policy:lint`** - Validates policy JSON syntax, date ranges, and selector consistency
- **`npm run policy:eval`** - Generates a policy quality report with LLM‑detected issues (no deterministic test execution)

### Key Files & Modules
| Path | Purpose |
|------|---------|
| `lib/evaluate.ts` | Deterministic rule engine (filters, applies, orders approval steps) |
| `lib/extractionLLM.ts` | OpenAI API wrapper for structured extraction |
| `lib/policyLoader.ts` | Loads and validates policy JSON files |
| `schemas/extraction.schema.ts` | Zod schema defining receipt extraction contract |
| `schemas/policy.schema.ts` | Zod schema defining policy DSL structure |
| `scripts/evalTaxiReceipts.ts` | End-to-end evaluation harness with OCR + ground truth |

---

**For complete technical specification, API contracts, type definitions, and detailed flows, see [SPEC.md](SPEC.md).**

## Demo Rules (Policies)
- `policies/global.v1.json` — Pre‑change baseline: skip `manager` for `ride_hail` under $50 USD (US) and under €50 EUR (EU). Effective until 2024‑09‑30.
- `policies/global.v2.json` — Post‑change baseline: skip `manager` for `ride_hail` under $75 USD (US) and under €75 EUR (EU). Effective from 2024‑10‑01.
- `policies/region.us.json` — US overlay: skip `manager` for `ride_hail` under $100 USD (wins by using the largest matching threshold).
- `policies/region.eu.json` — EU overlay:
  - Require `compliance` when amount > €50.
  - Always require `hr` for `travel` category.
- `policies/region.apac.json` — APAC overlay: category routing examples — `meals` → `manager`, `travel` → `finance`, `software` → `it`.

Notes
- Finance is always included by default; Manager is included by default unless a skip threshold applies; ordering is `["compliance","hr","it","manager","finance"]`.
- Skip thresholds only apply when the expense currency matches the threshold currency (no FX conversion in demo).

## Demo Data (Receipts)
- Location: `scripts/datasets/taxi_pdfs/`
- Index: `scripts/datasets/taxi_ground_truth.csv` (filename, totals, currency, date, route)

Examples
- EU synthetic: `synthetic_eu_berlin.pdf`, `synthetic_eu_paris.pdf`, `synthetic_eu_dublin.pdf`
- US real-world: `Uber1.pdf` … `Uber5.pdf`
- APAC synthetic: `synthetic_asia_mumbai.pdf`, `synthetic_asia_beijing.pdf`, `synthetic_asia_tokyo.pdf`
- Americas (non‑USD): `synthetic_ca_toronto.pdf` (CAD), `synthetic_mx_cdmx.pdf` (MXN), `synthetic_br_sp.pdf` (BRL)
- ZA synthetic: `synthetic_za_cpt.pdf` (ZAR)

## Receipt → Rule Mapping (what fires)
Below are the expected approval steps based on date, region, category=`ride_hail`, and currency constraints.

- `synthetic_eu_berlin.pdf` — €14.80 on 2024‑05‑11 (EU)
  - Triggers: Global v1 EU manager skip (<€50)
  - Steps: [`finance`] (manager skipped)

- `synthetic_eu_paris.pdf` — €18.90 on 2024‑10‑03 (EU)
  - Triggers: Global v2 EU manager skip (<€75)
  - Steps: [`finance`] (manager skipped)

- `synthetic_eu_dublin.pdf` — €26.00 on 2025‑02‑09 (EU)
  - Triggers: Global v2 EU manager skip (<€75)
  - Steps: [`finance`] (manager skipped)

- `synthetic_us_nyc.pdf` — $50.10 on 2024‑01‑18 (US)
  - Triggers: US overlay manager skip (<$100); currency matches USD
  - Steps: [`finance`] (manager skipped)

- `Uber1.pdf` — $7.90 on 2025‑09‑26 (US)
  - Triggers: US overlay manager skip (<$100)
  - Steps: [`finance`] (manager skipped)

- `Uber2.pdf` — $8.37 on 2025‑08‑12 (US)
  - Triggers: US overlay manager skip (<$100)
  - Steps: [`finance`] (manager skipped)

- `Uber3.pdf` — $33.50 on 2025‑03‑24 (US)
  - Triggers: US overlay manager skip (<$100)
  - Steps: [`finance`] (manager skipped)

- `Uber4.pdf` — $41.99 on 2025‑01‑31 (US)
  - Triggers: US overlay manager skip (<$100)
  - Steps: [`finance`] (manager skipped)

- `Uber5.pdf` — $29.27 on 2024‑10‑01 (US)
  - Triggers: US overlay manager skip (<$100); global v2 effective from this date
  - Steps: [`finance`] (manager skipped)

- `synthetic_ca_toronto.pdf` — C$42.00 on 2025‑04‑28 (Region=US; Currency=CAD)
  - Triggers: No skip (currency mismatch vs USD thresholds)
  - Steps: [`manager`, `finance`]

- `synthetic_mx_cdmx.pdf` — MX$160.00 on 2025‑08‑14 (Region=US; Currency=MXN)
  - Triggers: No skip (currency mismatch vs USD thresholds)
  - Steps: [`manager`, `finance`]

- `synthetic_br_sp.pdf` — R$62.00 on 2024‑06‑05 (Region=US; Currency=BRL)
  - Triggers: No skip (currency mismatch vs USD thresholds)
  - Steps: [`manager`, `finance`]

- `synthetic_asia_mumbai.pdf` — ₹265.00 on 2024‑07‑21 (APAC)
  - Triggers: No ride_hail skip in APAC; category routes apply only to meals/travel/software
  - Steps: [`manager`, `finance`]

- `synthetic_asia_beijing.pdf` — CN¥96.00 on 2024‑11‑10 (APAC)
  - Triggers: No ride_hail skip in APAC
  - Steps: [`manager`, `finance`]

- `synthetic_asia_tokyo.pdf` — ¥2500.00 on 2025‑03‑15 (APAC)
  - Triggers: No ride_hail skip in APAC
  - Steps: [`manager`, `finance`]

- `synthetic_au_sydney.pdf` — A$40.00 on 2024‑12‑02 (APAC)
  - Triggers: No ride_hail skip in APAC
  - Steps: [`manager`, `finance`]

- `synthetic_za_cpt.pdf` — R270.00 on 2025‑09‑09 (APAC by demo mapping)
  - Triggers: No ride_hail skip in APAC
  - Steps: [`manager`, `finance`]

EU compliance/HR notes
- None of the EU examples exceed €50, so `compliance` is not added.
- HR is only added for EU `travel` category; all examples here are `ride_hail`.
