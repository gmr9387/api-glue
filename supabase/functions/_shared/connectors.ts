// Shared connector adapter layer. Every step execution flows through
// Connector.execute(input) -> ConnectorResult. Adapters own timeout,
// auth detection, latency measurement, structured errors, quota touch,
// and health-check hooks. Workers never speak to connectors directly.

export type ErrorKind =
  | "timeout"
  | "auth"
  | "rate_limit"
  | "upstream_5xx"
  | "upstream_4xx"
  | "validation"
  | "unknown";

export interface ConnectorError {
  kind: ErrorKind;
  retryable: boolean;
  message: string;
  status?: number;
}

export interface ConnectorResult {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: ConnectorError;
  latency_ms: number;
  mock: boolean;
  connector: string;
  action: string;
}

export interface ConnectorAdapter {
  name: string;
  /** Returns true if live credentials are present. */
  hasCredentials(): boolean;
  /** Execute one action with a hard timeout. */
  execute(action: string, input: Record<string, unknown>, opts?: { timeoutMs?: number; idempotencyKey?: string }): Promise<ConnectorResult>;
  /** Cheap probe used by connector_state ticker. */
  healthCheck?(): Promise<{ ok: boolean; latency_ms: number; error?: string }>;
}

// ─── utilities ────────────────────────────────────────────
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

function classifyHttp(status: number, body: string): ConnectorError {
  if (status === 401 || status === 403) return { kind: "auth", retryable: false, status, message: body.slice(0, 200) };
  if (status === 429) return { kind: "rate_limit", retryable: true, status, message: body.slice(0, 200) };
  if (status >= 500) return { kind: "upstream_5xx", retryable: true, status, message: body.slice(0, 200) };
  if (status >= 400) return { kind: "upstream_4xx", retryable: false, status, message: body.slice(0, 200) };
  return { kind: "unknown", retryable: false, status, message: body.slice(0, 200) };
}

async function runAdapter(
  connector: string,
  action: string,
  hasCreds: boolean,
  liveFn: () => Promise<Response>,
  mockFn: () => Record<string, unknown>,
  timeoutMs: number,
): Promise<ConnectorResult> {
  const t0 = Date.now();
  if (!hasCreds) {
    // Cheap simulated latency so mock mode is not instantaneous (more realistic
    // for telemetry), but still bounded.
    await new Promise((r) => setTimeout(r, 80 + Math.random() * 220));
    return { ok: true, data: mockFn(), latency_ms: Date.now() - t0, mock: true, connector, action };
  }
  try {
    const resp = await withTimeout(liveFn(), timeoutMs);
    const text = await resp.text();
    let body: unknown = text;
    try { body = JSON.parse(text); } catch { /* keep text */ }
    if (!resp.ok) {
      return { ok: false, error: classifyHttp(resp.status, text), latency_ms: Date.now() - t0, mock: false, connector, action };
    }
    return { ok: true, data: body as Record<string, unknown>, latency_ms: Date.now() - t0, mock: false, connector, action };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const kind: ErrorKind = msg.startsWith("timeout") ? "timeout" : "unknown";
    return {
      ok: false,
      error: { kind, retryable: kind === "timeout", message: msg },
      latency_ms: Date.now() - t0,
      mock: false,
      connector,
      action,
    };
  }
}

// ─── Stripe ───────────────────────────────────────────────
const stripe: ConnectorAdapter = {
  name: "stripe",
  hasCredentials: () => !!Deno.env.get("STRIPE_KEY"),
  execute(action, input, opts) {
    const key = Deno.env.get("STRIPE_KEY");
    return runAdapter(
      "stripe", action, !!key,
      () => {
        const endpoints: Record<string, string> = {
          charge: "https://api.stripe.com/v1/charges",
          refund: "https://api.stripe.com/v1/refunds",
          createCustomer: "https://api.stripe.com/v1/customers",
        };
        const params = new URLSearchParams(Object.entries(input).reduce((acc, [k, v]) => { acc[k] = String(v); return acc; }, {} as Record<string, string>));
        return fetch(endpoints[action] ?? endpoints.charge, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/x-www-form-urlencoded",
            ...(opts?.idempotencyKey ? { "Idempotency-Key": opts.idempotencyKey } : {}),
          },
          body: params,
        });
      },
      () => ({ id: "ch_mock_" + Date.now(), amount: input.amount ?? 1000, currency: input.currency ?? "usd", status: "succeeded" }),
      opts?.timeoutMs ?? 5000,
    );
  },
};

