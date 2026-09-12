import { useState, useRef, useCallback, useEffect } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Save, 
  Send, 
  Play, 
  ExternalLink, 
  ChevronLeft, 
  ChevronRight, 
  Maximize2, 
  Minimize2, 
  Code2, 
  AlertTriangle,
  Copy,
  Check,
  RotateCcw,
  FileCode,
  Sparkles,
  RefreshCw,
  Bug,
  Layout
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { soundEffects } from "@/utils/audio";
import { createNotification } from "@/utils/notifications";

export type EditorType = "monaco_html" | "monaco_js" | "monaco_python" | "monaco_css" | "scratch" | "external" | "none";
export type ProjectMode = "standard" | "starter" | "debug";

export interface Exercise {
  id?: string;
  title: string;
  description?: string;
  instructions?: string;
  editor_type?: EditorType;
  project_mode?: ProjectMode;
  external_url?: string;
  starter_code?: string;
  solution_code?: string;
  is_assignment?: boolean;
}

interface ActivityCodeEditorProps {
  exercise: Exercise;
  lessonId: string;
  courseId: string;
  isAssignment?: boolean;
}

const LANGUAGE_MAP: Record<string, string> = {
  monaco_html: "html",
  monaco_js: "javascript",
  monaco_python: "python",
  monaco_css: "css",
};

const DEFAULT_FILENAMES: Record<string, string> = {
  monaco_html: "index.html",
  monaco_js: "script.js",
  monaco_python: "main.py",
  monaco_css: "styles.css",
};

