import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { LMSLayout } from "@/components/LMSLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
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
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Download,
  ExternalLink,
  FileText,
  Code2,
  Eye,
  CheckCircle,
  Search,
  Check,
  Clock,
  Loader2,
  RefreshCw,
  Sliders,
  Award,
  Sparkles,
  Plus,
  Trash2,
  Save,
  HelpCircle,
  Settings as SettingsIcon,
  MessageSquare,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { soundEffects } from "@/utils/audio";
import { createNotification } from "@/utils/notifications";
import { awardXP, XP_REWARDS } from "@/utils/gamification";
import { fetchUserDirectory } from "@/utils/studentDirectory";
import { StudentDetailDialog } from "@/components/StudentDetailDialog";

type StatusFilter = "no_filter" | "needs_grading" | "submitted" | "not_submitted";
type PageTab = "assignment" | "settings" | "advanced_grading";

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
  student?: {
    id: string;
    auth_user_id: string | null;
    name: string | null;
    first_name?: string | null;
    last_name?: string | null;
    email: string | null;
    phone?: string | null;
    avatar_url?: string | null;
  };
}

interface EnrolledStudent {
  id: string;
  auth_user_id: string | null;
  name: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email: string | null;
  phone?: string | null;
  avatar_url?: string | null;
}