// ─── OpenAI ───────────────────────────────────────────────
const openai: ConnectorAdapter = {
  name: "openai",
  hasCredentials: () => !!Deno.env.get("OPENAI_KEY") || !!Deno.env.get("LOVABLE_API_KEY"),
  execute(action, input, opts) {
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_KEY");
    const useGateway = !!lovableKey && !openaiKey;
    const key = openaiKey ?? lovableKey;
    return runAdapter(
      "openai", action, !!key,
      () => {
        const url = useGateway
          ? "https://ai.gateway.lovable.dev/v1/chat/completions"
          : "https://api.openai.com/v1/chat/completions";
        return fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: input.model ?? (useGateway ? "google/gemini-2.5-flash" : "gpt-4o-mini"),
            messages: [{ role: "user", content: String(input.prompt ?? "Summarize the operation.") }],
            max_tokens: input.maxTokens ?? 200,
          }),
        });
      },
      () => ({ text: `Receipt for ${input.correlation_id ?? "op"} generated.`, model: "mock", confidence: 0.55 + Math.random() * 0.42 }),
      opts?.timeoutMs ?? 8000,
    );
  },
};

// ─── SendGrid ─────────────────────────────────────────────
const sendgrid: ConnectorAdapter = {
  name: "sendgrid",
  hasCredentials: () => !!Deno.env.get("SENDGRID_KEY"),
  execute(action, input, opts) {
    const key = Deno.env.get("SENDGRID_KEY");
    return runAdapter(
      "sendgrid", action, !!key,
      () => fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: input.to ?? "noop@example.com" }], subject: input.subject ?? "Notification" }],
          from: { email: input.from ?? "ops@apiglue.dev" },
          content: [{ type: "text/plain", value: String(input.body ?? "Operation completed.") }],
        }),
      }),
      () => ({ sent: true, to: input.to ?? "noop@example.com" }),
      opts?.timeoutMs ?? 4000,
    );
  },
};

// ─── Twilio ───────────────────────────────────────────────
const twilio: ConnectorAdapter = {
  name: "twilio",
  hasCredentials: () => !!Deno.env.get("TWILIO_SID") && !!Deno.env.get("TWILIO_TOKEN"),
  execute(action, input, opts) {
    const sid = Deno.env.get("TWILIO_SID");
    const token = Deno.env.get("TWILIO_TOKEN");
    const from = Deno.env.get("TWILIO_PHONE");
    return runAdapter(
      "twilio", action, !!sid && !!token,
      () => fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: String(input.to ?? ""), From: String(input.from ?? from ?? ""), Body: String(input.body ?? "") }),
      }),
      () => ({ sid: "SM_mock_" + Date.now(), status: "queued", to: input.to ?? "+10000000000" }),
      opts?.timeoutMs ?? 4000,
    );
  },
};

// ─── Slack ────────────────────────────────────────────────
const slack: ConnectorAdapter = {
  name: "slack",
  hasCredentials: () => !!Deno.env.get("SLACK_BOT_TOKEN"),
  execute(action, input, opts) {
    const key = Deno.env.get("SLACK_BOT_TOKEN");
    return runAdapter(
      "slack", action, !!key,
      () => fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ channel: input.channel ?? "#ops", text: input.text ?? "Workflow event" }),
      }),
      () => ({ ok: true, ts: String(Date.now() / 1000), channel: input.channel ?? "#ops" }),
      opts?.timeoutMs ?? 4000,
    );
  },
};

// ─── Salesforce (stub adapter — credential-aware shape) ───
const salesforce: ConnectorAdapter = {
  name: "salesforce",
  hasCredentials: () => !!Deno.env.get("SALESFORCE_ACCESS_TOKEN") && !!Deno.env.get("SALESFORCE_INSTANCE_URL"),
  execute(action, input, opts) {
    const token = Deno.env.get("SALESFORCE_ACCESS_TOKEN");
    const instance = Deno.env.get("SALESFORCE_INSTANCE_URL");
    return runAdapter(
      "salesforce", action, !!token && !!instance,
      () => fetch(`${instance}/services/data/v60.0/sobjects/${input.object ?? "Account"}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(input.fields ?? {}),
      }),
      () => ({ id: "sf_mock_" + Date.now(), object: input.object ?? "Account" }),
      opts?.timeoutMs ?? 6000,
    );
  },
};

// ─── Internal (no-op step used for validate/route nodes) ──
const internal: ConnectorAdapter = {
  name: "internal",
  hasCredentials: () => true,
  async execute(action, input) {
    const t0 = Date.now();
    await new Promise((r) => setTimeout(r, 40 + Math.random() * 80));
    return { ok: true, data: { validated: true, action, echo: input }, latency_ms: Date.now() - t0, mock: false, connector: "internal", action };
  },
};

const REGISTRY: Record<string, ConnectorAdapter> = {
  stripe, openai, sendgrid, twilio, slack, salesforce, internal,
};

export function getConnector(name: string): ConnectorAdapter {
  return REGISTRY[name] ?? internal;
}

export const CONNECTOR_NAMES = Object.keys(REGISTRY);
