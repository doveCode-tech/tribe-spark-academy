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

interface SendCertificateRequest {
  certificateId: string;
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
    const { certificateId, adminId }: SendCertificateRequest = await req.json();

    console.log(`Processing certificate ${certificateId}`);

    if (!certificateId || !adminId) {
      throw new Error("Missing required fields: certificateId and adminId");
    }

    // Fetch certificate data
    const { data: certificate, error: certError } = await supabase
      .from("certificates")
      .select("*, student:users!certificates_student_id_fkey(first_name, last_name, parent_email)")
      .eq("id", certificateId)
      .single();

    if (certError || !certificate) {
      throw new Error("Certificate not found");
    }

    const parentEmail = certificate.student?.parent_email;
    if (!parentEmail) {
      await supabase.from("audit_logs").insert({
        action_type: "send_certificate_to_parent",
        performed_by: adminId,
        target_id: certificateId,
        target_type: "certificate",
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

    // Fetch admin assets
    const { data: adminAssets } = await supabase
      .from("admin_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["founder_signature_url", "company_logo_url"]);

    let logoBase64: string | null = null;
    let signatureBase64: string | null = null;

    if (adminAssets) {
      for (const asset of adminAssets) {
        const url = asset.setting_value?.url;
        if (url) {
          if (asset.setting_key === "company_logo_url") {
            logoBase64 = await fetchImageAsBase64(url);
          } else if (asset.setting_key === "founder_signature_url") {
            signatureBase64 = await fetchImageAsBase64(url);
          }
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

    const docDefinition = {
      pageOrientation: 'landscape' as const,
      content: [
        logoBase64 ? {
          image: logoBase64,
          width: 100,
          alignment: 'center',
          margin: [0, 20, 0, 20]
        } : {
          text: 'STEMTribe LMS',
          style: 'logo',
          alignment: 'center',
          margin: [0, 40, 0, 20]
        },
        {
          text: 'Certificate of Completion',
          style: 'title',
          alignment: 'center',
          margin: [0, 0, 0, 40]
        },
        {
          text: 'This certifies that',
          style: 'subtitle',
          alignment: 'center',
          margin: [0, 0, 0, 20]
        },
        {
          text: certificate.student_name,
          style: 'studentName',
          alignment: 'center',
          margin: [0, 0, 0, 30]
        },
        {
          text: 'has successfully completed',
          style: 'subtitle',
          alignment: 'center',
          margin: [0, 0, 0, 20]
        },
        {
          text: certificate.course_title,
          style: 'courseName',
          alignment: 'center',
          margin: [0, 0, 0, 40]
        },
        {
          columns: [
            {
              width: '*',
              stack: [
                {
                  text: new Date(certificate.completion_date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  }),
                  alignment: 'center',
                  margin: [0, 0, 0, 5]
                },
                {
                  canvas: [{ type: 'line', x1: 0, y1: 0, x2: 150, y2: 0, lineWidth: 1 }],
                  alignment: 'center',
                  margin: [0, 0, 0, 5]
                },
                {
                  text: 'Date',
                  style: 'label',
                  alignment: 'center'
                }
              ]
            },
            { width: 100, text: '' },
            {
              width: '*',
              stack: [
                signatureBase64 ? {
                  image: signatureBase64,
                  width: 120,
                  height: 50,
                  alignment: 'center',
                  margin: [0, -10, 0, 5]
                } : {
                  text: certificate.founder_name || 'STEMTribe Founder',
                  alignment: 'center',
                  margin: [0, 0, 0, 5]
                },
                {
                  canvas: [{ type: 'line', x1: 0, y1: 0, x2: 150, y2: 0, lineWidth: 1 }],
                  alignment: 'center',
                  margin: [0, 0, 0, 5]
                },
                {
                  text: 'Authorized Signature',
                  style: 'label',
                  alignment: 'center'
                }
              ]
            }
          ],
          margin: [100, 60, 100, 40]
        },
        {
          text: `Certificate ID: ${certificate.id.slice(0, 8).toUpperCase()}`,
          style: 'certificateId',
          alignment: 'center',
          margin: [0, 20, 0, 0]
        }
      ],
      styles: {
        logo: {
          fontSize: 24,
          bold: true,
          color: '#5B21B6'
        },
        title: {
          fontSize: 36,
          bold: true,
          color: '#6366F1'
        },
        subtitle: {
          fontSize: 14,
          color: '#666'
        },
        studentName: {
          fontSize: 28,
          bold: true,
          color: '#000'
        },
        courseName: {
          fontSize: 22,
          bold: true,
          color: '#5B21B6'
        },
        label: {
          fontSize: 10,
          color: '#666'
        },
        certificateId: {
          fontSize: 9,
          color: '#999'
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

    // Send email
    const emailResponse = await resend.emails.send({
      from: "STEMTribe LMS <onboarding@resend.dev>",
      to: [parentEmail],
      subject: `Certificate of Completion for ${certificate.student_name}`,
      html: `
        <h2>Certificate of Completion</h2>
        <p>Congratulations! ${certificate.student_name} has successfully completed ${certificate.course_title}.</p>
        <p>Please find the official certificate attached to this email.</p>
        <br>
        <p>Best regards,<br>STEMTribe LMS Team</p>
      `,
      attachments: [
        {
          filename: `${certificate.student_name}_Certificate_${certificate.course_title.replace(/\s+/g, '_')}.pdf`,
          content: pdfBase64,
        }
      ],
    });

    console.log("Certificate email sent successfully:", emailResponse);

    // Create audit logs
    await supabase.from("audit_logs").insert([
      {
        action_type: "send_certificate_to_parent",
        performed_by: adminId,
        target_id: certificateId,
        target_type: "certificate",
        status: "success",
        details: {
          certificate_id: certificateId,
          student_id: certificate.student_id,
          parent_email: parentEmail,
          email_id: emailResponse.id,
        },
      },
      {
        action_type: "email_sent",
        performed_by: adminId,
        target_id: certificateId,
        target_type: "certificate",
        status: "success",
        details: {
          email_type: "certificate_to_parent",
          recipient_email: parentEmail,
          email_id: emailResponse.id,
        },
      },
    ]);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Certificate successfully sent to parent at ${parentEmail}`,
        emailResponse,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-certificate-email function:", error);

    try {
      const { certificateId, adminId } = await req.json();
      if (certificateId && adminId) {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );
        await supabase.from("audit_logs").insert({
          action_type: "send_certificate_to_parent",
          performed_by: adminId,
          target_id: certificateId,
          target_type: "certificate",
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
