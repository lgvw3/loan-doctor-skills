# Loan Doctor Agent Skill API Contract

## Endpoint
- Method: `POST`
- Path: `/api/agent-skills/get-plans`
- Auth: none
- Rate limiting: enforced by server (`429 RATE_LIMITED`)

## Request Body
Same schema as debt diagnostic calculate request.

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

## Success Response
```json
{
  "success": true,
  "plans": [],
  "meta": {
    "calculatedAt": "2026-03-03T00:00:00.000Z",
    "totalDebt": 15000,
    "monthlyPayment": 450,
    "debtCount": 1
  },
  "marketing": {
    "headline": "Want a professional walkthrough of your debt strategy?",
    "ctaLabel": "Book a 15-minute Plan Review",
    "ctaUrl": "https://example.com",
    "disclaimer": "Loan options and savings projections are estimates and should be reviewed with a licensed advisor."
  }
}
```

## Error Response
```json
{
  "success": false,
  "error": "VALIDATION_FAILED"
}
```

Possible error values:
- `UNAUTHORIZED` (reserved for parity with upstream contract)
- `VALIDATION_FAILED`
- `INTERNAL_ERROR`
- `RATE_LIMITED`
- or descriptive request parsing/validation errors

## Rate Limit Headers
When limited (`429`), server may include:
- `Retry-After`
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
