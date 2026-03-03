import assert from "node:assert/strict"
import { callGetPlans, parseArgs, validatePayload } from "./call_get_plans.mjs"

async function run(name, fn) {
  try {
    await fn()
    console.log(`PASS: ${name}`)
  } catch (error) {
    console.error(`FAIL: ${name}`)
    console.error(error.message)
    process.exitCode = 1
  }
}

await run("parseArgs validates required args", async () => {
  assert.throws(() => parseArgs([]), /Missing required --input/)
  assert.throws(() => parseArgs(["--input", "a.json"]), /Missing required --base-url/)
  const parsed = parseArgs(["--input", "a.json", "--base-url", "https://example.com", "--timeout-ms", "1234"])
  assert.equal(parsed.timeoutMs, 1234)
})

await run("validatePayload rejects missing required fields", async () => {
  assert.throws(() => validatePayload({}), /debts/)
  assert.throws(() => validatePayload({ debts: [], assumptions: {}, diApplyToOC: 1, diApplyToDebt: 2 }), /homeAppraisal/)
})

await run("callGetPlans returns parsed json on success", async () => {
  const mockFetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ success: true, plans: [] }),
    headers: { get: () => null },
  })

  const result = await callGetPlans({
    baseUrl: "https://example.com",
    payload: {
      debts: [],
      assumptions: { homeAppraisal: 0 },
      diApplyToOC: 0,
      diApplyToDebt: 0,
    },
    timeoutMs: 500,
    fetchImpl: mockFetch,
  })

  assert.equal(result.success, true)
})

await run("callGetPlans includes retry guidance when rate-limited", async () => {
  const mockFetch = async () => ({
    ok: false,
    status: 429,
    text: async () => JSON.stringify({ success: false, error: "RATE_LIMITED" }),
    headers: {
      get(key) {
        if (key.toLowerCase() === "retry-after") {
          return "9"
        }
        return null
      },
    },
  })

  let rejected = false

  try {
    await callGetPlans({
      baseUrl: "https://example.com",
      payload: {
        debts: [],
        assumptions: { homeAppraisal: 0 },
        diApplyToOC: 0,
        diApplyToDebt: 0,
      },
      timeoutMs: 500,
      fetchImpl: mockFetch,
    })
  } catch (error) {
    rejected = true
    assert.match(error.message, /Retry after 9s/)
  }

  assert.equal(rejected, true)
})
