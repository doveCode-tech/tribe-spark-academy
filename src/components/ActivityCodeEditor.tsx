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
  Layout,
  Plus,
  X,
  Download,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { soundEffects } from "@/utils/audio";
import { createNotification } from "@/utils/notifications";

export type EditorType =
  | "monaco_html"
  | "monaco_js"
  | "monaco_python"
  | "monaco_css"
  | "scratch"
  | "external"
  | "none";
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

// ── File tab types ───────────────────────────────────────────────────────────
interface FileTab {
  name: string;
  language: string;
  content: string;
}

const DEFAULT_FILENAMES: Record<string, string> = {
  monaco_html: "index.html",
  monaco_js: "script.js",
  monaco_python: "main.py",
  monaco_css: "styles.css",
};

const LANGUAGE_MAP: Record<string, string> = {
  monaco_html: "html",
  monaco_js: "javascript",
  monaco_python: "python",
  monaco_css: "css",
};

const EXTRA_FILE_TEMPLATES: Record<string, { name: string; language: string; content: string }[]> = {
  monaco_html: [
    { name: "style.css", language: "css", content: "/* Add your CSS styles here */\nbody {\n  font-family: sans-serif;\n  margin: 20px;\n}\n" },
    { name: "script.js", language: "javascript", content: "// Add your JavaScript here\nconsole.log('Hello from script.js!');\n" },
  ],
  monaco_js: [
    { name: "helpers.js", language: "javascript", content: "// Helper functions\nfunction add(a, b) { return a + b; }\n" },
  ],
  monaco_css: [
    { name: "theme.css", language: "css", content: "/* Theme overrides */\n" },
  ],
  monaco_python: [
    { name: "utils.py", language: "python", content: "# Utility functions\ndef greet(name):\n    return f'Hello, {name}!'\n" },
  ],
};

// ── Default blueprint templates ──────────────────────────────────────────────
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
    <h1>🌐 My Web Project</h1>
    <p>Welcome! Edit this page and click <strong>Run</strong> to see the live preview.</p>
    <button onclick="alert('Hello World!')">Click Me!</button>
  </div>
</body>
</html>`,
    debug: `<!DOCTYPE html>
<html>
<head>
  <!-- BUG: Missing closing title tag and unclosed p tag below -->
  <title>Debug Challenge
</head>
<body>
  <h1>Fix the Bugs Below</h1>
  <p>Can you find the missing closing tags?
  <img src=profile.jpg>
  <a href="#">Click here<a>
</body>
</html>`,
    instructions: `### HTML Project Instructions:
1. Read through the starter HTML and CSS.
2. Add your own content inside the <body>.
3. Customize colours and fonts in the <style> block.
4. Press Run to see the live result in the preview panel.`,
  },
  monaco_js: {
    starter: `// JavaScript Interactive Activity
// Click Run to see console output in the right panel

const name = "STEMTribe Coder";
console.log("Welcome, " + name + "!");

// Try a simple function
function add(a, b) {
  return a + b;
}

console.log("5 + 3 =", add(5, 3));
`,
    debug: `// Fix the syntax / logic errors below!
