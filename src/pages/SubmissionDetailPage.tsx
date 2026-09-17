import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { LMSLayout } from "@/components/LMSLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Code2,
  ExternalLink,
  FileText,
  History,
  RotateCcw,
  Save,
  Shield,
  Sliders,
  Star,
  User,
  AlertTriangle,
  Award,
  BookOpen,
  Copy,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ClickableStudentName } from "@/components/ClickableStudentName";
import { awardXP } from "@/utils/gamification";
import { createNotification } from "@/utils/notifications";
import { soundEffects } from "@/utils/audio";

interface SubmissionHistoryEntry {
  version: number;
  submitted_at: string;
  code_content?: string | null;
  link?: string | null;
  grade?: number | null;
  feedback?: string | null;
  status?: string | null;
  reviewed_at?: string | null;
}

interface ProjectData {
  id: string;
  title: string | null;
  description: string | null;
  link: string | null;
  code_content: string | null;
  editor_type: string | null;
  file_path: string | null;
  grade: number | null;
  feedback: string | null;
  review_status: string | null;
  submitted_at: string | null;
  graded_at: string | null;
  graded_by: string | null;
  activity_id: string | null;
  resubmission_requested: boolean | null;
  submission_history: any | null;
  student_id: string;
  course_id: string;
  lesson_id: string | null;
  student?: {
    id: string;
    auth_user_id: string | null;
    name: string | null;
    first_name?: string | null;
    last_name?: string | null;
    email: string | null;
    avatar_url: string | null;
  };
  course?: {
    id: string;
    title: string;
    category?: string;
  };
  lesson?: {
    id: string;
    title: string;
    order_index: number;
  };
}

