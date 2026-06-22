import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function lookupCountry(ip: string) {
  if (!ip || ip === "127.0.0.1" || ip.startsWith("10.") || ip.startsWith("192.168.")) return "Unknown";
  try {
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,country,country_code`, {
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) return "Unknown";
    const json = await res.json();
    if (!json.success) return "Unknown";
    return json.country || json.country_code || "Unknown";
  } catch (_err) {
    return "Unknown";
  }
}

function isBotOrTestUserAgent(userAgent: string) {
  return /HeadlessChrome|Playwright|Puppeteer|bot|crawler|spider/i.test(userAgent);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const hashSalt = Deno.env.get("VISIT_HASH_SALT") || "funding-dashboard";

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "missing supabase env" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({}));
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || "";
  const userAgent = req.headers.get("user-agent") || "";
  if (isBotOrTestUserAgent(userAgent)) {
    return new Response(JSON.stringify({ ok: true, skipped: "bot_or_test_user_agent" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const headerCountry =
    req.headers.get("cf-ipcountry") ||
    req.headers.get("x-vercel-ip-country") ||
    req.headers.get("x-country-code") ||
    body.country;
  const country = headerCountry || await lookupCountry(ip);

  const visitorId = String(body.visitorId || "");
  if (!visitorId) {
    return new Response(JSON.stringify({ error: "missing visitorId" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ipHash = ip ? await sha256(`${hashSalt}:${ip}:${userAgent}`) : null;
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { error } = await supabase.from("visit_events").insert({
    visitor_id: visitorId,
    path: typeof body.path === "string" ? body.path.slice(0, 500) : null,
    referrer: typeof body.referrer === "string" ? body.referrer.slice(0, 500) : null,
    country: String(country).slice(0, 80),
    user_agent: userAgent.slice(0, 500),
    ip_hash: ipHash,
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
