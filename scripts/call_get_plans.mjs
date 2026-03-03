#!/usr/bin/env node
import fs from "node:fs/promises"
import http from "node:http"
import https from "node:https"

const DEFAULT_TIMEOUT_MS = 15000

export function usage() {
  return [
    "Usage:",
    "  node scripts/call_get_plans.mjs --input <payload.json> --base-url <https://host>",
    "Options:",
    "  --output <file>       Write full response JSON to file",
    "  --timeout-ms <num>    Request timeout in ms (default: 15000)",
  ].join("\n")
}

export function parseArgs(argv) {
  const args = {
    input: "",
    output: "",
    baseUrl: "",
    timeoutMs: DEFAULT_TIMEOUT_MS,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    const value = argv[i + 1]

    if (token === "--input") {
      args.input = value || ""
      i += 1
      continue
    }

    if (token === "--output") {
      args.output = value || ""
      i += 1
      continue
    }

    if (token === "--base-url") {
      args.baseUrl = value || ""
      i += 1
      continue
    }

    if (token === "--timeout-ms") {
      args.timeoutMs = Number(value)
      i += 1
      continue
    }

    throw new Error(`Unknown argument: ${token}`)
  }

  if (!args.input) {
    throw new Error("Missing required --input")
  }

  if (!args.baseUrl) {
    throw new Error("Missing required --base-url")
  }

  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0) {
    throw new Error("--timeout-ms must be a positive number")
  }

  return args
}

export function validatePayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload must be a JSON object")
  }

  if (!Array.isArray(payload.debts)) {
    throw new Error("Payload must include debts[]")
  }

  if (!payload.assumptions || typeof payload.assumptions !== "object") {
    throw new Error("Payload must include assumptions object")
  }

  if (payload.assumptions.homeAppraisal === undefined || payload.assumptions.homeAppraisal === null) {
    throw new Error("Payload must include assumptions.homeAppraisal (set 0 when no home)")
  }

  if (typeof payload.diApplyToOC !== "number") {
    throw new Error("Payload must include numeric diApplyToOC")
  }

  if (typeof payload.diApplyToDebt !== "number") {
    throw new Error("Payload must include numeric diApplyToDebt")
  }
}

function postJsonWithNode(url, payload, timeoutMs) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const body = JSON.stringify(payload)
    const client = parsed.protocol === "https:" ? https : http

    const req = client.request(
      parsed,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = ""
        res.setEncoding("utf8")
        res.on("data", (chunk) => {
          data += chunk
        })
        res.on("end", () => {
          resolve({
            ok: (res.statusCode || 500) >= 200 && (res.statusCode || 500) < 300,
            status: res.statusCode || 500,
            text: async () => data,
            headers: {
              get(key) {
                return res.headers[key.toLowerCase()] || null
              },
            },
          })
        })
      }
    )

    req.on("error", (error) => reject(error))
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`API request timed out after ${timeoutMs}ms`))
    })
    req.write(body)
    req.end()
  })
}

export async function callGetPlans({ baseUrl, payload, timeoutMs, fetchImpl }) {
  const url = `${baseUrl.replace(/\/$/, "")}/api/agent-skills/get-plans`
  const activeFetch = fetchImpl || (typeof globalThis.fetch === "function" ? globalThis.fetch.bind(globalThis) : null)

  const response = activeFetch
    ? await activeFetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      })
    : await postJsonWithNode(url, payload, timeoutMs)

  const text = await response.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`API returned non-JSON response (status ${response.status})`)
  }

  if (!response.ok) {
    const apiError = json?.error || `HTTP_${response.status}`
    const retryAfter = response.headers.get("retry-after")
    const retryMsg = retryAfter ? ` Retry after ${retryAfter}s.` : ""
    throw new Error(`API request failed (${response.status}): ${apiError}.${retryMsg}`.trim())
  }

  return json
}

export async function main(argv = process.argv.slice(2)) {
  try {
    const args = parseArgs(argv)
    const raw = await fs.readFile(args.input, "utf8")

    let payload
    try {
      payload = JSON.parse(raw)
    } catch {
      throw new Error(`Invalid JSON in input file: ${args.input}`)
    }

    validatePayload(payload)
    const result = await callGetPlans({
      baseUrl: args.baseUrl,
      payload,
      timeoutMs: args.timeoutMs,
    })

    if (args.output) {
      await fs.writeFile(args.output, `${JSON.stringify(result, null, 2)}\n`, "utf8")
      console.error(`Wrote response to ${args.output}`)
    }

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  } catch (error) {
    console.error(`Error: ${error.message}`)
    console.error(usage())
    process.exitCode = 1
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main()
}
