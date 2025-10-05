import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendReportEmailRequest {
  reportId: string;
  parentEmail: string;
  studentName: string;
  reportTitle: string;
  reportContent: string;
  tutorName: string;
  courseName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      reportId, 
      parentEmail, 
      studentName, 
      reportTitle, 
      reportContent,
      tutorName,
      courseName
    }: SendReportEmailRequest = await req.json();

    console.log(`Sending report email to ${parentEmail} for student ${studentName}`);

    // Validate inputs
    if (!reportId || !parentEmail || !studentName || !reportTitle || !reportContent) {
      throw new Error("Missing required fields");
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(parentEmail)) {
      throw new Error("Invalid email address");
    }

    const emailResponse = await resend.emails.send({
      from: "STEMTribe LMS <onboarding@resend.dev>",
      to: [parentEmail],
      subject: `Student Progress Report: ${studentName} - ${reportTitle}`,
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
              .report-box {
                background: #f9f9f9;
                border-left: 4px solid #5B21B6;
                padding: 20px;
                margin: 20px 0;
                border-radius: 4px;
              }
              .info-item {
                margin: 10px 0;
                padding: 8px 0;
                border-bottom: 1px solid #eee;
              }
              .info-label {
                font-weight: 600;
                color: #5B21B6;
                display: inline-block;
                width: 120px;
              }
              .footer {
                background: #f5f5f5;
                padding: 20px;
                text-align: center;
                font-size: 12px;
                color: #666;
                border-radius: 0 0 10px 10px;
              }
              .button {
                display: inline-block;
                background: #5B21B6;
                color: white;
                padding: 12px 30px;
                text-decoration: none;
                border-radius: 6px;
                margin: 20px 0;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1 style="margin: 0; font-size: 28px;">📚 STEMTribe LMS</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Student Progress Report</p>
            </div>
            
            <div class="content">
              <h2 style="color: #5B21B6; margin-top: 0;">Report for ${studentName}</h2>
              
              <div class="info-item">
                <span class="info-label">Report Title:</span>
                <span>${reportTitle}</span>
              </div>
              
              <div class="info-item">
                <span class="info-label">Tutor:</span>
                <span>${tutorName}</span>
              </div>
              
              ${courseName ? `
              <div class="info-item">
                <span class="info-label">Course:</span>
                <span>${courseName}</span>
              </div>
              ` : ''}
              
              <div class="info-item">
                <span class="info-label">Date:</span>
                <span>${new Date().toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</span>
              </div>
              
              <div class="report-box">
                <h3 style="margin-top: 0; color: #333;">Report Details:</h3>
                <div style="white-space: pre-wrap; line-height: 1.8;">${reportContent}</div>
              </div>
              
              <p style="margin-top: 30px; color: #666; font-size: 14px;">
                This report has been reviewed and approved by the administration team. 
                If you have any questions or concerns, please don't hesitate to contact us.
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

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true,
      emailResponse 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-report-email function:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);