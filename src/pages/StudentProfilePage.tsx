import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { LMSLayout } from "@/components/LMSLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  User,
  BookOpen,
  Trophy,
  FileText,
  Clock,
  Activity,
  Mail,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Shield,
  ArrowLeft,
  GraduationCap,
  Sparkles,
  Lock,
  Globe,
  Tag,
  Eye,
  Sliders,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface UserProfileData {
  id: string;
  auth_user_id: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  email: string;
  role: string;
  avatar_url?: string;
  created_at?: string;
  phone?: string;
  city?: string;
  country?: string;
  parent_email?: string;
  last_login?: string;
  last_access?: string;
  subscription_type?: string | null;
  age?: number | null;
  suspended?: boolean;
}

interface EnrolledCourse {
  course_id: string;
  course_title: string;
  category?: string;
  progress_percentage: number;
  enrolled_at?: string;
  status?: string;
}

interface ProjectItem {
  id: string;
  title: string;
  course_title?: string;
  grade?: number | null;
  review_status?: string | null;
  submitted_at?: string | null;
  feedback?: string | null;
  editor_type?: string | null;
}

interface StudentReport {
  id: string;
  title: string;
  status: string;
  grade?: number | null;
  created_at: string;
  course_title?: string;
  content?: string;
}

interface SessionReportItem {
  id: string;
  attendance_status: string;
  topics_covered: string;
  student_performance?: number | null;
  submitted_at: string;
  tutor_name?: string;
  course_title?: string;
  notes_for_parents?: string;
}

interface AuditLogEntry {
  id: string;
  action_type: string;
  created_at: string;
  details?: any;
  status?: string;
}

