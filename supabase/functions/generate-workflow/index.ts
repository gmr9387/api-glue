import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VALID_ACTIONS: Record<string, string[]> = {
  stripe: ["charge", "refund", "createCustomer"],
  openai: ["generateText", "generateImage"],
  sendgrid: ["sendEmail"],
  twilio: ["sendMessage"],
};

const SYSTEM_PROMPT = `You are an API workflow generator for "API Unity OS".

You MUST return ONLY a valid JSON object with this exact structure:
{
  "name": "Short workflow name",
  "steps": [
    {
      "service": "<service_name>",
      "action": "<action_name>",
      "data": { <relevant_default_data> }
    }
  ]
}

Available connectors and their actions:
- stripe: charge, refund, createCustomer
- openai: generateText, generateImage
- sendgrid: sendEmail
- twilio: sendMessage

Rules:
- ONLY use the services and actions listed above
- NEVER invent new services or actions
- ALWAYS return valid JSON, nothing else
- Include sensible default data for each step
- Keep workflow names concise (under 6 words)
- Return ONLY the JSON object, no markdown, no explanation`;

interface WorkflowStep {
  service: string;
  action: string;
  data: Record<string, unknown>;
}

interface GeneratedWorkflow {
  name: string;
  steps: WorkflowStep[];
}

function validateWorkflow(parsed: unknown): { valid: boolean; error?: string; workflow?: GeneratedWorkflow } {
  if (!parsed || typeof parsed !== "object") {
    return { valid: false, error: "Response is not an object" };
  }

  const obj = parsed as Record<string, unknown>;

  if (typeof obj.name !== "string" || !obj.name) {
    return { valid: false, error: "Missing or invalid workflow name" };
  }

  if (!Array.isArray(obj.steps) || obj.steps.length === 0) {
    return { valid: false, error: "Workflow must have at least one step" };
  }

  for (let i = 0; i < obj.steps.length; i++) {
    const step = obj.steps[i] as Record<string, unknown>;
    const service = step.service as string;
    const action = step.action as string;

    if (!service || !VALID_ACTIONS[service]) {
      return { valid: false, error: `Step ${i + 1}: Unknown service "${service}". Valid: ${Object.keys(VALID_ACTIONS).join(", ")}` };
    }

    if (!action || !VALID_ACTIONS[service].includes(action)) {
      return { valid: false, error: `Step ${i + 1}: Unknown action "${action}" for ${service}. Valid: ${VALID_ACTIONS[service].join(", ")}` };
    }

    if (!step.data || typeof step.data !== "object") {
      obj.steps[i] = { ...step, data: {} };
    }
  }

  return { valid: true, workflow: obj as unknown as GeneratedWorkflow };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (prompt.length > 500) {
      return new Response(JSON.stringify({ error: "Prompt must be under 500 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error("AI service unavailable");
    }

    const aiResult = await response.json();
    let content = aiResult.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new Error("Empty AI response");
    }

    // Strip markdown code fences if present
    content = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("AI returned invalid JSON");
    }

    const validation = validateWorkflow(parsed);

    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: `Invalid workflow: ${validation.error}`, raw: content }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        workflow: validation.workflow,
        prompt,
        generatedAt: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-workflow error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
