import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendTutorNotificationRequest {
  tutorEmail: string;
  tutorName: string;
  reportTitle: string;
  status: 'approved' | 'rejected';
  reviewerComments?: string;
  studentName: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      tutorEmail,
      tutorName,
      reportTitle,
      status,
      reviewerComments,
      studentName
    }: SendTutorNotificationRequest = await req.json();

    console.log(`Sending ${status} notification to tutor ${tutorEmail}`);

    if (!tutorEmail || !tutorName || !reportTitle || !status || !studentName) {
      throw new Error("Missing required fields");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(tutorEmail)) {
      throw new Error("Invalid email address");
    }

    const isApproved = status === 'approved';
    const statusColor = isApproved ? '#10B981' : '#EF4444';
    const statusText = isApproved ? 'Approved' : 'Rejected';
    const statusIcon = isApproved ? '✅' : '❌';

    const emailResponse = await resend.emails.send({
      from: "STEMTribe LMS <onboarding@resend.dev>",
      to: [tutorEmail],
      subject: `Report ${statusText}: ${reportTitle}`,
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
              .status-badge {
                background: ${statusColor};
                color: white;
                padding: 8px 16px;
                border-radius: 20px;
                display: inline-block;
                font-weight: 600;
                margin: 20px 0;
              }
              .info-box {
                background: #f9f9f9;
                border-left: 4px solid ${statusColor};
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
            </style>
          </head>
          <body>
            <div class="header">
              <h1 style="margin: 0; font-size: 28px;">📚 STEMTribe LMS</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Report Status Update</p>
            </div>
            
            <div class="content">
              <h2 style="color: #5B21B6; margin-top: 0;">Hello ${tutorName},</h2>
              
              <p>Your report has been reviewed by the administration team.</p>
              
              <div style="text-align: center;">
                <span class="status-badge">${statusIcon} ${statusText}</span>
              </div>
              
              <div class="info-box">
                <div class="info-item">
                  <span class="info-label">Report Title:</span>
                  <span>${reportTitle}</span>
                </div>
                
                <div class="info-item">
                  <span class="info-label">Student:</span>
                  <span>${studentName}</span>
                </div>
                
                <div class="info-item">
                  <span class="info-label">Status:</span>
                  <span style="color: ${statusColor}; font-weight: 600;">${statusText}</span>
                </div>
                
                <div class="info-item">
                  <span class="info-label">Date:</span>
                  <span>${new Date().toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}</span>
                </div>
              </div>
              
              ${reviewerComments ? `
              <div style="background: #f0f9ff; border-left: 4px solid #3B82F6; padding: 20px; margin: 20px 0; border-radius: 4px;">
                <h3 style="margin-top: 0; color: #1E40AF;">Reviewer Comments:</h3>
                <div style="white-space: pre-wrap; line-height: 1.8; color: #1E3A8A;">${reviewerComments}</div>
              </div>
              ` : ''}
              
              ${isApproved ? `
              <p style="margin-top: 30px; color: #10B981; font-weight: 500;">
                ✅ Your report has been approved and can now be sent to the student's parent/guardian.
              </p>
              ` : `
              <p style="margin-top: 30px; color: #EF4444; font-weight: 500;">
                ℹ️ Your report was not approved. Please review the comments above and make necessary revisions before resubmitting.
              </p>
              `}
              
              <p style="margin-top: 20px; color: #666; font-size: 14px;">
                Log in to your dashboard to view the full details and take any necessary actions.
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

    console.log("Tutor notification email sent successfully:", emailResponse);

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
    console.error("Error in send-tutor-notification function:", error);
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
