import { readdir } from "node:fs/promises";
import process from "node:process";

const EXCLUDED_DIRS = new Set(["_shared"]);
const API_BASE = "https://api.uptimerobot.com/v2";
const DEFAULT_RETRIES = 6;
const DEFAULT_BACKOFF_MS = 4000;

const MONITOR_NAME_MAP = {
  "admin-financial-dashboard": "PREFEST - Finance Dashboard",
  "admin-update-user-password": "PREFEST - Security Admin Password",
  "asaas-connect-organizer-v2": "PREFEST - Asaas Connect Organizer",
  "asaas-create-or-connect-organizer": "PREFEST - Asaas Create Connect Organizer",
  "asaas-create-payment-split": "PREFEST - Payments Split",
  "asaas-create-ticket-payment-v2": "PREFEST - Payments Ticket v2",
  "asaas-create-ticket-payment-v3": "PREFEST - Payments Ticket v3",
  "asaas-refresh-organizer-kyc-status": "PREFEST - Asaas KYC Organizer",
  "asaas-webhook": "PREFEST - Asaas Webhook",
  "asaas-webhook-handler": "PREFEST - Comm Webhook Handler",
  "complete-profile": "PREFEST - Profile Complete",
  "create-asaas-payment": "PREFEST - Payments Create Asaas",
  "debug-auth": "PREFEST - Security Debug Auth",
  "delete-event-safely": "PREFEST - Events Safe Delete",
  "delete-user-account": "PREFEST - Security Delete Account",
  "get-payment-settings": "PREFEST - Payments Settings",
  "get-payment-status": "PREFEST - Payments Status",
  "init-ticket-checkout-v2": "PREFEST - Payments Checkout v2",
  "issue-free-ticket-v2": "PREFEST - Tickets Free v2",
  "save-buyer-profile-v2": "PREFEST - Buyer Profile v2",
  "save-system-settings": "PREFEST - System Settings",
  "send-resend-email": "PREFEST - Comm Send Email",
  "test-smtp-connection": "PREFEST - Comm SMTP Test",
  "uptimerobot-status": "PREFEST - Monitoring Status",
  "validate-asaas-credentials": "PREFEST - Security Validate Asaas",
};


function parseArgs(argv) {
  const args = {
    dryRun: false,
  };

  for (const arg of argv.slice(2)) {
    if (arg === "--dry-run") {
      args.dryRun = true;
    }
  }

  return args;
}

function resolveFunctionsBaseUrl() {
  const explicitBase = process.env.SUPABASE_FUNCTIONS_BASE_URL?.trim();
  if (explicitBase) {
    return explicitBase.replace(/\/$/, "");
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim();
  if (!supabaseUrl) {
    throw new Error("Missing SUPABASE_FUNCTIONS_BASE_URL or VITE_SUPABASE_URL environment variable");
  }

  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1`;
}

async function listEdgeFunctions() {
  const entries = await readdir("supabase/functions", { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !EXCLUDED_DIRS.has(name))
    .sort((a, b) => a.localeCompare(b));
}


function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function buildFormBody(values) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    params.set(key, String(value));
  }
  return params;
}

async function uptimeApi(action, payload, options = {}) {
  const retries = Number(options.retries ?? DEFAULT_RETRIES);
  const backoffMs = Number(options.backoffMs ?? DEFAULT_BACKOFF_MS);

  let attempt = 0;
  while (true) {
    const res = await fetch(`${API_BASE}/${action}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: buildFormBody(payload).toString(),
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 429 && attempt < retries) {
      const waitMs = backoffMs * (attempt + 1);
      console.warn(`RATE  ${action} -> 429, retrying in ${waitMs}ms (${attempt + 1}/${retries})`);
      attempt += 1;
      await sleep(waitMs);
      continue;
    }

    if (!res.ok || data?.stat !== "ok") {
      const msg = data?.error?.message || data?.message || `UptimeRobot ${action} failed with status ${res.status}`;
      throw new Error(msg);
    }

    return data;
  }
}

async function getExistingMonitors(apiKey) {
  const data = await uptimeApi("getMonitors", {
    api_key: apiKey,
    format: "json",
    all_time_uptime_ratio: 1,
  });

  const byUrl = new Map();
  for (const monitor of data.monitors ?? []) {
    if (monitor?.url) {
      byUrl.set(String(monitor.url), monitor);
    }
  }
  return byUrl;
}

async function main() {
  const { dryRun } = parseArgs(process.argv);

  const apiKey = process.env.UPTIMEROBOT_API_KEY?.trim();
  if (!dryRun && !apiKey) {
    throw new Error("Missing UPTIMEROBOT_API_KEY environment variable");
  }

  const monitorInterval = Number(process.env.UPTIMEROBOT_MONITOR_INTERVAL ?? "300");
  const monitorTimeout = Number(process.env.UPTIMEROBOT_MONITOR_TIMEOUT ?? "30");
  const monitorPrefix = process.env.UPTIMEROBOT_MONITOR_PREFIX?.trim() || "PREFEST";
  const acceptedStatuses = process.env.UPTIMEROBOT_ACCEPTED_HTTP_STATUSES?.trim() || "200:1_201:1_202:1_204:1_301:1_302:1_307:1_308:1_400:1_401:1_404:1_500:1";

  const baseUrl = resolveFunctionsBaseUrl();
  const edgeFunctions = await listEdgeFunctions();

  if (!edgeFunctions.length) {
    console.log("No edge functions found in supabase/functions");
    return;
  }

  const existing = apiKey ? await getExistingMonitors(apiKey) : new Map();

  const summary = {
    totalFunctions: edgeFunctions.length,
    created: 0,
    skipped: 0,
    errors: 0,
  };

  for (const fnName of edgeFunctions) {
    const url = `${baseUrl}/${fnName}`;

    if (existing.has(url)) {
      summary.skipped += 1;
      console.log(`SKIP  ${fnName} -> monitor already exists (${url})`);
      continue;
    }

    const friendlyName = MONITOR_NAME_MAP[fnName] ?? `${monitorPrefix} - ${fnName}`;

    if (dryRun) {
      summary.created += 1;
      console.log(`DRY   ${fnName} -> would create HTTP monitor for ${url}`);
      continue;
    }

    try {
      await uptimeApi("newMonitor", {
        api_key: apiKey,
        format: "json",
        type: 1,
        url,
        friendly_name: friendlyName,
        interval: monitorInterval,
        timeout: monitorTimeout,
        custom_http_statuses: acceptedStatuses,
      });
      summary.created += 1;
      console.log(`OK    ${fnName} -> monitor created (${url})`);
    } catch (error) {
      summary.errors += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`FAIL  ${fnName} -> ${message}`);
    }
  }

  console.log("\nSummary");
  console.log(`- Functions found: ${summary.totalFunctions}`);
  console.log(`- Created: ${summary.created}`);
  console.log(`- Skipped: ${summary.skipped}`);
  console.log(`- Errors: ${summary.errors}`);

  if (summary.errors > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Fatal: ${message}`);
  process.exit(1);
});
