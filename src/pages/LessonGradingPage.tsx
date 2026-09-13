import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { LMSLayout } from "@/components/LMSLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  FileText,
  Code2,
  Eye,
  CheckCircle,
  Search,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Send,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { soundEffects } from "@/utils/audio";
import { createNotification } from "@/utils/notifications";

type StatusFilter = "no_filter" | "needs_grading" | "submitted" | "not_submitted";

interface SubmissionItem {
  id: string;
  course_id: string;
  lesson_id: string | null;
  student_id: string;
  title: string | null;
  description: string | null;
  link: string | null;
  file_path: string | null;
  code_content: string | null;
  editor_type: string | null;
  grade: number | null;
  feedback: string | null;
  review_status: string | null;
  submitted_at: string | null;
  // Resolved student info
  student?: {
    id: string;
    auth_user_id: string | null;
    name: string | null;
    email: string | null;
    phone?: string | null;
    avatar_url?: string | null;
  };
}

interface EnrolledStudent {
  id: string;
  auth_user_id: string | null;
  name: string | null;
  email: string | null;
  phone?: string | null;
  avatar_url?: string | null;
}

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function LessonGradingPage() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [course, setCourse] = useState<any>(null);
  const [lesson, setLesson] = useState<any>(null);
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("no_filter");
  const [searchQuery, setSearchQuery] = useState("");
  const [firstNameFilter, setFirstNameFilter] = useState<string>("ALL");
  const [lastNameFilter, setLastNameFilter] = useState<string>("ALL");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Inline grading state map
  const [gradingValues, setGradingValues] = useState<Record<string, { grade: string; feedback: string }>>({});
  const [savingGradeId, setSavingGradeId] = useState<string | null>(null);

  // View Submission Modal state
  const [viewSubmission, setViewSubmission] = useState<SubmissionItem | null>(null);
  const [codeTab, setCodeTab] = useState<"code" | "preview">("code");

  useEffect(() => {
    if (courseId && lessonId) {
      loadData();
    }
  }, [courseId, lessonId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Course
      const { data: cData } = await supabase
        .from("courses")
        .select("id, title, description, category")
        .eq("id", courseId!)
        .maybeSingle();
      setCourse(cData);

      // 2. Fetch Lesson
      const { data: lData } = await supabase
        .from("lessons")
        .select("*")
        .eq("id", lessonId!)
        .maybeSingle();
      setLesson(lData);

      // 3. Fetch Enrolled Students for this course
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("student_id")
        .eq("course_id", courseId!);

      const studentIds = (enrollments || []).map((e) => e.student_id).filter(Boolean);
      let studentList: EnrolledStudent[] = [];

      if (studentIds.length > 0) {
        const { data: uData } = await supabase
          .from("users")
          .select("id, auth_user_id, name, email, parent_phone, avatar_url")
          .or(`id.in.(${studentIds.join(",")}),auth_user_id.in.(${studentIds.join(",")})`);

        studentList = (uData || []).map((u) => ({
          id: u.id,
          auth_user_id: u.auth_user_id,
          name: u.name || "Student",
          email: u.email || "",
          phone: u.parent_phone || null,
          avatar_url: u.avatar_url || null,
        }));
        setEnrolledStudents(studentList);
      }

      // 4. Fetch Submissions for this lesson
      const { data: pData, error: pErr } = await supabase
        .from("projects")
        .select("id, course_id, lesson_id, student_id, title, description, link, file_path, code_content, editor_type, grade, feedback, review_status, submitted_at")
        .eq("lesson_id", lessonId!)
        .order("submitted_at", { ascending: false });

      if (pErr) throw pErr;

      // Also lookup any students in projects that might not be in enrolledStudents map
      const projStudentIds = Array.from(new Set((pData || []).map((p) => p.student_id).filter(Boolean)));
      const missingIds = projStudentIds.filter(
        (pid) => !studentList.some((s) => s.id === pid || s.auth_user_id === pid)
      );

      let extraStudentsMap: Record<string, EnrolledStudent> = {};
      if (missingIds.length > 0) {
        const { data: extraUsers } = await supabase
          .from("users")
          .select("id, auth_user_id, name, email, parent_phone, avatar_url")
          .or(`id.in.(${missingIds.join(",")}),auth_user_id.in.(${missingIds.join(",")})`);

        (extraUsers || []).forEach((u) => {
          const item: EnrolledStudent = {
            id: u.id,
            auth_user_id: u.auth_user_id,
            name: u.name || "Student",
            email: u.email || "",
            phone: u.parent_phone || null,
            avatar_url: u.avatar_url || null,
          };
          if (u.id) extraStudentsMap[u.id] = item;
          if (u.auth_user_id) extraStudentsMap[u.auth_user_id] = item;
        });
      }

      // Merge student mapping into submissions
      const allStudentMap: Record<string, EnrolledStudent> = { ...extraStudentsMap };
      studentList.forEach((s) => {
        if (s.id) allStudentMap[s.id] = s;
        if (s.auth_user_id) allStudentMap[s.auth_user_id] = s;
      });

      const initialGradingMap: Record<string, { grade: string; feedback: string }> = {};
      const enrichedSubmissions: SubmissionItem[] = (pData || []).map((p) => {
        const studentInfo = allStudentMap[p.student_id] || {
          id: p.student_id,
          auth_user_id: p.student_id,
          name: "Student",
          email: "",
        };

        initialGradingMap[p.id] = {
          grade: p.grade !== null ? p.grade.toString() : "",
          feedback: p.feedback || "",
        };

        return {
          ...p,
          student: studentInfo,
        };
      });

      setSubmissions(enrichedSubmissions);
      setGradingValues(initialGradingMap);
    } catch (err: any) {
      console.error("Error loading submissions page data:", err);
      toast({
        title: "Failed to load data",
        description: err.message || "Could not retrieve submissions.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Map of student IDs who have submitted
  const submittedStudentIds = useMemo(() => {
    const ids = new Set<string>();
    submissions.forEach((s) => {
      if (s.student?.id) ids.add(s.student.id);
      if (s.student?.auth_user_id) ids.add(s.student.auth_user_id);
      if (s.student_id) ids.add(s.student_id);
    });
    return ids;
  }, [submissions]);

  // Students who have not submitted
  const unsubmittedStudents = useMemo(() => {
    return enrolledStudents.filter(
      (s) => !submittedStudentIds.has(s.id) && (!s.auth_user_id || !submittedStudentIds.has(s.auth_user_id))
    );
  }, [enrolledStudents, submittedStudentIds]);

  // Unified list depending on filter
  interface RowItem {
    key: string;
    isSubmitted: boolean;
    submission?: SubmissionItem;
    student: EnrolledStudent;
  }

  const tableRows: RowItem[] = useMemo(() => {
    const rows: RowItem[] = [];

    // Add submitted rows
    if (statusFilter !== "not_submitted") {
      submissions.forEach((sub) => {
        const st = sub.student || {
          id: sub.student_id,
          auth_user_id: sub.student_id,
          name: "Student",
          email: "",
        };

        const isNeedsGrading = sub.grade === null || sub.review_status === "submitted";

        if (statusFilter === "needs_grading" && !isNeedsGrading) return;
        if (statusFilter === "submitted" && !sub.submitted_at) return;

        rows.push({
          key: sub.id,
          isSubmitted: true,
          submission: sub,
          student: st,
        });
      });
    }

    // Add unsubmitted rows
    if (statusFilter === "no_filter" || statusFilter === "not_submitted") {
      unsubmittedStudents.forEach((st) => {
        rows.push({
          key: `unsub-${st.id}`,
          isSubmitted: false,
          student: st,
        });
      });
    }

    // Apply Search Query
    let filtered = rows;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.student.name?.toLowerCase().includes(q) ||
          r.student.email?.toLowerCase().includes(q) ||
          r.submission?.title?.toLowerCase().includes(q)
      );
    }

    // Apply Alphabet Filters
    if (firstNameFilter !== "ALL") {
      filtered = filtered.filter((r) => {
        const name = (r.student.name || "").trim();
        return name.toUpperCase().startsWith(firstNameFilter);
      });
    }

    if (lastNameFilter !== "ALL") {
      filtered = filtered.filter((r) => {
        const nameParts = (r.student.name || "").trim().split(" ");
        const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0];
        return lastName.toUpperCase().startsWith(lastNameFilter);
      });
    }

    return filtered;
  }, [submissions, unsubmittedStudents, statusFilter, searchQuery, firstNameFilter, lastNameFilter]);

  // Save Grade Handler
  const handleSaveGrade = async (submissionId: string) => {
    const values = gradingValues[submissionId];
    if (!values || !values.grade.trim()) {
      toast({ title: "Please enter a grade between 0 and 100", variant: "destructive" });
      return;
    }

    const numGrade = parseInt(values.grade, 10);
    if (isNaN(numGrade) || numGrade < 0 || numGrade > 100) {
      toast({ title: "Invalid grade", description: "Grade must be between 0 and 100", variant: "destructive" });
      return;
    }

    setSavingGradeId(submissionId);
    try {
      const { error } = await supabase
        .from("projects")
        .update({
          grade: numGrade,
          feedback: values.feedback.trim() || null,
          review_status: "graded",
          graded_at: new Date().toISOString(),
        })
        .eq("id", submissionId);

      if (error) throw error;

      soundEffects.playSuccess();
      toast({ title: "Grade Saved!", description: `Assigned ${numGrade}% to student.` });

      // Notify student
      const sub = submissions.find((s) => s.id === submissionId);
      const studentAuthId = sub?.student?.auth_user_id || sub?.student_id;
      if (studentAuthId) {
        createNotification({
          recipientUserId: studentAuthId,
          type: "project_graded",
          title: `Project Graded: ${sub?.title || lesson?.title || "Assignment"}`,
          message: `Your project has been graded: ${numGrade}/100.${values.feedback ? ` Feedback: ${values.feedback}` : ""}`,
          data: { course_id: courseId, lesson_id: lessonId, project_id: submissionId },
        }).catch((e) => console.warn(e));
      }

      // Update local state
      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === submissionId
            ? { ...s, grade: numGrade, feedback: values.feedback.trim(), review_status: "graded" }
            : s
        )
      );

      if (viewSubmission?.id === submissionId) {
        setViewSubmission((prev) =>
          prev ? { ...prev, grade: numGrade, feedback: values.feedback.trim(), review_status: "graded" } : null
        );
      }
    } catch (err: any) {
      console.error("Save grade error:", err);
      toast({ title: "Failed to save grade", description: err.message, variant: "destructive" });
    } finally {
      setSavingGradeId(null);
    }
  };

  // Download All Submissions (CSV or JSON summary)
  const handleDownloadAll = () => {
    if (submissions.length === 0) {
      toast({ title: "No submissions to download", variant: "destructive" });
      return;
    }

    const rows = [
      ["Student Name", "Email", "Submission Title", "Submitted At", "Status", "Grade", "Link", "Has Code", "Feedback"],
      ...submissions.map((s) => [
        `"${s.student?.name || "Student"}"`,
        `"${s.student?.email || ""}"`,
        `"${s.title || "Project"}"`,
        `"${s.submitted_at ? new Date(s.submitted_at).toLocaleString() : ""}"`,
        `"${s.review_status || "submitted"}"`,
        `"${s.grade !== null ? s.grade : "Ungraded"}"`,
        `"${s.link || ""}"`,
        `"${s.code_content ? "Yes" : "No"}"`,
        `"${(s.feedback || "").replace(/"/g, '""')}"`,
      ]),
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `submissions-${course?.title || "course"}-lesson-${lesson?.order_index || 1}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({ title: "Submissions exported!", description: `Downloaded CSV with ${submissions.length} submissions.` });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(tableRows.map((r) => r.key));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <LMSLayout>
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-16">
        {/* ── 1. Top Forest Green Course Banner (Image 2 style) ────────────────────── */}
        <div className="bg-[#1b4332] text-white py-4 px-6 shadow-md">
          <div className="max-w-7xl mx-auto flex flex-col items-center justify-center text-center">
            <h1 className="text-xl md:text-2xl font-black tracking-wider uppercase drop-shadow-sm">
              {course?.title || "COURSE MANAGEMENT"}
            </h1>
            <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wider uppercase text-emerald-200 mt-1 flex-wrap justify-center">
              <Link to="/" className="hover:underline text-emerald-100">DASHBOARD</Link>
              <span>/</span>
              <Link to="/courses" className="hover:underline text-emerald-100">MY COURSES</Link>
              <span>/</span>
              <Link to={`/courses/${courseId}`} className="hover:underline text-emerald-100">
                {course?.title || "COURSE"}
              </Link>
              <span>/</span>
              <span className="text-white">
                {lesson?.title || `LESSON ${lesson?.order_index || 1}`}
              </span>
              <span>/</span>
              <span className="bg-emerald-800/80 px-1.5 py-0.5 rounded text-white">GRADING</span>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-4 space-y-4">
          {/* ── 2. Assignment Section Header ─────────────────────────────────────── */}
          <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-pink-500/15 text-pink-600 dark:text-pink-400 flex items-center justify-center shrink-0 mt-0.5">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300 px-2 py-0.5 rounded">
                      ASSIGNMENT
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Lesson {lesson?.order_index || 1}
                    </span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-foreground mt-0.5">
                    {lesson?.title ? `${lesson.title} Graded Project` : "Lesson Graded Project"}
                  </h2>
                  {lesson?.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 max-w-2xl">
                      {lesson.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(-1)}
                  className="gap-1.5 bg-background shadow-xs text-xs h-9"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleDownloadAll}
                  className="gap-1.5 bg-[#1b4332] hover:bg-[#143225] text-white shadow-xs text-xs h-9"
                >
                  <Download className="w-4 h-4" />
                  Download all submissions
                </Button>
              </div>
            </div>

            {/* Sub-tabs bar */}
            <div className="border-t bg-muted/40 px-4 flex items-center gap-2 text-xs font-semibold text-muted-foreground overflow-x-auto">
              <button className="px-3 py-2.5 border-b-2 border-[#1b4332] text-[#1b4332] dark:text-emerald-400 bg-background/60">
                Assignment
              </button>
              <button className="px-3 py-2.5 hover:text-foreground">Settings</button>
              <button className="px-3 py-2.5 hover:text-foreground">Advanced grading</button>
            </div>
          </div>

          {/* ── 3. Submissions Control & Filter Bar ───────────────────────────────── */}
          <div className="bg-card border rounded-lg p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-extrabold tracking-tight text-foreground">
                  Submissions
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  <span className="font-semibold text-foreground">{submissions.length}</span> submitted ·{" "}
                  <span className="font-semibold text-amber-600">
                    {submissions.filter((s) => s.grade === null || s.review_status === "submitted").length}
                  </span>{" "}
                  need grading ·{" "}
                  <span className="font-semibold text-muted-foreground">{unsubmittedStudents.length}</span> not submitted
                </p>
              </div>

              {/* Filter controls */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* Search query input */}
                <div className="relative min-w-[200px]">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input
                    placeholder="Search students..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 pl-8 text-xs bg-background"
                  />
                </div>

                {/* Status Filter Dropdown (Explicitly requested by user) */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                    Filter:
                  </span>
                  <Select
                    value={statusFilter}
                    onValueChange={(val: StatusFilter) => setStatusFilter(val)}
                  >
                    <SelectTrigger className="w-[180px] h-9 text-xs bg-background">
                      <SelectValue placeholder="Select filter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no_filter">No filter (All)</SelectItem>
                      <SelectItem value="needs_grading">Needs grading</SelectItem>
                      <SelectItem value="submitted">Submitted</SelectItem>
                      <SelectItem value="not_submitted">Not submitted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadData}
                  className="h-9 px-2 text-xs"
                  title="Refresh submissions"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>

            {/* ── 4. Alphabet Index (First name & Last name A-Z from Image 2) ────── */}
            <div className="border-t pt-3 space-y-2 text-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="w-20 font-semibold text-muted-foreground text-[11px]">First name:</span>
                <button
                  onClick={() => setFirstNameFilter("ALL")}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    firstNameFilter === "ALL"
                      ? "bg-[#1b4332] text-white"
                      : "bg-muted/70 hover:bg-muted text-foreground"
                  }`}
                >
                  All
                </button>
                {alphabet.map((letter) => (
                  <button
                    key={`fn-${letter}`}
                    onClick={() => setFirstNameFilter(letter)}
                    className={`w-6 h-6 rounded text-[11px] font-medium transition-colors ${
                      firstNameFilter === letter
                        ? "bg-[#1b4332] text-white font-bold"
                        : "bg-muted/50 hover:bg-muted text-foreground"
                    }`}
                  >
                    {letter}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="w-20 font-semibold text-muted-foreground text-[11px]">Last name:</span>
                <button
                  onClick={() => setLastNameFilter("ALL")}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    lastNameFilter === "ALL"
                      ? "bg-[#1b4332] text-white"
                      : "bg-muted/70 hover:bg-muted text-foreground"
                  }`}
                >
                  All
                </button>
                {alphabet.map((letter) => (
                  <button
                    key={`ln-${letter}`}
                    onClick={() => setLastNameFilter(letter)}
                    className={`w-6 h-6 rounded text-[11px] font-medium transition-colors ${
                      lastNameFilter === letter
                        ? "bg-[#1b4332] text-white font-bold"
                        : "bg-muted/50 hover:bg-muted text-foreground"
                    }`}
                  >
                    {letter}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── 5. Main Submissions & Grading Table (matching Image 2) ───────────── */}
          <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#1b4332] text-white border-b font-semibold text-[11px]">
                    <th className="py-3 px-3 w-10 text-center">
                      <Checkbox
                        checked={selectedIds.length === tableRows.length && tableRows.length > 0}
                        onCheckedChange={handleSelectAll}
                        className="border-white data-[state=checked]:bg-white data-[state=checked]:text-[#1b4332]"
                      />
                    </th>
                    <th className="py-3 px-3 w-12">User picture</th>
                    <th className="py-3 px-4 font-bold">First name / Last name</th>
                    <th className="py-3 px-4">Username / Email</th>
                    <th className="py-3 px-3 hidden lg:table-cell">Phone</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 min-w-[160px]">Grade</th>
                    <th className="py-3 px-4 hidden md:table-cell">Last modified (submission)</th>
                    <th className="py-3 px-4 min-w-[200px]">Online text / Submission</th>
                    <th className="py-3 px-4 min-w-[180px]">Feedback</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="py-16 text-center text-muted-foreground">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                        Loading submissions and enrolled students...
                      </td>
                    </tr>
                  ) : tableRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-16 text-center text-muted-foreground">
                        <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="font-semibold text-foreground">No students match current filter.</p>
                        <p className="text-xs text-muted-foreground mt-1">Try selecting "No filter (All)" or clear the search.</p>
                      </td>
                    </tr>
                  ) : (
                    tableRows.map((row) => {
                      const isSub = row.isSubmitted && row.submission;
                      const sub = row.submission;
                      const st = row.student;
                      const vals = isSub && sub ? gradingValues[sub.id] || { grade: "", feedback: "" } : { grade: "", feedback: "" };

                      return (
                        <tr
                          key={row.key}
                          className={`hover:bg-muted/30 transition-colors ${
                            !row.isSubmitted ? "bg-muted/10 opacity-75" : ""
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="py-3.5 px-3 text-center">
                            <Checkbox
                              checked={selectedIds.includes(row.key)}
                              onCheckedChange={() => toggleSelectRow(row.key)}
                            />
                          </td>

                          {/* User picture */}
                          <td className="py-3.5 px-3">
                            <Avatar className="w-8 h-8 rounded-full border shadow-xs">
                              {st.avatar_url && <AvatarImage src={st.avatar_url} alt={st.name || "Student"} />}
                              <AvatarFallback className="bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                                {(st.name || "S").slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          </td>

                          {/* Student Name */}
                          <td className="py-3.5 px-4 font-semibold text-foreground">
                            {st.name || "Student"}
                          </td>

                          {/* Email / Username */}
                          <td className="py-3.5 px-4 text-muted-foreground">
                            {st.email || "—"}
                          </td>

                          {/* Phone */}
                          <td className="py-3.5 px-3 text-muted-foreground hidden lg:table-cell">
                            {st.phone || "—"}
                          </td>

                          {/* Status Badge */}
                          <td className="py-3.5 px-3">
                            {row.isSubmitted && sub ? (
                              sub.grade !== null || sub.review_status === "graded" ? (
                                <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[10px] px-2 py-0.5">
                                  Graded ({sub.grade}%)
                                </Badge>
                              ) : (
                                <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-medium text-[10px] px-2 py-0.5">
                                  Submitted for grading
                                </Badge>
                              )
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground text-[10px] px-2 py-0.5">
                                Not submitted
                              </Badge>
                            )}
                          </td>

                          {/* Grade Column (Image 2 style with input + / 100 + Grade button) */}
                          <td className="py-3.5 px-4">
                            {row.isSubmitted && sub ? (
                              <div className="flex items-center gap-1.5">
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={vals.grade}
                                  onChange={(e) =>
                                    setGradingValues((prev) => ({
                                      ...prev,
                                      [sub.id]: {
                                        ...vals,
                                        grade: e.target.value,
                                      },
                                    }))
                                  }
                                  className="w-14 h-8 text-center text-xs font-semibold bg-background p-1"
                                  placeholder="—"
                                />
                                <span className="text-muted-foreground text-[11px] font-medium">/ 100</span>
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveGrade(sub.id)}
                                  disabled={savingGradeId === sub.id}
                                  className="h-8 px-2.5 text-xs bg-[#1b4332] hover:bg-[#143225] text-white font-semibold"
                                >
                                  {savingGradeId === sub.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    "Grade"
                                  )}
                                </Button>
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic text-[11px]">—</span>
                            )}
                          </td>

                          {/* Last modified date */}
                          <td className="py-3.5 px-4 text-muted-foreground hidden md:table-cell text-[11px]">
                            {sub?.submitted_at
                              ? new Date(sub.submitted_at).toLocaleString([], {
                                  weekday: "short",
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "—"}
                          </td>

                          {/* Online text / Submission: Link, Code, and View Submission button */}
                          <td className="py-3.5 px-4">
                            {row.isSubmitted && sub ? (
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {/* View Submission Button */}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setViewSubmission(sub)}
                                    className="h-7 text-xs px-2 gap-1 border-primary/40 text-primary hover:bg-primary/10"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    View Submission
                                  </Button>

                                  {/* External Link (if student pasted a project URL) */}
                                  {sub.link && (
                                    <a
                                      href={sub.link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 font-semibold underline text-xs"
                                      title={sub.link}
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                      Student project
                                    </a>
                                  )}

                                  {/* File link (if student uploaded a file) */}
                                  {sub.file_path && (
                                    <a
                                      href={
                                        supabase.storage
                                          .from("project-submissions")
                                          .getPublicUrl(sub.file_path).data.publicUrl
                                      }
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-800 font-semibold underline text-xs"
                                    >
                                      <FileText className="w-3 h-3" />
                                      File attachment
                                    </a>
                                  )}
                                </div>

                                {sub.title && (
                                  <div className="text-[11px] text-muted-foreground truncate max-w-[220px]">
                                    Title: <span className="text-foreground">{sub.title}</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">No submission yet</span>
                            )}
                          </td>

                          {/* Feedback text input or display */}
                          <td className="py-3.5 px-4">
                            {row.isSubmitted && sub ? (
                              <Input
                                value={vals.feedback}
                                onChange={(e) =>
                                  setGradingValues((prev) => ({
                                    ...prev,
                                    [sub.id]: {
                                      ...vals,
                                      feedback: e.target.value,
                                    },
                                  }))
                                }
                                onBlur={() => {
                                  // Auto-save feedback if grade already set
                                  if (sub.grade !== null && vals.feedback !== sub.feedback) {
                                    handleSaveGrade(sub.id);
                                  }
                                }}
                                placeholder="Add tutor feedback..."
                                className="h-8 text-xs bg-background"
                              />
                            ) : (
                              <span className="text-muted-foreground italic text-[11px]">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── 6. Full "View Submission" Modal ────────────────────────────────────── */}
        <Dialog open={!!viewSubmission} onOpenChange={(open) => !open && setViewSubmission(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
            <DialogHeader className="p-5 border-b bg-muted/20">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <DialogTitle className="text-lg font-bold flex items-center gap-2">
                    <Eye className="w-5 h-5 text-[#1b4332]" />
                    Submission Details: {viewSubmission?.student?.name || "Student"}
                  </DialogTitle>
                  <DialogDescription className="text-xs mt-1">
                    {lesson?.title || "Lesson"} · Submitted on{" "}
                    {viewSubmission?.submitted_at
                      ? new Date(viewSubmission.submitted_at).toLocaleString()
                      : "recently"}
                  </DialogDescription>
                </div>
                {viewSubmission?.review_status === "graded" ? (
                  <Badge className="bg-emerald-600 text-white text-xs">
                    Graded: {viewSubmission.grade}%
                  </Badge>
                ) : (
                  <Badge className="bg-amber-500 text-white text-xs">
                    Pending Review
                  </Badge>
                )}
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Submission Title and Student Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/40 p-4 rounded-lg text-xs">
                <div>
                  <span className="text-muted-foreground block">Project Title:</span>
                  <span className="font-semibold text-sm text-foreground">
                    {viewSubmission?.title || "Activity Project"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Student Contact:</span>
                  <span className="font-medium text-foreground">
                    {viewSubmission?.student?.email || "No email"}
                    {viewSubmission?.student?.phone ? ` · ${viewSubmission.student.phone}` : ""}
                  </span>
                </div>
                {viewSubmission?.description && (
                  <div className="col-span-full">
                    <span className="text-muted-foreground block">Description / Student Notes:</span>
                    <p className="mt-0.5 text-foreground leading-relaxed">
                      {viewSubmission.description}
                    </p>
                  </div>
                )}
              </div>

              {/* External Link Block (if student provided URL) */}
              {viewSubmission?.link && (
                <div className="p-4 border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-semibold text-blue-900 dark:text-blue-200 block">
                      External Project Link
                    </span>
                    <a
                      href={viewSubmission.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-700 dark:text-blue-300 underline font-mono break-all"
                    >
                      {viewSubmission.link}
                    </a>
                  </div>
                  <Button size="sm" asChild className="gap-1.5 shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-xs">
                    <a href={viewSubmission.link} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open Project ↗
                    </a>
                  </Button>
                </div>
              )}

              {/* Uploaded File Block */}
              {viewSubmission?.file_path && (
                <div className="p-4 border border-purple-200 bg-purple-50/50 dark:bg-purple-950/20 rounded-lg flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-semibold text-purple-900 dark:text-purple-200 block">
                      Uploaded File Submission
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {viewSubmission.file_path}
                    </span>
                  </div>
                  <Button size="sm" asChild variant="outline" className="gap-1.5 shrink-0 text-xs">
                    <a
                      href={
                        supabase.storage
                          .from("project-submissions")
                          .getPublicUrl(viewSubmission.file_path).data.publicUrl
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download File
                    </a>
                  </Button>
                </div>
              )}

              {/* Code Content & Live Preview */}
              {viewSubmission?.code_content && (
                <div className="border rounded-lg overflow-hidden space-y-0">
                  <div className="bg-muted/70 px-4 py-2 flex items-center justify-between border-b">
                    <div className="flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-primary" />
                      <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                        Submitted Code ({viewSubmission.editor_type || "code"})
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant={codeTab === "code" ? "default" : "ghost"}
                        onClick={() => setCodeTab("code")}
                        className="h-7 text-xs px-2.5"
                      >
                        Code
                      </Button>
                      <Button
                        size="sm"
                        variant={codeTab === "preview" ? "default" : "ghost"}
                        onClick={() => setCodeTab("preview")}
                        className="h-7 text-xs px-2.5"
                      >
                        Live Preview
                      </Button>
                    </div>
                  </div>

                  {codeTab === "code" ? (
                    <pre className="p-4 bg-zinc-950 text-zinc-100 font-mono text-xs overflow-x-auto max-h-80 leading-relaxed whitespace-pre-wrap">
                      {viewSubmission.code_content}
                    </pre>
                  ) : (
                    <iframe
                      srcDoc={viewSubmission.code_content}
                      title="Submission Live Preview"
                      sandbox="allow-scripts"
                      className="w-full h-80 border-0 bg-white"
                    />
                  )}
                </div>
              )}

              {/* Quick Grading Form in Modal */}
              <div className="p-4 border rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-900 dark:text-emerald-200">
                  Grade This Submission
                </h4>
                <div className="flex items-center gap-3">
                  <div className="w-32">
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                      Grade (0–100)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={viewSubmission ? gradingValues[viewSubmission.id]?.grade || "" : ""}
                      onChange={(e) => {
                        if (!viewSubmission) return;
                        setGradingValues((prev) => ({
                          ...prev,
                          [viewSubmission.id]: {
                            ...prev[viewSubmission.id],
                            grade: e.target.value,
                          },
                        }));
                      }}
                      className="h-9 text-sm font-bold bg-background"
                      placeholder="e.g. 95"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                      Tutor Feedback
                    </label>
                    <Input
                      value={viewSubmission ? gradingValues[viewSubmission.id]?.feedback || "" : ""}
                      onChange={(e) => {
                        if (!viewSubmission) return;
                        setGradingValues((prev) => ({
                          ...prev,
                          [viewSubmission.id]: {
                            ...prev[viewSubmission.id],
                            feedback: e.target.value,
                          },
                        }));
                      }}
                      placeholder="Great job! Keep it up..."
                      className="h-9 text-xs bg-background"
                    />
                  </div>
                  <div className="self-end">
                    <Button
                      onClick={() => viewSubmission && handleSaveGrade(viewSubmission.id)}
                      disabled={savingGradeId === viewSubmission?.id}
                      className="h-9 px-4 text-xs font-semibold bg-[#1b4332] hover:bg-[#143225] text-white"
                    >
                      {savingGradeId === viewSubmission?.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Save Grade"
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </LMSLayout>
  );
}
