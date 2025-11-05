import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reportTitle, reportContent, reportGrade } = await req.json();

    if (!reportTitle || !reportContent) {
      return new Response(
        JSON.stringify({ error: 'Report title and content are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `You are a professional academic report formatter. Your task is to format student reports while:

1. PRESERVING all original meaning, keywords, and emphases from the tutor
2. NEVER changing any grades or numeric values
3. Organizing content into clear sections:
   - Title (use provided title)
   - Summary (brief overview of the report)
   - Strengths (positive aspects and achievements)
   - Areas to Improve (constructive feedback)
   - Action Items (specific next steps)

4. Improving grammar, punctuation, and sentence structure
5. Maintaining a professional, encouraging tone
6. Keeping the tutor's original voice and specific feedback

Return ONLY a JSON object with this structure:
{
  "formatted_html": "<formatted HTML version with proper headings and structure>",
  "formatted_text": "Plain text version with clear section headings"
}

Do not include any markdown code blocks or extra text - just the JSON object.`;

    const userPrompt = `Format this report:

TITLE: ${reportTitle}
${reportGrade ? `GRADE: ${reportGrade}/100` : ''}

CONTENT:
${reportContent}

Remember to preserve all keywords, emphases, and numeric values. Organize into Title, Summary, Strengths, Areas to Improve, and Action Items sections.`;

    console.log("Calling Lovable AI for report formatting...");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3, // Lower temperature for more consistent formatting
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        console.error("Rate limit exceeded");
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        console.error("Payment required");
        return new Response(
          JSON.stringify({ error: "AI service credits depleted. Please contact administrator." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI formatting service unavailable" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;

    if (!aiContent) {
      console.error("No content in AI response");
      return new Response(
        JSON.stringify({ error: "AI service returned empty response" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the JSON response from AI
    let formattedData;
    try {
      // Remove any markdown code blocks if present
      const cleanContent = aiContent.replace(/```json\n?|\n?```/g, '').trim();
      formattedData = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", parseError);
      console.error("AI response:", aiContent);
      return new Response(
        JSON.stringify({ error: "Failed to parse formatted report" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!formattedData.formatted_html || !formattedData.formatted_text) {
      console.error("AI response missing required fields");
      return new Response(
        JSON.stringify({ error: "Incomplete formatting response" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Report formatted successfully");

    return new Response(
      JSON.stringify({
        success: true,
        formatted_html: formattedData.formatted_html,
        formatted_text: formattedData.formatted_text,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error("Error formatting report:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error occurred" 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
