import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Video, 
  BookOpen, 
  FileText, 
  Upload, 
  CheckCircle, 
  ClipboardList, 
  Users, 
  ExternalLink,
  HelpCircle,
  Trophy,
  Zap,
  CheckCircle2
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { LessonSubmissions } from "./LessonSubmissions";
import { ActivityCodeEditor, EditorType } from "./ActivityCodeEditor";
import { QuizInterface } from "./QuizInterface";
import { awardXP, XP_REWARDS } from "@/utils/gamification";
import { soundEffects } from "@/utils/audio";

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
    quiz_required?: boolean;
    quiz_data?: any;
  };
  onSubmitAssignment?: () => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  completedActivityIds?: string[];
  onToggleActivityComplete?: (activityId: string, completed: boolean, xpAmount: number) => void;
  onQuizCompleted?: () => void;
}

export function LessonContentViewer({ 
  lesson, 
  onSubmitAssignment,
  activeTab,
  onTabChange,
  completedActivityIds = [],
  onToggleActivityComplete,
  onQuizCompleted
}: LessonContentViewerProps) {
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const [internalTab, setInternalTab] = useState("video");
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [assignmentDescription, setAssignmentDescription] = useState("");
  const [assignmentLink, setAssignmentLink] = useState("");
  const [assignmentFile, setAssignmentFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [quiz, setQuiz] = useState<any>(null);

  const currentTab = activeTab || internalTab;
  const handleTabChange = (val: string) => {
    setInternalTab(val);
    onTabChange?.(val);
  };

  useEffect(() => {
    if (lesson.quiz_data) {
      setQuiz(lesson.quiz_data);
    } else {
      fetchQuiz();
    }
  }, [lesson.id, lesson.course_id]);

  const fetchQuiz = async () => {
    try {
      const { data } = await supabase
        .from('quizzes')
        .select('*')
        .eq('course_id', lesson.course_id)
        .maybeSingle();
      if (data) setQuiz(data);
    } catch (e) {
      console.warn("Quiz load note:", e);
    }
  };

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

      // Use authoritative submit_student_project RPC
      const { data: projectRes, error: rpcError } = await (supabase.rpc as any)('submit_student_project', {
        _course_id: lesson.course_id,
        _lesson_id: lesson.id,
        _title: assignmentTitle,
        _description: assignmentDescription || null,
        _link: assignmentLink || null,
        _file_path: filePath
      });

      if (rpcError) throw rpcError;

      // Record learning activity for streak tracking (3 points for project submission)
      try {
        await (supabase.rpc as any)('record_learning_activity', {
          _activity_type: 'project_submit',
          _lesson_id: lesson.id,
          _course_id: lesson.course_id,
          _points: 3
        });
      } catch (streakErr) {
        console.warn('Streak recording note:', streakErr);
      }

      // Award XP for assignment submission
      try {
        await awardXP(userProfile, XP_REWARDS.PROJECT_SUBMITTED, 'Submitted assignment: ' + assignmentTitle, lesson.id);
      } catch (xpErr) {
        console.warn('XP award note:', xpErr);
      }

      soundEffects.playSuccess();
      onToggleActivityComplete?.("lesson_final_assignment", true, XP_REWARDS.PROJECT_SUBMITTED);

      // Trigger notification to staff
      try {
        if (projectRes?.id) {
          await supabase.functions.invoke('notify-project-submission', {
            body: {
              projectId: projectRes.id,
              courseId: lesson.course_id,
              lessonId: lesson.id,
              studentId: userProfile?.auth_user_id,
              projectTitle: assignmentTitle,
            }
          });
        }
      } catch (notifErr) {
        console.warn('Notification note:', notifErr);
      }

      toast({ 
        title: "Success! 🚀 (+100 XP)", 
        description: "Assignment submitted successfully. Your tutor will review it soon." 
      });
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
        {(() => {
          const hasQuiz = Boolean(lesson.quiz_required || lesson.quiz_data || quiz);
          const tabCols = 3 + (hasQuiz ? 1 : 0) + 1 + (isTutorOrAdmin ? 1 : 0);

          return (
            <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
              <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${tabCols}, minmax(0, 1fr))` }}>
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
                  Exercises ({lesson.exercises?.length || 0})
                </TabsTrigger>
                {hasQuiz && (
                  <TabsTrigger value="quiz">
                    <HelpCircle className="w-4 h-4 mr-2 text-amber-500" />
                    Quiz
                  </TabsTrigger>
                )}
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
                    const actId = exercise.id || `act_${index}`;
                    const isCompleted = completedActivityIds.includes(actId);
                    const xpReward = exercise.xp_reward || (exercise.is_assignment ? 100 : editorType === "none" ? 20 : 40);

                    return (
                      <Card key={actId} className={`transition-all ${isCompleted ? "border-emerald-500/40 bg-emerald-500/5 shadow-sm" : ""}`}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              {isCompleted ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-100 dark:fill-emerald-950/40 shrink-0" />
                              ) : null}
                              <div>
                                <CardTitle className="text-base flex items-center gap-2">
                                  <span>{exercise.title || `Exercise ${index + 1}`}</span>
                                  {exercise.is_assignment && (
                                    <Badge variant="secondary" className="text-[10px]">Tutor Assignment</Badge>
                                  )}
                                </CardTitle>
                                {exercise.description && (
                                  <CardDescription>{exercise.description}</CardDescription>
                                )}
                              </div>
                            </div>

                            <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-xs font-bold gap-1">
                              <Zap className="w-3 h-3 fill-amber-500 text-amber-500" />
                              +{xpReward} XP
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {/* External URL courses: show instructions + link */}
                          {editorType === "external" && (
                            <ActivityCodeEditor
                              exercise={{ ...exercise, xp_reward: xpReward }}
                              lessonId={lesson.id}
                              courseId={lesson.course_id}
                              onActivityComplete={(xp) => onToggleActivityComplete?.(actId, true, xp)}
                            />
                          )}

                          {/* Scratch courses */}
                          {editorType === "scratch" && (
                            <ActivityCodeEditor
                              exercise={{ ...exercise, xp_reward: xpReward }}
                              lessonId={lesson.id}
                              courseId={lesson.course_id}
                              onActivityComplete={(xp) => onToggleActivityComplete?.(actId, true, xp)}
                            />
                          )}

                          {/* Monaco editor courses (HTML/JS/Python/CSS) */}
                          {(editorType === "monaco_html" || editorType === "monaco_js" || editorType === "monaco_python" || editorType === "monaco_css") && (
                            <ActivityCodeEditor
                              exercise={{ ...exercise, xp_reward: xpReward }}
                              lessonId={lesson.id}
                              courseId={lesson.course_id}
                              onActivityComplete={(xp) => onToggleActivityComplete?.(actId, true, xp)}
                            />
                          )}

                          {/* Text/link only exercises */}
                          {editorType === "none" && (
                            <div className="space-y-3">
                              {exercise.instructions || exercise.prompt ? (
                                <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
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
                                  exercise={{ ...exercise, xp_reward: xpReward }}
                                  lessonId={lesson.id}
                                  courseId={lesson.course_id}
                                  onActivityComplete={(xp) => onToggleActivityComplete?.(actId, true, xp)}
                                />
                              )}

                              <div className="pt-2 flex justify-end">
                                {isCompleted ? (
                                  <Badge className="bg-emerald-600 text-white gap-1.5 py-1 px-3 text-xs">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Completed
                                  </Badge>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      soundEffects.playSuccess();
                                      onToggleActivityComplete?.(actId, true, xpReward);
                                    }}
                                    className="gap-1.5 text-xs border-emerald-500/40 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    Mark Activity Completed (+{xpReward} XP)
                                  </Button>
                                )}
                              </div>
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

              {/* ── QUIZ TAB ────────────────────────────────────────────────────────── */}
              {hasQuiz && (
                <TabsContent value="quiz" className="space-y-4">
                  {quiz ? (
                    <QuizInterface
                      quiz={quiz}
                      onComplete={(passed, score) => {
                        if (passed) {
                          soundEffects.playSuccess();
                          awardXP(userProfile, 30, `Passed quiz for ${quiz.title || lesson.title}`, lesson.id);
                          onToggleActivityComplete?.("lesson_quiz", true, 30);
                          onQuizCompleted?.();
                          toast({
                            title: "🎉 Quiz Passed! (+30 XP)",
                            description: `Awesome job scoring ${score}%!`,
                          });
                        }
                      }}
                    />
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <HelpCircle className="w-12 h-12 mx-auto mb-2 opacity-40" />
                      <p>Loading quiz questions...</p>
                    </div>
                  )}
                </TabsContent>
              )}

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
      );
    })()}
  </CardContent>
</Card>
);
}
