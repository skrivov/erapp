# Expense Reimbursement Conversational Agent (ERCA)

This demo Next.js application pairs LLM-assisted receipt extraction with a deterministic policy evaluator to streamline expense approval routing. The build follows `SPEC.md`, leveraging file-backed policies, Tailwind UI components, and Zod-validated data contracts.

## Analysis of Requirements

On one hand, there is a requirement to build a conversational agent for the analysis of receipts. On the other hand, there is an invitation to design a reliable and flexible system for submitting expense reimbursements.

**The core and most important requirement:** Make sure that submitted data trigger the appropriate rule.

**Reasonable requirement:** Get the country of the expense from the receipt.

**Unreasonable requirements:** Derive department and purpose of visit from an Uber/Lyft receipt. This is impossible.

**Dangerous requirement:** The invitation is to design an agent, which implies that an LLM will drive the conversation and apply rules. LLMs are prone to nondeterminism. Relying on an LLM for making decisions about finances is dangerous at this point. The reimbursement rules are deterministic and have to be applied deterministically.

**Implicit and very important requirements:**
- US Office, EU Office, and Asia-Pacific Office use different currencies.
- The rules of the offices are expressed in their specific currencies.
- There are examples of departmental expenses that have nothing to do with Uber/Lyft receipts, such as detailed categorization and approval of IT expenses.

**The key goal:** Develop a software solution that significantly reduces human error in the expense reimbursement process. The system should be flexible and open to the addition of new rules. No hardcoded rules. The system should reasonably leverage LLM capabilities. It seems that Uber receipt submission is just a backdrop.

## Architectural Choices

Financial and business decisions are based on rigid rules. We need to support deterministic rules; the rules should be extensible and ideally stored in a database. For demo purposes we will use JSON-based rules stored locally. We will add a linting script to verify the correctness of the rules.

We need to ensure that submitted reimbursement requests include all information to correctly trigger specific rules. This key information is the regional office that defines the relevant rules. The other fields are department and type of expense.

To trigger rules we need to supply information in structured form.

We will use OCR to extract text from the receipt. It will be plain text.

We will use an LLM to convert the text extracted from the receipt into a clean structured form, so that we can supply it to the rule engine that triggers routing of the expense.

We will use the structured information extracted by the LLM to prefill most fields on expense reimbursement forms.

Some fields like department cannot be derived from a taxi receipt. They will have to be filled manually. Some fields like regional office can be deduced from the country of expense, but they still have to be verified by the user because the expense may happen abroad.

We will make the form editable, which allows re-itemizing the expense as necessary or converting figures to different currencies manually.

**Out of scope:** Automatic currency conversion.

## Assumptions

US Office uses USD.
EU Office uses Euro.
Asia-Pacific Office uses Indian Rupees.
Every department requires submissions in their specific currencies.

These assumptions are deduced from the fact that each department defines rules using regional currency.

## Edge Cases

- An employee from a U.S. regional office travels to an EU country. The taxi receipt is issued in euros, but the expenses must be submitted in U.S. dollars.

- An employee receives a receipt itemized in a vendor-specific format, but the department requires a department-specific breakdown.

To handle these cases, we support an editable reimbursement form. The UI also prevents submitting a reimbursement request in a currency different from the required currency of the regional office.

## Key Technical Elements (see SPEC.md)

- Architecture: Next.js App Router (TypeScript), Tailwind, Zod validation.
- Policies: File‑backed JSON under `policies/` with effective dates and precedence; deterministic evaluator in `lib/evaluate.ts` with fixed step order.
- APIs: `POST /api/extract`, `POST /api/submit`, `GET /api/policies`, `POST /api/policy-eval`.
- LLM usage: Structured extraction to schema with confidence thresholds; minimal clarifications; dev‑only policy QA.
- Data & storage: No DB; demo audit log at `data/audit.jsonl`.
- Scripts: `npm run eval:taxi`, `npm run policy:lint`, `npm run policy:eval`.

For full architecture, contracts, and flows, see SPEC.md.
