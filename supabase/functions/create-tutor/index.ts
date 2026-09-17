import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Verify caller authentication and admin authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callerUser }, error: tokenError } = await supabaseAdmin.auth.getUser(token);
    if (tokenError || !callerUser) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid authentication token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify caller has admin role
    const { data: callerProfile, error: profileCheckError } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("auth_user_id", callerUser.id)
      .single();

    if (profileCheckError || callerProfile?.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Forbidden: Only administrators can create tutors" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { name, email, subjects, bio } = await req.json();

    if (!name || !email) {
      return new Response(
        JSON.stringify({ error: "Name and email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a new user via admin client
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: Math.random().toString(36).slice(-12), // Temporary password
      email_confirm: true,
      user_metadata: { name, subjects, bio }
    });

    if (authError) {
      throw authError;
    }

    // Create the user profile
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        auth_user_id: authUser.user.id,
        name,
        email,
        role: 'tutor',
        approved: true,
        bio: bio || null,
      });

    if (profileError) {
      throw profileError;
    }

    // Send password reset email (acts as welcome email)
    const { error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
    });

    if (resetError) {
      console.warn('Could not send welcome email:', resetError);
    }

    return new Response(
      JSON.stringify({ 
        message: "Tutor created successfully",
        user_id: authUser.user.id 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );

  } catch (error) {
    console.error("Error creating tutor:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});