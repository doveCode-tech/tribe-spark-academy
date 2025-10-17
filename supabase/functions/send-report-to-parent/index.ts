import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";
import PdfPrinter from "npm:pdfmake@0.2.10";
import { TFontDictionary } from "npm:pdfmake@0.2.10/interfaces.d.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendReportToParentRequest {
  reportId: string;
  adminId: string;
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
    const { reportId, adminId }: SendReportToParentRequest = await req.json();

    console.log(`Processing report ${reportId} for parent email`);

    if (!reportId || !adminId) {
      throw new Error("Missing required fields: reportId and adminId");
    }

    // Fetch report details with student and course info
    const { data: report, error: reportError } = await supabase
      .from("reports")
      .select(`
        *,
        student:users!reports_student_id_fkey(
          first_name,
          last_name,
          parent_email
        ),
        course:courses(title),
        tutor:users!reports_tutor_id_fkey(
          first_name,
          last_name
        )
      `)
      .eq("id", reportId)
      .single();

    if (reportError || !report) {
      console.error("Report not found:", reportError);
      throw new Error("Report not found");
    }

    // Check if report is approved
    if (report.status !== "approved") {
      throw new Error("Only approved reports can be sent to parents");
    }

    // Check if parent email exists
    const parentEmail = report.student?.parent_email;
    if (!parentEmail) {
      console.error("Parent email not found for student");
      
      // Create audit log for failed attempt
      await supabase.from("audit_logs").insert({
        action_type: "send_report_to_parent",
        performed_by: adminId,
        target_id: reportId,
        target_type: "report",
        status: "failed",
        error_message: "Parent email not found for student",
        details: {
          report_id: reportId,
          student_id: report.student_id,
        },
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Parent email not found for this student. Please add a parent email to the student's profile.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    const studentName = `${report.student?.first_name || ''} ${report.student?.last_name || ''}`.trim();
    const tutorName = `${report.tutor?.first_name || ''} ${report.tutor?.last_name || ''}`.trim();
    const courseTitle = report.course?.title || 'Course';

    // Generate PDF
    const fonts: TFontDictionary = {
      Roboto: {
        normal: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Regular.ttf',
        bold: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Medium.ttf',
        italics: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Italic.ttf',
        bolditalics: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-MediumItalic.ttf'
      }
    };

    const printer = new PdfPrinter(fonts);
    
    const docDefinition = {
      content: [
        {
          text: 'STEMTribe LMS',
          style: 'header',
          alignment: 'center',
          margin: [0, 0, 0, 10]
        },
        {
          text: 'Student Progress Report',
          style: 'subheader',
          alignment: 'center',
          margin: [0, 0, 0, 30]
        },
        {
          text: 'Progress Report',
          style: 'reportTitle',
          margin: [0, 0, 0, 20]
        },
        {
          columns: [
            { text: 'Student:', bold: true, width: 100 },
            { text: studentName, width: '*' }
          ],
          margin: [0, 5, 0, 5]
        },
        {
          columns: [
            { text: 'Course:', bold: true, width: 100 },
            { text: courseTitle, width: '*' }
          ],
          margin: [0, 5, 0, 5]
        },
        {
          columns: [
            { text: 'Tutor:', bold: true, width: 100 },
            { text: tutorName, width: '*' }
          ],
          margin: [0, 5, 0, 5]
        },
        {
          columns: [
            { text: 'Report Date:', bold: true, width: 100 },
            { text: new Date(report.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            }), width: '*' }
          ],
          margin: [0, 5, 0, 5]
        },
        report.grade ? {
          columns: [
            { text: 'Grade:', bold: true, width: 100 },
            { text: `${report.grade}%`, width: '*', color: '#10B981', bold: true }
          ],
          margin: [0, 5, 0, 20]
        } : { text: '', margin: [0, 0, 0, 20] },
        {
          text: report.title,
          style: 'sectionTitle',
          margin: [0, 20, 0, 10]
        },
        {
          text: report.content,
          style: 'reportContent',
          margin: [0, 0, 0, 20]
        },
        report.reviewer_comments ? {
          stack: [
            {
              text: 'Admin Review Comments',
              style: 'sectionTitle',
              margin: [0, 20, 0, 10]
            },
            {
              text: report.reviewer_comments,
              style: 'reviewComments',
              margin: [0, 0, 0, 20]
            }
          ]
        } : {},
        {
          text: `© ${new Date().getFullYear()} STEMTribe LMS`,
          style: 'footer',
          alignment: 'center',
          margin: [0, 30, 0, 10]
        },
        {
          text: 'This is an official student progress report.',
          style: 'footer',
          alignment: 'center'
        }
      ],
      styles: {
        header: {
          fontSize: 22,
          bold: true,
          color: '#5B21B6'
        },
        subheader: {
          fontSize: 16,
          color: '#6366F1'
        },
        reportTitle: {
          fontSize: 18,
          bold: true,
          color: '#5B21B6'
        },
        sectionTitle: {
          fontSize: 14,
          bold: true,
          color: '#5B21B6'
        },
        reportContent: {
          fontSize: 11,
          lineHeight: 1.5
        },
        reviewComments: {
          fontSize: 11,
          lineHeight: 1.5,
          background: '#f0f9ff'
        },
        footer: {
          fontSize: 10,
          color: '#666'
        }
      },
      defaultStyle: {
        font: 'Roboto'
      }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition as any);
    const chunks: Uint8Array[] = [];
    
    pdfDoc.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    
    await new Promise<void>((resolve, reject) => {
      pdfDoc.on('end', () => resolve());
      pdfDoc.on('error', reject);
      pdfDoc.end();
    });

    const pdfBuffer = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      pdfBuffer.set(chunk, offset);
      offset += chunk.length;
    }

    const pdfBase64 = btoa(String.fromCharCode(...pdfBuffer));

    // Generate simple HTML email content
    const reportHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #5B21B6 0%, #6366F1 100%);
              color: white;
              padding: 40px;
              border-radius: 10px;
              text-align: center;
              margin-bottom: 30px;
            }
            .header h1 {
              margin: 0;
              font-size: 32px;
            }
            .header p {
              margin: 10px 0 0 0;
              opacity: 0.9;
              font-size: 18px;
            }
            .content {
              background: #ffffff;
              padding: 30px;
              border: 1px solid #e0e0e0;
              border-radius: 10px;
              margin-bottom: 20px;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 150px 1fr;
              gap: 15px;
              margin: 20px 0;
            }
            .info-label {
              font-weight: 600;
              color: #5B21B6;
            }
            .info-value {
              color: #333;
            }
            .section {
              margin: 30px 0;
            }
            .section-title {
              font-size: 20px;
              font-weight: 600;
              color: #5B21B6;
              margin-bottom: 15px;
              padding-bottom: 10px;
              border-bottom: 2px solid #e0e0e0;
            }
            .report-content {
              background: #f9f9f9;
              padding: 20px;
              border-radius: 8px;
              white-space: pre-wrap;
              line-height: 1.8;
            }
            .grade-badge {
              display: inline-block;
              background: #10B981;
              color: white;
              padding: 8px 20px;
              border-radius: 20px;
              font-weight: 600;
              font-size: 18px;
            }
            .footer {
              background: #f5f5f5;
              padding: 20px;
              text-align: center;
              font-size: 12px;
              color: #666;
              border-radius: 10px;
              margin-top: 30px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>📚 STEMTribe LMS</h1>
            <p>Student Progress Report</p>
          </div>
          
          <div class="content">
            <h2 style="color: #5B21B6; margin-top: 0;">Progress Report</h2>
            
            <div class="info-grid">
              <div class="info-label">Student:</div>
              <div class="info-value">${studentName}</div>
              
              <div class="info-label">Course:</div>
              <div class="info-value">${courseTitle}</div>
              
              <div class="info-label">Tutor:</div>
              <div class="info-value">${tutorName}</div>
              
              <div class="info-label">Report Date:</div>
              <div class="info-value">${new Date(report.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}</div>
              
              ${report.grade ? `
              <div class="info-label">Grade:</div>
              <div class="info-value"><span class="grade-badge">${report.grade}</span></div>
              ` : ''}
            </div>
            
            <div class="section">
              <div class="section-title">${report.title}</div>
              <div class="report-content">${report.content}</div>
            </div>
            
            ${report.reviewer_comments ? `
            <div class="section">
              <div class="section-title">Admin Review Comments</div>
              <div class="report-content" style="background: #f0f9ff; border-left: 4px solid #3B82F6;">
                ${report.reviewer_comments}
              </div>
            </div>
            ` : ''}
          </div>
          
          <div class="footer">
            <p style="margin: 5px 0;"><strong>© ${new Date().getFullYear()} STEMTribe LMS</strong></p>
            <p style="margin: 5px 0;">This is an official student progress report.</p>
            <p style="margin: 5px 0;">For questions, please contact your student's tutor.</p>
          </div>
        </body>
      </html>
    `;

    // Send email with PDF attachment
    const emailResponse = await resend.emails.send({
      from: "STEMTribe LMS <onboarding@resend.dev>",
      to: [parentEmail],
      subject: `Progress Report for ${studentName} - ${courseTitle}`,
      html: reportHtml,
      attachments: [
        {
          filename: `${studentName}_Report_${new Date().toISOString().split('T')[0]}.pdf`,
          content: pdfBase64,
        }
      ],
    });

    console.log("Report email sent successfully:", emailResponse);

    // Create audit logs for successful send
    await supabase.from("audit_logs").insert([
      {
        action_type: "send_report_to_parent",
        performed_by: adminId,
        target_id: reportId,
        target_type: "report",
        status: "success",
        details: {
          report_id: reportId,
          student_id: report.student_id,
          parent_email: parentEmail,
          email_id: emailResponse.id,
        },
      },
      {
        action_type: "email_sent",
        performed_by: adminId,
        target_id: reportId,
        target_type: "report",
        status: "success",
        details: {
          email_type: "report_to_parent",
          recipient_email: parentEmail,
          email_id: emailResponse.id,
          report_title: report.title,
        },
      },
    ]);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Report successfully sent to parent at ${parentEmail}`,
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
    console.error("Error in send-report-to-parent function:", error);

    // Try to create audit log for error
    try {
      const { reportId, adminId } = await req.json();
      if (reportId && adminId) {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );
        await supabase.from("audit_logs").insert({
          action_type: "send_report_to_parent",
          performed_by: adminId,
          target_id: reportId,
          target_type: "report",
          status: "failed",
          error_message: error.message,
        });
      }
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
