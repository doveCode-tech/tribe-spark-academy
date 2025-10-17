import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";
import PdfPrinter from "npm:pdfmake@0.2.10";
import { TFontDictionary } from "npm:pdfmake@0.2.10/interfaces.d.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendPortfolioRequest {
  studentId: string;
  adminId: string;
}

// Helper function to fetch image and convert to base64
async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return `data:${response.headers.get('content-type')};base64,${btoa(binary)}`;
  } catch (error) {
    console.error('Error fetching image:', error);
    return null;
  }
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
    const { studentId, adminId }: SendPortfolioRequest = await req.json();

    console.log(`Processing portfolio for student ${studentId}`);

    if (!studentId || !adminId) {
      throw new Error("Missing required fields: studentId and adminId");
    }

    // Fetch student data
    const { data: student, error: studentError } = await supabase
      .from("users")
      .select("first_name, last_name, name, email, parent_email, avatar_url")
      .eq("auth_user_id", studentId)
      .single();

    if (studentError || !student) {
      throw new Error("Student not found");
    }

    const parentEmail = student.parent_email;
    if (!parentEmail) {
      await supabase.from("audit_logs").insert({
        action_type: "send_portfolio_to_parent",
        performed_by: adminId,
        target_id: studentId,
        target_type: "portfolio",
        status: "failed",
        error_message: "Parent email not found for student",
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Parent email not found for this student.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const studentName = student.first_name
      ? `${student.first_name} ${student.last_name || ''}`.trim()
      : student.name || student.email;

    // Fetch portfolio data
    const { data: projects } = await supabase
      .from("projects")
      .select("*, course:courses(title)")
      .eq("student_id", studentId)
      .order("submitted_at", { ascending: false });

    const { data: badges } = await supabase
      .from("student_badges")
      .select("*, badge:badges(*)")
      .eq("student_id", studentId);

    const { data: enrollments } = await supabase
      .from("enrollments")
      .select("*")
      .eq("student_id", studentId);

    // Fetch admin assets
    const { data: adminAssets } = await supabase
      .from("admin_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["company_logo_url"]);

    let logoBase64: string | null = null;

    if (adminAssets) {
      for (const asset of adminAssets) {
        const url = asset.setting_value?.url;
        if (url && asset.setting_key === "company_logo_url") {
          logoBase64 = await fetchImageAsBase64(url);
        }
      }
    }

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

    const projectsContent = projects && projects.length > 0
      ? projects.map((p: any) => [
          { text: p.title, bold: true, margin: [0, 10, 0, 5] },
          { text: p.course?.title || 'General', color: '#666', margin: [0, 0, 0, 5] },
          { text: p.description || 'No description', margin: [0, 0, 0, 10] },
        ]).flat()
      : [{ text: 'No projects yet', color: '#999', italics: true }];

    const badgesContent = badges && badges.length > 0
      ? badges.map((b: any) => ({
          text: `• ${b.badge?.name || 'Badge'} - ${b.badge?.description || ''}`,
          margin: [0, 5, 0, 0]
        }))
      : [{ text: 'No badges yet', color: '#999', italics: true }];

    const docDefinition = {
      content: [
        logoBase64 ? {
          image: logoBase64,
          width: 80,
          alignment: 'center',
          margin: [0, 0, 0, 10]
        } : {
          text: 'STEMTribe LMS',
          style: 'header',
          alignment: 'center',
          margin: [0, 0, 0, 10]
        },
        {
          text: 'Student Portfolio',
          style: 'subheader',
          alignment: 'center',
          margin: [0, 0, 0, 30]
        },
        {
          text: studentName,
          style: 'studentName',
          alignment: 'center',
          margin: [0, 0, 0, 5]
        },
        {
          text: student.email,
          style: 'studentEmail',
          alignment: 'center',
          margin: [0, 0, 0, 30]
        },
        {
          columns: [
            { text: 'Total Courses:', bold: true, width: 150 },
            { text: enrollments?.length || 0, width: '*' }
          ],
          margin: [0, 5, 0, 5]
        },
        {
          columns: [
            { text: 'Total Projects:', bold: true, width: 150 },
            { text: projects?.length || 0, width: '*' }
          ],
          margin: [0, 5, 0, 5]
        },
        {
          columns: [
            { text: 'Badges Earned:', bold: true, width: 150 },
            { text: badges?.length || 0, width: '*' }
          ],
          margin: [0, 5, 0, 20]
        },
        {
          text: 'Projects',
          style: 'sectionTitle',
          margin: [0, 20, 0, 10]
        },
        ...projectsContent,
        {
          text: 'Badges',
          style: 'sectionTitle',
          margin: [0, 30, 0, 10]
        },
        ...badgesContent,
        {
          text: `Generated on ${new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}`,
          style: 'footer',
          alignment: 'center',
          margin: [0, 40, 0, 10]
        },
        {
          text: '© STEMTribe LMS',
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
        studentName: {
          fontSize: 20,
          bold: true
        },
        studentEmail: {
          fontSize: 12,
          color: '#666'
        },
        sectionTitle: {
          fontSize: 16,
          bold: true,
          color: '#5B21B6'
        },
        footer: {
          fontSize: 10,
          color: '#666'
        }
      },
      defaultStyle: {
        font: 'Roboto',
        fontSize: 11
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

    // Send email
    const emailResponse = await resend.emails.send({
      from: "STEMTribe LMS <onboarding@resend.dev>",
      to: [parentEmail],
      subject: `${studentName}'s Portfolio - STEMTribe LMS`,
      html: `
        <h2>Student Portfolio</h2>
        <p>Please find attached the portfolio for ${studentName}.</p>
        <p>This portfolio includes their projects, badges, and course progress.</p>
        <br>
        <p>Best regards,<br>STEMTribe LMS Team</p>
      `,
      attachments: [
        {
          filename: `${studentName}_Portfolio_${new Date().toISOString().split('T')[0]}.pdf`,
          content: pdfBase64,
        }
      ],
    });

    console.log("Portfolio email sent successfully:", emailResponse);

    // Create audit logs
    await supabase.from("audit_logs").insert([
      {
        action_type: "send_portfolio_to_parent",
        performed_by: adminId,
        target_id: studentId,
        target_type: "portfolio",
        status: "success",
        details: {
          student_id: studentId,
          parent_email: parentEmail,
          email_id: emailResponse.id,
        },
      },
      {
        action_type: "email_sent",
        performed_by: adminId,
        target_id: studentId,
        target_type: "portfolio",
        status: "success",
        details: {
          email_type: "portfolio_to_parent",
          recipient_email: parentEmail,
          email_id: emailResponse.id,
        },
      },
    ]);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Portfolio successfully sent to parent at ${parentEmail}`,
        emailResponse,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-portfolio-email function:", error);

    try {
      const { studentId, adminId } = await req.json();
      if (studentId && adminId) {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );
        await supabase.from("audit_logs").insert({
          action_type: "send_portfolio_to_parent",
          performed_by: adminId,
          target_id: studentId,
          target_type: "portfolio",
          status: "failed",
          error_message: error.message,
        });
      }
    } catch (logError) {
      console.error("Failed to create audit log:", logError);
    }

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
