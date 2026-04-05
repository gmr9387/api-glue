import { corsHeaders } from "@supabase/supabase-js/cors";

const VALID_SERVICES: Record<string, string[]> = {
  stripe: ["charge", "refund", "createCustomer"],
  openai: ["generateText", "generateImage"],
  sendgrid: ["sendEmail"],
  twilio: ["sendMessage"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { service, action, data } = await req.json();

    if (!service || !action) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing "service" or "action"' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validActions = VALID_SERVICES[service];
    if (!validActions) {
      return new Response(
        JSON.stringify({ success: false, error: `Unknown service "${service}". Available: ${Object.keys(VALID_SERVICES).join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!validActions.includes(action)) {
      return new Response(
        JSON.stringify({ success: false, error: `Unknown action "${action}" for ${service}. Available: ${validActions.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await executeAction(service, action, data || {});

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[execute-api] Error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function getEnvOrThrow(name: string): string {
  const val = Deno.env.get(name);
  if (!val) throw new Error(`Server secret "${name}" is not configured. Please add it in project settings.`);
  return val;
}

async function executeAction(service: string, action: string, data: Record<string, unknown>) {
  switch (service) {
    case "stripe": return executeStripe(action, data);
    case "openai": return executeOpenAI(action, data);
    case "sendgrid": return executeSendGrid(action, data);
    case "twilio": return executeTwilio(action, data);
    default: return { success: false, error: `Unhandled service: ${service}` };
  }
}

// ─── STRIPE ──────────────────────────────────────────────
async function executeStripe(action: string, data: Record<string, unknown>) {
  const key = getEnvOrThrow("STRIPE_KEY");
  const baseUrl = "https://api.stripe.com/v1";

  const endpoints: Record<string, string> = {
    charge: `${baseUrl}/charges`,
    refund: `${baseUrl}/refunds`,
    createCustomer: `${baseUrl}/customers`,
  };

  const inputMappers: Record<string, (d: Record<string, unknown>) => Record<string, string>> = {
    charge: (d) => ({
      amount: String(d.amount || ""),
      currency: String(d.currency || "usd"),
      source: String(d.source || ""),
      ...(d.description ? { description: String(d.description) } : {}),
    }),
    refund: (d) => ({
      charge: String(d.chargeId || ""),
      ...(d.amount ? { amount: String(d.amount) } : {}),
    }),
    createCustomer: (d) => ({
      email: String(d.email || ""),
      ...(d.name ? { name: String(d.name) } : {}),
      ...(d.description ? { description: String(d.description) } : {}),
    }),
  };

  const mapped = inputMappers[action](data);
  const resp = await fetch(endpoints[action], {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(mapped),
  });

  const body = await resp.json();
  if (!resp.ok) {
    return { success: false, error: `Stripe ${action} failed [${resp.status}]: ${body?.error?.message || JSON.stringify(body)}` };
  }

  const outputMappers: Record<string, (r: Record<string, unknown>) => Record<string, unknown>> = {
    charge: (r) => ({ id: r.id, amount: r.amount, status: r.status, currency: r.currency }),
    refund: (r) => ({ id: r.id, amount: r.amount, status: r.status }),
    createCustomer: (r) => ({ id: r.id, email: r.email, name: r.name }),
  };

  return { success: true, data: outputMappers[action](body) };
}

// ─── OPENAI ──────────────────────────────────────────────
async function executeOpenAI(action: string, data: Record<string, unknown>) {
  const key = getEnvOrThrow("OPENAI_KEY");
  const baseUrl = "https://api.openai.com/v1";

  if (action === "generateText") {
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: data.model || "gpt-4o-mini",
        messages: [{ role: "user", content: data.prompt }],
        max_tokens: data.maxTokens || 1000,
        temperature: data.temperature ?? 0.7,
      }),
    });
    const body = await resp.json();
    if (!resp.ok) return { success: false, error: `OpenAI error [${resp.status}]: ${body?.error?.message || JSON.stringify(body)}` };
    return { success: true, data: { text: body.choices?.[0]?.message?.content, model: body.model, usage: body.usage } };
  }

  if (action === "generateImage") {
    const resp = await fetch(`${baseUrl}/images/generations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "dall-e-3", prompt: data.prompt, n: 1, size: data.size || "1024x1024" }),
    });
    const body = await resp.json();
    if (!resp.ok) return { success: false, error: `OpenAI error [${resp.status}]: ${body?.error?.message || JSON.stringify(body)}` };
    return { success: true, data: { url: body.data?.[0]?.url, revisedPrompt: body.data?.[0]?.revised_prompt } };
  }

  return { success: false, error: `Unknown OpenAI action: ${action}` };
}

// ─── SENDGRID ────────────────────────────────────────────
async function executeSendGrid(action: string, data: Record<string, unknown>) {
  const key = getEnvOrThrow("SENDGRID_KEY");

  if (action === "sendEmail") {
    const resp = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: data.to }], subject: data.subject }],
        from: { email: data.from },
        content: [{ type: data.html ? "text/html" : "text/plain", value: data.body || data.html || data.text }],
      }),
    });
    if (!resp.ok) {
      const body = await resp.text();
      return { success: false, error: `SendGrid error [${resp.status}]: ${body}` };
    }
    return { success: true, data: { sent: true } };
  }

  return { success: false, error: `Unknown SendGrid action: ${action}` };
}

// ─── TWILIO ──────────────────────────────────────────────
async function executeTwilio(action: string, data: Record<string, unknown>) {
  const sid = getEnvOrThrow("TWILIO_SID");
  const token = getEnvOrThrow("TWILIO_TOKEN");
  const phoneNumber = getEnvOrThrow("TWILIO_PHONE");

  if (action === "sendMessage") {
    const encoded = btoa(`${sid}:${token}`);
    const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${encoded}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: String(data.to || ""),
        From: String(data.from || phoneNumber),
        Body: String(data.body || ""),
      }),
    });
    const body = await resp.json();
    if (!resp.ok) return { success: false, error: `Twilio error [${resp.status}]: ${body?.message || JSON.stringify(body)}` };
    return { success: true, data: { sid: body.sid, status: body.status, to: body.to, body: body.body } };
  }

  return { success: false, error: `Unknown Twilio action: ${action}` };
}
