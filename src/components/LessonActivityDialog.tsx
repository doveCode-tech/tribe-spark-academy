import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Plus, 
  Trash2, 
  Upload, 
  X, 
  ArrowUp, 
  ArrowDown, 
  Video, 
  Youtube, 
  Code2, 
  ExternalLink, 
  Bug, 
  FileCode, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  Trophy,
  AlertCircle,
  Lightbulb,
  Volume2,
  Image as ImageIcon
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ActivityHint {
  step?: number;
  text?: string;
  image_url?: string;
  audio_url?: string;
}

export interface ActivityItem {
  id: string;
  title: string;
  instructions?: string;
  editor_type: "none" | "monaco_html" | "monaco_python" | "monaco_js" | "monaco_css" | "scratch" | "external";
  project_mode: "standard" | "starter" | "debug";
  starter_code?: string;
  external_url?: string;
  is_assignment: boolean;
  status: "published" | "draft";
  type?: string;
  hints?: ActivityHint[];
}

export interface LessonData {
  id?: string;
  title: string;
  description: string;
  content: string;
  instructions?: string;
  duration_minutes: number;
  video_url?: string | null;
  video_urls?: string[] | null;
  youtube_urls?: string[] | null;
  exercises?: ActivityItem[] | any;
  assignment_required?: boolean;
  quiz_required?: boolean;
  is_end_of_course?: boolean;
  order_index?: number;
}

interface LessonActivityDialogProps {
  lesson: LessonData | null;
  courseId: string;
  onSave: (data: Partial<LessonData>) => void;
  onCancel: () => void;
}