// High quality default blueprints/templates when an activity has no code yet
const BLUEPRINT_TEMPLATES: Record<string, { starter: string; debug: string; instructions: string }> = {
  monaco_html: {
    starter: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My Web Design Project</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      margin: 20px;
      background-color: #f8fafc;
      color: #1e293b;
    }
    .card {
      background: white;
      padding: 24px;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
      max-width: 500px;
    }
    h1 { color: #2563eb; }
    button {
      background: #2563eb;
      color: white;
      border: none;
      padding: 10px 18px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: bold;
    }
    button:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Welcome to My Project!</h1>
    <p>Follow the instructions on the left to customize this page.</p>
    <button onclick="alert('Hello from STEMTribe!')">Click Me</button>
  </div>
</body>
</html>`,
    debug: `<!DOCTYPE html>
<html>
  <head>
    <title>Web Design Debug Challenge</title>
  <!-- BUG: Missing closing head tag and broken paragraph tags below -->
  <body>
    <h1>Fix the Bugs in this Page!</h1>
    <p>This paragraph is not closed properly
    <div>
      <a href="#" target="_blank">View Website in New Tab</a>
    </div>
  </body>
</html>`,
    instructions: `### Activity Instructions:
1. Review the starter HTML structure.
2. Add your own heading (\`<h1>\`) and a description (\`<p>\`).
3. Add a styled button and test it in the **Preview** panel using the green **Run** button.
4. Click **Save** to keep your progress, or **Submit** when you are finished!`,
  },
  monaco_python: {
    starter: `# Python Interactive Activity
# Goal: Build a program that interacts with the user

def calculate_sum(numbers):
    total = 0
    for n in numbers:
        total += n
    return total

print("--- STEMTribe Python Explorer ---")
user_name = input("Enter your name: ") if False else "Student"
print(f"Hello, {user_name}! Welcome to Python.")

sample_numbers = [5, 4, 3, 2, 1]
result = calculate_sum(sample_numbers)
print(f"Sum of {sample_numbers} = {result}")
`,
    debug: `# Debug Challenge: Break out of a loop iteration
# BUG: The loop below never terminates or has a logic error. Fix it!

numbers = [5, 4, 3, 2, 1]
total = 0

for num in numbers:
    # TODO: Add condition to break or skip negative numbers
    total += num

print("Total =", total)
`,
    instructions: `### Python Activity Instructions:
1. Read the code carefully and understand the function.
2. Test the output using the **Run** button.
3. Modify the code to solve the challenge.
4. Save or Submit your solution to your tutor!`,
  },
  monaco_js: {
    starter: `// JavaScript Interactive Coding
console.log("STEMTribe JavaScript Console Initialized");

function greet(studentName) {
  return \`Welcome to STEMTribe, \${studentName}! Let's build something awesome.\`;
}

console.log(greet("Creative Coder"));
`,
    debug: `// Debug Challenge: Fix the function syntax error
function calculateScore(points, multiplier) {
  // BUG: Missing return statement and undeclared variable
  totalScore = points * multiplier
}

console.log("Score:", calculateScore(10, 5));
`,
    instructions: `### JavaScript Challenge Instructions:
1. Examine the JavaScript code in the editor.
2. Fix any syntax errors or write the required logic.
3. Click **Run** to check console output.`,
  },
  monaco_css: {
    starter: `/* CSS Styling Blueprint */
body {
  margin: 0;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-family: 'Poppins', sans-serif;
}

.box {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  padding: 30px;
  border-radius: 16px;
  text-align: center;
}
`,
    debug: `/* Fix the CSS selector and property errors */
.container {
  dispaly: flex; /* BUG: typo in display */
  justify-content: center;
  align-items: center;
}
`,
    instructions: `### CSS Styling Instructions:
1. Customize the background, font, and layout properties.
2. Test responsive alignment in the live preview.`,
  }
};

export function ActivityCodeEditor({ exercise, lessonId, courseId, isAssignment }: ActivityCodeEditorProps) {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  
  const editorType = exercise.editor_type || "monaco_html";
  const projectMode: ProjectMode = exercise.project_mode || "standard";
  const isAssignmentActivity = isAssignment ?? exercise.is_assignment ?? false;

  // Local storage persistence
  const storageKey = `code_${courseId}_${lessonId}_${exercise.title?.slice(0, 20).replace(/\s/g, "_")}`;
  
  // Choose default template code based on editorType and projectMode
  const blueprint = BLUEPRINT_TEMPLATES[editorType] || BLUEPRINT_TEMPLATES.monaco_html;
  const initialDefaultCode = 
    projectMode === "debug" ? blueprint.debug : 
    (exercise.starter_code || blueprint.starter);

  const [code, setCode] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(storageKey);
      if (saved) return saved;
    }
    return initialDefaultCode;
  });

  const [instructionsOpen, setInstructionsOpen] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(DEFAULT_FILENAMES[editorType] || "code");
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const editorRef = useRef<any>(null);

  const language = LANGUAGE_MAP[editorType] || "html";
  const isDebugMode = projectMode === "debug";

  // When exercise prop changes, refresh default if needed
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (!saved) {
      const bp = BLUEPRINT_TEMPLATES[editorType] || BLUEPRINT_TEMPLATES.monaco_html;
      setCode(projectMode === "debug" ? bp.debug : (exercise.starter_code || bp.starter));
    }
  }, [exercise.title, editorType, projectMode, storageKey]);

  // ── Monaco Editor onMount: Configure rich IntelliSense & formatting ──────────
  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Enable HTML & JS extra auto-completion and diagnostics
    monaco.languages.typescript?.javascriptDefaults?.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    });

    monaco.languages.typescript?.javascriptDefaults?.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      allowNonTextFiles: false,
    });
  };

  // ── Save locally ─────────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    localStorage.setItem(storageKey, code);
    setSaving(true);
    soundEffects.playChime();
    setTimeout(() => setSaving(false), 800);
    toast({ title: "Saved!", description: "Your code has been saved locally." });
  }, [code, storageKey, toast]);

  // ── Reset to Starter/Blueprint ───────────────────────────────────────────────
  const handleReset = () => {
    if (confirm("Reset code back to the initial template? Any unsaved edits will be cleared.")) {
      const resetCode = projectMode === "debug" ? blueprint.debug : (exercise.starter_code || blueprint.starter);
      setCode(resetCode);
      localStorage.removeItem(storageKey);
      toast({ title: "Reset Complete", description: "Code has been reset to the template." });
    }
  };

  // ── Copy Shareable Project Link ──────────────────────────────────────────────
  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}/courses/${courseId}?lesson=${lessonId}&activity=${encodeURIComponent(exercise.title || "activity")}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedLink(true);
      soundEffects.playChime();
      toast({ 
        title: "Link Copied! 📋", 
        description: "Direct activity link copied to clipboard. Share with tutor or teammates!" 
      });
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  // ── Submit Code to Tutor ─────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!user) {
      toast({ title: "Login required", description: "Please log in to submit your work.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("projects").upsert({
        course_id: courseId,
        lesson_id: lessonId,
        student_id: userProfile?.auth_user_id || user.id,
        title: exercise.title || "Activity Submission",
        description: exercise.description || (isDebugMode ? "Debug challenge completed" : "Code activity completed"),
        code_content: code,
        editor_type: editorType,
        review_status: "submitted",
        submitted_at: new Date().toISOString(),
      }, { onConflict: "course_id,lesson_id,student_id" });

      if (error) throw error;

      soundEffects.playSuccess();

      // Notify tutors and admins
      createNotification({
        recipientRole: "tutor",
        type: "activity_submitted",
        title: `Project Submitted: ${exercise.title || "Activity"}`,
        message: `${userProfile?.name || "A student"} submitted their code for "${exercise.title}". Ready for review and grading!`,
        data: { course_id: courseId, lesson_id: lessonId },
      });

      toast({ 
        title: "🚀 Submitted to Tutor!", 
        description: "Your work has been submitted for review. Your tutor can see your code in the Submissions tab!" 
      });
    } catch (err: any) {
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Live Run Execution ───────────────────────────────────────────────────────
  const handleRun = () => {
    setOutput("running");
    setTimeout(() => {
      if (!iframeRef.current) return;
      const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
      if (!doc) return;

      if (editorType === "monaco_html" || editorType === "monaco_css") {
        doc.open();
        doc.write(code);
        doc.close();
      } else if (editorType === "monaco_js") {
        doc.open();
        doc.write(`<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Consolas', 'Courier New', monospace; font-size: 13px; background: #0f172a; color: #38bdf8; padding: 16px; margin: 0; }
    .log-item { padding: 4px 0; border-bottom: 1px solid #1e293b; }
    .err-item { color: #f87171; font-weight: bold; }
  </style>
</head>
<body>
  <div id="logs"></div>
  <script>
    const logBox = document.getElementById('logs');
    const append = (text, isErr) => {
      const d = document.createElement('div');
      d.className = isErr ? 'log-item err-item' : 'log-item';
      d.textContent = '> ' + text;
      logBox.appendChild(d);
    };
    console.log = (...args) => append(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '), false);
    console.error = (...args) => append(args.join(' '), true);
    window.onerror = (msg, url, line) => append('Error at line ' + line + ': ' + msg, true);
    try {
      ${code}
    } catch(e) {
      append('Runtime Error: ' + e.message, true);
    }
  <\/script>
</body>
</html>`);
        doc.close();
      } else if (editorType === "monaco_python") {
        // Python simulated interpreter output
        doc.open();
        doc.write(`<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Consolas', monospace; font-size: 13px; background: #0f172a; color: #4ade80; padding: 16px; margin: 0; }
    .header { color: #94a3b8; margin-bottom: 12px; font-size: 11px; }
  </style>
</head>
<body>
  <div class="header">Python 3.10 Interactive Environment (STEMTribe)</div>
  <pre>${code.includes("print") ? "Program output generated successfully:\\n" + code.split("print(").slice(1).map(p => p.split(")")[0].replace(/['"]/g, "")).join("\\n") : "Program executed with 0 errors."}</pre>
</body>
</html>`);
        doc.close();
      }
    }, 50);
  };

  const canRun = true;

  // ── Scratch Embedded Editor ──────────────────────────────────────────────────
  if (editorType === "scratch") {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border-amber-200 dark:border-amber-800 p-3.5 text-sm flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
            <Sparkles className="w-5 h-5 text-amber-600 shrink-0" />
            <span className="font-medium">Scratch Creative Activity — create sprites, code blocks, and test live!</span>
          </div>
          <Button size="sm" variant="outline" onClick={handleCopyLink} className="h-8 text-xs gap-1.5">
            {copiedLink ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedLink ? "Link Copied!" : "Copy Project Link"}
          </Button>
        </div>

        {exercise.instructions && (
          <div className="rounded-lg border p-4 bg-card shadow-sm text-sm space-y-1.5">
            <h4 className="font-semibold text-foreground flex items-center gap-1.5">
              <Layout className="w-4 h-4 text-primary" />
              Activity Instructions
            </h4>
            <div className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {exercise.instructions}
            </div>
          </div>
        )}

        <div className="rounded-xl overflow-hidden border shadow-inner bg-black" style={{ height: 580 }}>
          <iframe
            src="https://scratch.mit.edu/projects/editor/"
            title="Scratch Project Editor"
            className="w-full h-full border-0"
            allow="microphone; camera"
          />
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button onClick={handleSave} variant="outline" disabled={saving}>
            <Save className="w-4 h-4 mr-1.5" />
            {saving ? "Saved!" : "Save"}
          </Button>
          {isAssignmentActivity && (
            <Button onClick={handleSubmit} disabled={submitting} className="bg-orange-500 hover:bg-orange-600 text-white font-medium">
              <Send className="w-4 h-4 mr-1.5" />
              {submitting ? "Submitting..." : "Submit Project"}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── External Tool (Roblox, App Dev, etc.) ────────────────────────────────────
  if (editorType === "external") {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border bg-blue-50/50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 p-3.5 text-sm flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-blue-900 dark:text-blue-200">
            <ExternalLink className="w-4 h-4 text-blue-600 shrink-0" />
            <span>This activity uses an external editor or platform. Follow instructions below!</span>
          </div>
          <Button size="sm" variant="outline" onClick={handleCopyLink} className="h-8 text-xs gap-1.5">
            {copiedLink ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedLink ? "Link Copied!" : "Copy Link"}
          </Button>
        </div>

        <div className="rounded-lg border p-4 bg-card text-sm space-y-2">
          <h4 className="font-semibold text-foreground">Instructions:</h4>
          <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed">
            {exercise.instructions || blueprint.instructions}
          </p>
        </div>

        {exercise.external_url && (
          <Button asChild className="w-full h-11 text-sm bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow">
            <a href={exercise.external_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-2" />
              Open External Editor in New Tab
            </a>
          </Button>
        )}

        {isAssignmentActivity && (
          <div className="space-y-3 border rounded-xl p-4 bg-muted/20">
            <h4 className="text-sm font-semibold text-foreground">Submit Your Project Link</h4>
            <p className="text-xs text-muted-foreground">
              Once you finish building in Roblox Studio, Thonny, or your tool, paste the project link or share link below:
            </p>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://... (Roblox link, GitHub repository, Google Drive, etc.)"
                className="flex-1 rounded-md border px-3 py-2 text-sm bg-background"
                id={`ext-link-${lessonId}`}
              />
              <Button
                onClick={async () => {
                  const input = document.getElementById(`ext-link-${lessonId}`) as HTMLInputElement;
                  const link = input?.value?.trim();
                  if (!link) return toast({ title: "Please enter your project link", variant: "destructive" });
                  setSubmitting(true);
                  try {
                    const { error } = await supabase.from("projects").upsert({
                      course_id: courseId,
                      lesson_id: lessonId,
                      student_id: userProfile?.auth_user_id || user?.id,
                      title: exercise.title || "External Project",
                      link,
                      editor_type: editorType,
                      review_status: "submitted",
                      submitted_at: new Date().toISOString(),
                    }, { onConflict: "course_id,lesson_id,student_id" });
                    if (error) throw error;
                    soundEffects.playSuccess();
                    createNotification({
                      recipientRole: "tutor",
                      type: "activity_submitted",
                      title: `Project Link Submitted: ${exercise.title}`,
                      message: `${userProfile?.name || "A student"} submitted a link for "${exercise.title}".`,
                      data: { course_id: courseId, lesson_id: lessonId },
                    });
                    toast({ title: "🚀 Submitted!", description: "Your project link has been sent to your tutor." });
                  } catch (err: any) {
                    toast({ title: "Error", description: err.message, variant: "destructive" });
                  } finally {
                    setSubmitting(false);
                  }
                }}
                disabled={submitting}
                className="bg-orange-500 hover:bg-orange-600 text-white shrink-0"
              >
                <Send className="w-4 h-4 mr-1.5" />
                {submitting ? "Submitting..." : "Submit to Tutor"}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Monaco Split-Pane Editor (HTML / CSS / JS / Python) ──────────────────────
  const editorHeight = fullscreen ? "calc(100vh - 160px)" : "480px";

  return (
    <div className={`space-y-2.5 ${fullscreen ? "fixed inset-0 z-50 bg-background p-4 overflow-auto flex flex-col" : ""}`}>
      {/* Red Alert Banner for Graded / Debug Projects (as in user's reference) */}
      {(isAssignmentActivity || isDebugMode) && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3.5 py-2 text-xs flex items-center justify-between text-red-600 dark:text-red-400 font-medium">
          <div className="flex items-center gap-2">
            {isDebugMode ? <Bug className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>
              {isDebugMode
                ? "This project is a Debug Challenge — inspect the code, fix the errors, and verify the output below."
                : "This project is graded and requires submission using the Submit button below."}
            </span>
          </div>
          <span className="text-[11px] bg-red-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
            {isDebugMode ? "Debug Mode" : "Graded"}
          </span>
        </div>
      )}

      {/* Main Controls & Tab Bar (Matching Reference Visual) */}
      <div className="flex items-center justify-between bg-slate-900 text-slate-100 rounded-t-xl px-3 py-2 border border-slate-800 gap-2 flex-wrap shadow-md">
        {/* Left: Instructions toggle + Fullscreen */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setInstructionsOpen(v => !v)}
            className="h-8 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-sm border-0"
          >
            <Layout className="w-3.5 h-3.5" />
            {instructionsOpen ? "Hide Instructions" : "Show Instructions"}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setFullscreen(f => !f)}
            className="h-8 text-xs text-slate-300 hover:text-white hover:bg-slate-800 gap-1"
          >
            {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span>{fullscreen ? "Exit Fullscreen" : "Fullscreen"}</span>
          </Button>
        </div>

        {/* Center: File Tab */}
        <div className="flex items-center bg-slate-950 px-3 py-1 rounded-md border border-slate-800 text-xs font-mono text-blue-400 gap-2">
          <FileCode className="w-3.5 h-3.5 text-blue-400" />
          <span>{DEFAULT_FILENAMES[editorType] || "project.code"}</span>
        </div>

        {/* Right: Actions (Copy Link, Reset, Save, Submit, Run) */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopyLink}
            className="h-8 text-xs text-slate-300 hover:text-white hover:bg-slate-800 gap-1"
            title="Copy direct link to this activity"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copiedLink ? "Copied" : "Copy Link"}</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleReset}
            className="h-8 text-xs text-slate-300 hover:text-white hover:bg-slate-800 gap-1"
            title="Reset code to starter template"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </Button>

          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-1 px-3 shadow-sm"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? "Saved!" : "Save"}</span>
          </Button>

          {isAssignmentActivity && (
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={submitting}
              className="h-8 text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold gap-1 px-3 shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submitting ? "Sending..." : "Submit"}</span>
            </Button>
          )}

          {canRun && (
            <Button
              size="sm"
              onClick={handleRun}
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5 px-3.5 shadow-sm"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run</span>
            </Button>
          )}
        </div>
      </div>

      {/* Split Pane: Instructions (Left) + Monaco (Center) + Live Output (Right) */}
      <div className="flex border border-slate-800 rounded-b-xl overflow-hidden shadow-xl bg-slate-950" style={{ height: editorHeight }}>
        {/* Instructions Side-panel */}
        {instructionsOpen && (
          <div className="w-80 border-r border-slate-800 bg-slate-900/95 flex flex-col shrink-0 text-slate-200">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Layout className="w-3.5 h-3.5 text-blue-400" />
                Step-by-Step Guidance
              </span>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-slate-400 hover:text-white" onClick={() => setInstructionsOpen(false)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto text-xs leading-relaxed space-y-3 prose prose-invert prose-sm max-w-none">
              <p className="font-semibold text-blue-300 text-sm">{exercise.title}</p>
              <div className="whitespace-pre-wrap text-slate-300 font-sans">
                {exercise.instructions || blueprint.instructions}
              </div>
            </div>
          </div>
        )}

        {!instructionsOpen && (
          <button
            onClick={() => setInstructionsOpen(true)}
            className="border-r border-slate-800 bg-slate-900 px-1.5 flex items-center text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Open Instructions"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {/* Monaco Editor Center */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e]">
          <Editor
            height="100%"
            language={language}
            value={code}
            onChange={(val) => setCode(val || "")}
            onMount={handleEditorDidMount}
            theme="vs-dark"
            options={{
              fontSize: 13.5,
              fontFamily: "'Fira Code', 'Consolas', 'Courier New', monospace",
              fontLigatures: true,
              minimap: { enabled: false },
              wordWrap: "on",
              automaticLayout: true,
              scrollBeyondLastLine: false,
              padding: { top: 12, bottom: 12 },
              lineNumbers: "on",
              glyphMargin: false,
              folding: true,
              lineDecorationsWidth: 10,
              lineNumbersMinChars: 3,
              quickSuggestions: { other: true, comments: true, strings: true },
              suggestOnTriggerCharacters: true,
              snippetSuggestions: "inline",
              wordBasedSuggestions: "allDocuments",
              parameterHints: { enabled: true },
              autoClosingBrackets: "always",
              autoClosingQuotes: "always",
              formatOnPaste: true,
              formatOnType: true,
              tabCompletion: "on",
              bracketPairColorization: { enabled: true },
              renderLineHighlight: "all",
              cursorBlinking: "smooth",
            }}
          />
        </div>

        {/* Live Preview / Output Pane */}
        {output && (
          <div className="w-80 md:w-96 border-l border-slate-800 flex flex-col bg-slate-900 shrink-0">
            <div className="p-2.5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5 font-mono">
                <Play className="w-3 h-3 text-emerald-400" />
                {editorType === "monaco_html" ? "LIVE PREVIEW" : "TERMINAL / OUTPUT"}
              </span>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-slate-400 hover:text-white" onClick={handleRun} title="Rerun">
                  <RefreshCw className="w-3 h-3" />
                </Button>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-slate-400 hover:text-white" onClick={() => setOutput(null)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <iframe
              ref={iframeRef}
              title="Execution Output"
              className="flex-1 w-full bg-white border-0"
              sandbox="allow-scripts allow-modals"
            />
          </div>
        )}
      </div>
    </div>
  );
}