export default function StudentProfilePage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { userProfile: currentUser } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState<boolean>(true);
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [enrolledCourses, setEnrolledCourses] = useState<EnrolledCourse[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [reports, setReports] = useState<StudentReport[]>([]);
  const [sessionReports, setSessionReports] = useState<SessionReportItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [todayActivityCount, setTodayActivityCount] = useState<number>(0);

  // Admin Controls State
  const [updatingSubscription, setUpdatingSubscription] = useState<boolean>(false);
  const [selectedSubscription, setSelectedSubscription] = useState<string>("Other");
  const [ageInput, setAgeInput] = useState<string>("");

  const isAdmin = currentUser?.role === "admin";
  const isUltimateTutor = currentUser?.role === "ultimate_tutor";
  const isTutor = currentUser?.role === "tutor";

  useEffect(() => {
    if (studentId) {
      loadStudentData();
    }
  }, [studentId]);

  const loadStudentData = async () => {
    setLoading(true);
    try {
      // 1. Fetch user by id or auth_user_id
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("*")
        .or(`id.eq.${studentId},auth_user_id.eq.${studentId}`)
        .maybeSingle();

      if (userError) throw userError;

      if (!userData) {
        toast({
          title: "Student Not Found",
          description: "Could not locate a student profile with this ID.",
          variant: "destructive",
        });
        navigate(-1);
        return;
      }

      setProfile(userData as any);
      setSelectedSubscription(userData.subscription_type || "Other");
      setAgeInput(userData.age ? String(userData.age) : "");

      const dbUserId = userData.id;
      const authUserId = userData.auth_user_id;

      const currentIds = [currentUser?.id, currentUser?.auth_user_id].filter(Boolean);
      if (currentUser?.role === "student" && !currentIds.includes(dbUserId) && !currentIds.includes(authUserId)) {
        setLoading(false);
        navigate("/unauthorized");
        return;
      }

      if (currentUser?.role === "tutor" || currentUser?.role === "ultimate_tutor") {
        const { data: targetEnrollments } = await supabase
          .from("enrollments")
          .select("course_id")
          .in("student_id", [dbUserId, authUserId].filter(Boolean));
        const courseIds = (targetEnrollments || []).map((row) => row.course_id).filter(Boolean);
        if (courseIds.length === 0) {
          setLoading(false);
          navigate("/unauthorized");
          return;
        }

        const { data: assignments } = await supabase
          .from("course_tutors")
          .select("course_id")
          .in("course_id", courseIds)
          .eq("tutor_id", currentUser.auth_user_id);
        const { data: qualifications } = await supabase
          .from("tutor_qualifications")
          .select("course_id")
          .in("course_id", courseIds)
          .eq("tutor_id", currentUser.id);
        if (!(assignments?.length || qualifications?.length)) {
          setLoading(false);
          navigate("/unauthorized");
          return;
        }
      }

      // 2. Fetch Enrolled Courses & Progress
      const { data: enrollmentsData } = await supabase
        .from("enrollments")
        .select(`
          course_id,
          enrolled_at,
          courses (
            id,
            title,
            category
          )
        `)
        .or(`student_id.eq.${dbUserId},student_id.eq.${authUserId}`);

      const coursesWithProgress: EnrolledCourse[] = [];
      if (enrollmentsData && enrollmentsData.length > 0) {
        for (const enroll of enrollmentsData) {
          const course = (enroll as any).courses;
          if (!course) continue;

          // Count lessons vs completed lessons
          const [{ count: totalLessons }, { count: completedLessons }] = await Promise.all([
            supabase
              .from("lessons")
              .select("*", { count: "exact", head: true })
              .eq("course_id", course.id),
            supabase
              .from("lesson_progress")
              .select("*", { count: "exact", head: true })
              .eq("completed", true)
              .or(`student_id.eq.${dbUserId},student_id.eq.${authUserId}`)
              .in(
                "lesson_id",
                (
                  await supabase
                    .from("lessons")
                    .select("id")
                    .eq("course_id", course.id)
                ).data?.map((l) => l.id) || []
              ),
          ]);

          const total = totalLessons || 0;
          const completed = completedLessons || 0;
          const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

          coursesWithProgress.push({
            course_id: course.id,
            course_title: course.title,
            category: course.category,
            progress_percentage: progress,
            enrolled_at: enroll.enrolled_at,
            status: progress === 100 ? "Completed" : progress > 0 ? "In Progress" : "Enrolled",
          });
        }
      }
      setEnrolledCourses(coursesWithProgress);

      // 3. Fetch Projects Submissions
      const { data: projectsData } = await supabase
        .from("projects")
        .select(`
          id,
          title,
          grade,
          review_status,
          submitted_at,
          feedback,
          editor_type,
          courses (title)
        `)
        .or(`student_id.eq.${dbUserId},student_id.eq.${authUserId}`)
        .order("submitted_at", { ascending: false });

      setProjects(
        (projectsData || []).map((p: any) => ({
          id: p.id,
          title: p.title || "Project",
          course_title: p.courses?.title,
          grade: p.grade,
          review_status: p.review_status,
          submitted_at: p.submitted_at,
          feedback: p.feedback,
          editor_type: p.editor_type,
        }))
      );

      // 4. Fetch Student Reports
      const { data: reportsData } = await supabase
        .from("reports")
        .select(`
          id,
          title,
          status,
          grade,
          created_at,
          content,
          courses (title)
        `)
        .or(`student_id.eq.${dbUserId},student_id.eq.${authUserId}`)
        .order("created_at", { ascending: false });

      setReports(
        (reportsData || []).map((r: any) => ({
          id: r.id,
          title: r.title,
          status: r.status,
          grade: r.grade,
          created_at: r.created_at,
          course_title: r.courses?.title,
          content: r.content,
        }))
      );

      // 5. Fetch Session Reports
      const { data: sessReportsData } = await supabase
        .from("session_reports")
        .select(`
          id,
          attendance_status,
          topics_covered,
          student_performance,
          submitted_at,
          notes_for_parents,
          tutor:users!session_reports_tutor_id_fkey(name),
          course:courses!session_reports_course_id_fkey(title)
        `)
        .or(`student_id.eq.${dbUserId},student_id.eq.${authUserId}`)
        .order("submitted_at", { ascending: false });

      setSessionReports(
        (sessReportsData || []).map((sr: any) => ({
          id: sr.id,
          attendance_status: sr.attendance_status,
          topics_covered: sr.topics_covered,
          student_performance: sr.student_performance,
          submitted_at: sr.submitted_at,
          tutor_name: sr.tutor?.name || "Tutor",
          course_title: sr.course?.title || "Class Session",
          notes_for_parents: sr.notes_for_parents,
        }))
      );

      // 6. Fetch Audit Logs & Activity
      const { data: logsData } = await supabase
        .from("audit_logs")
        .select("id, action_type, created_at, details, status")
        .or(`performed_by.eq.${dbUserId},performed_by.eq.${authUserId},target_id.eq.${dbUserId},target_id.eq.${authUserId}`)
        .order("created_at", { ascending: false })
        .limit(50);

      const logs = (logsData || []) as AuditLogEntry[];
      setAuditLogs(logs);

      // Calculate today's activity count
      const today = new Date().toDateString();
      const todayLogs = logs.filter((l) => new Date(l.created_at).toDateString() === today);
      setTodayActivityCount(todayLogs.length);
    } catch (err: any) {
      console.error("Error loading student profile:", err);
      toast({
        title: "Error Loading Profile",
        description: err.message || "Failed to retrieve student profile.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSubscriptionAndAge = async () => {
    if (!profile || !isAdmin) return;

    setUpdatingSubscription(true);
    try {
      const parsedAge = ageInput ? parseInt(ageInput, 10) : null;
      if (parsedAge !== null && (isNaN(parsedAge) || parsedAge < 3 || parsedAge > 120)) {
        toast({
          title: "Invalid Age",
          description: "Please enter a realistic age.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from("users")
        .update({
          subscription_type: selectedSubscription,
          age: parsedAge,
        })
        .eq("id", profile.id);

      if (error) throw error;

      toast({
        title: "Student Details Updated",
        description: `Subscription updated to "${selectedSubscription}" and age set to ${parsedAge || "unspecified"}.`,
      });

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              subscription_type: selectedSubscription,
              age: parsedAge,
            }
          : null
      );
    } catch (err: any) {
      console.error("Error updating student:", err);
      toast({
        title: "Update Failed",
        description: err.message || "Could not update student details.",
        variant: "destructive",
      });
    } finally {
      setUpdatingSubscription(false);
    }
  };

  if (loading) {
    return (
      <LMSLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center space-y-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto" />
            <p className="text-muted-foreground text-sm">Loading student profile...</p>
          </div>
        </div>
      </LMSLayout>
    );
  }

  if (!profile) return null;

  const displayName = profile.name || `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || profile.email;
  const subscriptionLabel =
    profile.subscription_type === "PT"
      ? "PT - Personal Tutoring (1-on-1)"
      : profile.subscription_type === "VG"
      ? "VG - Virtual Group Class"
      : profile.subscription_type === "PC"
      ? "PC - Physical Class"
      : profile.subscription_type || "Other";

  return (
    <LMSLayout>
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        {/* Top Back Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              Role: <strong className="uppercase">{profile.role}</strong>
            </Badge>
            {profile.suspended && (
              <Badge variant="destructive">Suspended</Badge>
            )}
          </div>
        </div>

        {/* Student Profile Hero Card */}
        <Card className="border-t-4 border-t-primary shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20 border-2 border-primary/20">
                  <AvatarImage src={profile.avatar_url || undefined} alt={displayName} />
                  <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
                    {displayName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">{displayName}</h1>
                    <Badge variant="secondary" className="font-semibold bg-primary/10 text-primary border border-primary/20">
                      {subscriptionLabel}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" />
                      {profile.email}
                    </span>
                    {profile.age && (
                      <span className="flex items-center gap-1 font-medium text-foreground">
                        🎂 Age: {profile.age} yrs
                      </span>
                    )}
                    {profile.country && (
                      <span className="flex items-center gap-1">
                        <Globe className="w-3.5 h-3.5" />
                        {profile.city ? `${profile.city}, ` : ""}{profile.country}
                      </span>
                    )}
                    {profile.parent_email && (
                      <span className="flex items-center gap-1">
                        👨‍👩‍👧 Parent: {profile.parent_email}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Stats Block */}
              <div className="grid grid-cols-3 gap-3 text-center w-full md:w-auto">
                <div className="p-3 bg-muted/40 rounded-lg border">
                  <div className="text-xl font-bold text-foreground">{enrolledCourses.length}</div>
                  <div className="text-[11px] text-muted-foreground uppercase">Courses</div>
                </div>
                <div className="p-3 bg-muted/40 rounded-lg border">
                  <div className="text-xl font-bold text-emerald-600">{projects.length}</div>
                  <div className="text-[11px] text-muted-foreground uppercase">Projects</div>
                </div>
                <div className="p-3 bg-muted/40 rounded-lg border">
                  <div className="text-xl font-bold text-primary">{todayActivityCount}</div>
                  <div className="text-[11px] text-muted-foreground uppercase">Today Logs</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabbed Detailed Information */}
        <Tabs defaultValue="courses" className="space-y-4">
          <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full">
            <TabsTrigger value="courses" className="gap-1.5 text-xs">
              <BookOpen className="w-4 h-4" />
              Courses ({enrolledCourses.length})
            </TabsTrigger>
            <TabsTrigger value="submissions" className="gap-1.5 text-xs">
              <Code2 className="w-4 h-4" />
              Submissions ({projects.length})
            </TabsTrigger>
            <TabsTrigger value="session_reports" className="gap-1.5 text-xs">
              <FileText className="w-4 h-4" />
              Class Reports ({sessionReports.length})
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-1.5 text-xs">
              <Activity className="w-4 h-4" />
              Activity Log
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="admin" className="gap-1.5 text-xs text-destructive">
                <Shield className="w-4 h-4" />
                Admin Security
              </TabsTrigger>
            )}
          </TabsList>

          {/* TAB 1: Enrolled Courses */}
          <TabsContent value="courses">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                  Learning Journey & Enrolled Courses
                </CardTitle>
                <CardDescription>
                  Curriculum progress and course completion tracking
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {enrolledCourses.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    This student is not yet enrolled in any courses.
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {enrolledCourses.map((c) => (
                      <div
                        key={c.course_id}
                        className="p-4 border rounded-lg hover:bg-muted/20 transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-base">{c.course_title}</h4>
                            {c.category && (
                              <Badge variant="secondary" className="text-xs">
                                {c.category}
                              </Badge>
                            )}
                            <Badge
                              variant={c.progress_percentage === 100 ? "default" : "outline"}
                              className={
                                c.progress_percentage === 100 ? "bg-emerald-600 text-white" : ""
                              }
                            >
                              {c.status}
                            </Badge>
                          </div>
                          <div className="space-y-1 pt-2 max-w-md">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Course Progress</span>
                              <span>{c.progress_percentage}%</span>
                            </div>
                            <Progress value={c.progress_percentage} className="h-2" />
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/courses/${c.course_id}`)}
                          className="gap-1"
                        >
                          View Course
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: Submissions (With Uniform 'View Submission' Button) */}
          <TabsContent value="submissions">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Code2 className="w-5 h-5 text-primary" />
                  Project Submissions & Grades
                </CardTitle>
                <CardDescription>
                  Review submitted code deliverables, grades, and tutor feedback
                </CardDescription>
              </CardHeader>
              <CardContent>
                {projects.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    No project submissions recorded for this student yet.
                  </div>
                ) : (
                  <div className="divide-y border rounded-lg overflow-hidden">
                    {projects.map((p) => (
                      <div
                        key={p.id}
                        className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-muted/10 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-sm">{p.title}</h4>
                            {p.grade !== null && p.grade !== undefined ? (
                              <Badge variant="default" className="bg-emerald-600 text-white text-xs">
                                Grade: {p.grade}/100
                              </Badge>
                            ) : p.review_status === "resubmission_requested" ? (
                              <Badge variant="outline" className="text-amber-600 border-amber-500 bg-amber-50 text-xs">
                                Revision Requested
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                Pending Review
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Course: {p.course_title || "General STEM Course"} • Submitted:{" "}
                            {p.submitted_at
                              ? new Date(p.submitted_at).toLocaleDateString()
                              : "Recently"}
                          </p>
                          {p.feedback && (
                            <p className="text-xs text-muted-foreground italic line-clamp-1 pt-0.5">
                              Feedback: "{p.feedback}"
                            </p>
                          )}
                        </div>

                        {/* Uniform View Submission Button */}
                        <Button
                          size="sm"
                          onClick={() => navigate(`/dashboard/submissions/${p.id}`)}
                          className="gap-1.5 shrink-0"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View Submission
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: Class & Session Reports */}
          <TabsContent value="session_reports">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Live Class & Session Reports
                </CardTitle>
                <CardDescription>
                  Official attendance, covered topics, and parent feedback recorded by tutors
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {sessionReports.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    No session reports submitted for this student yet.
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {sessionReports.map((sr) => (
                      <div key={sr.id} className="p-4 border rounded-lg bg-card space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{sr.course_title}</span>
                            <Badge
                              variant={
                                sr.attendance_status === "attended"
                                  ? "default"
                                  : sr.attendance_status === "late"
                                  ? "secondary"
                                  : "destructive"
                              }
                              className="text-[11px] capitalize"
                            >
                              {sr.attendance_status}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(sr.submitted_at).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        </div>

                        <div className="text-xs text-muted-foreground">
                          Tutor: <strong>{sr.tutor_name}</strong>
                          {sr.student_performance && (
                            <span className="ml-3 font-medium text-amber-500">
                              ★ Performance: {sr.student_performance}/5
                            </span>
                          )}
                        </div>

                        <div className="p-2.5 bg-muted/40 rounded text-xs leading-relaxed">
                          <strong className="block text-foreground mb-0.5">Topics Covered:</strong>
                          {sr.topics_covered}
                        </div>

                        {sr.notes_for_parents && (
                          <div className="p-2.5 bg-primary/5 border border-primary/20 rounded text-xs leading-relaxed text-foreground">
                            <strong className="block text-primary mb-0.5">Notes for Parents:</strong>
                            {sr.notes_for_parents}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 4: Activity Log */}
          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  Student Activity & Audit Logs
                </CardTitle>
                <CardDescription>
                  Full audit timeline of logins, submissions, and key actions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 mb-4 p-3 bg-muted/30 rounded-lg text-xs grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div>
                    <span className="text-muted-foreground block">First Created</span>
                    <strong className="text-foreground">
                      {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : "N/A"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Last Login</span>
                    <strong className="text-foreground">
                      {profile.last_login ? new Date(profile.last_login).toLocaleString() : "Never"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Last Platform Access</span>
                    <strong className="text-foreground">
                      {profile.last_access ? new Date(profile.last_access).toLocaleString() : "N/A"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Today's Log Events</span>
                    <strong className="text-primary font-bold">{todayActivityCount}</strong>
                  </div>
                </div>

                {auditLogs.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    No activity logs recorded yet.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                    {auditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-2.5 border rounded flex items-center justify-between text-xs hover:bg-muted/20"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {log.action_type}
                          </Badge>
                          <span className="text-muted-foreground">
                            {log.details ? JSON.stringify(log.details).slice(0, 70) : "Action logged"}
                          </span>
                        </div>
                        <span className="text-muted-foreground text-[11px] shrink-0">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 5: Admin Security & Account Controls (Admin Only) */}
          {isAdmin && (
            <TabsContent value="admin">
              <Card className="border-destructive/30">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-destructive">
                    <Shield className="w-5 h-5" />
                    Admin Security & Account Controls
                  </CardTitle>
                  <CardDescription>
                    Administrative parameters, subscription adjustments, and disciplinary actions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Subscription and Age Editor */}
                  <div className="p-4 bg-muted/40 rounded-lg border space-y-4">
                    <h4 className="font-semibold text-sm">Modify Student Parameters</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">
                          Subscription Type
                        </label>
                        <select
                          value={selectedSubscription}
                          onChange={(e) => setSelectedSubscription(e.target.value)}
                          className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                        >
                          <option value="PT">PT - Personal Tutoring (1-on-1)</option>
                          <option value="VG">VG - Virtual Group Class</option>
                          <option value="PC">PC - Physical Class</option>
                          <option value="Other">Other / Self-Paced</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">Student Age</label>
                        <input
                          type="number"
                          value={ageInput}
                          onChange={(e) => setAgeInput(e.target.value)}
                          placeholder="e.g. 11"
                          className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                        />
                      </div>
                    </div>

                    <Button
                      size="sm"
                      onClick={handleUpdateSubscriptionAndAge}
                      disabled={updatingSubscription}
                      className="gap-1.5"
                    >
                      {updatingSubscription ? "Saving..." : "Save Parameters"}
                    </Button>
                  </div>

                  {/* Disciplinary & Access Status */}
                  <div className="p-4 border rounded-lg flex items-center justify-between text-sm">
                    <div>
                      <strong className="block text-foreground">Account Status</strong>
                      <p className="text-xs text-muted-foreground">
                        {profile.suspended ? "This account is currently suspended." : "Account is active."}
                      </p>
                    </div>
                    <Badge variant={profile.suspended ? "destructive" : "secondary"}>
                      {profile.suspended ? "Suspended" : "Active"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </LMSLayout>
  );
}
