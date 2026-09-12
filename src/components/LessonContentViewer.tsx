import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Video, BookOpen, FileText, Upload, CheckCircle, ClipboardList, Users, ExternalLink } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { LessonSubmissions } from "./LessonSubmissions";
import { ActivityCodeEditor, EditorType } from "./ActivityCodeEditor";

interface LessonContentViewerProps {
  lesson: {
    id: string;
    title: string;
    description: string;
    content: string;
    video_urls: string[] | null;
    youtube_urls: string[] | null;
    instructions: string | null;
    exercises: any;
    course_id: string;
    assignment_required?: boolean;
  };
  onSubmitAssignment?: () => void;
}

export function LessonContentViewer({ lesson, onSubmitAssignment }: LessonContentViewerProps) {
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [assignmentDescription, setAssignmentDescription] = useState("");
  const [assignmentLink, setAssignmentLink] = useState("");
  const [assignmentFile, setAssignmentFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmitAssignment = async () => {
    if (!assignmentTitle.trim()) {
      toast({ title: "Error", description: "Please provide an assignment title", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      let filePath = null;

      if (assignmentFile) {
        const fileName = `${lesson.course_id}/${Date.now()}-${assignmentFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("project-submissions")
          .upload(fileName, assignmentFile);
        if (uploadError) throw uploadError;
        filePath = fileName;
      }

      const { error: insertError } = await supabase.from("projects").insert({
        course_id: lesson.course_id,
        lesson_id: lesson.id,
        student_id: userProfile?.auth_user_id,
        title: assignmentTitle,
        description: assignmentDescription,
        link: assignmentLink,
        file_path: filePath,
        review_status: "submitted",
        submitted_at: new Date().toISOString(),
      });

      if (insertError) throw insertError;

      toast({ title: "Success!", description: "Assignment submitted successfully. Your tutor will review it soon." });
      setAssignmentTitle("");
      setAssignmentDescription("");
      setAssignmentLink("");
      setAssignmentFile(null);
      onSubmitAssignment?.();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to submit assignment", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const isTutorOrAdmin =
    userProfile?.role === "tutor" ||
    userProfile?.role === "ultimate_tutor" ||
    userProfile?.role === "admin";

  const hasExercises = lesson.exercises && Array.isArray(lesson.exercises) && lesson.exercises.length > 0;
  const hasVideos =
    (lesson.video_urls && lesson.video_urls.length > 0) ||
    (lesson.youtube_urls && lesson.youtube_urls.length > 0);

  // Helper to get a proper YouTube embed URL
  const getYoutubeEmbed = (url: string) => {
    if (url.includes("youtu.be/")) {
      const id = url.split("youtu.be/")[1]?.split("?")[0];
      return `https://www.youtube.com/embed/${id}`;
    }
    if (url.includes("watch?v=")) {
      const id = url.split("watch?v=")[1]?.split("&")[0];
      return `https://www.youtube.com/embed/${id}`;
    }
    return url;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{lesson.title}</CardTitle>
        <CardDescription>{lesson.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="video" className="w-full">
          <TabsList className={`grid w-full ${isTutorOrAdmin ? "grid-cols-5" : "grid-cols-4"}`}>
            <TabsTrigger value="video">
              <Video className="w-4 h-4 mr-2" />
              Videos
            </TabsTrigger>
            <TabsTrigger value="instructions">
              <ClipboardList className="w-4 h-4 mr-2" />
              Instructions
            </TabsTrigger>
            <TabsTrigger value="exercises">
              <BookOpen className="w-4 h-4 mr-2" />
              Exercises
            </TabsTrigger>
            <TabsTrigger value="assignment">
              <FileText className="w-4 h-4 mr-2" />
              Assignment
            </TabsTrigger>
            {isTutorOrAdmin && (
              <TabsTrigger value="submissions">
                <Users className="w-4 h-4 mr-2" />
                Submissions
              </TabsTrigger>
            )}
          </TabsList>

          {/* ── VIDEOS TAB ─────────────────────────────────────────────────────── */}
          <TabsContent value="video" className="space-y-4">
            {hasVideos ? (
              <div className="space-y-6">
                {lesson.video_urls && lesson.video_urls.map((url, index) => (
                  <div key={`video-${index}`} className="space-y-2">
                    <h4 className="font-medium text-sm">Video {index + 1}</h4>
                    <div className="aspect-video w-full rounded-lg overflow-hidden bg-muted">
                      <video src={url} className="w-full h-full" controls />
                    </div>
                  </div>
                ))}
                {lesson.youtube_urls && lesson.youtube_urls.map((url, index) => (
                  <div key={`youtube-${index}`} className="space-y-2">
                    <h4 className="font-medium text-sm">YouTube Tutorial {index + 1}</h4>
                    <div className="aspect-video w-full rounded-lg overflow-hidden bg-muted">
                      <iframe
                        src={getYoutubeEmbed(url)}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title={`YouTube ${index + 1}`}
                      />
                    </div>
                  </div>
                ))}
                {lesson.content && (
                  <div className="prose prose-sm max-w-none">
                    <p>{lesson.content}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Video className="w-12 h-12 mx-auto mb-2 opacity-40" />
                <p>No videos available for this lesson yet.</p>
              </div>
            )}
          </TabsContent>

          {/* ── INSTRUCTIONS TAB ───────────────────────────────────────────────── */}
          <TabsContent value="instructions" className="space-y-4">
            {lesson.instructions ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <ClipboardList className="w-5 h-5 mr-2" />
                    Lesson Instructions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed">
                    {lesson.instructions}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <ClipboardList className="w-12 h-12 mx-auto mb-2 opacity-40" />
                <p>No instructions available for this lesson.</p>
              </div>
            )}
          </TabsContent>

          {/* ── EXERCISES TAB ─────────────────────────────────────────────────── */}
          <TabsContent value="exercises" className="space-y-6">
            {hasExercises ? (
              lesson.exercises.map((exercise: any, index: number) => {
                const editorType: EditorType = exercise.editor_type || "none";
                const hasEditor = editorType !== "none";

                return (
                  <Card key={index}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">
                        {exercise.title || `Exercise ${index + 1}`}
                      </CardTitle>
                      {exercise.description && (
                        <CardDescription>{exercise.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* External URL courses: show instructions + link */}
                      {editorType === "external" && (
                        <ActivityCodeEditor
                          exercise={exercise}
                          lessonId={lesson.id}
                          courseId={lesson.course_id}
                        />
                      )}

                      {/* Scratch courses */}
                      {editorType === "scratch" && (
                        <ActivityCodeEditor
                          exercise={exercise}
                          lessonId={lesson.id}
                          courseId={lesson.course_id}
                        />
                      )}

                      {/* Monaco editor courses (HTML/JS/Python/CSS) */}
                      {(editorType === "monaco_html" || editorType === "monaco_js" || editorType === "monaco_python" || editorType === "monaco_css") && (
                        <ActivityCodeEditor
                          exercise={exercise}
                          lessonId={lesson.id}
                          courseId={lesson.course_id}
                        />
                      )}

                      {/* Text/link only exercises */}
                      {editorType === "none" && (
                        <div className="space-y-2">
                          {exercise.instructions || exercise.prompt ? (
                            <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {exercise.instructions || exercise.prompt}
                            </div>
                          ) : null}
                          {exercise.question && (
                            <div className="space-y-2">
                              <p className="font-medium text-sm">{exercise.question}</p>
                              {exercise.options && (
                                <ul className="list-disc list-inside space-y-1">
                                  {exercise.options.map((opt: string, i: number) => (
                                    <li key={i} className="text-sm">{opt}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                          {exercise.is_assignment && (
                            <ActivityCodeEditor
                              exercise={exercise}
                              lessonId={lesson.id}
                              courseId={lesson.course_id}
                            />
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-40" />
                <p>No exercises available for this lesson.</p>
              </div>
            )}
          </TabsContent>

          {/* ── ASSIGNMENT TAB ─────────────────────────────────────────────────── */}
          <TabsContent value="assignment" className="space-y-4">
            <div className="space-y-4">
              {lesson.assignment_required ? (
                <>
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-200">
                    ⚠️ This lesson requires an assignment submission to mark as complete.
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="title">Assignment Title *</Label>
                    <Input
                      id="title"
                      value={assignmentTitle}
                      onChange={(e) => setAssignmentTitle(e.target.value)}
                      placeholder="Enter your assignment title"
                      disabled={submitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={assignmentDescription}
                      onChange={(e) => setAssignmentDescription(e.target.value)}
                      placeholder="Describe what you've learned or built"
                      rows={4}
                      disabled={submitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="link">Project Link (Optional)</Label>
                    <Input
                      id="link"
                      type="url"
                      value={assignmentLink}
                      onChange={(e) => setAssignmentLink(e.target.value)}
                      placeholder="https://... (GitHub, Scratch, Roblox, etc.)"
                      disabled={submitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="file">Upload File (Optional)</Label>
                    <Input
                      id="file"
                      type="file"
                      onChange={(e) => setAssignmentFile(e.target.files?.[0] || null)}
                      disabled={submitting}
                    />
                    {assignmentFile && (
                      <p className="text-sm text-muted-foreground">Selected: {assignmentFile.name}</p>
                    )}
                  </div>

                  <Button
                    onClick={handleSubmitAssignment}
                    disabled={submitting || !assignmentTitle.trim()}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    {submitting ? (
                      "Submitting..."
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Submit Assignment
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-40" />
                  <p>No assignment required for this lesson.</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── SUBMISSIONS TAB (staff only) ──────────────────────────────────── */}
          {isTutorOrAdmin && (
            <TabsContent value="submissions" className="space-y-4">
              <LessonSubmissions lessonId={lesson.id} courseId={lesson.course_id} />
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}
