import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Github, ExternalLink, CheckCircle2, AlertCircle, Loader2, Sparkles, Key, Lock, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { soundEffects } from "@/utils/audio";

interface GitHubPushDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: {
    id?: string;
    title: string;
    description?: string;
    code_content?: string;
    editor_type?: string;
    submitted_at?: string;
  } | null;
  studentName?: string;
}

export function GitHubPushDialog({
  open,
  onOpenChange,
  project,
  studentName = "Young Maker",
}: GitHubPushDialogProps) {
  const { toast } = useToast();

  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem("stemtribe_github_pat") || "";
    } catch {
      return "";
    }
  });
  const [repoName, setRepoName] = useState("");
  const [repoDescription, setRepoDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [saveToken, setSaveToken] = useState(true);

  const [pushing, setPushing] = useState(false);
  const [pushSuccess, setPushSuccess] = useState<string | null>(null); // holds repo url on success

  useEffect(() => {
    if (project) {
      const sanitized = `stem-${project.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30)}`;
      setRepoName(sanitized || "stemtribe-capstone");
      setRepoDescription(project.description || `STEMtribe Academy Capstone Project: ${project.title}`);
      setPushSuccess(null);
    }
  }, [project]);

  const handlePushToGitHub = async () => {
    const cleanToken = token.trim();
    if (!cleanToken) {
      toast({
        title: "GitHub Token Required",
        description: "Please provide a GitHub Personal Access Token (PAT) with 'repo' scope.",
        variant: "destructive",
      });
      return;
    }

    const cleanRepoName = repoName.trim().replace(/\s+/g, "-");
    if (!cleanRepoName) {
      toast({
        title: "Repository Name Required",
        description: "Please provide a valid repository name.",
        variant: "destructive",
      });
      return;
    }

    setPushing(true);
    try {
      if (saveToken) {
        localStorage.setItem("stemtribe_github_pat", cleanToken);
      }

      // 1. Authenticate with GitHub & get username
      const userRes = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${cleanToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      if (!userRes.ok) {
        const userErr = await userRes.json().catch(() => ({}));
        throw new Error(userErr.message || "Invalid GitHub token. Ensure it has 'repo' permissions.");
      }

      const userData = await userRes.json();
      const username = userData.login;

      // 2. Create the repository
      const createRepoRes = await fetch("https://api.github.com/user/repos", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cleanToken}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: cleanRepoName,
          description: repoDescription,
          private: isPrivate,
          auto_init: false,
        }),
      });

      let repoUrl = `https://github.com/${username}/${cleanRepoName}`;

      if (!createRepoRes.ok) {
        const repoErr = await createRepoRes.json().catch(() => ({}));
        // If repo already exists, we can still push files to it
        if (!repoErr.message?.includes("already exists")) {
          throw new Error(repoErr.message || "Failed to create GitHub repository.");
        }
      }

      // 3. Prepare README.md & Code file
      const readmeContent = `# ${project?.title || "STEMtribe Capstone Project"}

> Created by **${studentName}** at [STEMtribe LMS Academy](https://stemtribe.org)

## 📌 Project Overview
${project?.description || "A hands-on STEM programming and engineering capstone project."}

## 🚀 Built With
- Language / Environment: \`${project?.editor_type || "Python 3 / HTML5"}\`
- Completed Date: ${new Date(project?.submitted_at || Date.now()).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}

---
*Published automatically from STEMtribe Student Portfolio.*
`;

      const codeFileName =
        project?.editor_type === "monaco_python"
          ? "main.py"
          : project?.editor_type === "monaco_js"
          ? "app.js"
          : project?.editor_type === "monaco_css"
          ? "style.css"
          : "index.html";

      const projectCode = project?.code_content || `<!-- ${project?.title} code -->\n<h1>${project?.title}</h1>`;

      // Helper to encode Unicode string to Base64
      const toBase64 = (str: string) => window.btoa(unescape(encodeURIComponent(str)));

      // Helper to push a file
      const uploadFile = async (path: string, contentStr: string, commitMsg: string) => {
        // Check if file exists to retrieve SHA if overwriting
        let existingSha: string | undefined;
        try {
          const checkRes = await fetch(`https://api.github.com/repos/${username}/${cleanRepoName}/contents/${path}`, {
            headers: {
              Authorization: `Bearer ${cleanToken}`,
              Accept: "application/vnd.github.v3+json",
            },
          });
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            existingSha = checkData.sha;
          }
        } catch {}

        const putRes = await fetch(`https://api.github.com/repos/${username}/${cleanRepoName}/contents/${path}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${cleanToken}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: commitMsg,
            content: toBase64(contentStr),
            sha: existingSha,
          }),
        });

        if (!putRes.ok) {
          const errData = await putRes.json().catch(() => ({}));
          throw new Error(`Failed to upload ${path}: ${errData.message || "Unknown error"}`);
        }
      };

      // Push README.md
      await uploadFile("README.md", readmeContent, `Initial commit: Add README for ${project?.title}`);

      // Push code file
      await uploadFile(codeFileName, projectCode, `Add source code: ${codeFileName}`);

      soundEffects.playSuccess();
      setPushSuccess(repoUrl);
      toast({
        title: "🚀 Repository Created & Pushed!",
        description: `Successfully published to GitHub: ${repoUrl}`,
      });
    } catch (err: any) {
      console.error("GitHub push error:", err);
      soundEffects.playError();
      toast({
        title: "GitHub Push Failed",
        description: err.message || "Failed to push repository to GitHub.",
        variant: "destructive",
      });
    } finally {
      setPushing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-slate-900 text-white">
              <Github className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                Publish Capstone to GitHub
                <Badge className="bg-emerald-600 text-white text-[10px]">Capstone Project</Badge>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Create a GitHub repository and showcase your project code to the world.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {pushSuccess ? (
          <div className="space-y-4 py-4 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-600 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">Awesome! Your code is live on GitHub!</h3>
              <p className="text-xs text-muted-foreground">
                Your repository has been created with a generated <code>README.md</code> and your project source code.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/40 border text-xs font-mono text-emerald-600 break-all">
              {pushSuccess}
            </div>
            <div className="pt-2 flex justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-xs"
              >
                Close
              </Button>
              <Button
                size="sm"
                onClick={() => window.open(pushSuccess, "_blank")}
                className="bg-slate-900 hover:bg-slate-800 text-white text-xs gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View on GitHub
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Project Pill */}
            <div className="p-3 rounded-lg border bg-muted/20 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-foreground">{project?.title}</span>
                <p className="text-[11px] text-muted-foreground">
                  File: {project?.editor_type === "monaco_python" ? "main.py" : "index.html"} + README.md
                </p>
              </div>
              <Badge variant="outline" className="text-[10px] uppercase">
                {project?.editor_type?.replace("monaco_", "") || "code"}
              </Badge>
            </div>

            {/* Token Input */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Key className="w-3.5 h-3.5 text-muted-foreground" />
                  GitHub Personal Access Token (PAT):
                </span>
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo&description=STEMtribe%20LMS%20Capstone"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-blue-600 hover:underline flex items-center gap-1"
                >
                  Generate Token <ExternalLink className="w-3 h-3" />
                </a>
              </Label>
              <Input
                type="password"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="h-8 text-xs font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                Requires <code>repo</code> scope to create repositories and commit code.
              </p>
            </div>

            {/* Repo Name */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Repository Name:</Label>
              <Input
                placeholder="stemtribe-robot-rover"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>

            {/* Repo Description */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Description:</Label>
              <Textarea
                placeholder="A STEMtribe Academy capstone project..."
                value={repoDescription}
                onChange={(e) => setRepoDescription(e.target.value)}
                rows={2}
                className="text-xs resize-none"
              />
            </div>

            {/* Options */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="flex items-center justify-between p-2 rounded-lg border bg-background">
                <span className="text-xs flex items-center gap-1">
                  {isPrivate ? <Lock className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                  {isPrivate ? "Private" : "Public"}
                </span>
                <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg border bg-background">
                <span className="text-xs text-muted-foreground">Save Token</span>
                <Switch checked={saveToken} onCheckedChange={setSaveToken} />
              </div>
            </div>

            <DialogFooter className="pt-2 gap-2 sm:justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handlePushToGitHub}
                disabled={pushing}
                className="bg-slate-900 hover:bg-slate-800 text-white text-xs gap-1.5 font-semibold"
              >
                {pushing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Pushing to GitHub...
                  </>
                ) : (
                  <>
                    <Github className="w-3.5 h-3.5" />
                    Push Capstone to GitHub 🚀
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
