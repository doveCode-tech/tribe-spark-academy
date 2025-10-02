import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Certificate {
  id: string;
  student_name: string;
  course_title: string;
  completion_date: string;
  founder_name: string;
}

interface CertificateViewerProps {
  certificateId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CertificateViewer({ certificateId, open, onOpenChange }: CertificateViewerProps) {
  const [certificate, setCertificate] = useState<Certificate | null>(null);

  useEffect(() => {
    if (certificateId && open) {
      fetchCertificate();
    }
  }, [certificateId, open]);

  const fetchCertificate = async () => {
    if (!certificateId) return;

    const { data } = await supabase
      .from('certificates')
      .select('*')
      .eq('id', certificateId)
      .single();

    if (data) {
      setCertificate(data);
    }
  };

  const handleDownloadPDF = () => {
    // Create a printable version
    window.print();
  };

  if (!certificate) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Certificate of Completion</DialogTitle>
        </DialogHeader>

        <div className="bg-gradient-to-br from-primary/5 via-secondary/5 to-pink/5 p-8 rounded-lg border-4 border-primary/20 print:border-primary">
          <div className="text-center space-y-6">
            {/* Header */}
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-2">Certificate of Completion</h1>
              <p className="text-muted-foreground">This is to certify that</p>
            </div>

            {/* Student Name */}
            <div className="py-4">
              <h2 className="text-5xl font-bold bg-gradient-rainbow bg-clip-text text-transparent">
                {certificate.student_name}
              </h2>
            </div>

            {/* Course Details */}
            <div>
              <p className="text-muted-foreground mb-2">has successfully completed</p>
              <h3 className="text-3xl font-semibold text-foreground">{certificate.course_title}</h3>
            </div>

            {/* Date & Signatures */}
            <div className="flex justify-between items-end pt-8 mt-8 border-t border-border">
              <div className="text-left">
                <p className="text-sm text-muted-foreground mb-1">Completion Date</p>
                <p className="font-semibold">{new Date(certificate.completion_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground mb-1">Authorized by</p>
                <p className="font-semibold">{certificate.founder_name}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end print:hidden">
          <Button variant="outline" onClick={handleDownloadPDF}>
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
          <Button onClick={() => window.open(`/portfolio/certificate/${certificateId}`, '_blank')}>
            <ExternalLink className="w-4 h-4 mr-2" />
            Open in New Tab
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
