import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.117.3";

const jsonHeaders = { "Content-Type": "application/json", "Vary": "Origin" };
const response = (body: Record<string, unknown>, status: number, origin = "") => new Response(JSON.stringify(body), {
  status,
  headers: { ...jsonHeaders, ...(origin ? { "Access-Control-Allow-Origin": origin } : {}) },
});

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  const origins = (Deno.env.get("APP_ORIGINS") ?? "").split(",").map(value => value.trim()).filter(Boolean);
  const requestOrigin = req.headers.get("Origin") ?? "";
  if (!origins.length) return response({ error: "not_configured" }, 503);
  if (!origins.includes(requestOrigin)) return response({ error: "origin_not_allowed" }, 403);
  const corsHeaders = {
    "Access-Control-Allow-Origin": requestOrigin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { ...jsonHeaders, ...corsHeaders } });

  const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY");
  const hashSecret = Deno.env.get("RATE_LIMIT_HASH_SECRET");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!turnstileSecret || !hashSecret || !serviceRoleKey || !supabaseUrl) {
    return new Response(JSON.stringify({ error: "not_configured" }), { status: 503, headers: { ...jsonHeaders, ...corsHeaders } });
  }
  const contentLength = Number(req.headers.get("Content-Length") ?? 0);
  if (contentLength > 12_000) return new Response(JSON.stringify({ error: "request_too_large" }), { status: 413, headers: { ...jsonHeaders, ...corsHeaders } });

  try {
    const body = await req.json();
    const artistId = typeof body.artistId === "string" ? body.artistId : "";
    const artworkId = typeof body.artworkId === "string" ? body.artworkId : null;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const captchaToken = typeof body.captchaToken === "string" ? body.captchaToken : "";
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuid.test(artistId) || (artworkId !== null && !uuid.test(artworkId)) || name.length < 1 || name.length > 120 || email.length < 3 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || message.length < 10 || message.length > 4000 || !captchaToken || JSON.stringify(body).length > 12_000) {
      return new Response(JSON.stringify({ error: "invalid_request" }), { status: 400, headers: { ...jsonHeaders, ...corsHeaders } });
    }

    const verification = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: turnstileSecret, response: captchaToken }),
    });
    const result = await verification.json();
    const expectedHosts = origins.map(origin => new URL(origin).hostname);
    if (!verification.ok || !result.success || !expectedHosts.includes(result.hostname)) {
      return new Response(JSON.stringify({ error: "verification_failed" }), { status: 400, headers: { ...jsonHeaders, ...corsHeaders } });
    }

    const clientIp = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const ipHash = await sha256(`${hashSecret}:${clientIp}`);
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: allowed, error: rateError } = await supabase.rpc("consume_enquiry_rate_limit", { p_ip_hash: ipHash });
    if (rateError) return new Response(JSON.stringify({ error: "temporarily_unavailable" }), { status: 503, headers: { ...jsonHeaders, ...corsHeaders } });
    if (!allowed) return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers: { ...jsonHeaders, ...corsHeaders } });

    const { error: insertError } = await supabase.rpc("create_buyer_enquiry", {
      p_artist_id: artistId, p_artwork_id: artworkId, p_name: name, p_email: email, p_message: message,
    });
    if (insertError) return new Response(JSON.stringify({ error: "artist_unavailable" }), { status: 422, headers: { ...jsonHeaders, ...corsHeaders } });
    return new Response(JSON.stringify({ ok: true }), { status: 201, headers: { ...jsonHeaders, ...corsHeaders } });
  } catch {
    return new Response(JSON.stringify({ error: "invalid_request" }), { status: 400, headers: { ...jsonHeaders, ...corsHeaders } });
  }
});