function greet(name) {
  console.log("Hello " + name   // BUG: missing closing parenthesis
}

let scores = [10, 20, 30;]      // BUG: stray semicolon inside array
console.log(scores[0])
greet("World")
`,
    instructions: `### JavaScript Instructions:
1. Write or fix the JavaScript code.
2. Use console.log() to print output.
3. Click Run to see results in the terminal panel on the right.`,
  },
  monaco_python: {
    starter: `# Python Activity — click Run to execute
name = "STEMTribe Coder"
print(f"Welcome, {name}!")

# Simple calculation
def add(a, b):
    return a + b

result = add(5, 3)
print(f"5 + 3 = {result}")
`,
    debug: `# Debug Challenge: Fix the bugs below!
score = 10
if score = 10:          # BUG: should be == not =
    print("Score is perfect")

my_list = [1, 2, 3
print(my_list)          # BUG: missing closing bracket above
`,
    instructions: `### Python Instructions:
1. Read the code carefully.
2. Fix any syntax or logic errors.
3. Click Run to check your output.`,
  },
  monaco_css: {
    starter: `/* CSS Styling Activity */
body {
  font-family: 'Segoe UI', sans-serif;
  margin: 0;
  padding: 20px;
  background: linear-gradient(135deg, #1a1a2e, #16213e);
  min-height: 100vh;
  color: white;
}

.container {
  background: rgba(255, 255, 255, 0.1);
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
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function buildHtmlOutput(files: FileTab[]): string {
  const htmlFile = files.find((f) => f.name === "index.html" || f.language === "html");
  const cssFiles = files.filter((f) => f.language === "css");
  const jsFiles = files.filter((f) => f.language === "javascript");

  if (!htmlFile) return "<p>No HTML file found.</p>";

  let html = htmlFile.content;

  // Inject CSS files before </head>
  if (cssFiles.length > 0) {
    const cssTag = cssFiles
      .map((f) => `<style>/* ${f.name} */\n${f.content}\n</style>`)
      .join("\n");
    html = html.replace("</head>", `${cssTag}\n</head>`);
  }

  // Inject JS files before </body>
  if (jsFiles.length > 0) {
    const jsTag = jsFiles
      .map((f) => `<script>/* ${f.name} */\n${f.content}\n</script>`)
      .join("\n");
    html = html.replace("</body>", `${jsTag}\n</body>`);
  }

  return html;
}

function buildJsOutput(code: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Consolas', 'Courier New', monospace; font-size: 13px; background: #0f172a; color: #38bdf8; padding: 16px; margin: 0; }
    .log-item { padding: 4px 0; border-bottom: 1px solid #1e293b; white-space: pre-wrap; }
    .err-item { color: #f87171; font-weight: bold; }
    .header { color: #94a3b8; font-size: 11px; margin-bottom: 8px; }
  </style>
</head>
<body>
  <div class="header">▶ JavaScript Console Output</div>
  <div id="logs"></div>
  <script>
    const logBox = document.getElementById('logs');
    const append = (text, isErr) => {
      const d = document.createElement('div');
      d.className = isErr ? 'log-item err-item' : 'log-item';
      d.textContent = '> ' + text;
      logBox.appendChild(d);
    };
    const _orig = { log: console.log, error: console.error, warn: console.warn };
    console.log = (...args) => append(args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' '), false);
    console.error = (...args) => append(args.join(' '), true);
    console.warn = (...args) => append('[WARN] ' + args.join(' '), false);
    window.onerror = (msg, url, line) => append('❌ Error at line ' + line + ': ' + msg, true);
    try {
      ${code}
    } catch(e) {
      append('❌ Runtime Error: ' + e.message, true);
    }
  </script>
</body>
</html>`;
}

function buildPythonOutput(code: string): string {
  // Simple simulation — real Python requires a WASM interpreter (Pyodide)
  // We'll do a best-effort parse of print() calls
  const lines = code.split("\n");
  const outputs: string[] = [];
  let hasError = false;
  let errorMsg = "";

  // Detect common syntax errors
  const syntaxChecks = [
    { re: /if\s+\w+\s*=[^=]/, msg: "SyntaxError: invalid syntax (did you mean == instead of =?)" },
    { re: /^\s*def\s+\w+[^(]/, msg: "SyntaxError: missing parentheses in function definition" },
  ];
  for (const chk of syntaxChecks) {
    if (chk.re.test(code)) {
      hasError = true;
      errorMsg = chk.msg;
      break;
    }
  }

  if (!hasError) {
    for (const line of lines) {
      const m = line.match(/^\s*print\s*\((.+)\)\s*$/);
      if (m) {
        const inner = m[1].trim().replace(/^['"`]|['"`]$/g, "").replace(/f['"](.+)['"]/, "$1");
        outputs.push(inner);
      }
    }
    if (outputs.length === 0) outputs.push("Program executed with 0 errors.");
  }

  const display = hasError
    ? `<span style="color:#f87171">❌ ${errorMsg}</span>`
    : outputs.map((o) => `<div>&gt; ${o}</div>`).join("");

  return `<!DOCTYPE html><html><head><style>
    body { font-family: 'Consolas', monospace; font-size: 13px; background: #0f172a; color: #4ade80; padding: 16px; margin: 0; }
    .header { color: #94a3b8; margin-bottom: 12px; font-size: 11px; }
  </style></head><body>
  <div class="header">▶ Python 3.x Interactive Environment (STEMTribe)</div>
  <div>${display}</div>
</body></html>`;
}

// ── Main Component ────────────────────────────────────────────────────────────
export function ActivityCodeEditor({
  exercise,
  lessonId,
  courseId,
  isAssignment,
}: ActivityCodeEditorProps) {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();

  const editorType = (exercise.editor_type || "monaco_html") as EditorType;
  const projectMode: ProjectMode = exercise.project_mode || "standard";
  const isAssignmentActivity = isAssignment ?? exercise.is_assignment ?? false;

  const blueprint = BLUEPRINT_TEMPLATES[editorType] || BLUEPRINT_TEMPLATES.monaco_html;
  const defaultMainCode =
    projectMode === "debug" ? blueprint.debug : exercise.starter_code || blueprint.starter;

  const mainFileName = DEFAULT_FILENAMES[editorType] || "index.html";
  const mainLanguage = LANGUAGE_MAP[editorType] || "html";

  // ── Storage key: unique per student + course + activity ──────────────────
  const studentId = user?.id || "anon";
  const activityId = exercise.id || exercise.title?.slice(0, 20).replace(/\s/g, "_") || "act";
  const storageKey = `ace_${studentId}_${courseId}_${lessonId}_${activityId}`;

  // ── File tabs state ────────────────────────────────────────────────────────
  const [files, setFiles] = useState<FileTab[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved) as FileTab[];
    } catch {}
    return [{ name: mainFileName, language: mainLanguage, content: defaultMainCode }];
  });
  const [activeFile, setActiveFile] = useState(mainFileName);

  const [instructionsOpen, setInstructionsOpen] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null); // null = no run yet
  const [previewOpen, setPreviewOpen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const editorRef = useRef<any>(null);

  const isDebugMode = projectMode === "debug";
  const currentFile = files.find((f) => f.name === activeFile) || files[0];

  // ── Auto-run state ──────────────────────────────────────────────────────────
  const [autoRun, setAutoRun] = useState(false);
  const autoRunTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Resizable split pane ────────────────────────────────────────────────────
  const [splitPercent, setSplitPercent] = useState(55); // editor gets 55%, preview 45%
  const splitDragRef = useRef(false);

  // ── Step-by-step instructions ──────────────────────────────────────────────
  const instructionText = exercise.instructions || blueprint.instructions;
  const instructionSteps = (() => {
    // Split instructions by numbered steps, ### headers, or double-newlines
    const byNumbers = instructionText.split(/(?=(?:^|\n)\s*(?:\d+[\.\)]\s|Step\s+\d+|###\s))/i).filter(s => s.trim());
    if (byNumbers.length > 1) return byNumbers.map(s => s.trim());
    const byDoubleNl = instructionText.split(/\n\s*\n/).filter(s => s.trim());
    if (byDoubleNl.length > 1) return byDoubleNl.map(s => s.trim());
    return [instructionText.trim()];
  })();
  const [currentStep, setCurrentStep] = useState(0);
  const hasMultipleSteps = instructionSteps.length > 1;

  // Sync storage when files change
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(files));
  }, [files, storageKey]);

  // When exercise changes, reset if no save exists
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (!saved) {
      const bp = BLUEPRINT_TEMPLATES[editorType] || BLUEPRINT_TEMPLATES.monaco_html;
      const code = projectMode === "debug" ? bp.debug : exercise.starter_code || bp.starter;
      setFiles([{ name: mainFileName, language: mainLanguage, content: code }]);
      setActiveFile(mainFileName);
    }
  }, [exercise.title, editorType, projectMode]);

  // ── Monaco onMount ─────────────────────────────────────────────────────────
  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monaco.languages.typescript?.javascriptDefaults?.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    });
    monaco.languages.typescript?.javascriptDefaults?.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2020,
    });
  };

  // ── Update current file content ─────────────────────────────────────────────
  const updateCurrentFile = (content: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.name === activeFile ? { ...f, content } : f))
    );
  };

  // ── Add new file ────────────────────────────────────────────────────────────
  const addFile = () => {
    const extras = EXTRA_FILE_TEMPLATES[editorType] || [];
    const existingNames = files.map((f) => f.name);
    const newFile = extras.find((e) => !existingNames.includes(e.name));
    if (newFile) {
      const tab: FileTab = { ...newFile };
      setFiles((prev) => [...prev, tab]);
      setActiveFile(tab.name);
    } else {
      // Generic new file
      let idx = files.length;
      let name = `file${idx}.${mainLanguage === "html" ? "html" : mainLanguage === "javascript" ? "js" : mainLanguage === "css" ? "css" : "py"}`;
      while (existingNames.includes(name)) { idx++; name = `file${idx}.${name.split(".").pop()}`; }
      const tab: FileTab = { name, language: mainLanguage, content: "" };
      setFiles((prev) => [...prev, tab]);
      setActiveFile(tab.name);
    }
  };

  // ── Close file tab ──────────────────────────────────────────────────────────
  const closeFile = (name: string) => {
    if (files.length <= 1) return; // keep at least one
    const idx = files.findIndex((f) => f.name === name);
    const newFiles = files.filter((f) => f.name !== name);
    setFiles(newFiles);
    if (activeFile === name) {
      setActiveFile(newFiles[Math.max(0, idx - 1)].name);
    }
  };

  // ── Save locally ─────────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    setSaving(true);
    soundEffects.playChime();
    setTimeout(() => setSaving(false), 800);
    toast({ title: "Saved!", description: "Your code has been saved locally." });
  }, [toast]);

  // ── Reset ─────────────────────────────────────────────────────────────────────
  const handleReset = () => {
    if (confirm("Reset all files back to the initial template? Any unsaved edits will be cleared.")) {
      const code = projectMode === "debug" ? blueprint.debug : exercise.starter_code || blueprint.starter;
      setFiles([{ name: mainFileName, language: mainLanguage, content: code }]);
      setActiveFile(mainFileName);
      localStorage.removeItem(storageKey);
      setPreviewSrc(null);
      setPreviewOpen(false);
      toast({ title: "Reset Complete", description: "Code has been reset to the template." });
    }
  };

  // ── Copy unique project link ──────────────────────────────────────────────────
  const handleCopyLink = () => {
    const projectUrl = `${window.location.origin}/project/${studentId}/${courseId}/${encodeURIComponent(activityId)}`;
    navigator.clipboard.writeText(projectUrl).then(() => {
      setCopiedLink(true);
      soundEffects.playChime();
      toast({
        title: "Link Copied! 📋",
        description: "Unique project link copied. Share with your tutor or classmates!",
      });
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  // ── Run Code ──────────────────────────────────────────────────────────────────
  const handleRun = () => {
    let src = "";
    if (editorType === "monaco_html" || editorType === "monaco_css") {
      src = buildHtmlOutput(files);
    } else if (editorType === "monaco_js") {
      src = buildJsOutput(currentFile.content);
    } else if (editorType === "monaco_python") {
      src = buildPythonOutput(currentFile.content);
    }
    setPreviewSrc(src);
    setPreviewOpen(true);

    // Give iframe a tick to mount then write
    setTimeout(() => {
      if (!iframeRef.current) return;
      const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
      if (!doc) return;
      doc.open();
      doc.write(src);
      doc.close();
    }, 60);
  };

  // ── Rerun (refresh iframe) ────────────────────────────────────────────────────
  const handleRerun = () => {
    if (!previewSrc) return handleRun();
    setTimeout(() => {
      if (!iframeRef.current) return;
      const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
      if (!doc) return;
      doc.open();
      doc.write(previewSrc);
      doc.close();
    }, 60);
  };

  // ── Auto-run: debounced execution on code change ─────────────────────────────
  useEffect(() => {
    if (!autoRun) return;
    if (autoRunTimerRef.current) clearTimeout(autoRunTimerRef.current);
    autoRunTimerRef.current = setTimeout(() => {
      handleRun();
    }, 600);
    return () => { if (autoRunTimerRef.current) clearTimeout(autoRunTimerRef.current); };
  }, [autoRun, files, activeFile]);

  // ── Download project ────────────────────────────────────────────────────────
  const handleDownload = () => {
    if (files.length === 1) {
      // Single file: download directly
      const f = files[0];
      const blob = new Blob([f.content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = f.name;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // Multiple files: combine into a single HTML with all CSS/JS inline
      const combined = buildHtmlOutput(files);
      const blob = new Blob([combined], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "project.html";
      a.click();
      URL.revokeObjectURL(url);
    }
    soundEffects.playChime();
    toast({ title: "Downloaded! 📥", description: "Your project files have been downloaded." });
  };

  // ── Resizable split pane handlers ──────────────────────────────────────────
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const handleSplitMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    splitDragRef.current = true;
    const onMove = (ev: MouseEvent) => {
      if (!splitDragRef.current || !splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const offsetX = ev.clientX - rect.left;
      const pct = Math.min(80, Math.max(20, (offsetX / rect.width) * 100));
      setSplitPercent(pct);
    };
    const onUp = () => {
      splitDragRef.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // ── Submit ────────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!user) {
      toast({ title: "Login required", description: "Please log in to submit.", variant: "destructive" });
      return;
    }
    const sid = user.id; // Use the auth UID directly — matches projects_student_id_fkey → auth.users(id)
    setSubmitting(true);
    try {
      const allCode = files.map((f) => `/* ===== ${f.name} ===== */\n${f.content}`).join("\n\n");
      const { error } = await supabase.from("projects").upsert(
        {
          course_id: courseId,
          lesson_id: lessonId,
          student_id: sid,
          title: exercise.title || "Activity Submission",
          description: exercise.description || (isDebugMode ? "Debug challenge completed" : "Code activity completed"),
          code_content: allCode,
          editor_type: editorType,
          review_status: "submitted",
          submitted_at: new Date().toISOString(),
        },
        { onConflict: "course_id,lesson_id,student_id" }
      );

      if (error) throw error;

      soundEffects.playSuccess();
      createNotification({
        recipientRole: "tutor",
        type: "activity_submitted",
        title: `Project Submitted: ${exercise.title || "Activity"}`,
        message: `${userProfile?.name || "A student"} submitted their code for "${exercise.title}". Ready for review!`,
        data: { course_id: courseId, lesson_id: lessonId },
      });
      toast({
        title: "🚀 Submitted to Tutor!",
        description: "Your work has been submitted for review. Your tutor can see your code in the Submissions tab!",
      });
    } catch (err: any) {
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Scratch editor ────────────────────────────────────────────────────────────
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
            <div className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{exercise.instructions}</div>
          </div>
        )}
        <div className="rounded-xl overflow-hidden border shadow-inner bg-black" style={{ height: 580 }}>
          <iframe src="https://scratch.mit.edu/projects/editor/" title="Scratch Project Editor" className="w-full h-full border-0" allow="microphone; camera" />
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

  // ── External tool ────────────────────────────────────────────────────────────
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
            <p className="text-xs text-muted-foreground">Paste the project link or share link once done:</p>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://... (Roblox link, GitHub, Google Drive, etc.)"
                className="flex-1 rounded-md border px-3 py-2 text-sm bg-background"
                id={`ext-link-${lessonId}-${activityId}`}
              />
              <Button
                onClick={async () => {
                  const input = document.getElementById(`ext-link-${lessonId}-${activityId}`) as HTMLInputElement;
                  const link = input?.value?.trim();
                  if (!link) return toast({ title: "Please enter your project link", variant: "destructive" });
                  setSubmitting(true);
                  try {
                    const sid = user?.id;
                    if (!sid) throw new Error("Not logged in");
                    const { error } = await supabase.from("projects").upsert(
                      {
                        course_id: courseId,
                        lesson_id: lessonId,
                        student_id: sid,
                        title: exercise.title || "External Project",
                        description: link,
                        code_content: link,
                        editor_type: editorType,
                        review_status: "submitted",
                        submitted_at: new Date().toISOString(),
                      },
                      { onConflict: "course_id,lesson_id,student_id" }
                    );
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

  // ── Main Monaco Editor ────────────────────────────────────────────────────────
  const isHtmlMode = editorType === "monaco_html" || editorType === "monaco_css";

  // Fullscreen: render as fixed overlay portal-style
  const outerCls = fullscreen
    ? "fixed inset-0 z-[9999] bg-background flex flex-col overflow-hidden"
    : "flex flex-col space-y-0";

  const editorAreaHeight = fullscreen ? "calc(100vh - 106px)" : "480px";

  return (
    <div className={outerCls}>
      {/* Red alert banner */}
      {(isAssignmentActivity || isDebugMode) && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3.5 py-2 text-xs flex items-center justify-between text-red-600 dark:text-red-400 font-medium mx-0 mb-0 rounded-b-none">
          <div className="flex items-center gap-2">
            {isDebugMode ? <Bug className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>
              {isDebugMode
                ? "Debug Challenge — inspect the code, find and fix the errors, then verify the output."
                : "This project is graded and requires submission using the Submit button below."}
            </span>
          </div>
          <span className="text-[11px] bg-red-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
            {isDebugMode ? "Debug Mode" : "Graded"}
          </span>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between bg-slate-900 text-slate-100 px-3 py-2 border border-slate-800 gap-2 flex-wrap shadow-md">
        {/* Left */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setInstructionsOpen((v) => !v)}
            className="h-8 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-sm border-0"
          >
            <Layout className="w-3.5 h-3.5" />
            {instructionsOpen ? "Hide Instructions" : "Show Instructions"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setFullscreen((f) => !f)}
            className="h-8 text-xs text-slate-300 hover:text-white hover:bg-slate-800 gap-1"
          >
            {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span>{fullscreen ? "Exit Fullscreen" : "Fullscreen"}</span>
          </Button>
        </div>

        {/* File tabs row (center) */}
        <div className="flex items-center gap-1 flex-1 overflow-x-auto min-w-0 px-2">
          {files.map((f) => (
            <div
              key={f.name}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono cursor-pointer border transition-colors ${
                f.name === activeFile
                  ? "bg-slate-700 border-slate-600 text-blue-300"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
              onClick={() => setActiveFile(f.name)}
            >
              <FileCode className="w-3 h-3 text-blue-400 shrink-0" />
              <span>{f.name}</span>
              {files.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); closeFile(f.name); }}
                  className="text-slate-500 hover:text-red-400 ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addFile}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-slate-400 hover:text-white hover:bg-slate-800 border border-dashed border-slate-700 transition-colors"
            title="Add new file"
          >
            <Plus className="w-3 h-3" />
            <span className="hidden sm:inline">New File</span>
          </button>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopyLink}
            className="h-8 text-xs text-slate-300 hover:text-white hover:bg-slate-800 gap-1 px-2"
            title="Copy unique project link"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copiedLink ? "Copied" : "Copy Link"}</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDownload}
            className="h-8 text-xs text-slate-300 hover:text-white hover:bg-slate-800 gap-1 px-2"
            title="Download project files"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Download</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleReset}
            className="h-8 text-xs text-slate-300 hover:text-white hover:bg-slate-800 gap-1 px-2"
            title="Reset code to starter template"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-1 px-2.5 shadow-sm"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? "Saved!" : "Save"}</span>
          </Button>
          {isAssignmentActivity && (
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={submitting}
              className="h-8 text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold gap-1 px-2.5 shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submitting ? "Sending..." : "Submit"}</span>
            </Button>
          )}

          {/* Auto-Run toggle button */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const next = !autoRun;
              setAutoRun(next);
              if (next) {
                handleRun();
                toast({ title: "Auto-Run Enabled ⚡", description: "Code will automatically re-run as you type." });
              }
            }}
            className={`h-8 text-xs gap-1 px-2 border transition-colors ${
              autoRun
                ? "bg-emerald-950/80 border-emerald-500 text-emerald-300 hover:bg-emerald-900"
                : "bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700"
            }`}
            title="Automatically run code on edits"
          >
            <Zap className={`w-3.5 h-3.5 ${autoRun ? "fill-emerald-400 text-emerald-400" : ""}`} />
            <span>Auto</span>
          </Button>

          <Button
            size="sm"
            onClick={handleRun}
            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5 px-3 shadow-sm"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Run</span>
          </Button>
        </div>
      </div>

      {/* Editor + Preview split pane with fit-to-view height and resizable divider */}
      <div
        ref={splitContainerRef}
        className="flex border border-slate-800 rounded-b-xl overflow-hidden shadow-xl bg-slate-950 relative"
        style={{
          height: fullscreen ? "calc(100vh - 106px)" : "calc(82vh - 130px)",
          minHeight: "420px",
          maxHeight: fullscreen ? "none" : "680px"
        }}
      >
        {/* Step-by-Step Guidance Side Panel */}
        {instructionsOpen && (
          <div className="w-72 md:w-80 border-r border-slate-800 bg-slate-900/95 flex flex-col shrink-0 text-slate-200">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Layout className="w-3.5 h-3.5 text-blue-400" />
                Step-by-Step Guidance
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-slate-400 hover:text-white"
                onClick={() => setInstructionsOpen(false)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>

            {/* Instruction content: paginated if multiple steps, or single view */}
            <div className="p-4 flex-1 overflow-y-auto text-xs leading-relaxed space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-blue-300 text-sm">{exercise.title}</p>
                {hasMultipleSteps && (
                  <Badge variant="outline" className="text-[10px] text-blue-300 border-blue-500/30">
                    Step {currentStep + 1} of {instructionSteps.length}
                  </Badge>
                )}
              </div>

              <div className="whitespace-pre-wrap text-slate-300 font-sans leading-relaxed bg-slate-950/40 p-3 rounded-lg border border-slate-800/80">
                {hasMultipleSteps ? instructionSteps[currentStep] : instructionText}
              </div>
            </div>

            {/* Step navigation buttons when there are multiple steps */}
            {hasMultipleSteps && (
              <div className="p-2.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentStep === 0}
                  onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
                  className="h-7 text-xs px-2.5 text-slate-300 border-slate-700 bg-slate-900 hover:bg-slate-800 gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </Button>
                <span className="text-[11px] text-slate-400 font-mono">
                  {currentStep + 1} / {instructionSteps.length}
                </span>
                <Button
                  size="sm"
                  disabled={currentStep >= instructionSteps.length - 1}
                  onClick={() => setCurrentStep((s) => Math.min(instructionSteps.length - 1, s + 1))}
                  className="h-7 text-xs px-2.5 bg-blue-600 hover:bg-blue-700 text-white gap-1"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
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

        {/* Monaco Editor Center (resizable width if previewOpen) */}
        <div
          className="flex flex-col min-w-0 bg-[#1e1e1e]"
          style={{
            flex: previewOpen ? `${splitPercent} 1 0%` : "1 1 0%",
            width: previewOpen ? `${splitPercent}%` : "100%",
          }}
        >
          <Editor
            height="100%"
            language={currentFile.language}
            value={currentFile.content}
            onChange={(val) => updateCurrentFile(val || "")}
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

        {/* Resizable Divider Handle (appears when preview is open) */}
        {previewOpen && (
          <div
            onMouseDown={handleSplitMouseDown}
            className="w-1.5 bg-slate-800 hover:bg-blue-500 active:bg-blue-600 cursor-col-resize shrink-0 transition-colors flex items-center justify-center group"
            title="Drag to resize editor & preview"
          >
            <div className="h-6 w-0.5 bg-slate-600 group-hover:bg-white rounded" />
          </div>
        )}

        {/* Live Preview / Output pane — resizable */}
        {previewOpen && (
          <div
            className="border-l border-slate-800 flex flex-col bg-slate-900 shrink-0 min-w-[240px]"
            style={{
              flex: `${100 - splitPercent} 1 0%`,
              width: `${100 - splitPercent}%`,
            }}
          >
            <div className="p-2 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5 font-mono">
                <Play className="w-3 h-3 text-emerald-400" />
                {isHtmlMode ? "LIVE PREVIEW" : "TERMINAL / OUTPUT"}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-slate-400 hover:text-white"
                  onClick={handleRerun}
                  title="Rerun"
                >
                  <RefreshCw className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-slate-400 hover:text-white"
                  onClick={() => setPreviewOpen(false)}
                  title="Close preview"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <iframe
              ref={iframeRef}
              title="Execution Output"
              className="flex-1 w-full bg-white border-0"
              sandbox="allow-scripts allow-modals allow-same-origin"
            />
          </div>
        )}
      </div>
    </div>
  );
}
