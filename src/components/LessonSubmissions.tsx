import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalLink, FileText, CheckCircle, Loader2, Code2, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { soundEffects } from "@/utils/audio";
import { createNotification } from "@/utils/notifications";
import { fetchUserDirectory, DirectoryUser } from "@/utils/studentDirectory";

type Filter = "all" | "requires_grading" | "submitted" | "not_submitted";

interface Submission {
  id: string;
  title: string;
  description: string | null;
  link: string | null;
  file_path: string | null;
  code_content?: string | null;
  editor_type?: string | null;
  review_status: string | null;
  grade: number | null;
  feedback: string | null;
  submitted_at: string | null;
  student_id: string | null;
  student?: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
}

interface LessonSubmissionsProps {
  lessonId: string;
  courseId: string;
}

export function LessonSubmissions({ lessonId, courseId }: LessonSubmissionsProps) {
  const { toast } = useToast();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [allStudents, setAllStudents] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [grade, setGrade] = useState("");
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [codeViewContent, setCodeViewContent] = useState<{ title: string; code: string; lang: string } | null>(null);

  useEffect(() => {
    fetchSubmissions();
    fetchEnrolledStudents();

    const channel = supabase
      .channel(`lesson-submissions-${lessonId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "projects", filter: `lesson_id=eq.${lessonId}` }, () => {
        fetchSubmissions();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [lessonId]);

  const fetchEnrolledStudents = async () => {
    const { data } = await supabase
      .from("enrollments")
      .select("student_id")
      .eq("course_id", courseId);

    if (data && data.length > 0) {
      const ids = data.map(e => e.student_id);
      const directory = await fetchUserDirectory(ids);
      const students = Array.from(new Set(ids.map(id => directory[id]).filter(Boolean)));
      setAllStudents(students);
    }
  };

  const fetchSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("id, title, description, link, file_path, code_content, editor_type, review_status, grade, feedback, submitted_at, student_id")
        .eq("lesson_id", lessonId)
        .order("submitted_at", { ascending: false });

      if (error) throw error;

      const studentIds = Array.from(new Set((data || []).map(s => s.student_id).filter(Boolean))) as string[];
      const directory = studentIds.length > 0 ? await fetchUserDirectory(studentIds) : {};

      const withStudents = (data || []).map((sub) => ({
        ...sub,
        student: sub.student_id ? directory[sub.student_id] || null : null,
      }));

      setSubmissions(withStudents);
    } catch (err: any) {
      console.error("Error fetching submissions:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleGrade = async (submissionId: string) => {
    if (!grade) {
      toast({ title: "Enter a grade", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("projects")
        .update({ grade: parseInt(grade), feedback: feedback || null, review_status: "graded" })
        .eq("id", submissionId);
      if (error) throw error;

      soundEffects.playSuccess();

      const targetSub = submissions.find(s => s.id === submissionId);
      if (targetSub?.student_id) {
        createNotification({
          recipientUserId: targetSub.student_id,
          type: 'project_graded',
          title: `Project Graded: ${targetSub.title || 'Assignment'}`,
          message: `Your work has been graded: ${grade}/100.${feedback ? ` Feedback: ${feedback}` : ''}`,
          data: { project_id: submissionId, course_id: courseId, lesson_id: lessonId },
        });
      }

      // Upsert lesson_progress completed = true
      if (targetSub?.student_id && lessonId) {
        try {
          await supabase
            .from("lesson_progress")
            .upsert({
              student_id: targetSub.student_id,
              lesson_id: lessonId,
              completed: true,
              completed_at: new Date().toISOString(),
            });
        } catch (progErr) {
          console.warn("Could not upsert lesson_progress:", progErr);
        }
      }

      toast({ title: "Graded!", description: "Grade saved successfully." });
      setGradingId(null);
      setGrade("");
      setFeedback("");
      fetchSubmissions();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "graded":
        return <Badge className="bg-green-600 text-white text-xs">Graded</Badge>;
      case "submitted":
        return <Badge className="bg-amber-500 text-white text-xs">Submitted for Grading</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">Not Submitted</Badge>;
    }
  };

  const getInitials = (sub: Submission) => {
    const fn = sub.student?.first_name || "";
    const ln = sub.student?.last_name || "";
    return `${fn.slice(0, 1)}${ln.slice(0, 1)}`.toUpperCase() || "?";
  };

  const getStudentName = (sub: Submission) => {
    const fn = sub.student?.first_name || "";
    const ln = sub.student?.last_name || "";
    return `${fn} ${ln}`.trim() || sub.student?.email || "Unknown";
  };

  // Build merged list: submissions + enrolled students with no submission
  const submittedIds = new Set(submissions.map(s => s.student_id));
  const notSubmittedStudents = allStudents.filter(s => !submittedIds.has(s.auth_user_id) && !submittedIds.has(s.id));

  const filteredSubmissions = filter === "not_submitted"
    ? [] // shown below from notSubmittedStudents
    : submissions.filter(s => {
        if (filter === "all") return true;
        if (filter === "requires_grading") return s.review_status === "submitted";
        if (filter === "submitted") return s.review_status === "submitted" || s.review_status === "graded";
        return true;
      });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-base">Submissions</h3>
          <p className="text-xs text-muted-foreground">
            {submissions.length} submitted · {notSubmittedStudents.length} not submitted
          </p>
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <SelectTrigger className="w-48 h-9 text-sm">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All participants</SelectItem>
            <SelectItem value="requires_grading">Requires Grading</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="not_submitted">Not Submitted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Submissions table */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/60 border-b text-xs text-muted-foreground">
              <th className="text-left px-4 py-2.5 font-medium">Student</th>
              <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Email</th>
              <th className="text-left px-4 py-2.5 font-medium">Status</th>
              <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Submitted</th>
              <th className="text-left px-4 py-2.5 font-medium">Grade</th>
              <th className="text-left px-4 py-2.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {/* Submitted students */}
            {(filter === "all" || filter === "requires_grading" || filter === "submitted") &&
              filteredSubmissions.map(sub => (
                <tr key={sub.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar className="w-8 h-8 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                          {getInitials(sub)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-sm">{getStudentName(sub)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs hidden sm:table-cell">
                    {sub.student?.email}
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(sub.review_status)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                    {sub.submitted_at ? new Date(sub.submitted_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {sub.grade !== null ? (
                      <span className="font-semibold text-green-700">{sub.grade}<span className="text-muted-foreground font-normal">/100</span></span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {sub.link && (
                        <Button size="sm" variant="outline" className="h-7 text-xs px-2" asChild>
                          <a href={sub.link} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-3 h-3 mr-1" />
                            Link
                          </a>
                        </Button>
                      )}
                      {sub.file_path && (
                        <Button size="sm" variant="outline" className="h-7 text-xs px-2" asChild>
                          <a href={supabase.storage.from("project-submissions").getPublicUrl(sub.file_path).data.publicUrl} target="_blank" rel="noopener noreferrer">
                            <FileText className="w-3 h-3 mr-1" />
                            File
                          </a>
                        </Button>
                      )}
                      {sub.code_content && (
                        <Button
                          size="sm" variant="outline" className="h-7 text-xs px-2"
                          onClick={() => setCodeViewContent({ title: sub.title, code: sub.code_content!, lang: sub.editor_type || "text" })}
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          Code
                        </Button>
                      )}
                      {sub.review_status !== "graded" ? (
                        <Button
                          size="sm" className="h-7 text-xs px-2 bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => { setGradingId(sub.id); setGrade(sub.grade?.toString() || ""); setFeedback(sub.feedback || ""); }}
                        >
                          Grade
                        </Button>
                      ) : (
                        <Button
                          size="sm" variant="outline" className="h-7 text-xs px-2"
                          onClick={() => { setGradingId(sub.id); setGrade(sub.grade?.toString() || ""); setFeedback(sub.feedback || ""); }}
                        >
                          Edit Grade
                        </Button>
                      )}
                    </div>

                    {/* Inline grade form */}
                    {gradingId === sub.id && (
                      <Card className="mt-2 border-green-200 bg-green-50 dark:bg-green-950/30">
                        <CardContent className="p-3 space-y-2">
                          <div className="flex gap-2 items-end">
                            <div className="space-y-1">
                              <Label className="text-xs">Grade (0–100)</Label>
                              <Input type="number" min="0" max="100" value={grade} onChange={e => setGrade(e.target.value)} className="h-8 w-24 text-sm" />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Feedback (optional)</Label>
                            <Textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={2} className="text-xs" placeholder="Write feedback for the student..." />
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => handleGrade(sub.id)} disabled={submitting}>
                              <CheckCircle className="w-3 h-3 mr-1" />
                              {submitting ? "Saving..." : "Save Grade"}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setGradingId(null)}>
                              Cancel
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </td>
                </tr>
              ))}

            {/* Not submitted students */}
            {(filter === "all" || filter === "not_submitted") &&
              notSubmittedStudents.map(student => (
                <tr key={student.auth_user_id} className="hover:bg-muted/20 opacity-70">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar className="w-8 h-8 shrink-0">
                        <AvatarFallback className="bg-muted text-muted-foreground text-xs font-semibold">
                          {`${student.first_name?.slice(0, 1) || ""}${student.last_name?.slice(0, 1) || ""}`.toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-sm">{`${student.first_name || ""} ${student.last_name || ""}`.trim() || student.email}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs hidden sm:table-cell">{student.email}</td>
                  <td className="px-4 py-3"><Badge variant="secondary" className="text-xs">Not Submitted</Badge></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">—</td>
                  <td className="px-4 py-3 text-muted-foreground">—</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">No submission yet</td>
                </tr>
              ))}

            {filteredSubmissions.length === 0 && (filter === "all" || filter === "submitted" || filter === "requires_grading") && notSubmittedStudents.length === 0 && filter === "not_submitted" && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No submissions match this filter
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Code viewer dialog */}
      <Dialog open={!!codeViewContent} onOpenChange={() => setCodeViewContent(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code2 className="w-4 h-4" />
              {codeViewContent?.title}
            </DialogTitle>
          </DialogHeader>
          <pre className="bg-zinc-950 text-zinc-100 rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
            {codeViewContent?.code}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}