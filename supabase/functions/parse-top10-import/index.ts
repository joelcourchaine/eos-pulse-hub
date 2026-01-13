import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ColumnDefinition {
  key: string;
  label: string;
}

interface ParseRequest {
  imageBase64: string;
  columns: ColumnDefinition[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { imageBase64, columns }: ParseRequest = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "No image provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!columns || columns.length === 0) {
      return new Response(
        JSON.stringify({ error: "No column definitions provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Parsing image with ${columns.length} columns`);

    // Build the column description for the prompt
    const columnLabels = columns.map((col, idx) => `${idx + 1}. "${col.label}" (key: ${col.key})`).join("\n");

    const prompt = `You are extracting tabular data from an image. The table has the following columns:
${columnLabels}

Instructions:
- Extract up to 10 rows of data from the table in the image
- Each row should be an object with keys matching the column keys provided (${columns.map(c => c.key).join(", ")})
- If a cell is empty or unreadable, use an empty string ""
- Do NOT include any explanations, just return valid JSON
- Return ONLY a JSON object in this exact format:

{
  "rows": [
    {${columns.map(c => `"${c.key}": "value"`).join(", ")}},
    ...
  ]
}

If you cannot find any table data in the image, return: {"rows": [], "error": "No table data found in image"}`;

    // Determine the image media type
    let mediaType = "image/png";
    if (imageBase64.startsWith("data:")) {
      const match = imageBase64.match(/^data:([^;]+);base64,/);
      if (match) {
        mediaType = match[1];
      }
    }

    // Clean the base64 string (remove data URL prefix if present)
    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mediaType};base64,${cleanBase64}`,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add funds to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error("No content in AI response");
      return new Response(
        JSON.stringify({ error: "No response from AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("AI response content:", content);

    // Parse the JSON from the response
    // Try to extract JSON from the response (it might be wrapped in markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    try {
      const parsed = JSON.parse(jsonStr);
      
      // Validate the response structure
      if (!parsed.rows || !Array.isArray(parsed.rows)) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: parsed.error || "Invalid response format from AI",
            rows: [] 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Ensure all rows have all column keys (fill in empty strings for missing keys)
      const normalizedRows = parsed.rows.map((row: Record<string, string>) => {
        const normalized: Record<string, string> = {};
        for (const col of columns) {
          normalized[col.key] = row[col.key] || "";
        }
        return normalized;
      });

      console.log(`Successfully extracted ${normalizedRows.length} rows`);

      return new Response(
        JSON.stringify({ success: true, rows: normalizedRows }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", parseError);
      return new Response(
        JSON.stringify({ 
          error: "Failed to parse AI response", 
          rawContent: content.substring(0, 500) 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Error in parse-top10-import function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
