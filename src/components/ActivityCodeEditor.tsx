import { useState, useRef, useCallback } from "react";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save, Send, Play, ExternalLink, ChevronLeft, ChevronRight, Maximize2, Minimize2, Code2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export type EditorType = "monaco_html" | "monaco_js" | "monaco_python" | "monaco_css" | "scratch" | "external" | "none";

export interface Exercise {
  id?: string;
  title: string;
  description?: string;
  instructions?: string;
  editor_type?: EditorType;
  external_url?: string;
  starter_code?: string;
  is_assignment?: boolean;
}

interface ActivityCodeEditorProps {
  exercise: Exercise;
  lessonId: string;
  courseId: string;
  isAssignment?: boolean; // override from lesson level
}

const LANGUAGE_MAP: Record<string, string> = {
  monaco_html: "html",
  monaco_js: "javascript",
  monaco_python: "python",
  monaco_css: "css",
};

const EDITOR_LABEL: Record<string, string> = {
  monaco_html: "HTML",
  monaco_js: "JavaScript",
  monaco_python: "Python",
  monaco_css: "CSS",
};

const DEFAULT_CODE: Record<string, string> = {
  monaco_html: `<!DOCTYPE html>\n<html>\n  <head>\n    <title>My Project</title>\n  </head>\n  <body>\n    <!-- Write your HTML here -->\n  </body>\n</html>`,
  monaco_js: `// Write your JavaScript here\n\nconsole.log("Hello, World!");`,
  monaco_python: `# Write your Python here\n\nprint("Hello, World!")`,
  monaco_css: `/* Write your CSS here */\n\nbody {\n  font-family: sans-serif;\n}`,
};