export function LessonActivityDialog({ lesson, courseId, onSave, onCancel }: LessonActivityDialogProps) {
  const { toast } = useToast();

  // Basic lesson info
  const [title, setTitle] = useState(lesson?.title || "");
  const [description, setDescription] = useState(lesson?.description || "");
  const [content, setContent] = useState(lesson?.content || "");
  const [duration, setDuration] = useState(lesson?.duration_minutes || 45);
  const [assignmentRequired, setAssignmentRequired] = useState(lesson?.assignment_required || false);
  const [quizRequired, setQuizRequired] = useState(lesson?.quiz_required || false);
  const [isEndOfCourse, setIsEndOfCourse] = useState(lesson?.is_end_of_course || false);

  // Videos
  const [videoUrls, setVideoUrls] = useState<string[]>(lesson?.video_urls || []);
  const [youtubeUrls, setYoutubeUrls] = useState<string[]>(lesson?.youtube_urls || []);
  const [newYoutubeUrl, setNewYoutubeUrl] = useState("");
  const [newVideoUrl, setNewVideoUrl] = useState("");
  const [uploadingVideo, setUploadingVideo] = useState(false);

  // Activities
  const [activities, setActivities] = useState<ActivityItem[]>(() => {
    if (Array.isArray(lesson?.exercises)) {
      return lesson.exercises.map((ex: any, idx: number) => ({
        id: ex.id || `act_${Date.now()}_${idx}`,
        title: ex.title || `Activity ${idx + 1}`,
        instructions: ex.instructions || ex.description || "",
        editor_type: ex.editor_type || (ex.type === "video" ? "none" : "monaco_html"),
        project_mode: ex.project_mode || "standard",
        starter_code: ex.starter_code || "",
        external_url: ex.external_url || "",
        is_assignment: ex.is_assignment ?? false,
        status: ex.status || "published",
        type: ex.type || "practice",
      }));
    }
    return [];
  });

  useEffect(() => {
    setTitle(lesson?.title || "");
    setDescription(lesson?.description || "");
    setContent(lesson?.content || "");
    setDuration(lesson?.duration_minutes || 45);
    setAssignmentRequired(lesson?.assignment_required || false);
    setQuizRequired(lesson?.quiz_required || false);
    setIsEndOfCourse(lesson?.is_end_of_course || false);
    setVideoUrls(lesson?.video_urls || []);
    setYoutubeUrls(lesson?.youtube_urls || []);

    if (Array.isArray(lesson?.exercises)) {
      setActivities(lesson.exercises.map((ex: any, idx: number) => ({
        id: ex.id || `act_${Date.now()}_${idx}`,
        title: ex.title || `Activity ${idx + 1}`,
        instructions: ex.instructions || ex.description || "",
        editor_type: ex.editor_type || (ex.type === "video" ? "none" : "monaco_html"),
        project_mode: ex.project_mode || "standard",
        starter_code: ex.starter_code || "",
        external_url: ex.external_url || "",
        is_assignment: ex.is_assignment ?? false,
        status: ex.status || "published",
        type: ex.type || "practice",
      })));
    } else {
      setActivities([]);
    }
  }, [lesson]);

  // ── Video Handlers ─────────────────────────────────────────────────────────
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingVideo(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const path = `${courseId}/${Date.now()}-${safeName}`;

      const { error: upErr } = await supabase.storage.from("lesson-videos").upload(path, file, { upsert: false });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("lesson-videos").getPublicUrl(path);
      if (pub?.publicUrl) {
        setVideoUrls(prev => [...prev, pub.publicUrl]);
        toast({ title: "Video Uploaded", description: `${file.name} attached to lesson.` });
      }
    } catch (err: any) {
      console.error("Video upload error:", err);
      toast({ title: "Upload Failed", description: err.message || "Failed to upload video.", variant: "destructive" });
    } finally {
      setUploadingVideo(false);
      e.target.value = "";
    }
  };

  const addYoutubeUrl = () => {
    const url = newYoutubeUrl.trim();
    if (!url) return;
    setYoutubeUrls(prev => [...prev, url]);
    setNewYoutubeUrl("");
    toast({ title: "YouTube Link Added" });
  };

  const addDirectVideoUrl = () => {
    const url = newVideoUrl.trim();
    if (!url) return;
    setVideoUrls(prev => [...prev, url]);
    setNewVideoUrl("");
    toast({ title: "Video URL Added" });
  };

  const removeVideoUrl = (index: number) => {
    setVideoUrls(prev => prev.filter((_, i) => i !== index));
  };

  const removeYoutubeUrl = (index: number) => {
    setYoutubeUrls(prev => prev.filter((_, i) => i !== index));
  };

  // ── Activity Handlers ──────────────────────────────────────────────────────
  const addActivity = () => {
    const newAct: ActivityItem = {
      id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      title: `Activity ${activities.length + 1}`,
      instructions: "",
      editor_type: "monaco_html",
      project_mode: "standard",
      starter_code: "",
      external_url: "",
      is_assignment: false,
      status: "published",
      type: "practice",
    };
    setActivities(prev => [...prev, newAct]);
  };

  const updateActivity = (index: number, field: keyof ActivityItem, value: any) => {
    setActivities(prev => prev.map((act, i) => i === index ? { ...act, [field]: value } : act));
  };

  const deleteActivity = (index: number) => {
    // Preserves historical records in DB: only removes from this lesson's active exercises list
    setActivities(prev => prev.filter((_, i) => i !== index));
  };

  const moveActivity = (index: number, direction: "up" | "down") => {
    const newIdx = direction === "up" ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= activities.length) return;
    setActivities(prev => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[newIdx];
      copy[newIdx] = temp;
      return copy;
    });
  };

  // ── Save Form ──────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!title.trim()) {
      toast({ title: "Title required", description: "Please enter a lesson title.", variant: "destructive" });
      return;
    }

    onSave({
      title: title.trim(),
      description: description.trim(),
      content: content.trim(),
      instructions: content.trim(),
      duration_minutes: duration,
      video_url: videoUrls[0] || null,
      video_urls: videoUrls,
      youtube_urls: youtubeUrls,
      exercises: activities,
      assignment_required: assignmentRequired,
      quiz_required: quizRequired,
      is_end_of_course: isEndOfCourse,
    });
  };

  return (
    <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
      <DialogHeader>
        <DialogTitle className="text-xl flex items-center gap-2">
          {lesson ? "Edit Lesson & Activities" : "Create New Lesson & Activities"}
        </DialogTitle>
        <DialogDescription>
          Configure lesson details, training videos, and dynamic interactive student activities.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6 pt-2">
        {/* Section 1: Lesson Details */}
        <div className="space-y-3 p-4 rounded-xl border bg-muted/20">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileCode className="w-4 h-4 text-primary" />
            Lesson Details
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <Label className="text-xs">Lesson Title *</Label>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g., Lesson 1: Introduction to Robotics"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Duration (minutes)</Label>
              <Input
                type="number"
                value={duration}
                onChange={e => setDuration(Number(e.target.value))}
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Short Description</Label>
            <Input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief summary shown on course list cards"
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Lesson Overview &amp; Learning Objectives</Label>
            <Textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Detailed lesson content, topics covered, and student guidance..."
              rows={3}
              className="text-xs"
            />
          </div>
        </div>

        {/* Section 2: Lesson Videos (Optional) */}
        <div className="space-y-3 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-2">
              <Video className="w-4 h-4 text-blue-600" />
              Lesson Training Videos (Optional)
            </h3>
            <span className="text-[11px] text-muted-foreground bg-background px-2 py-0.5 rounded border">
              Optional — leave empty if not needed
            </span>
          </div>

          {/* List existing attached videos */}
          {(videoUrls.length > 0 || youtubeUrls.length > 0) && (
            <div className="space-y-2 pt-1">
              {youtubeUrls.map((url, idx) => (
                <div key={`yt-${idx}`} className="flex items-center justify-between p-2 rounded-lg bg-background border text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <Youtube className="w-4 h-4 text-red-500 shrink-0" />
                    <span className="truncate">{url}</span>
                  </div>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500 hover:text-red-600" onClick={() => removeYoutubeUrl(idx)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}

              {videoUrls.map((url, idx) => (
                <div key={`vid-${idx}`} className="flex items-center justify-between p-2 rounded-lg bg-background border text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <Video className="w-4 h-4 text-blue-500 shrink-0" />
                    <span className="truncate">{url.split("/").pop()}</span>
                  </div>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500 hover:text-red-600" onClick={() => removeVideoUrl(idx)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Add video methods */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {/* YouTube link */}
            <div className="space-y-1.5 bg-background p-3 rounded-lg border">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Youtube className="w-3.5 h-3.5 text-red-500" />
                Add YouTube Video Link
              </Label>
              <div className="flex gap-1.5">
                <Input
                  type="url"
                  placeholder="https://youtube.com/watch?v=..."
                  value={newYoutubeUrl}
                  onChange={e => setNewYoutubeUrl(e.target.value)}
                  className="h-8 text-xs flex-1"
                />
                <Button type="button" size="sm" variant="outline" onClick={addYoutubeUrl} className="h-8 text-xs">
                  Add
                </Button>
              </div>
            </div>

            {/* Upload MP4 from device */}
            <div className="space-y-1.5 bg-background p-3 rounded-lg border">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-blue-500" />
                Upload MP4 Video from Computer
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="video/*"
                  onChange={handleVideoUpload}
                  disabled={uploadingVideo}
                  className="h-8 text-xs cursor-pointer flex-1"
                />
              </div>
              {uploadingVideo && <p className="text-[11px] text-blue-600 animate-pulse">Uploading video...</p>}
            </div>
          </div>
        </div>

        {/* Section 3: Activities Configuration (PRD Core) */}
        <div className="space-y-4 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                <Code2 className="w-4 h-4 text-emerald-600" />
                Activities &amp; Coding Tasks ({activities.length})
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure student interactive activities, code editors, debug challenges, or external tools.
              </p>
            </div>
            <Button type="button" size="sm" onClick={addActivity} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 h-8 text-xs font-semibold">
              <Plus className="w-3.5 h-3.5" />
              Add Activity
            </Button>
          </div>

          {activities.length === 0 && (
            <div className="text-center py-6 border border-dashed rounded-lg bg-background text-muted-foreground text-xs space-y-2">
              <p>No activities configured for this lesson yet.</p>
              <Button type="button" size="sm" variant="outline" onClick={addActivity} className="text-xs">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Create First Activity
              </Button>
            </div>
          )}

          <div className="space-y-4">
            {activities.map((act, index) => (
              <div key={act.id} className="rounded-xl border bg-background p-4 space-y-3 shadow-sm">
                {/* Activity Card Header */}
                <div className="flex items-center justify-between border-b pb-2.5 gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs font-bold bg-emerald-500/10 text-emerald-700 border-emerald-300">
                      Activity #{index + 1}
                    </Badge>
                    <Badge variant={act.status === "published" ? "default" : "secondary"} className="text-[10px] uppercase tracking-wider">
                      {act.status}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Reorder Buttons */}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      disabled={index === 0}
                      onClick={() => moveActivity(index, "up")}
                      title="Move Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      disabled={index === activities.length - 1}
                      onClick={() => moveActivity(index, "down")}
                      title="Move Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </Button>

                    {/* Delete Activity */}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => deleteActivity(index)}
                      title="Delete Activity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* 1. Activity Title */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">1. Activity Title *</Label>
                  <Input
                    value={act.title}
                    onChange={e => updateActivity(index, "title", e.target.value)}
                    placeholder="e.g., Build an Interactive Robot Arm Web Page"
                    className="h-8 text-xs font-medium"
                  />
                </div>

                {/* 2. Instructions / Description */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">2. Instructions / Description (shown to student)</Label>
                  <Textarea
                    value={act.instructions || ""}
                    onChange={e => updateActivity(index, "instructions", e.target.value)}
                    placeholder="Step-by-step guidance, instructions, or challenge objectives..."
                    rows={2}
                    className="text-xs"
                  />
                </div>

                {/* 3 & 4. Editor Type & Project Type */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">3. Editor / IDE Type</Label>
                    <Select value={act.editor_type} onValueChange={val => updateActivity(index, "editor_type", val)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None (Text / Video only)</SelectItem>
                        <SelectItem value="monaco_html">HTML/CSS Editor</SelectItem>
                        <SelectItem value="monaco_python">Python Editor</SelectItem>
                        <SelectItem value="monaco_js">JavaScript Editor</SelectItem>
                        <SelectItem value="monaco_css">CSS Editor</SelectItem>
                        <SelectItem value="scratch">Scratch Embed</SelectItem>
                        <SelectItem value="external">External Tool</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">4. Project Type</Label>
                    <Select value={act.project_mode} onValueChange={val => updateActivity(index, "project_mode", val)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Blank Project</SelectItem>
                        <SelectItem value="starter">Starter Template</SelectItem>
                        <SelectItem value="debug">Debug Project (Fix the Bug)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* 5. Starter / Buggy Code (Only for Starter or Debug) */}
                {act.editor_type !== "none" && act.editor_type !== "scratch" && act.editor_type !== "external" && (
                  <div className="space-y-1 pt-1">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      {act.project_mode === "debug" ? (
                        <>
                          <Bug className="w-3.5 h-3.5 text-red-500" />
                          <span className="text-red-600 font-semibold">5. Buggy Code (Code with intentional bugs for students to solve)</span>
                        </>
                      ) : (
                        <span>5. Starter Code (Initial code template for students)</span>
                      )}
                    </Label>
                    <Textarea
                      value={act.starter_code || ""}
                      onChange={e => updateActivity(index, "starter_code", e.target.value)}
                      placeholder={act.project_mode === "debug" ? "Paste code containing errors that the student needs to debug..." : "Paste starter boilerplate code..."}
                      rows={3}
                      className="text-xs font-mono"
                    />
                  </div>
                )}

                {/* 6. External Tool URL (Only for External) */}
                {act.editor_type === "external" && (
                  <div className="space-y-1 pt-1">
                    <Label className="text-xs font-semibold flex items-center gap-1">
                      <ExternalLink className="w-3 h-3 text-blue-500" />
                      6. External Tool URL
                    </Label>
                    <Input
                      type="url"
                      value={act.external_url || ""}
                      onChange={e => updateActivity(index, "external_url", e.target.value)}
                      placeholder="e.g. https://create.roblox.com, https://appinventor.mit.edu, https://tinkercad.com"
                      className="h-8 text-xs"
                    />
                  </div>
                )}

                {/* 7 & 8. Submission Rule & Status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t">
                  <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/20">
                    <div className="space-y-0.5">
                      <Label className="text-xs font-semibold">7. Submission Rule</Label>
                      <p className="text-[11px] text-muted-foreground">
                        {act.is_assignment ? "Assignment (Save + Submit to Tutor)" : "Exercise (Save only)"}
                      </p>
                    </div>
                    <Switch
                      checked={act.is_assignment}
                      onCheckedChange={v => updateActivity(index, "is_assignment", v)}
                    />
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/20">
                    <div className="space-y-0.5">
                      <Label className="text-xs font-semibold">8. Activity Status</Label>
                      <p className="text-[11px] text-muted-foreground">
                        {act.status === "published" ? "Published (Visible to students)" : "Draft (Hidden from students)"}
                      </p>
                    </div>
                    <Switch
                      checked={act.status === "published"}
                      onCheckedChange={v => updateActivity(index, "status", v ? "published" : "draft")}
                    />
                  </div>
                </div>

                {/* 9. Step Hints & Audio Guidance */}
                <div className="space-y-2 pt-3 border-t">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                      <span>9. Step Hints &amp; Audio Guidance (Text, Code Snapshots, Voice Instructions)</span>
                    </Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 border-amber-500/40 text-amber-600 hover:bg-amber-50"
                      onClick={() => {
                        const currentHints = act.hints || [];
                        updateActivity(index, "hints", [
                          ...currentHints,
                          { step: 1, text: "", image_url: "", audio_url: "" }
                        ]);
                      }}
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Step Hint</span>
                    </Button>
                  </div>

                  {act.hints && act.hints.length > 0 && (
                    <div className="space-y-2 pt-1">
                      {act.hints.map((hint, hIdx) => (
                        <div key={hIdx} className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-amber-800 dark:text-amber-200">Hint for:</span>
                              <Select
                                value={String(hint.step || 1)}
                                onValueChange={(val) => {
                                  const copy = [...(act.hints || [])];
                                  copy[hIdx] = { ...copy[hIdx], step: Number(val) };
                                  updateActivity(index, "hints", copy);
                                }}
                              >
                                <SelectTrigger className="h-7 text-xs w-28">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1">Step 1</SelectItem>
                                  <SelectItem value="2">Step 2</SelectItem>
                                  <SelectItem value="3">Step 3</SelectItem>
                                  <SelectItem value="4">Step 4</SelectItem>
                                  <SelectItem value="5">Step 5</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-600"
                              onClick={() => {
                                const copy = (act.hints || []).filter((_, i) => i !== hIdx);
                                updateActivity(index, "hints", copy);
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <div>
                              <Label className="text-[11px] text-muted-foreground">Text Clue / Explanation</Label>
                              <Input
                                placeholder="Clue or step details..."
                                value={hint.text || ""}
                                onChange={(e) => {
                                  const copy = [...(act.hints || [])];
                                  copy[hIdx] = { ...copy[hIdx], text: e.target.value };
                                  updateActivity(index, "hints", copy);
                                }}
                                className="h-7 text-xs"
                              />
                            </div>
                            <div>
                              <Label className="text-[11px] text-muted-foreground">Image / Code Snapshot URL</Label>
                              <Input
                                placeholder="https://... image URL"
                                value={hint.image_url || ""}
                                onChange={(e) => {
                                  const copy = [...(act.hints || [])];
                                  copy[hIdx] = { ...copy[hIdx], image_url: e.target.value };
                                  updateActivity(index, "hints", copy);
                                }}
                                className="h-7 text-xs"
                              />
                            </div>
                            <div>
                              <Label className="text-[11px] text-muted-foreground">Audio Voice URL (For kids)</Label>
                              <Input
                                placeholder="https://... audio.mp3"
                                value={hint.audio_url || ""}
                                onChange={(e) => {
                                  const copy = [...(act.hints || [])];
                                  copy[hIdx] = { ...copy[hIdx], audio_url: e.target.value };
                                  updateActivity(index, "hints", copy);
                                }}
                                className="h-7 text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: Completion Requirements */}
        <div className="space-y-3 p-4 rounded-xl border bg-muted/20">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            Completion Rules
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-center justify-between p-2.5 rounded-lg border bg-background">
              <Label className="text-xs font-medium cursor-pointer">Assignment Required</Label>
              <Switch checked={assignmentRequired} onCheckedChange={setAssignmentRequired} />
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg border bg-background">
              <Label className="text-xs font-medium cursor-pointer">Quiz Required</Label>
              <Switch checked={quizRequired} onCheckedChange={setQuizRequired} />
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg border bg-background">
              <Label className="text-xs font-medium cursor-pointer">End of Course</Label>
              <Switch checked={isEndOfCourse} onCheckedChange={setIsEndOfCourse} />
            </div>
          </div>
        </div>
      </div>

      <DialogFooter className="pt-4 border-t gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave} className="font-semibold bg-primary hover:bg-primary/90">
          Save Lesson &amp; Activities
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