export default function SubmissionDetailPage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { toast } = useToast();

  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [unauthorized, setUnauthorized] = useState<boolean>(false);
  const [gradeInput, setGradeInput] = useState<string>("");
  const [feedbackInput, setFeedbackInput] = useState<string>("");
  const [savingGrade, setSavingGrade] = useState<boolean>(false);

  // Resubmission request modal
  const [showResubmitModal, setShowResubmitModal] = useState<boolean>(false);
  const [resubmitInstructions, setResubmitInstructions] = useState<string>("");
  const [requestingResubmit, setRequestingResubmit] = useState<boolean>(false);

  // Advanced Grading (Rubrics for Ultimate Tutor & Admin)
  const [rubricScores, setRubricScores] = useState<{ [criterion: string]: number }>({
    functionality: 4,
    code_quality: 4,
    creativity: 4,
  });

  const isTutor = userProfile?.role === "tutor";
  const isUltimateTutor = userProfile?.role === "ultimate_tutor";
  const isAdmin = userProfile?.role === "admin";
  const isSuperStaff = isAdmin;

  useEffect(() => {
    if (submissionId && userProfile) {
      loadSubmission();
    }
  }, [submissionId, userProfile]);

  const loadSubmission = async () => {
    setLoading(true);
    setUnauthorized(false);
    try {
      // 1. Fetch project with student, course, and lesson
      const { data, error } = await supabase
        .from("projects")
        .select(`
          *,
          student:users!projects_student_id_fkey(
            id,
            auth_user_id,
            name,
            first_name,
            last_name,
            email,
            avatar_url
          ),
          course:courses!projects_course_id_fkey(
            id,
            title,
            category
          ),
          lesson:lessons!projects_lesson_id_fkey(
            id,
            title,
            order_index
          )
        `)
        .eq("id", submissionId!)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        toast({
          title: "Submission Not Found",
          description: "The requested project submission does not exist.",
          variant: "destructive",
        });
        navigate(-1);
        return;
      }

      // Every non-admin staff member must have an explicit teaching relationship.
      if (isTutor || isUltimateTutor) {
        const tutorId = userProfile.id;
        const tutorAuthId = userProfile.auth_user_id;

        // Check tutor_qualifications & course_tutors
        const [qualRes, assignRes] = await Promise.all([
          supabase
            .from("tutor_qualifications")
            .select("id")
            .eq("course_id", data.course_id)
            .in("tutor_id", [tutorId, tutorAuthId].filter(Boolean)),
          supabase
            .from("course_tutors")
            .select("id")
            .eq("course_id", data.course_id)
            .in("tutor_id", [tutorId, tutorAuthId].filter(Boolean)),
        ]);

        const hasQual = (qualRes.data && qualRes.data.length > 0);
        const hasAssign = (assignRes.data && assignRes.data.length > 0);

        if (!hasQual && !hasAssign) {
          setUnauthorized(true);
          setLoading(false);
          return;
        }
      }

      setProject(data as any);
      setGradeInput(data.grade !== null && data.grade !== undefined ? String(data.grade) : "");
      setFeedbackInput(data.feedback || "");
    } catch (err: any) {
      console.error("Error loading submission:", err);
      toast({
        title: "Error Loading Submission",
        description: err.message || "Failed to load submission details.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGrade = async (gradeToSave?: number) => {
    if (!project) return;

    const parsedGrade = gradeToSave !== undefined ? gradeToSave : parseInt(gradeInput, 10);
    if (isNaN(parsedGrade) || parsedGrade < 0 || parsedGrade > 100) {
      toast({
        title: "Invalid Grade",
        description: "Please enter a valid grade between 0 and 100.",
        variant: "destructive",
      });
      return;
    }

    setSavingGrade(true);
    try {
      const staffId = userProfile?.id || userProfile?.auth_user_id;
      const nowIso = new Date().toISOString();

      // 1. Update project in database
      const { error: projError } = await supabase
        .from("projects")
        .update({
          grade: parsedGrade,
          feedback: feedbackInput.trim(),
          review_status: "graded",
          graded_at: nowIso,
          graded_by: staffId,
          resubmission_requested: false,
        })
        .eq("id", project.id);

      if (projError) throw projError;

      // 2. Mark lesson_progress completed = true for student so next lesson unlocks
      if (project.lesson_id && project.student_id) {
        try {
          await supabase
            .from("lesson_progress")
            .upsert(
              {
                student_id: project.student_id,
                lesson_id: project.lesson_id,
                completed: true,
                completed_at: nowIso,
                score: parsedGrade,
              },
              { onConflict: "student_id,lesson_id" }
            );
        } catch (progErr) {
          console.warn("Could not upsert lesson_progress:", progErr);
        }
      }

      // 3. Award XP & sound
      try {
        await awardXP(project.student_id, 100, `Completed Project: ${project.title || 'Course Activity'}`);
        soundEffects.play("success");
      } catch (e) {
        console.warn("Gamification reward error:", e);
      }

      // 4. Send notification to student
      try {
        await createNotification({
          recipient_user_id: project.student?.auth_user_id || project.student_id,
          title: "Project Graded! 🎯",
          message: `Your project for "${project.lesson?.title || project.title}" was graded: ${parsedGrade}%. Feedback: "${feedbackInput.trim().slice(0, 80)}..."`,
          type: "grade",
          data: {
            project_id: project.id,
            course_id: project.course_id,
            lesson_id: project.lesson_id,
            grade: parsedGrade,
          },
        });
      } catch (notifErr) {
        console.warn("Could not send notification:", notifErr);
      }

      toast({
        title: "Project Graded Successfully! 🌟",
        description: `Grade (${parsedGrade}/100) and feedback saved. The next lesson is now unlocked for the student.`,
      });

      setProject((prev) =>
        prev
          ? {
              ...prev,
              grade: parsedGrade,
              feedback: feedbackInput.trim(),
              review_status: "graded",
              graded_at: nowIso,
              resubmission_requested: false,
            }
          : null
      );
    } catch (err: any) {
      console.error("Error saving grade:", err);
      toast({
        title: "Grading Failed",
        description: err.message || "Failed to save grade.",
        variant: "destructive",
      });
    } finally {
      setSavingGrade(false);
    }
  };

  const handleRequestResubmission = async () => {
    if (!project) return;
    if (!resubmitInstructions.trim()) {
      toast({
        title: "Instructions Required",
        description: "Please provide actionable feedback explaining what needs to be improved.",
        variant: "destructive",
      });
      return;
    }

    setRequestingResubmit(true);
    try {
      const nowIso = new Date().toISOString();
      const priorHistory: SubmissionHistoryEntry[] = Array.isArray(project.submission_history)
        ? [...project.submission_history]
        : [];

      // Add current state to submission history
      const currentVersionNumber = priorHistory.length + 1;
      priorHistory.push({
        version: currentVersionNumber,
        submitted_at: project.submitted_at || nowIso,
        code_content: project.code_content,
        link: project.link,
        grade: project.grade,
        feedback: resubmitInstructions.trim(),
        status: "resubmission_requested",
        reviewed_at: nowIso,
      });

      // Update project record
      const { error: updateErr } = await supabase
        .from("projects")
        .update({
          review_status: "resubmission_requested",
          resubmission_requested: true,
          feedback: resubmitInstructions.trim(),
          submission_history: priorHistory,
        })
        .eq("id", project.id);

      if (updateErr) throw updateErr;

      // Send student notification
      try {
        await createNotification({
          recipient_user_id: project.student?.auth_user_id || project.student_id,
          title: "Project Revision Requested 🔄",
          message: `Your tutor requested a revision for "${project.lesson?.title || project.title}": "${resubmitInstructions.trim().slice(0, 100)}..."`,
          type: "resubmission_requested",
          data: {
            project_id: project.id,
            course_id: project.course_id,
            lesson_id: project.lesson_id,
          },
        });
      } catch (notifErr) {
        console.warn("Could not notify student:", notifErr);
      }

      toast({
        title: "Resubmission Requested",
        description: "The student has been notified to revise and resubmit their work.",
      });

      setProject((prev) =>
        prev
          ? {
              ...prev,
              review_status: "resubmission_requested",
              resubmission_requested: true,
              feedback: resubmitInstructions.trim(),
              submission_history: priorHistory,
            }
          : null
      );

      setShowResubmitModal(false);
      setResubmitInstructions("");
    } catch (err: any) {
      console.error("Error requesting resubmission:", err);
      toast({
        title: "Request Failed",
        description: err.message || "Failed to request resubmission.",
        variant: "destructive",
      });
    } finally {
      setRequestingResubmit(false);
    }
  };

  const calculateRubricTotal = () => {
    const total =
      (rubricScores.functionality || 0) +
      (rubricScores.code_quality || 0) +
      (rubricScores.creativity || 0);
    // 15 max => scale to 100
    return Math.round((total / 15) * 100);
  };

  if (loading) {
    return (
      <LMSLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center space-y-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto" />
            <p className="text-muted-foreground text-sm">Loading submission review...</p>
          </div>
        </div>
      </LMSLayout>
    );
  }

  if (unauthorized) {
    return (
      <LMSLayout>
        <div className="max-w-xl mx-auto py-16 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold">Access Restricted</h2>
          <p className="text-muted-foreground">
            You are not currently qualified or assigned to supervise this course. Only assigned tutors, ultimate tutors, and administrators can review this submission.
          </p>
          <Button onClick={() => navigate("/dashboard")} variant="outline">
            Return to Dashboard
          </Button>
        </div>
      </LMSLayout>
    );
  }

  if (!project) return null;

  const historyEntries: SubmissionHistoryEntry[] = Array.isArray(project.submission_history)
    ? project.submission_history
    : [];

  const submissionDate = project.submitted_at
    ? new Date(project.submitted_at).toLocaleString()
    : "Not recorded";

  const isCodeSubmission = !!project.code_content;
  const isLinkSubmission = !!project.link;

  return (
    <LMSLayout>
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        {/* Navigation & Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">
                  {project.title || "Project Submission"}
                </h1>
                {project.review_status === "graded" && (
                  <Badge variant="default" className="bg-emerald-600 text-white gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Graded: {project.grade}%
                  </Badge>
                )}
                {project.review_status === "resubmission_requested" && (
                  <Badge variant="outline" className="text-amber-600 border-amber-500 bg-amber-50 gap-1">
                    <RotateCcw className="w-3.5 h-3.5" />
                    Resubmission Requested
                  </Badge>
                )}
                {(!project.review_status || project.review_status === "submitted") && (
                  <Badge variant="secondary" className="gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Pending Review
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-3 mt-1">
                <span>
                  Course: <strong>{project.course?.title || "STEM Course"}</strong>
                </span>
                {project.lesson && (
                  <span>
                    Lesson: <strong>{project.lesson.title}</strong>
                  </span>
                )}
                {project.activity_id && (
                  <span>
                    Activity: <strong>{project.activity_id}</strong>
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Quick Links */}
          <div className="flex items-center gap-2">
            {project.student_id && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/dashboard/students/${project.student_id}`)}
                className="gap-1.5"
              >
                <User className="w-4 h-4 text-primary" />
                View Student Profile
              </Button>
            )}
          </div>
        </div>

        {/* Student & Submission Metadata Bar */}
        <Card className="border-l-4 border-l-primary shadow-sm">
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-xs text-muted-foreground block">Student</span>
              <div className="pt-1">
                <ClickableStudentName
                  studentId={project.student_id}
                  name={project.student?.name}
                  email={project.student?.email}
                  avatarUrl={project.student?.avatar_url}
                  showAvatar
                  avatarSize="md"
                  className="font-semibold text-base"
                />
              </div>
            </div>

            <div>
              <span className="text-xs text-muted-foreground block">Submitted At</span>
              <div className="flex items-center gap-1.5 pt-1 text-foreground font-medium">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span>{submissionDate}</span>
              </div>
            </div>

            <div>
              <span className="text-xs text-muted-foreground block">Submission Type</span>
              <div className="flex items-center gap-1.5 pt-1 font-medium">
                {isCodeSubmission ? (
                  <Badge variant="secondary" className="gap-1">
                    <Code2 className="w-3.5 h-3.5 text-primary" />
                    Online Code Editor ({project.editor_type || "Python"})
                  </Badge>
                ) : isLinkSubmission ? (
                  <Badge variant="secondary" className="gap-1">
                    <ExternalLink className="w-3.5 h-3.5 text-primary" />
                    External Project Link
                  </Badge>
                ) : (
                  <Badge variant="outline">Document / Project</Badge>
                )}
              </div>
            </div>

            <div>
              <span className="text-xs text-muted-foreground block">Current Score</span>
              <div className="pt-1 text-xl font-bold text-foreground">
                {project.grade !== null ? `${project.grade} / 100` : "Not graded"}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Review Section: Code/URL Viewer vs Grading Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Artifact / Code / Link Content (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    {isCodeSubmission ? (
                      <>
                        <Code2 className="w-5 h-5 text-primary" />
                        Code Content
                      </>
                    ) : (
                      <>
                        <FileText className="w-5 h-5 text-primary" />
                        Project Deliverable
                      </>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {isCodeSubmission
                      ? `Submitted via the interactive ${project.editor_type || "code"} IDE`
                      : "External project URL or document submission"}
                  </CardDescription>
                </div>

                {isCodeSubmission && project.code_content && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(project.code_content || "");
                      toast({ title: "Code Copied to Clipboard" });
                    }}
                    className="gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy Code
                  </Button>
                )}
              </CardHeader>

              <CardContent className="space-y-4">
                {project.description && (
                  <div className="p-3 bg-muted/40 rounded-md border text-sm text-foreground">
                    <strong className="text-xs text-muted-foreground block uppercase mb-1">
                      Student's Submission Notes
                    </strong>
                    <p className="whitespace-pre-wrap">{project.description}</p>
                  </div>
                )}

                {/* Render Online Code Editor content */}
                {isCodeSubmission && (
                  <div className="rounded-lg overflow-hidden border bg-zinc-950 text-zinc-100 font-mono text-sm">
                    <div className="bg-zinc-900 px-4 py-2 text-xs text-zinc-400 border-b border-zinc-800 flex items-center justify-between">
                      <span>solution.{project.editor_type === "web" ? "html" : "py"}</span>
                      <span className="text-[10px] uppercase">{project.editor_type || "python"}</span>
                    </div>
                    <pre className="p-4 overflow-x-auto max-h-[500px] leading-relaxed text-xs sm:text-sm">
                      <code>{project.code_content}</code>
                    </pre>
                  </div>
                )}

                {/* Render External Project Link */}
                {isLinkSubmission && (
                  <div className="p-6 rounded-lg border bg-card text-center space-y-4">
                    <ExternalLink className="w-10 h-10 text-primary mx-auto" />
                    <div>
                      <h4 className="font-semibold text-base">External Project Deliverable</h4>
                      <p className="text-xs text-muted-foreground break-all max-w-md mx-auto mt-1">
                        {project.link}
                      </p>
                    </div>
                    <Button asChild className="gap-2">
                      <a href={project.link!} target="_blank" rel="noopener noreferrer">
                        Open Project in New Tab
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                  </div>
                )}

                {!isCodeSubmission && !isLinkSubmission && (
                  <div className="py-12 text-center text-muted-foreground">
                    No code content or external link provided for this submission.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Resubmission History Timeline */}
            {historyEntries.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <History className="w-5 h-5 text-primary" />
                    Resubmission History Timeline ({historyEntries.length})
                  </CardTitle>
                  <CardDescription>
                    All prior attempts, timestamps, and previous feedback
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-border">
                    {historyEntries.map((entry, idx) => (
                      <div key={idx} className="relative flex items-start gap-4 pl-8">
                        <div className="absolute left-2 top-1.5 w-3.5 h-3.5 rounded-full bg-primary border-2 border-background" />
                        <div className="flex-1 p-3 bg-muted/40 rounded-lg border text-sm space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-primary">
                              Version {entry.version}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(entry.submitted_at).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          {entry.grade !== null && entry.grade !== undefined && (
                            <Badge variant="outline" className="text-xs">
                              Previous Grade: {entry.grade}%
                            </Badge>
                          )}
                          {entry.feedback && (
                            <p className="text-xs text-muted-foreground italic pt-1">
                              Feedback: "{entry.feedback}"
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column: Grading, Role-Based Controls, and Feedback (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Tutors ONLY see Standard Grading. Ultimate Tutors & Admins see Tabs */}
            {isSuperStaff ? (
              <Tabs defaultValue="standard" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="standard" className="gap-1.5 text-xs">
                    <Star className="w-3.5 h-3.5" />
                    Grading & Review
                  </TabsTrigger>
                  <TabsTrigger value="advanced" className="gap-1.5 text-xs">
                    <Sliders className="w-3.5 h-3.5" />
                    Advanced Rubric
                  </TabsTrigger>
                </TabsList>

                {/* Standard Tab */}
                <TabsContent value="standard" className="pt-2">
                  {renderGradingForm()}
                </TabsContent>

                {/* Advanced Rubric Tab (Ultimate Tutor & Admin Only) */}
                <TabsContent value="advanced" className="pt-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Shield className="w-4 h-4 text-primary" />
                        Advanced Rubric Grading
                      </CardTitle>
                      <CardDescription>
                        Evaluate criterion breakdown (Ultimate Tutor & Admin permission)
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Functionality */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-medium">
                          <span>Functionality & Requirements</span>
                          <span>{rubricScores.functionality || 0} / 5</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          value={rubricScores.functionality || 1}
                          onChange={(e) =>
                            setRubricScores({
                              ...rubricScores,
                              functionality: parseInt(e.target.value, 10),
                            })
                          }
                          className="w-full cursor-pointer accent-primary"
                        />
                      </div>

                      {/* Code Quality */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-medium">
                          <span>Code Quality & Structure</span>
                          <span>{rubricScores.code_quality || 0} / 5</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          value={rubricScores.code_quality || 1}
                          onChange={(e) =>
                            setRubricScores({
                              ...rubricScores,
                              code_quality: parseInt(e.target.value, 10),
                            })
                          }
                          className="w-full cursor-pointer accent-primary"
                        />
                      </div>

                      {/* Creativity */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-medium">
                          <span>Creativity & Problem Solving</span>
                          <span>{rubricScores.creativity || 0} / 5</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          value={rubricScores.creativity || 1}
                          onChange={(e) =>
                            setRubricScores({
                              ...rubricScores,
                              creativity: parseInt(e.target.value, 10),
                            })
                          }
                          className="w-full cursor-pointer accent-primary"
                        />
                      </div>

                      <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 flex items-center justify-between">
                        <span className="text-xs font-medium">Calculated Rubric Grade:</span>
                        <span className="text-lg font-bold text-primary">
                          {calculateRubricTotal()}%
                        </span>
                      </div>

                      <Button
                        className="w-full gap-2"
                        onClick={() => {
                          const rubricGrade = calculateRubricTotal();
                          setGradeInput(String(rubricGrade));
                          handleSaveGrade(rubricGrade);
                        }}
                        disabled={savingGrade}
                      >
                        <Award className="w-4 h-4" />
                        Apply Rubric Grade ({calculateRubricTotal()}%)
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            ) : (
              // Standard Tutor View (NO Advanced Grading, NO Settings)
              renderGradingForm()
            )}
          </div>
        </div>
      </div>

      {/* Resubmission Request Dialog */}
      <Dialog open={showResubmitModal} onOpenChange={setShowResubmitModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-amber-500" />
              Request Project Resubmission
            </DialogTitle>
            <DialogDescription>
              Specify what corrections or additional work the student must make before resubmitting.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <Label htmlFor="resubmit-notes">Revision Instructions for Student *</Label>
            <Textarea
              id="resubmit-notes"
              value={resubmitInstructions}
              onChange={(e) => setResubmitInstructions(e.target.value)}
              placeholder="e.g., Please fix the loop syntax in line 12 and implement the bonus test cases..."
              rows={4}
              required
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowResubmitModal(false)}
              disabled={requestingResubmit}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRequestResubmission}
              disabled={requestingResubmit || !resubmitInstructions.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
            >
              {requestingResubmit ? "Sending Request..." : "Send Revision Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </LMSLayout>
  );

  function renderGradingForm() {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="w-5 h-5 text-primary" />
            Grading & Feedback
          </CardTitle>
          <CardDescription>
            Enter student score and provide constructive comments
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="grade-input">Grade (0 - 100) *</Label>
            <Input
              id="grade-input"
              type="number"
              min="0"
              max="100"
              value={gradeInput}
              onChange={(e) => setGradeInput(e.target.value)}
              placeholder="Enter numeric grade e.g. 90"
              disabled={savingGrade}
              className="text-lg font-bold"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="feedback-input">Tutor Feedback & Mentorship</Label>
            <Textarea
              id="feedback-input"
              value={feedbackInput}
              onChange={(e) => setFeedbackInput(e.target.value)}
              placeholder="Great implementation! You followed the algorithms well..."
              rows={5}
              disabled={savingGrade}
            />
          </div>

          <div className="space-y-2 pt-2">
            <Button
              className="w-full gap-2"
              onClick={() => handleSaveGrade()}
              disabled={savingGrade || !gradeInput}
            >
              <Save className="w-4 h-4" />
              {savingGrade ? "Saving Grade..." : "Save Grade & Unlock Next Lesson"}
            </Button>

            <Button
              variant="outline"
              className="w-full gap-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
              onClick={() => {
                setResubmitInstructions(feedbackInput || "");
                setShowResubmitModal(true);
              }}
              disabled={savingGrade}
            >
              <RotateCcw className="w-4 h-4" />
              Request Resubmission
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
}
