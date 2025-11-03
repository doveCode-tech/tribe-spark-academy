import { forwardRef, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award, Calendar, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface CertificateData {
  id: string;
  student_name: string;
  course_title: string;
  completion_date: string;
  founder_name: string;
}

interface CertificateGeneratorProps {
  certificate: CertificateData;
  className?: string;
}

export const CertificateGenerator = forwardRef<HTMLDivElement, CertificateGeneratorProps>(
  ({ certificate, className = "" }, ref) => {
    const [logoUrl, setLogoUrl] = useState<string>("");
    const [signatureUrl, setSignatureUrl] = useState<string>("");

    useEffect(() => {
      const loadAssets = async () => {
        const { data } = await supabase
          .from("admin_settings")
          .select("setting_key, setting_value")
          .in("setting_key", ["founder_signature_url", "company_logo_url"]);

        if (data) {
          data.forEach((setting) => {
            const value = setting.setting_value as any;
            if (setting.setting_key === "company_logo_url" && value?.url) {
              setLogoUrl(value.url);
            } else if (setting.setting_key === "founder_signature_url" && value?.url) {
              setSignatureUrl(value.url);
            }
          });
        }
      };
      loadAssets();
    }, []);

    return (
      <div 
        ref={ref}
        className={`w-full max-w-4xl mx-auto bg-gradient-to-br from-primary/5 via-background to-secondary/5 ${className}`}
      >
        <Card className="p-12 border-2 border-primary/20 shadow-2xl relative overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute top-10 left-10 w-20 h-20 border-2 border-primary rotate-45"></div>
            <div className="absolute top-10 right-10 w-16 h-16 border-2 border-secondary rotate-12"></div>
            <div className="absolute bottom-10 left-20 w-12 h-12 border-2 border-accent rotate-45"></div>
            <div className="absolute bottom-10 right-20 w-14 h-14 border-2 border-primary rotate-12"></div>
          </div>

          {/* Header */}
          <div className="text-center mb-8 relative z-10">
            <div className="flex justify-center mb-4">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-20 h-20 object-contain" />
              ) : (
                <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center">
                  <Award className="w-8 h-8 text-primary-foreground" />
                </div>
              )}
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2">
              Certificate of Completion
            </h1>
            <div className="w-24 h-1 bg-gradient-to-r from-primary to-secondary mx-auto"></div>
          </div>

          {/* Main Content */}
          <div className="text-center space-y-8 relative z-10">
            <div className="space-y-4">
              <p className="text-lg text-muted-foreground">This is to certify that</p>
              <div className="relative">
                <h2 className="text-3xl font-bold text-foreground border-b-2 border-primary/30 pb-2 inline-block">
                  {certificate.student_name}
                </h2>
                <User className="absolute -left-8 top-1/2 transform -translate-y-1/2 w-5 h-5 text-primary" />
              </div>
              <p className="text-lg text-muted-foreground">has successfully completed the course</p>
              <div className="bg-gradient-to-r from-primary/10 to-secondary/10 p-6 rounded-lg border border-primary/20">
                <h3 className="text-2xl font-semibold text-primary">
                  {certificate.course_title}
                </h3>
              </div>
            </div>

            {/* Date and Signature */}
            <div className="flex justify-between items-end pt-8">
              <div className="text-left">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Date of Completion</span>
                </div>
                <div className="text-lg font-semibold border-b border-muted pb-1">
                  {new Date(certificate.completion_date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm text-muted-foreground mb-2">Authorized by</div>
                {signatureUrl ? (
                  <img src={signatureUrl} alt="Signature" className="h-12 mb-1 ml-auto" />
                ) : (
                  <div className="text-lg font-semibold border-b border-muted pb-1">
                    {certificate.founder_name}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-1">
                  {certificate.founder_name}
                </div>
                <div className="text-xs text-muted-foreground">STEMTribe Founder</div>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-6 border-t border-muted">
              <div className="flex justify-center items-center gap-4">
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                  Certificate ID: {certificate.id.slice(0, 8).toUpperCase()}
                </Badge>
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <span className="text-sm text-muted-foreground">STEMTribe Learning Management System</span>
              </div>
            </div>
          </div>

          {/* Corner Decorations */}
          <div className="absolute top-0 left-0 w-20 h-20 border-l-4 border-t-4 border-primary/30"></div>
          <div className="absolute top-0 right-0 w-20 h-20 border-r-4 border-t-4 border-primary/30"></div>
          <div className="absolute bottom-0 left-0 w-20 h-20 border-l-4 border-b-4 border-primary/30"></div>
          <div className="absolute bottom-0 right-0 w-20 h-20 border-r-4 border-b-4 border-primary/30"></div>
        </Card>
      </div>
    );
  }
);

CertificateGenerator.displayName = "CertificateGenerator";