interface RubricCriterion {
  id: string;
  name: string;
  description: string;
  maxPoints: number;
}

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function LessonGradingPage() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [course, setCourse] = useState<any>(null);
  const [lesson, setLesson] = useState<any>(null);
  const [allLessons, setAllLessons] = useState<{ id: string; title: string; order_index: number }[]>([]);
  const [downloadInFolders, setDownloadInFolders] = useState(false);
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Top Tab
  const [activeTab, setActiveTab] = useState<PageTab>("assignment");

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("no_filter");
  const [searchQuery, setSearchQuery] = useState("");
  const [firstNameFilter, setFirstNameFilter] = useState<string>("ALL");
  const [lastNameFilter, setLastNameFilter] = useState<string>("ALL");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Inline grading state map
  const [gradingValues, setGradingValues] = useState<Record<string, { grade: string; feedback: string }>>({});
  const [savingGradeId, setSavingGradeId] = useState<string | null>(null);
  // Submissions with unsaved edits, preserved across realtime reloads
  const dirtyDrafts = useRef<Set<string>>(new Set());

  const setDraft = (
    submissionId: string,
    patch: Partial<{ grade: string; feedback: string }>
  ) => {
    dirtyDrafts.current.add(submissionId);
    setGradingValues((prev) => ({
      ...prev,
      [submissionId]: { grade: "", feedback: "", ...prev[submissionId], ...patch },
    }));
  };

  // View Submission Modal state
  const [viewSubmission, setViewSubmission] = useState<SubmissionItem | null>(null);

  // Student detail drill-down
  const [detailStudent, setDetailStudent] = useState<EnrolledStudent | null>(null);
  const [codeTab, setCodeTab] = useState<"code" | "preview">("code");

  // Current lesson navigation calculations (Image 1)
  const currentLessonIndex = useMemo(() => {
    return allLessons.findIndex((l) => l.id === lessonId);
  }, [allLessons, lessonId]);

  const prevLesson = currentLessonIndex > 0 ? allLessons[currentLessonIndex - 1] : null;
  const nextLesson =
    currentLessonIndex >= 0 && currentLessonIndex < allLessons.length - 1
      ? allLessons[currentLessonIndex + 1]
      : null;

  // ── Settings Tab State (Image 2) ───────────────────────────────────────────
  const [settingTitle, setSettingTitle] = useState("");
  const [settingDescription, setSettingDescription] = useState("");
  const [settingInstructions, setSettingInstructions] = useState("");
  const [enableDueDate, setEnableDueDate] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [enableCutoffDate, setEnableCutoffDate] = useState(false);
  const [cutoffDate, setCutoffDate] = useState("");
  const [allowOnlineCode, setAllowOnlineCode] = useState(true);
  const [allowFileUpload, setAllowFileUpload] = useState(true);
  const [allowExternalLink, setAllowExternalLink] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // ── Advanced Grading Tab State (Image 3) ───────────────────────────────────
  const [gradingMethod, setGradingMethod] = useState<"simple" | "rubric" | "guide">("simple");
  const [maxGrade, setMaxGrade] = useState("100");
  const [passingGrade, setPassingGrade] = useState("70");
  const [autoNotify, setAutoNotify] = useState(true);
  const [rubricCriteria, setRubricCriteria] = useState<RubricCriterion[]>([
    { id: "1", name: "Code Correctness & Functionality", description: "Does the code run properly without errors and meet requirements?", maxPoints: 40 },
    { id: "2", name: "Design, Styling & Creativity", description: "Visual appearance, clean layout, color harmony, and creative effort.", maxPoints: 30 },
    { id: "3", name: "Code Structure & Best Practices", description: "Proper indentation, semantic tags, comments, and clean logic.", maxPoints: 30 },
  ]);
  const [savingGradingConfig, setSavingGradingConfig] = useState(false);

  useEffect(() => {
    if (courseId && lessonId) {
      loadData();
    }
  }, [courseId, lessonId]);

  // Keep the table in sync as students submit or profiles are updated
  useEffect(() => {
    if (!lessonId) return;

    const channel = supabase
      .channel(`lesson-grading-${lessonId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects", filter: `lesson_id=eq.${lessonId}` },
        () => loadData()
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, () => loadData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [lessonId, courseId]);

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

      // 3. Fetch all lessons for course (for bottom navigation bar)
      const { data: allCourseLessons } = await supabase
        .from("lessons")
        .select("id, title, order_index")
        .eq("course_id", courseId!)
        .order("order_index", { ascending: true });
      setAllLessons(allCourseLessons || []);

      // Initialize Settings from Lesson Data
      if (lData) {
        setSettingTitle(lData.title || "");
        setSettingDescription(lData.description || "");
        setSettingInstructions(lData.content || "");
        const ex = lData.exercises || {};
        if (ex.due_date) {
          setDueDate(ex.due_date);
          setEnableDueDate(true);
        }
        if (ex.cutoff_date) {
          setCutoffDate(ex.cutoff_date);
          setEnableCutoffDate(true);
        }
        if (ex.allow_code !== undefined) setAllowOnlineCode(ex.allow_code);
        if (ex.allow_file !== undefined) setAllowFileUpload(ex.allow_file);
        if (ex.allow_link !== undefined) setAllowExternalLink(ex.allow_link);
        if (ex.grading_method) setGradingMethod(ex.grading_method);
        if (ex.max_grade) setMaxGrade(ex.max_grade.toString());
        if (ex.passing_grade) setPassingGrade(ex.passing_grade.toString());
        if (ex.auto_notify !== undefined) setAutoNotify(ex.auto_notify);
        if (ex.rubric && Array.isArray(ex.rubric)) setRubricCriteria(ex.rubric);
      }

      // 4. Fetch Enrolled Students for this course
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("student_id")
        .eq("course_id", courseId!);

      // 5. Fetch Submissions for this lesson
      const { data: pData, error: pErr } = await supabase
        .from("projects")
        .select("id, course_id, lesson_id, student_id, title, description, link, file_path, code_content, editor_type, grade, feedback, review_status, submitted_at")
        .eq("lesson_id", lessonId!)
        .order("submitted_at", { ascending: false });

      if (pErr) throw pErr;

      // Collect all student IDs across enrollments and submissions
      const allStudentIdSet = new Set<string>();
      (enrollments || []).forEach((e) => {
        if (e.student_id) allStudentIdSet.add(e.student_id);
      });
      (pData || []).forEach((p) => {
        if (p.student_id) allStudentIdSet.add(p.student_id);
      });
      const allUniqueIds = Array.from(allStudentIdSet);

      // Resolve every student identifier (users.id or auth_user_id) to a real person
      const usersMap = await fetchUserDirectory(allUniqueIds);

      // Build enrolled student list
      const studentList: EnrolledStudent[] = (enrollments || [])
        .map((e) => usersMap[e.student_id])
        .filter(Boolean);
      setEnrolledStudents(studentList);

      // Build enriched submissions list
      const initialGradingMap: Record<string, { grade: string; feedback: string }> = {};
      const enrichedSubmissions: SubmissionItem[] = (pData || []).map((p) => {
        const studentInfo = usersMap[p.student_id] || {
          id: p.student_id,
          auth_user_id: p.student_id,
          name: "",
          first_name: null,
          last_name: null,
          email: "",
          phone: null,
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
      setGradingValues((prev) => {
        const merged = { ...initialGradingMap };
        dirtyDrafts.current.forEach((id) => {
          if (prev[id]) merged[id] = prev[id];
        });
        return merged;
      });
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

  // Unified list for table rows
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

  const QUICK_GRADE_PRESETS = [
    { grade: "100", label: "100% Outstanding", feedback: "Outstanding project submission! Flawless execution and clear STEM logic." },
    { grade: "90", label: "90% Excellent", feedback: "Excellent job! Well-structured solution demonstrating strong problem solving." },
    { grade: "80", label: "80% Good", feedback: "Good effort! The project meets key requirements with good attention to detail." },
    { grade: "70", label: "70% Passing", feedback: "Passing submission. Solid foundation, keep refining your code and designs!" },
  ];

  const handleApplyQuickGrade = (submissionId: string, preset: typeof QUICK_GRADE_PRESETS[0]) => {
    const current = gradingValues[submissionId] || { grade: "", feedback: "" };
    setDraft(submissionId, {
      grade: preset.grade,
      feedback: current.feedback.trim() ? current.feedback : preset.feedback
    });
    toast({
      title: `Preset Applied: ${preset.label}`,
      description: `Set grade to ${preset.grade}% with supportive tutor feedback.`
    });
  };

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

      dirtyDrafts.current.delete(submissionId);
      soundEffects.playSuccess();
      toast({ title: "Grade Saved!", description: `Assigned ${numGrade}% to student.` });

      // Notify student and award +150 XP bonus if passing (>= 70%)
      const sub = submissions.find((s) => s.id === submissionId);
      const studentAuthId = sub?.student?.auth_user_id || sub?.student_id;
      
      let earnedBonusXP = false;
      if (studentAuthId && numGrade >= 70) {
        try {
          const xpRes = await awardXP(
            studentAuthId,
            XP_REWARDS.PROJECT_GRADED_BONUS,
            `Passed project assignment: ${sub?.title || lesson?.title || "Project"} (${numGrade}%)`,
            submissionId
          );
          if (xpRes.success) earnedBonusXP = true;
        } catch (xpErr) {
          console.warn("Could not award project bonus XP:", xpErr);
        }
      }

      if (studentAuthId && autoNotify) {
        const xpNotice = earnedBonusXP ? ` 🎉 You earned a +${XP_REWARDS.PROJECT_GRADED_BONUS} XP bonus!` : "";
        createNotification({
          recipientUserId: studentAuthId,
          type: "project_graded",
          title: `Project Graded: ${sub?.title || lesson?.title || "Assignment"}`,
          message: `Your project has been graded: ${numGrade}/100.${xpNotice}${values.feedback ? ` Tutor Feedback: ${values.feedback}` : ""}`,
          data: { course_id: courseId, lesson_id: lessonId, project_id: submissionId, grade: numGrade, earned_bonus_xp: earnedBonusXP },
        }).catch((e) => console.warn(e));
      }

      // Mark lesson_progress completed = true so next lesson unlocks
      if (studentAuthId && lessonId) {
        try {
          await supabase
            .from("lesson_progress")
            .upsert({
              student_id: studentAuthId,
              lesson_id: lessonId,
              completed: true,
              completed_at: new Date().toISOString(),
            });
        } catch (progErr) {
          console.warn("Could not upsert lesson_progress:", progErr);
        }
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

  // Remove an existing grade and send the submission back for grading
  const handleUngrade = async (submissionId: string) => {
    setSavingGradeId(submissionId);
    try {
      const { error } = await supabase
        .from("projects")
        .update({
          grade: null,
          feedback: null,
          review_status: "submitted",
          graded_at: null,
        })
        .eq("id", submissionId);

      if (error) throw error;

      toast({ title: "Grade removed", description: "Submission is back in the needs-grading queue." });

      dirtyDrafts.current.delete(submissionId);
      setGradingValues((prev) => ({ ...prev, [submissionId]: { grade: "", feedback: "" } }));
      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === submissionId ? { ...s, grade: null, feedback: null, review_status: "submitted" } : s
        )
      );

      const sub = submissions.find((s) => s.id === submissionId);
      const studentAuthId = sub?.student?.auth_user_id || sub?.student_id;

      // Revert lesson_progress completed = false
      if (studentAuthId && lessonId) {
        try {
          await supabase
            .from("lesson_progress")
            .upsert({
              student_id: studentAuthId,
              lesson_id: lessonId,
              completed: false,
              completed_at: null,
            });
        } catch (progErr) {
          console.warn("Could not revert lesson_progress:", progErr);
        }
      }
      if (studentAuthId && autoNotify) {
        createNotification({
          recipientUserId: studentAuthId,
          type: "project_graded",
          title: `Grade Removed: ${sub?.title || lesson?.title || "Assignment"}`,
          message: "Your submission is being re-reviewed and will be graded again shortly.",
          data: { course_id: courseId, lesson_id: lessonId, project_id: submissionId },
        }).catch((e) => console.warn(e));
      }

      if (viewSubmission?.id === submissionId) {
        setViewSubmission((prev) =>
          prev ? { ...prev, grade: null, feedback: null, review_status: "submitted" } : null
        );
      }
    } catch (err: any) {
      console.error("Ungrade error:", err);
      toast({ title: "Failed to remove grade", description: err.message, variant: "destructive" });
    } finally {
      setSavingGradeId(null);
    }
  };

  // ── Save Settings Handler (Image 2) ─────────────────────────────────────────
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const updatedExercises = {
        ...(lesson?.exercises || {}),
        due_date: enableDueDate ? dueDate : null,
        cutoff_date: enableCutoffDate ? cutoffDate : null,
        allow_code: allowOnlineCode,
        allow_file: allowFileUpload,
        allow_link: allowExternalLink,
      };

      const { error } = await supabase
        .from("lessons")
        .update({
          title: settingTitle,
          description: settingDescription,
          content: settingInstructions,
          exercises: updatedExercises,
        })
        .eq("id", lessonId!);

      if (error) throw error;

      soundEffects.playSuccess();
      toast({
        title: "Assignment Settings Saved!",
        description: "Your changes have been updated successfully.",
      });

      setLesson((prev: any) => ({
        ...prev,
        title: settingTitle,
        description: settingDescription,
        content: settingInstructions,
        exercises: updatedExercises,
      }));

      // Switch back to view submissions
      setActiveTab("assignment");
    } catch (err: any) {
      console.error("Save settings error:", err);
      toast({ title: "Failed to save settings", description: err.message, variant: "destructive" });
    } finally {
      setSavingSettings(false);
    }
  };

  // ── Save Advanced Grading Handler (Image 3) ─────────────────────────────────
  const handleSaveGradingConfig = async () => {
    setSavingGradingConfig(true);
    try {
      const updatedExercises = {
        ...(lesson?.exercises || {}),
        grading_method: gradingMethod,
        max_grade: parseInt(maxGrade, 10) || 100,
        passing_grade: parseInt(passingGrade, 10) || 70,
        auto_notify: autoNotify,
        rubric: rubricCriteria,
      };

      const { error } = await supabase
        .from("lessons")
        .update({
          exercises: updatedExercises,
        })
        .eq("id", lessonId!);

      if (error) throw error;

      soundEffects.playSuccess();
      toast({
        title: "Advanced Grading Saved!",
        description: `Active grading method set to: ${
          gradingMethod === "simple"
            ? "Simple direct grading"
            : gradingMethod === "rubric"
            ? "Rubric"
            : "Marking guide"
        }.`,
      });

      setLesson((prev: any) => ({
        ...prev,
        exercises: updatedExercises,
      }));
    } catch (err: any) {
      console.error("Save grading config error:", err);
      toast({ title: "Failed to save configuration", description: err.message, variant: "destructive" });
    } finally {
      setSavingGradingConfig(false);
    }
  };

  // Rubric Criterion Helpers
  const handleAddCriterion = () => {
    const newId = Date.now().toString();
    setRubricCriteria((prev) => [
      ...prev,
      { id: newId, name: "New Criterion", description: "Describe what is expected for this criterion.", maxPoints: 20 },
    ]);
  };

  const handleUpdateCriterion = (id: string, field: keyof RubricCriterion, val: any) => {
    setRubricCriteria((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: val } : c))
    );
  };

  const handleDeleteCriterion = (id: string) => {
    setRubricCriteria((prev) => prev.filter((c) => c.id !== id));
  };

  // Download All Submissions CSV
  const handleDownloadAll = () => {
    if (submissions.length === 0) {
      toast({ title: "No submissions to download", variant: "destructive" });
      return;
    }

    const rows = [
      ["Student Name", "Email", "Phone", "Submission Title", "Submitted At", "Status", "Grade", "Link", "Has Code", "Feedback"],
      ...submissions.map((s) => [
        `"${s.student?.name || "Student"}"`,
        `"${s.student?.email || ""}"`,
        `"${s.student?.phone || ""}"`,
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
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 pb-16">
        {/* ── 1. Top Purple & Lavender Course Banner ─────────────────────────────── */}
        <div className="bg-gradient-to-r from-purple-900 via-indigo-950 to-purple-900 text-white py-5 px-6 shadow-md border-b border-purple-800/40">
          <div className="max-w-7xl mx-auto flex flex-col items-center justify-center text-center">
            <h1 className="text-xl md:text-2xl font-black tracking-wider uppercase drop-shadow-sm text-purple-100">
              {course?.title || "COURSE MANAGEMENT"}
            </h1>
            <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wider uppercase text-purple-200 mt-1 flex-wrap justify-center">
              <Link to="/" className="hover:underline text-purple-200">DASHBOARD</Link>
              <span>/</span>
              <Link to="/courses" className="hover:underline text-purple-200">MY COURSES</Link>
              <span>/</span>
              <Link to={`/courses/${courseId}`} className="hover:underline text-purple-200">
                {course?.title || "COURSE"}
              </Link>
              <span>/</span>
              <span className="text-white font-bold">
                {lesson?.title || `LESSON ${lesson?.order_index || 1}`}
              </span>
              <span>/</span>
              <span className="bg-purple-800/90 text-purple-100 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider">
                {activeTab === "assignment" ? "GRADING" : activeTab === "settings" ? "SETTINGS" : "ADVANCED GRADING"}
              </span>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-4 space-y-4">
          {/* ── 2. Assignment Header Card with Purple & Lavender Palette ───────────── */}
          <div className="bg-card border border-purple-100 dark:border-purple-950 rounded-lg overflow-hidden shadow-sm">
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 flex items-center justify-center shrink-0 mt-0.5 border border-purple-200 dark:border-purple-800">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 px-2.5 py-0.5 rounded-full border border-purple-200 dark:border-purple-800">
                      ASSIGNMENT
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">
                      Lesson {lesson?.order_index || 1}
                    </span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-foreground mt-1">
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
                  className="gap-1.5 bg-background shadow-xs text-xs h-9 border-purple-200 hover:bg-purple-50 text-purple-900 dark:text-purple-200"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleDownloadAll}
                  className="gap-1.5 bg-purple-700 hover:bg-purple-800 text-white shadow-xs text-xs h-9 font-semibold"
                >
                  <Download className="w-4 h-4" />
                  Download all submissions
                </Button>
              </div>
            </div>

            {/* ── Top Navigation Tabs (Assignment | Settings | Advanced grading) ── */}
            <div className="border-t border-purple-100 dark:border-purple-950/60 bg-purple-50/40 dark:bg-purple-950/20 px-4 flex items-center gap-1 text-xs font-semibold overflow-x-auto">
              <button
                onClick={() => setActiveTab("assignment")}
                className={`px-4 py-3 border-b-2 font-bold transition-colors flex items-center gap-1.5 ${
                  activeTab === "assignment"
                    ? "border-purple-700 text-purple-800 dark:text-purple-300 bg-white dark:bg-zinc-900"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Assignment & Submissions
              </button>
              <button
                onClick={() => setActiveTab("settings")}
                className={`px-4 py-3 border-b-2 font-bold transition-colors flex items-center gap-1.5 ${
                  activeTab === "settings"
                    ? "border-purple-700 text-purple-800 dark:text-purple-300 bg-white dark:bg-zinc-900"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <SettingsIcon className="w-3.5 h-3.5" />
                Settings
              </button>
              <button
                onClick={() => setActiveTab("advanced_grading")}
                className={`px-4 py-3 border-b-2 font-bold transition-colors flex items-center gap-1.5 ${
                  activeTab === "advanced_grading"
                    ? "border-purple-700 text-purple-800 dark:text-purple-300 bg-white dark:bg-zinc-900"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                Advanced grading
              </button>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════════
              TAB 1: ASSIGNMENT & SUBMISSIONS TABLE (matching Image 1 & 2)
          ═══════════════════════════════════════════════════════════════════════ */}
          {activeTab === "assignment" && (
            <>
              {/* Filter controls & Summary bar */}
              <div className="bg-card border border-purple-100 dark:border-purple-950 rounded-lg p-4 sm:p-5 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-extrabold tracking-tight text-foreground">
                      Submissions
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <span className="font-semibold text-purple-700 dark:text-purple-300">{submissions.length}</span> submitted ·{" "}
                      <span className="font-semibold text-amber-600">
                        {submissions.filter((s) => s.grade === null || s.review_status === "submitted").length}
                      </span>{" "}
                      need grading ·{" "}
                      <span className="font-semibold text-muted-foreground">{unsubmittedStudents.length}</span> not submitted
                    </p>
                  </div>

                  {/* Search and Filters */}
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Search box */}
                    <div className="relative min-w-[200px]">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                      <Input
                        placeholder="Search student, email, phone..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-9 pl-8 text-xs bg-background border-purple-200 dark:border-purple-900"
                      />
                    </div>

                    {/* Status Filter Dropdown */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                        Filter:
                      </span>
                      <Select
                        value={statusFilter}
                        onValueChange={(val: StatusFilter) => setStatusFilter(val)}
                      >
                        <SelectTrigger className="w-[180px] h-9 text-xs bg-background border-purple-200 dark:border-purple-900">
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
                      className="h-9 px-2 text-xs text-purple-800 dark:text-purple-300 hover:bg-purple-100/50"
                      title="Refresh submissions"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                    </Button>
                  </div>
                </div>

                {/* Alphabet Index (First name & Last name A-Z from Image 2) */}
                <div className="border-t border-purple-100 dark:border-purple-950 pt-3 space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="w-20 font-semibold text-muted-foreground text-[11px]">First name:</span>
                    <button
                      onClick={() => setFirstNameFilter("ALL")}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                        firstNameFilter === "ALL"
                          ? "bg-purple-700 text-white font-bold"
                          : "bg-purple-50 text-purple-900 hover:bg-purple-100 dark:bg-purple-950/40 dark:text-purple-300"
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
                            ? "bg-purple-700 text-white font-bold"
                            : "bg-purple-50 hover:bg-purple-100 text-purple-900 dark:bg-purple-950/30 dark:text-purple-300"
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
                          ? "bg-purple-700 text-white font-bold"
                          : "bg-purple-50 text-purple-900 hover:bg-purple-100 dark:bg-purple-950/40 dark:text-purple-300"
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
                            ? "bg-purple-700 text-white font-bold"
                            : "bg-purple-50 hover:bg-purple-100 text-purple-900 dark:bg-purple-950/30 dark:text-purple-300"
                        }`}
                      >
                        {letter}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Main Submissions Table (Deep Purple header) */}
              <div className="bg-card border border-purple-100 dark:border-purple-950 rounded-lg shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-purple-900 text-white border-b border-purple-800 font-semibold text-[11px]">
                        <th className="py-3 px-3 w-10 text-center">
                          <Checkbox
                            checked={selectedIds.length === tableRows.length && tableRows.length > 0}
                            onCheckedChange={handleSelectAll}
                            className="border-white data-[state=checked]:bg-white data-[state=checked]:text-purple-900"
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
                    <tbody className="divide-y divide-purple-100/60 dark:divide-purple-950/60">
                      {loading ? (
                        <tr>
                          <td colSpan={10} className="py-16 text-center text-muted-foreground">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-600" />
                            Loading submissions and student data...
                          </td>
                        </tr>
                      ) : tableRows.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-16 text-center text-muted-foreground">
                            <FileText className="w-10 h-10 mx-auto mb-2 opacity-30 text-purple-400" />
                            <p className="font-semibold text-foreground">No students match current filter.</p>
                            <p className="text-xs text-muted-foreground mt-1">Try selecting "No filter (All)" or clear search.</p>
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
                              className={`hover:bg-purple-50/40 dark:hover:bg-purple-950/20 transition-colors ${
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
                                <Avatar className="w-8 h-8 rounded-full border border-purple-200 shadow-xs">
                                  {st.avatar_url && <AvatarImage src={st.avatar_url} alt={st.name || ""} />}
                                  <AvatarFallback className="bg-purple-100 text-purple-900 font-bold text-[10px]">
                                    {(st.name ? st.name.slice(0, 2) : st.email ? st.email.slice(0, 2) : "?").toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                              </td>

                              {/* Student Name */}
                              <td className="py-3.5 px-4 font-bold text-foreground">
                                {st.name ? (
                                  <button
                                    type="button"
                                    onClick={() => setDetailStudent(st)}
                                    className="text-purple-700 dark:text-purple-300 hover:underline font-bold text-left"
                                    title={`View ${st.name}'s full profile, grades and activity`}
                                  >
                                    {st.name}
                                  </button>
                                ) : (
                                  <span className="text-muted-foreground font-normal italic text-xs">—</span>
                                )}
                              </td>

                              {/* Email / Username */}
                              <td className="py-3.5 px-4 text-muted-foreground font-medium">
                                {st.email || <span className="text-muted-foreground italic text-xs">—</span>}
                              </td>

                              {/* Phone */}
                              <td className="py-3.5 px-3 text-muted-foreground hidden lg:table-cell">
                                {st.phone || <span className="text-muted-foreground italic text-xs">—</span>}
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

                              {/* Grade Column */}
                              <td className="py-3.5 px-4">
                                {row.isSubmitted && sub ? (
                                  <div className="flex items-center gap-1.5">
                                    <Input
                                      type="number"
                                      min="0"
                                      max="100"
                                      value={vals.grade}
                                      onChange={(e) => setDraft(sub.id, { grade: e.target.value })}
                                      className="w-14 h-8 text-center text-xs font-semibold bg-background p-1 border-purple-200"
                                      placeholder="—"
                                    />
                                    <span className="text-muted-foreground text-[11px] font-medium">/ 100</span>
                                    <Button
                                      size="sm"
                                      onClick={() => handleSaveGrade(sub.id)}
                                      disabled={savingGradeId === sub.id}
                                      className="h-8 px-2.5 text-xs bg-purple-700 hover:bg-purple-800 text-white font-semibold"
                                    >
                                      {savingGradeId === sub.id ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        "Grade"
                                      )}
                                    </Button>
                                    {(sub.grade !== null || sub.review_status === "graded") && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleUngrade(sub.id)}
                                        disabled={savingGradeId === sub.id}
                                        className="h-8 px-2.5 text-xs border-purple-300 text-purple-700 dark:text-purple-300 hover:bg-purple-50 font-semibold"
                                        title="Remove this grade and return the submission for grading"
                                      >
                                        Ungrade
                                      </Button>
                                    )}
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

                              {/* Online text / Submission */}
                              <td className="py-3.5 px-4">
                                {row.isSubmitted && sub ? (
                                  <div className="space-y-1.5">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {/* View Submission Button */}
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setViewSubmission(sub)}
                                        className="h-7 text-xs px-2 gap-1 border-purple-300 text-purple-700 dark:text-purple-300 hover:bg-purple-50"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                        View Submission
                                      </Button>

                                      {/* Direct Chat Shortcut */}
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        asChild
                                        className="h-7 text-xs px-2 gap-1 border-purple-300 text-purple-700 dark:text-purple-300 hover:bg-purple-50"
                                        title={`Direct chat with ${st.name || "student"}`}
                                      >
                                        <Link to={`/chat?user=${st.auth_user_id || st.id}`}>
                                          <MessageSquare className="w-3.5 h-3.5 text-purple-600" />
                                          Chat
                                        </Link>
                                      </Button>

                                      {/* External Link */}
                                      {sub.link && (
                                        <a
                                          href={sub.link}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 text-purple-700 dark:text-purple-400 font-bold hover:underline text-xs"
                                          title={sub.link}
                                        >
                                          <ExternalLink className="w-3 h-3" />
                                          Student project
                                        </a>
                                      )}

                                      {/* File link */}
                                      {sub.file_path && (
                                        <a
                                          href={
                                            supabase.storage
                                              .from("project-submissions")
                                              .getPublicUrl(sub.file_path).data.publicUrl
                                          }
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-semibold underline text-xs"
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
                                  <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground text-[11px]">No submission yet</span>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      asChild
                                      className="h-6 text-[11px] px-2 gap-1 text-purple-600 hover:text-purple-800 hover:bg-purple-50"
                                      title={`Message ${st.name || "student"} on Live Chat`}
                                    >
                                      <Link to={`/chat?user=${st.auth_user_id || st.id}`}>
                                        <MessageSquare className="w-3 h-3" />
                                        Remind
                                      </Link>
                                    </Button>
                                  </div>
                                )}
                              </td>

                              {/* Feedback text input */}
                              <td className="py-3.5 px-4">
                                {row.isSubmitted && sub ? (
                                  <Input
                                    value={vals.feedback}
                                    onChange={(e) => setDraft(sub.id, { feedback: e.target.value })}
                                    onBlur={() => {
                                      if (sub.grade !== null && vals.feedback !== sub.feedback) {
                                        handleSaveGrade(sub.id);
                                      }
                                    }}
                                    placeholder="Add tutor feedback..."
                                    className="h-8 text-xs bg-background border-purple-200"
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
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════════════
              TAB 2: SETTINGS (Essential & Working features from Image 2)
          ═══════════════════════════════════════════════════════════════════════ */}
          {activeTab === "settings" && (
            <div className="bg-card border border-purple-100 dark:border-purple-950 rounded-lg p-6 shadow-sm space-y-6">
              <div className="border-b border-purple-100 dark:border-purple-900/50 pb-4">
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <SettingsIcon className="w-5 h-5 text-purple-700" />
                  Updating Assignment: {lesson?.title || "Lesson Graded Project"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configure assignment parameters, deadline dates, and accepted submission methods.
                </p>
              </div>

              {/* Section 1: General Details */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold uppercase tracking-wider text-purple-900 dark:text-purple-300 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                  General
                </h4>

                <div className="space-y-3 pl-4 border-l-2 border-purple-200 dark:border-purple-900">
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      Assignment Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={settingTitle}
                      onChange={(e) => setSettingTitle(e.target.value)}
                      placeholder="e.g. Lesson 2 Graded Project - Web Design"
                      className="text-xs border-purple-200"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      Description & Overview
                    </label>
                    <Textarea
                      value={settingDescription}
                      onChange={(e) => setSettingDescription(e.target.value)}
                      placeholder="Explain what the students are building and what is required to pass..."
                      rows={3}
                      className="text-xs border-purple-200 leading-relaxed"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      Activity Instructions & Guidance
                    </label>
                    <Textarea
                      value={settingInstructions}
                      onChange={(e) => setSettingInstructions(e.target.value)}
                      placeholder="Step-by-step instructions or coding prompts for students..."
                      rows={4}
                      className="text-xs border-purple-200 leading-relaxed"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Availability & Deadlines */}
              <div className="space-y-4 pt-2">
                <h4 className="text-sm font-bold uppercase tracking-wider text-purple-900 dark:text-purple-300 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                  Availability
                </h4>

                <div className="space-y-4 pl-4 border-l-2 border-purple-200 dark:border-purple-900">
                  {/* Due Date */}
                  <div className="flex items-center justify-between gap-4 p-3 rounded-lg border border-purple-100 bg-purple-50/30 dark:bg-purple-950/20 max-w-xl">
                    <div className="space-y-0.5">
                      <label className="text-xs font-semibold text-foreground block">
                        Due Date
                      </label>
                      <p className="text-[11px] text-muted-foreground">
                        Students can submit after this date but it will be flagged as late.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={enableDueDate}
                        onCheckedChange={(c) => setEnableDueDate(!!c)}
                        id="enable-due"
                      />
                      <label htmlFor="enable-due" className="text-xs font-medium mr-2">Enable</label>
                      <Input
                        type="date"
                        value={dueDate}
                        disabled={!enableDueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="h-8 text-xs w-36 bg-background border-purple-200"
                      />
                    </div>
                  </div>

                  {/* Cutoff Date */}
                  <div className="flex items-center justify-between gap-4 p-3 rounded-lg border border-purple-100 bg-purple-50/30 dark:bg-purple-950/20 max-w-xl">
                    <div className="space-y-0.5">
                      <label className="text-xs font-semibold text-foreground block">
                        Cut-off Date
                      </label>
                      <p className="text-[11px] text-muted-foreground">
                        Submissions will be completely closed after this date.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={enableCutoffDate}
                        onCheckedChange={(c) => setEnableCutoffDate(!!c)}
                        id="enable-cutoff"
                      />
                      <label htmlFor="enable-cutoff" className="text-xs font-medium mr-2">Enable</label>
                      <Input
                        type="date"
                        value={cutoffDate}
                        disabled={!enableCutoffDate}
                        onChange={(e) => setCutoffDate(e.target.value)}
                        className="h-8 text-xs w-36 bg-background border-purple-200"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Submission Types */}
              <div className="space-y-4 pt-2">
                <h4 className="text-sm font-bold uppercase tracking-wider text-purple-900 dark:text-purple-300 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                  Submission Types
                </h4>

                <div className="space-y-3 pl-4 border-l-2 border-purple-200 dark:border-purple-900 max-w-xl">
                  <div className="flex items-center justify-between p-3 rounded-lg border border-purple-100 bg-card">
                    <div className="space-y-0.5">
                      <span className="text-xs font-semibold text-foreground block">Online Code Editor</span>
                      <span className="text-[11px] text-muted-foreground">Allows HTML, CSS, JS, or Python code submissions directly</span>
                    </div>
                    <Switch checked={allowOnlineCode} onCheckedChange={setAllowOnlineCode} />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border border-purple-100 bg-card">
                    <div className="space-y-0.5">
                      <span className="text-xs font-semibold text-foreground block">File Uploads</span>
                      <span className="text-[11px] text-muted-foreground">Allows zip archives, documents, or project screenshots</span>
                    </div>
                    <Switch checked={allowFileUpload} onCheckedChange={setAllowFileUpload} />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border border-purple-100 bg-card">
                    <div className="space-y-0.5">
                      <span className="text-xs font-semibold text-foreground block">External Project Links</span>
                      <span className="text-[11px] text-muted-foreground">Allows Scratch URLs, Roblox game links, or GitHub repositories</span>
                    </div>
                    <Switch checked={allowExternalLink} onCheckedChange={setAllowExternalLink} />
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-4 border-t border-purple-100 flex items-center gap-3">
                <Button
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  className="bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold gap-2 px-6 h-10 shadow-xs"
                >
                  {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save and Display Assignment
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setActiveTab("assignment")}
                  className="text-xs h-10 border-purple-200"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════════
              TAB 3: ADVANCED GRADING (Matching Image 3)
          ═══════════════════════════════════════════════════════════════════════ */}
          {activeTab === "advanced_grading" && (
            <div className="bg-card border border-purple-100 dark:border-purple-950 rounded-lg p-6 shadow-sm space-y-6">
              <div className="border-b border-purple-100 dark:border-purple-900/50 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Award className="w-5 h-5 text-purple-700" />
                    Advanced grading
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Define active grading methodologies, passing cutoffs, and evaluation rubrics.
                  </p>
                </div>

                {/* Grading Method Selector (Image 3 dropdown) */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                    Change active grading method to:
                  </span>
                  <Select
                    value={gradingMethod}
                    onValueChange={(v: "simple" | "rubric" | "guide") => setGradingMethod(v)}
                  >
                    <SelectTrigger className="w-[200px] h-9 text-xs bg-background border-purple-300 font-semibold text-purple-900 dark:text-purple-200">
                      <SelectValue placeholder="Select grading method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="simple">Simple direct grading</SelectItem>
                      <SelectItem value="rubric">Rubric</SelectItem>
                      <SelectItem value="guide">Marking guide</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* ── Method 1: Simple Direct Grading ── */}
              {gradingMethod === "simple" && (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 text-xs space-y-2">
                    <span className="font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5 text-sm">
                      <CheckCircle className="w-4 h-4 text-purple-600" />
                      Simple Direct Grading is Active
                    </span>
                    <p className="text-muted-foreground leading-relaxed">
                      Tutors directly assign a numeric score between 0 and {maxGrade} along with qualitative written feedback for each student submission.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-foreground block">
                        Maximum Grade Points
                      </label>
                      <Input
                        type="number"
                        min="1"
                        max="1000"
                        value={maxGrade}
                        onChange={(e) => setMaxGrade(e.target.value)}
                        className="text-xs border-purple-200 h-9"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-foreground block">
                        Passing Grade Cutoff (%)
                      </label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={passingGrade}
                        onChange={(e) => setPassingGrade(e.target.value)}
                        className="text-xs border-purple-200 h-9"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-lg border border-purple-100 max-w-xl">
                    <div className="space-y-0.5">
                      <span className="text-xs font-semibold text-foreground block">Auto-notify student upon grading</span>
                      <span className="text-[11px] text-muted-foreground">Sends an in-app chime notification whenever a grade is posted</span>
                    </div>
                    <Switch checked={autoNotify} onCheckedChange={setAutoNotify} />
                  </div>
                </div>
              )}

              {/* ── Method 2: Rubric Builder ── */}
              {gradingMethod === "rubric" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-foreground">Rubric Evaluation Criteria</h4>
                      <p className="text-xs text-muted-foreground">
                        Define weighted assessment criteria with max points for each dimension.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleAddCriterion}
                      className="bg-purple-700 hover:bg-purple-800 text-white text-xs gap-1.5 h-8 font-semibold"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Criterion
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {rubricCriteria.map((c, idx) => (
                      <div
                        key={c.id}
                        className="p-4 rounded-lg border border-purple-200 dark:border-purple-900 bg-card space-y-3 shadow-xs"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-bold text-purple-900 dark:text-purple-300">
                            Criterion #{idx + 1}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground">Max Points:</span>
                            <Input
                              type="number"
                              min="1"
                              max="100"
                              value={c.maxPoints}
                              onChange={(e) => handleUpdateCriterion(c.id, "maxPoints", parseInt(e.target.value, 10) || 0)}
                              className="w-16 h-8 text-xs font-bold text-center border-purple-200"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteCriterion(c.id)}
                              className="text-red-500 hover:bg-red-50 h-8 w-8 p-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>

                        <Input
                          value={c.name}
                          onChange={(e) => handleUpdateCriterion(c.id, "name", e.target.value)}
                          placeholder="Criterion Name (e.g. Code Correctness)"
                          className="text-xs font-semibold border-purple-200"
                        />

                        <Textarea
                          value={c.description}
                          onChange={(e) => handleUpdateCriterion(c.id, "description", e.target.value)}
                          placeholder="Criterion description / performance expectations..."
                          rows={2}
                          className="text-xs border-purple-200"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Method 3: Marking Guide ── */}
              {gradingMethod === "guide" && (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 text-xs space-y-2">
                    <span className="font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5 text-sm">
                      <Award className="w-4 h-4 text-purple-600" />
                      Marking Guide Configuration
                    </span>
                    <p className="text-muted-foreground leading-relaxed">
                      A marking guide provides descriptive benchmarks and recommended grade allocations for each learning outcome.
                    </p>
                  </div>

                  <div className="space-y-3 max-w-xl">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-foreground block">
                        General Marker Guidance & Instructions
                      </label>
                      <Textarea
                        placeholder="Instructions for tutors reviewing this lesson's submissions..."
                        rows={3}
                        className="text-xs border-purple-200"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Save Button */}
              <div className="pt-4 border-t border-purple-100 flex items-center gap-3">
                <Button
                  onClick={handleSaveGradingConfig}
                  disabled={savingGradingConfig}
                  className="bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold gap-2 px-6 h-10 shadow-xs"
                >
                  {savingGradingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Advanced Grading Configuration
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ── 3. Bottom Lesson Navigation Bar (Image 1) ───────────────────────────── */}
        <div className="space-y-3 pt-2">
          {/* Checkbox: Download submissions in folders */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
            <Checkbox
              id="download-folders-cb"
              checked={downloadInFolders}
              onCheckedChange={(checked) => setDownloadInFolders(!!checked)}
              className="border-purple-300 data-[state=checked]:bg-purple-700 data-[state=checked]:border-purple-700"
            />
            <label
              htmlFor="download-folders-cb"
              className="cursor-pointer font-medium text-foreground select-none flex items-center gap-1.5"
            >
              <span>Download submissions in folders</span>
              <span
                title="When checked, submissions will be grouped into folders named after each student when downloading."
                className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-muted/60 text-muted-foreground hover:text-foreground text-[10px] font-bold"
              >
                ⓘ
              </span>
            </label>
          </div>

          {/* Navigation Bar matching Image 1: Dark Slate/Grey Bar */}
          <div className="bg-[#2d323e] dark:bg-slate-900 text-white rounded-lg p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md border border-slate-700/60">
            {/* Left: Previous Lesson Button */}
            <div className="w-full sm:w-1/3 flex justify-start">
              {prevLesson ? (
                <Button
                  variant="ghost"
                  onClick={() => navigate(`/courses/${courseId}/lessons/${prevLesson.id}/grading`)}
                  className="text-slate-200 hover:text-white hover:bg-white/10 text-xs font-semibold gap-1.5 justify-start truncate h-9 px-3 max-w-full"
                  title={`Go to previous lesson: ${prevLesson.title}`}
                >
                  <ChevronLeft className="w-4 h-4 shrink-0 text-slate-400" />
                  <span className="truncate">← {prevLesson.title}</span>
                </Button>
              ) : (
                <div />
              )}
            </div>

            {/* Center: Jump to... Dropdown */}
            <div className="w-full sm:w-auto min-w-[220px] max-w-xs flex justify-center">
              <Select
                value={lessonId}
                onValueChange={(targetId) => {
                  if (targetId && targetId !== lessonId) {
                    navigate(`/courses/${courseId}/lessons/${targetId}/grading`);
                  }
                }}
              >
                <SelectTrigger className="bg-[#1e222b] border-slate-600 text-slate-200 text-xs h-9 font-medium">
                  <SelectValue placeholder="Jump to..." />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {allLessons.map((l, idx) => (
                    <SelectItem key={l.id} value={l.id} className="text-xs">
                      {idx + 1}. {l.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Right: Next Lesson Button */}
            <div className="w-full sm:w-1/3 flex justify-end">
              {nextLesson ? (
                <Button
                  variant="ghost"
                  onClick={() => navigate(`/courses/${courseId}/lessons/${nextLesson.id}/grading`)}
                  className="text-slate-200 hover:text-white hover:bg-white/10 text-xs font-semibold gap-1.5 justify-end truncate h-9 px-3 max-w-full"
                  title={`Go to next lesson: ${nextLesson.title}`}
                >
                  <span className="truncate">{nextLesson.title}</span>
                  <span className="text-slate-400">▶</span>
                </Button>
              ) : (
                <div />
              )}
            </div>
          </div>
        </div>

        {/* ── 4. Full "View Submission" Modal ────────────────────────────────────── */}
        <Dialog open={!!viewSubmission} onOpenChange={(open) => !open && setViewSubmission(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden border-purple-200">
            <DialogHeader className="p-5 border-b bg-gradient-to-r from-purple-900 via-indigo-950 to-purple-900 text-white">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <DialogTitle className="text-lg font-bold flex items-center gap-2 text-white">
                    <Eye className="w-5 h-5 text-purple-200" />
                    Submission Details: {viewSubmission?.student?.name || "Submission"}
                  </DialogTitle>
                  <DialogDescription className="text-xs mt-1 text-purple-200">
                    {lesson?.title || "Lesson"} · Submitted on{" "}
                    {viewSubmission?.submitted_at
                      ? new Date(viewSubmission.submitted_at).toLocaleString()
                      : "recently"}
                  </DialogDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    asChild
                    className="h-7 text-xs px-2.5 gap-1.5 bg-white/10 hover:bg-white/20 text-white border-purple-300/40"
                    title="Open direct live chat with this student"
                  >
                    <Link to={`/chat?user=${viewSubmission?.student?.auth_user_id || viewSubmission?.student?.id || viewSubmission?.student_id}`}>
                      <MessageSquare className="w-3.5 h-3.5 text-purple-200" />
                      Chat with Student
                    </Link>
                  </Button>
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
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Submission Title and Student Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 p-4 rounded-lg text-xs">
                <div>
                  <span className="text-muted-foreground block font-medium">Student Name:</span>
                  <span className="font-bold text-sm text-foreground">
                    {viewSubmission?.student?.name || <span className="italic text-muted-foreground">—</span>}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block font-medium">Student Contact:</span>
                  <span className="font-semibold text-foreground">
                    {viewSubmission?.student?.email || "—"}
                    {viewSubmission?.student?.phone ? ` · Tel: ${viewSubmission.student.phone}` : ""}
                  </span>
                </div>
                <div className="col-span-full">
                  <span className="text-muted-foreground block font-medium">Project Title:</span>
                  <span className="font-bold text-foreground">
                    {viewSubmission?.title || "Activity Project"}
                  </span>
                </div>
                {viewSubmission?.description && (
                  <div className="col-span-full">
                    <span className="text-muted-foreground block font-medium">Student Description / Notes:</span>
                    <p className="mt-0.5 text-foreground leading-relaxed">
                      {viewSubmission.description}
                    </p>
                  </div>
                )}
              </div>

              {/* External Link Block */}
              {viewSubmission?.link && (
                <div className="p-4 border border-purple-200 bg-purple-50/50 dark:bg-purple-950/20 rounded-lg flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-semibold text-purple-900 dark:text-purple-200 block">
                      External Project Link
                    </span>
                    <a
                      href={viewSubmission.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-purple-700 dark:text-purple-300 underline font-mono break-all font-semibold"
                    >
                      {viewSubmission.link}
                    </a>
                  </div>
                  <Button size="sm" asChild className="gap-1.5 shrink-0 bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold">
                    <a href={viewSubmission.link} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open Project ↗
                    </a>
                  </Button>
                </div>
              )}

              {/* Uploaded File Block */}
              {viewSubmission?.file_path && (
                <div className="p-4 border border-indigo-200 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-lg flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-semibold text-indigo-900 dark:text-indigo-200 block">
                      Uploaded File Submission
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {viewSubmission.file_path}
                    </span>
                  </div>
                  <Button size="sm" asChild variant="outline" className="gap-1.5 shrink-0 text-xs border-indigo-300 text-indigo-700">
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
                <div className="border border-purple-200 rounded-lg overflow-hidden space-y-0">
                  <div className="bg-purple-50 dark:bg-purple-950/50 px-4 py-2 flex items-center justify-between border-b border-purple-200">
                    <div className="flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-purple-700 dark:text-purple-300" />
                      <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                        Submitted Code ({viewSubmission.editor_type || "code"})
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant={codeTab === "code" ? "default" : "ghost"}
                        onClick={() => setCodeTab("code")}
                        className={`h-7 text-xs px-2.5 ${codeTab === "code" ? "bg-purple-700 text-white" : ""}`}
                      >
                        Code
                      </Button>
                      <Button
                        size="sm"
                        variant={codeTab === "preview" ? "default" : "ghost"}
                        onClick={() => setCodeTab("preview")}
                        className={`h-7 text-xs px-2.5 ${codeTab === "preview" ? "bg-purple-700 text-white" : ""}`}
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
              <div className="p-4 border rounded-lg bg-purple-50/50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    Grade This Submission
                  </h4>
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[11px] font-semibold text-muted-foreground mr-1">Quick Presets:</span>
                    {QUICK_GRADE_PRESETS.map((preset) => (
                      <Button
                        key={preset.grade}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => viewSubmission && handleApplyQuickGrade(viewSubmission.id, preset)}
                        className="h-6 px-2 text-[10px] font-medium border-purple-200 hover:border-purple-400 hover:bg-purple-100 dark:border-purple-700 dark:hover:bg-purple-900"
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                </div>
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
                        setDraft(viewSubmission.id, { grade: e.target.value });
                      }}
                      className="h-9 text-sm font-bold bg-background border-purple-200"
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
                        setDraft(viewSubmission.id, { feedback: e.target.value });
                      }}
                      placeholder="Great work on this activity! Keep it up..."
                      className="h-9 text-xs bg-background border-purple-200"
                    />
                  </div>
                  <div className="self-end flex items-center gap-2">
                    <Button
                      onClick={() => viewSubmission && handleSaveGrade(viewSubmission.id)}
                      disabled={savingGradeId === viewSubmission?.id}
                      className="h-9 px-4 text-xs font-semibold bg-purple-700 hover:bg-purple-800 text-white"
                    >
                      {savingGradeId === viewSubmission?.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Save Grade"
                      )}
                    </Button>
                    {(viewSubmission?.grade !== null || viewSubmission?.review_status === "graded") && (
                      <Button
                        variant="outline"
                        onClick={() => viewSubmission && handleUngrade(viewSubmission.id)}
                        disabled={savingGradeId === viewSubmission?.id}
                        className="h-9 px-4 text-xs font-semibold border-purple-300 text-purple-700 dark:text-purple-300 hover:bg-purple-50"
                      >
                        Ungrade
                      </Button>
                    )}
                  </div>
                </div>
                {viewSubmission && parseInt(gradingValues[viewSubmission.id]?.grade || "0", 10) >= 70 && (
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium pt-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    Passing grade (≥70%) awards student a +150 XP bonus!
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Student Detail Drill-down */}
        {detailStudent && (
          <StudentDetailDialog
            studentId={detailStudent.auth_user_id || detailStudent.id}
            studentName={detailStudent.name || detailStudent.email || "Student"}
            open={!!detailStudent}
            onOpenChange={(open) => !open && setDetailStudent(null)}
          />
        )}
      </div>
    </LMSLayout>
  );
}
