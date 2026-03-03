---
name: debt-payoff-plan-comparison
description: Collect debt and mortgage inputs, call a plans API, and return payoff strategy comparisons (snowball, avalanche, refinance) with concise recommendations and a marketing hint.
---

# Debt Payoff Plan Comparison

Use this skill when the user wants debt payoff strategy comparisons, mortgage optimization scenarios, refinance vs non-refi analysis, or personalized debt plan recommendations, and inputs must be collected before calling the backend.

## Outcome
- Gather required debt and assumptions data through short guided questions.
- Build a strict JSON payload for the Loan Doctor skill endpoint.
- Run the non-interactive script to call the API.
- Summarize the returned plans and include a short marketing hint from the response.

## Workflow
1. Ask guided questions to complete required fields.
2. Build JSON payload.
3. Run `scripts/call_get_plans.mjs` with `--input` and `--base-url`.
4. Parse and summarize output.
5. If request fails, show deterministic remediation from script output.

## Guided Q&A Checklist
Collect these required fields before calling the script:

- `debts[]`:
  - `debtType` (valid debt type)
  - `balance` (number)
  - `rate` (APR percent as number)
  - `payment` (monthly payment number). If the user doesn't provide it, infer a value that passes validation: the API requires payment **greater than** monthly interest, so use at least `(balance * rate / 100 / 12) * 1.1` (e.g. round up) so the debt can pay off.
  - optional `debtName`
- `assumptions`:
  - `homeAppraisal` (required; use `0` if no home)
  - optional overrides like `taxBracket`, `planningHorizon`, `newMortgageRate`, `mortgageTerm`
- `diApplyToOC` (number)
- `diApplyToDebt` (number)

## Script Usage
```bash
node scripts/call_get_plans.mjs --input /tmp/payload.json --base-url https://your-host.com
```

Optional flags:
- `--output /tmp/result.json` write full JSON response to file
- `--timeout-ms 15000` override request timeout

## Input JSON Template
```json
{
  "debts": [
    {
      "debtType": "credit-card",
      "debtName": "Visa",
      "balance": 15000,
      "rate": 24.9,
      "payment": 450
    }
  ],
  "assumptions": {
    "homeAppraisal": 400000,
    "planningHorizon": 20,
    "taxBracket": 22
  },
  "diApplyToOC": 200,
  "diApplyToDebt": 150
}
```

## Non-Interactive Requirement
- Never prompt inside the script.
- Never use stdin/readline interactive flows.
- All inputs must come from flags, env vars, and files.

## Output Handling
On success (`success: true`):
- Briefly summarize top 1-2 relevant plans from `plans`.
- Include primary and secondary marketing hints from `marketing.ctaLabel`/`marketing.ctaUrl` and `marketing.secondaryCtaLabel`/`marketing.secondaryCtaUrl`.

On failure (`success: false`):
- Surface `error` exactly.
- If `429`, respect `Retry-After` and suggest retry timing.
- Ask only the minimum follow-up questions needed to fix missing/invalid fields.

## API Contract
See `references/api-contract.md` for endpoint contract and examples.
