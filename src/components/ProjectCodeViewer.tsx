import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink, Github, Code, Check } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

interface ProjectCodeViewerProps {
  project: {
    id: string;
    title: string;
    description: string;
    link?: string;
    file_path?: string;
    code_content?: string | null;
    editor_type?: string | null;
    grade?: number | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPushToGithub?: (project: any) => void;
}

export function ProjectCodeViewer({ project, open, onOpenChange, onPushToGithub }: ProjectCodeViewerProps) {
  const [codeContent, setCodeContent] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (project?.code_content) {
      setCodeContent(project.code_content);
    } else {
      setCodeContent("");
    }
  }, [project]);

  const handleCopyCode = async () => {
    const textToCopy = codeContent || project?.code_content || "";
    if (!textToCopy) {
      toast({
        title: "No code available",
        description: "There is no code content to copy for this project.",
        variant: "destructive",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
    if (onPushToGithub && project) {
      onPushToGithub(project);
    } else {
      toast({
        title: "GitHub Push",
        description: "Opening GitHub publisher...",
      });
    }
  };

  const handleViewExternal = () => {
    if (project?.link) {
      window.open(project.link, '_blank');
    }
  };

  if (!project) return null;

  const displayCode = codeContent || project.code_content || (
    project.file_path 
      ? `// Project file: ${project.file_path}\n// File code preview stored in cloud storage`
      : "// No code content was submitted for this project."
  );

  const langTag = project.editor_type?.replace("monaco_", "") || "code";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-6">
        <DialogHeader className="shrink-0 pb-2">
          <DialogTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Code className="w-5 h-5 text-primary" />
              <span className="text-xl font-bold">{project.title}</span>
              <Badge variant="outline" className="uppercase text-[10px] tracking-wider font-bold">
                {langTag}
              </Badge>
              {project.grade !== null && project.grade !== undefined && (
                <Badge className="bg-emerald-600 text-white text-xs">
                  Grade: {project.grade}%
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {project.link && (
                <Button variant="outline" size="sm" onClick={handleViewExternal}>
                  <ExternalLink className="w-4 h-4 mr-1.5" />
                  View Project
                </Button>
              )}
              <Button 
                size="sm" 
                onClick={handlePushToGitHub}
                className="bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 gap-1.5 font-medium shadow-sm"
              >
                <Github className="w-4 h-4" />
                Push to GitHub
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 flex-1 overflow-hidden flex flex-col pt-1">
          {project.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {project.description}
            </p>
          )}

          <div className="relative flex-1 rounded-xl border border-border bg-slate-950 text-slate-100 flex flex-col overflow-hidden shadow-inner">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs text-slate-400">
              <span className="font-mono">{project.file_path || `${project.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.${langTag === 'python' ? 'py' : langTag === 'monaco_js' || langTag === 'javascript' ? 'js' : 'html'}`}</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleCopyCode}
                className="h-7 px-2.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800"
              >
                {copied ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                {copied ? "Copied" : "Copy Code"}
              </Button>
            </div>
            
            <div className="p-4 overflow-y-auto font-mono text-xs leading-relaxed flex-1 select-text">
              <pre className="whitespace-pre-wrap break-words">
                <code>{displayCode}</code>
              </pre>
            </div>
          </div>

          {project.link && (
            <div className="text-xs text-muted-foreground pt-1 flex items-center gap-1.5">
              <span>External link:</span>
              <a href={project.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-mono">
                {project.link}
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