export function ActivityCodeEditor({ exercise, lessonId, courseId, isAssignment }: ActivityCodeEditorProps) {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const editorType = exercise.editor_type || "none";
  const isAssignmentActivity = isAssignment ?? exercise.is_assignment ?? false;

  const storageKey = `code_${lessonId}_${exercise.title?.slice(0, 20).replace(/\s/g, "_")}`;
  const savedCode = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
  const [code, setCode] = useState(savedCode || exercise.starter_code || DEFAULT_CODE[editorType] || "");
  const [instructionsOpen, setInstructionsOpen] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const language = LANGUAGE_MAP[editorType] || "plaintext";
  const label = EDITOR_LABEL[editorType] || editorType;

  // ── Save to localStorage ─────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    localStorage.setItem(storageKey, code);
    setSaving(true);
    setTimeout(() => setSaving(false), 1000);
    toast({ title: "Saved", description: "Your code has been saved locally." });
  }, [code, storageKey, toast]);

  // ── Submit (assignment only) ─────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("projects").upsert({
        course_id: courseId,
        lesson_id: lessonId,
        student_id: userProfile?.auth_user_id,
        title: exercise.title || "Code Submission",
        description: exercise.description || null,
        code_content: code,
        editor_type: editorType,
        review_status: "submitted",
        submitted_at: new Date().toISOString(),
      }, { onConflict: "course_id,lesson_id,student_id" });

      if (error) throw error;
      toast({ title: "🚀 Submitted!", description: "Your code has been submitted for grading." });
      localStorage.removeItem(storageKey);
    } catch (err: any) {
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Run HTML/JS in sandboxed iframe ──────────────────────────────────────────
  const handleRun = () => {
    if (!iframeRef.current) return;
    const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
    if (!doc) return;
    if (editorType === "monaco_html") {
      doc.open();
      doc.write(code);
      doc.close();
    } else if (editorType === "monaco_js") {
      doc.open();
      doc.write(`<script>
        const origLog = console.log;
        const logs = [];
        console.log = (...a) => { logs.push(a.map(x => String(x)).join(' ')); origLog(...a); };
        try { ${code} } catch(e) { logs.push('Error: ' + e.message); }
        document.body.innerHTML = '<pre style="font-family:monospace;padding:12px">' + logs.join('\\n') + '</pre>';
      <\/script>`);
      doc.close();
    }
    setOutput("running");
  };

  const canRun = editorType === "monaco_html" || editorType === "monaco_js";

  // ── Scratch embed ─────────────────────────────────────────────────────────────
  if (editorType === "scratch") {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800 p-3 text-sm text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>This project is graded and requires submission using the Submit button.</span>
        </div>

        {exercise.instructions && (
          <div className="rounded-lg border p-4 bg-muted/30 text-sm space-y-1">
            <p className="font-semibold text-sm">Instructions</p>
            <p className="whitespace-pre-wrap">{exercise.instructions}</p>
          </div>
        )}

        <div className="rounded-lg overflow-hidden border" style={{ height: 520 }}>
          <iframe
            src="https://scratch.mit.edu/projects/editor/"
            title="Scratch Editor"
            className="w-full h-full"
            allow="microphone; camera"
          />
        </div>

        <div className="flex gap-2 justify-end">
          <Button onClick={handleSave} variant="outline" disabled={saving}>
            <Save className="w-4 h-4 mr-1.5" />
            {saving ? "Saved!" : "Save"}
          </Button>
          {isAssignmentActivity && (
            <Button onClick={handleSubmit} disabled={submitting} className="bg-orange-500 hover:bg-orange-600 text-white">
              <Send className="w-4 h-4 mr-1.5" />
              {submitting ? "Submitting..." : "Submit"}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── External editor (Roblox, App Dev, etc.) ───────────────────────────────────
  if (editorType === "external") {
    return (
      <div className="space-y-4">
        {isAssignmentActivity && (
          <div className="rounded-lg border bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800 p-3 text-sm text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>This project is graded and requires submission below.</span>
          </div>
        )}

        {exercise.instructions && (
          <div className="rounded-lg border p-4 bg-muted/30 text-sm space-y-1">
            <p className="font-semibold">Instructions</p>
            <p className="whitespace-pre-wrap">{exercise.instructions}</p>
          </div>
        )}

        {exercise.external_url && (
          <Button asChild className="w-full" variant="outline">
            <a href={exercise.external_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-2" />
              Open Editor
            </a>
          </Button>
        )}

        {isAssignmentActivity && (
          <div className="space-y-3 border rounded-lg p-4 bg-muted/20">
            <p className="text-sm font-semibold">Submit your project link</p>
            <input
              type="url"
              placeholder="Paste your project link here (GitHub, Scratch, Roblox, etc.)"
              className="w-full rounded-md border px-3 py-2 text-sm bg-background"
              id={`link-${lessonId}`}
            />
            <Button
              onClick={async () => {
                const input = document.getElementById(`link-${lessonId}`) as HTMLInputElement;
                const link = input?.value?.trim();
                if (!link) return toast({ title: "Please enter a link", variant: "destructive" });
                setSubmitting(true);
                try {
                  const { error } = await supabase.from("projects").upsert({
                    course_id: courseId,
                    lesson_id: lessonId,
                    student_id: userProfile?.auth_user_id,
                    title: exercise.title || "Project Submission",
                    link,
                    editor_type: editorType,
                    review_status: "submitted",
                    submitted_at: new Date().toISOString(),
                  }, { onConflict: "course_id,lesson_id,student_id" });
                  if (error) throw error;
                  toast({ title: "🚀 Submitted!", description: "Your project link has been submitted for grading." });
                } catch (err: any) {
                  toast({ title: "Submission failed", description: err.message, variant: "destructive" });
                } finally {
                  setSubmitting(false);
                }
              }}
              disabled={submitting}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              <Send className="w-4 h-4 mr-1.5" />
              {submitting ? "Submitting..." : "Submit Project"}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ── Monaco split-pane editor (HTML / JS / Python / CSS) ──────────────────────
  if (editorType === "none") {
    // Text/link submission only
    return (
      <div className="space-y-4">
        {exercise.instructions && (
          <div className="rounded-lg border p-4 bg-muted/30 text-sm whitespace-pre-wrap">
            {exercise.instructions}
          </div>
        )}
        {isAssignmentActivity && (
          <div className="space-y-3 border rounded-lg p-4 bg-muted/20">
            <p className="text-sm font-semibold">Submit your work</p>
            <input type="url" placeholder="Paste a link to your project..." className="w-full rounded-md border px-3 py-2 text-sm bg-background" id={`link-none-${lessonId}`} />
            <Button onClick={async () => {
              const input = document.getElementById(`link-none-${lessonId}`) as HTMLInputElement;
              const link = input?.value?.trim();
              if (!link) return toast({ title: "Please enter a link", variant: "destructive" });
              setSubmitting(true);
              try {
                await supabase.from("projects").upsert({ course_id: courseId, lesson_id: lessonId, student_id: userProfile?.auth_user_id, title: exercise.title, link, review_status: "submitted", submitted_at: new Date().toISOString() }, { onConflict: "course_id,lesson_id,student_id" });
                toast({ title: "Submitted!" });
              } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
              finally { setSubmitting(false); }
            }} disabled={submitting} className="bg-orange-500 hover:bg-orange-600 text-white">
              <Send className="w-4 h-4 mr-1.5" />{submitting ? "Submitting..." : "Submit"}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Monaco editor layout
  const editorHeight = fullscreen ? "calc(100vh - 120px)" : "420px";

  return (
    <div className={`space-y-2 ${fullscreen ? "fixed inset-0 z-50 bg-background p-4 overflow-auto" : ""}`}>
      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {isAssignmentActivity && (
            <div className="text-xs text-red-600 font-medium bg-red-50 border border-red-200 rounded px-2 py-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              This project is graded — requires submission
            </div>
          )}
          <Badge variant="outline" className="flex items-center gap-1">
            <Code2 className="w-3 h-3" />
            {label}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5">
          {canRun && (
            <Button size="sm" variant="outline" onClick={handleRun} className="h-8 text-xs gap-1">
              <Play className="w-3 h-3 text-green-600" />
              Run
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={handleSave} className="h-8 text-xs gap-1" disabled={saving}>
            <Save className="w-3 h-3" />
            {saving ? "Saved!" : "Save"}
          </Button>
          {isAssignmentActivity && (
            <Button size="sm" onClick={handleSubmit} disabled={submitting} className="h-8 text-xs gap-1 bg-orange-500 hover:bg-orange-600 text-white">
              <Send className="w-3 h-3" />
              {submitting ? "Submitting..." : "Submit"}
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setFullscreen(f => !f)}>
            {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {/* Split pane */}
      <div className="flex gap-0 border rounded-lg overflow-hidden" style={{ height: editorHeight }}>
        {/* Instructions panel */}
        {instructionsOpen && exercise.instructions && (
          <div className="w-72 border-r bg-muted/20 flex flex-col shrink-0">
            <div className="p-2 border-b flex items-center justify-between bg-muted/40">
              <span className="text-xs font-semibold text-muted-foreground">Instructions</span>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setInstructionsOpen(false)}>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="p-3 flex-1 overflow-y-auto text-xs leading-relaxed whitespace-pre-wrap text-foreground">
              {exercise.instructions}
            </div>
          </div>
        )}

        {!instructionsOpen && exercise.instructions && (
          <button
            onClick={() => setInstructionsOpen(true)}
            className="border-r bg-muted/20 px-1 flex items-center text-xs text-muted-foreground hover:bg-muted/40 transition-colors"
            title="Show Instructions"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Editor */}
        <div className="flex-1 flex flex-col min-w-0">
          <Editor
            height="100%"
            language={language}
            value={code}
            onChange={(val) => setCode(val || "")}
            theme="vs-dark"
            options={{
              fontSize: 13,
              minimap: { enabled: false },
              wordWrap: "on",
              scrollBeyondLastLine: false,
              padding: { top: 8 },
              automaticLayout: true,
            }}
          />
        </div>

        {/* Run output panel */}
        {output && canRun && (
          <div className="w-64 border-l flex flex-col bg-background shrink-0">
            <div className="p-2 border-b flex items-center justify-between bg-muted/40">
              <span className="text-xs font-semibold text-muted-foreground">
                {editorType === "monaco_html" ? "Preview" : "Output"}
              </span>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setOutput(null)}>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
            <iframe
              ref={iframeRef}
              title="output"
              className="flex-1 w-full border-0"
              sandbox="allow-scripts"
              onLoad={handleRun}
            />
          </div>
        )}
      </div>
    </div>
  );
}
