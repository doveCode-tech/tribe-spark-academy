import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink, Github } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface ProjectCodeViewerProps {
  project: {
    id: string;
    title: string;
    description: string;
    link?: string;
    file_path?: string;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectCodeViewer({ project, open, onOpenChange }: ProjectCodeViewerProps) {
  const [codeContent, setCodeContent] = useState<string>("");
  const { toast } = useToast();

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(codeContent || "No code available");
      toast({
        title: "Code copied!",
        description: "Code has been copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Please copy the code manually",
        variant: "destructive",
      });
    }
  };

  const handlePushToGitHub = () => {
    toast({
      title: "GitHub Integration",
      description: "GitHub push functionality will be available soon!",
    });
  };

  const handleViewExternal = () => {
    if (project?.link) {
      window.open(project.link, '_blank');
    }
  };

  if (!project) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{project.title}</span>
            <div className="flex gap-2">
              {project.link && (
                <Button variant="outline" size="sm" onClick={handleViewExternal}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View Project
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handlePushToGitHub}>
                <Github className="w-4 h-4 mr-2" />
                Push to GitHub
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">{project.description}</p>
          </div>

          <div className="relative">
            <div className="absolute top-2 right-2 z-10">
              <Button variant="outline" size="sm" onClick={handleCopyCode}>
                <Copy className="w-4 h-4 mr-2" />
                Copy Code
              </Button>
            </div>
            
            <div className="bg-muted p-4 rounded-lg max-h-[400px] overflow-y-auto">
              <pre className="text-sm">
                <code>
                  {project.file_path ? (
                    `// Project code location: ${project.file_path}\n// Code preview will be available here`
                  ) : (
                    "No code file available for this project"
                  )}
                </code>
              </pre>
            </div>
          </div>

          {project.link && (
            <div className="text-sm text-muted-foreground">
              External Project Link: <a href={project.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{project.link}</a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
