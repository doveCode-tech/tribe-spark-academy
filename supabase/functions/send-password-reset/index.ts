import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendPasswordResetRequest {
  email: string;
  resetLink: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { email, resetLink }: SendPasswordResetRequest = await req.json();

    console.log(`Sending password reset email to ${email}`);

    if (!email || !resetLink) {
      throw new Error("Missing required fields: email and resetLink");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error("Invalid email address");
    }

    // Get user info for personalization
    const { data: userData } = await supabase
      .from('users')
      .select('first_name, last_name, name')
      .eq('email', email)
      .single();

    const userName = userData?.first_name 
      ? `${userData.first_name} ${userData.last_name || ''}`.trim()
      : userData?.name || 'User';

    const emailResponse = await resend.emails.send({
      from: "STEMTribe LMS <onboarding@resend.dev>",
      to: [email],
      subject: "Reset Your Password - STEMTribe LMS",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .header {
                background: linear-gradient(135deg, #5B21B6 0%, #6366F1 100%);
                color: white;
                padding: 30px;
                border-radius: 10px 10px 0 0;
                text-align: center;
              }
              .content {
                background: #ffffff;
                padding: 30px;
                border: 1px solid #e0e0e0;
                border-top: none;
              }
              .reset-button {
                display: inline-block;
                background: #5B21B6;
                color: white;
                padding: 14px 32px;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
                margin: 20px 0;
                text-align: center;
              }
              .reset-button:hover {
                background: #6366F1;
              }
              .warning-box {
                background: #FEF3C7;
                border-left: 4px solid #F59E0B;
                padding: 15px;
                margin: 20px 0;
                border-radius: 4px;
              }
              .info-box {
                background: #f9f9f9;
                border-left: 4px solid #5B21B6;
                padding: 15px;
                margin: 20px 0;
                border-radius: 4px;
              }
              .footer {
                background: #f5f5f5;
                padding: 20px;
                text-align: center;
                font-size: 12px;
                color: #666;
                border-radius: 0 0 10px 10px;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1 style="margin: 0; font-size: 28px;">🔐 Password Reset</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">STEMTribe LMS</p>
            </div>
            
            <div class="content">
              <h2 style="color: #5B21B6; margin-top: 0;">Hello ${userName},</h2>
              
              <p>We received a request to reset your password for your STEMTribe LMS account.</p>
              
              <p>Click the button below to reset your password:</p>
              
              <div style="text-align: center;">
                <a href="${resetLink}" class="reset-button">Reset Password</a>
              </div>
              
              <div class="info-box">
                <p style="margin: 0;"><strong>Security Information:</strong></p>
                <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                  <li>This link will expire in 1 hour</li>
                  <li>The link can only be used once</li>
                  <li>Your current password will remain active until you set a new one</li>
                </ul>
              </div>
              
              <div class="warning-box">
                <p style="margin: 0;"><strong>⚠️ Didn't request this?</strong></p>
                <p style="margin: 10px 0 0 0;">If you didn't request a password reset, please ignore this email. Your password will remain unchanged and your account is secure.</p>
              </div>
              
              <p style="color: #666; font-size: 14px; margin-top: 30px;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 12px;">
                ${resetLink}
              </p>
            </div>
            
            <div class="footer">
              <p style="margin: 5px 0;">© ${new Date().getFullYear()} STEMTribe LMS. All rights reserved.</p>
              <p style="margin: 5px 0;">This is an automated email. Please do not reply directly to this message.</p>
            </div>
          </body>
        </html>
      `,
    });

    console.log("Password reset email sent successfully:", emailResponse);

    // Create audit log
    await supabase.from("audit_logs").insert({
      action_type: "password_reset_email_sent",
      target_type: "user",
      status: "success",
      details: {
        email,
        email_id: emailResponse.id,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        emailResponse,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-password-reset function:", error);

    // Try to create audit log for error
    try {
      const { email } = await req.json();
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      
      await supabase.from("audit_logs").insert({
        action_type: "password_reset_email_failed",
        target_type: "user",
        status: "failed",
        error_message: error.message,
        details: { email },
      });
    } catch (logError) {
      console.error("Failed to create audit log:", logError);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
