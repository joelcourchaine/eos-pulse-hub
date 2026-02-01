import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function isProbablyImage(contentType: string | null): boolean {
  if (!contentType) return false;
  return contentType.startsWith("image/");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id")?.trim();

    if (!id) {
      return new Response(JSON.stringify({ error: "Missing id" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Build a canonical direct-view URL; we do NOT accept arbitrary URLs (SSRF protection).
    const driveUrl = `https://drive.google.com/uc?export=view&id=${encodeURIComponent(id)}`;

    // Fetch with redirect following. Drive may redirect to a googleusercontent host.
    const upstream = await fetch(driveUrl, {
      redirect: "follow",
      headers: {
        // Some hosts behave better with a UA.
        "User-Agent": "Mozilla/5.0 (thumbnail-proxy)",
      },
    });

    if (!upstream.ok) {
      return new Response(JSON.stringify({ error: `Upstream error (${upstream.status})` }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const contentType = upstream.headers.get("content-type");

    // If Drive returns HTML (login / warning page), surface as a 415 so UI can fallback.
    if (!isProbablyImage(contentType)) {
      return new Response(JSON.stringify({
        error: "Upstream did not return an image",
        contentType,
      }), {
        status: 415,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Pass through the image bytes.
    const headers = new Headers(corsHeaders);
    headers.set("Content-Type", contentType ?? "image/*");
    headers.set("Cache-Control", "public, max-age=3600");

    return new Response(upstream.body, {
      status: 200,
      headers,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message ?? "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
