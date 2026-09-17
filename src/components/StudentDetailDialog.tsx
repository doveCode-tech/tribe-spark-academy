import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  User,
  BookOpen,
  Trophy,
  FileText,
  Clock,
  GraduationCap,
  Activity,
  Mail,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Shield,
  FileSpreadsheet
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fetchDirectoryUser } from "@/utils/studentDirectory";

interface StudentDetailDialogProps {
  studentId: string; // users.id or users.auth_user_id
  studentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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
}

interface EnrolledCourse {
  course_id: string;
  course_title: string;
  category?: string;
  progress_percentage: number;
  enrolled_at?: string;
  status?: string;
}

interface ProjectGrade {
  id: string;
  title: string;
  course_title?: string;
  grade?: number;
  review_status?: string;
  submitted_at?: string;
  feedback?: string;
  editor_type?: string;
}

interface StudentReport {
  id: string;
  title: string;
  status: string;
  grade?: number;
  created_at: string;
  course_title?: string;
  content?: string;
}

interface AuditLogEntry {
  id: string;
  action_type: string;
  created_at: string;
  details?: any;
  status?: string;
}

export function StudentDetailDialog({
  studentId,
  studentName,
  open,
  onOpenChange,
}: StudentDetailDialogProps) {
  const { userProfile: currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [courses, setCourses] = useState<EnrolledCourse[]>([]);
  const [grades, setGrades] = useState<ProjectGrade[]>([]);
  const [reports, setReports] = useState<StudentReport[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [firstLogAt, setFirstLogAt] = useState<string | null>(null);
  const [reportFilter, setReportFilter] = useState<"all" | "today" | "outline" | "complete">("all");

  useEffect(() => {
    if (open && studentId) {
      loadStudentData();
    }
  }, [open, studentId]);

  const loadStudentData = async () => {
    setLoading(true);
    try {
      // 1. Resolve the person behind the identifier (users.id or auth_user_id)
      const directoryUser = await fetchDirectoryUser(studentId);

      const { data: userData } = await supabase
        .from("users")
        .select("*")
        .eq("id", directoryUser?.id || studentId)
        .maybeSingle();

      const resolved = (userData ?? directoryUser ?? null) as UserProfileData | null;
      setProfile(resolved);

      // Records may reference either identifier, so query against both
      const identifiers = Array.from(
        new Set([studentId, directoryUser?.id, directoryUser?.auth_user_id, resolved?.id, resolved?.auth_user_id].filter(Boolean))
      ) as string[];
      const idFilter = `(${identifiers.join(",")})`;

      // 2. Fetch Enrolled Courses & Progress
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select(`
          course_id,
          progress_percentage,
          enrolled_at,
          status,
          courses (
            id,
            title,
            category
          )
        `)
        .filter("student_id", "in", idFilter);

      if (enrollments) {
        const mappedCourses: EnrolledCourse[] = enrollments.map((e: any) => ({
          course_id: e.course_id,
          course_title: e.courses?.title || "Untitled Course",
          category: e.courses?.category || "General",
          progress_percentage: e.progress_percentage || 0,
          enrolled_at: e.enrolled_at,
          status: e.status,
        }));
        setCourses(mappedCourses);
      }

      // 3. Fetch Project submissions / Grades
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
          courses (
            title
          )
        `)
        .filter("student_id", "in", idFilter)
        .order("submitted_at", { ascending: false });

      if (projectsData) {
        const mappedGrades: ProjectGrade[] = projectsData.map((p: any) => ({
          id: p.id,
          title: p.title,
          course_title: p.courses?.title,
          grade: p.grade,
          review_status: p.review_status,
          submitted_at: p.submitted_at,
          feedback: p.feedback,
          editor_type: p.editor_type,
        }));
        setGrades(mappedGrades);
      }

      // 4. Fetch Reports
      const { data: reportsData } = await supabase
        .from("reports")
        .select(`
          id,
          title,
          status,
          grade,
          created_at,
          content,
          courses (
            title
          )
        `)
        .filter("student_id", "in", idFilter)
        .order("created_at", { ascending: false });

      if (reportsData) {
        const mappedReports: StudentReport[] = reportsData.map((r: any) => ({
          id: r.id,
          title: r.title,
          status: r.status,
          grade: r.grade,
          created_at: r.created_at,
          content: r.content,
          course_title: r.courses?.title,
        }));
        setReports(mappedReports);
      }

      // 5. Fetch Audit logs / Login activity
      const { data: logsData } = await supabase
        .from("audit_logs")
        .select("*")
        .filter("performed_by", "in", idFilter)
        .order("created_at", { ascending: false })
        .limit(200);

      if (logsData) {
        setAuditLogs(logsData);
      }

      // The bounded query above only covers recent history, so the very first
      // event is fetched separately
      const { data: firstLog } = await supabase
        .from("audit_logs")
        .select("created_at")
        .filter("performed_by", "in", idFilter)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      setFirstLogAt(firstLog?.created_at ?? null);
    } catch (err) {
      console.error("Error loading student data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Filtered reports — "today" follows the viewer's local calendar day
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  const isToday = (value?: string | null) => {
    if (!value) return false;
    const at = new Date(value);
    return at >= startOfToday && at < startOfTomorrow;
  };

  const filteredReports = reports.filter((r) => {
    if (reportFilter === "today") {
      return isToday(r.created_at);
    }
    if (reportFilter === "outline") {
      return r.title?.toLowerCase().includes("outline") || r.content?.toLowerCase().includes("outline");
    }
    if (reportFilter === "complete") {
      return r.status === "approved" || r.status === "submitted";
    }
    return true;
  });

  // Activity derivations
  const loginLogs = auditLogs.filter((l) => l.action_type === "login");
  const logoutLogs = auditLogs.filter((l) => l.action_type === "logout");

  const firstVisitCandidates = [firstLogAt, profile?.created_at].filter(Boolean) as string[];
  const firstVisit =
    firstVisitCandidates.length > 0
      ? firstVisitCandidates.reduce((earliest, candidate) => (candidate < earliest ? candidate : earliest))
      : null;

  const lastVisit = profile?.last_access || profile?.last_login || auditLogs[0]?.created_at || null;
  const lastLogin = profile?.last_login || loginLogs[0]?.created_at || null;
  const todaysLogs = auditLogs.filter((l) => isToday(l.created_at));

  // Most recent event that happened before the student last signed out
  const lastLogout = logoutLogs[0] || null;
  const lastActivityBeforeLogout = lastLogout
    ? auditLogs.find((l) => l.id !== lastLogout.id && l.created_at < lastLogout.created_at) || null
    : null;

  const formatDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString() : "No record yet");

  // Calculate average grade
  const validGrades = grades.filter((g) => typeof g.grade === "number" && !isNaN(g.grade));
  const avgGrade =
    validGrades.length > 0
      ? Math.round(validGrades.reduce((sum, g) => sum + (g.grade || 0), 0) / validGrades.length)
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-5 border-b bg-muted/20 shrink-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <Avatar className="w-12 h-12 border-2 border-primary/20">
                <AvatarImage src={profile?.avatar_url} />
                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                  {(profile?.name || studentName || "ST").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-xl font-bold text-foreground">
                    {profile?.name || studentName}
                  </DialogTitle>
                  <Badge variant="secondary" className="capitalize text-xs">
                    {profile?.role || "student"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{profile?.email || "No email provided"}</p>
              </div>
            </div>

            {/* Quick stats pill & Parent View */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                asChild
                className="h-8 text-xs gap-1.5 border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-300 font-semibold"
                title="Open public/shareable parent progress report"
              >
                <a href={`/parent/${studentId}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Parent Report Card
                </a>
              </Button>
              <div className="px-3 py-1.5 rounded-lg bg-card border text-center shadow-xs">
                <div className="text-xs text-muted-foreground">Courses</div>
                <div className="text-sm font-bold text-foreground">{courses.length}</div>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-card border text-center shadow-xs">
                <div className="text-xs text-muted-foreground">Avg Grade</div>
                <div className="text-sm font-bold text-emerald-600">
                  {avgGrade !== null ? `${avgGrade}%` : "—"}
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Tabbed Content Area */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3" />
              Loading student overview...
            </div>
          ) : (
            <Tabs defaultValue="profile" className="space-y-4">
              <TabsList className="grid grid-cols-6 w-full h-9 bg-muted/60">
                <TabsTrigger value="profile" className="text-xs gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  <span>Profile</span>
                </TabsTrigger>
                <TabsTrigger value="courses" className="text-xs gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Courses ({courses.length})</span>
                </TabsTrigger>
                <TabsTrigger value="grades" className="text-xs gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>Grades</span>
                </TabsTrigger>
                <TabsTrigger value="reports" className="text-xs gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Reports ({reports.length})</span>
                </TabsTrigger>
                <TabsTrigger value="certificates" className="text-xs gap-1.5">
                  <Trophy className="w-3.5 h-3.5" />
                  <span>Certs</span>
                </TabsTrigger>
                <TabsTrigger value="activity" className="text-xs gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  <span>Activity</span>
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: Profile & Miscellaneous */}
              <TabsContent value="profile" className="space-y-4 mt-3">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <User className="w-4 h-4 text-primary" />
                      Personal & Account Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1">
                      <span className="text-muted-foreground font-medium">Full Name</span>
                      <p className="font-semibold text-foreground text-sm">
                        {profile?.name || `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || studentName}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground font-medium">Email Address</span>
                      <p className="font-semibold text-foreground text-sm">{profile?.email || "—"}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground font-medium">Account Role</span>
                      <p className="font-semibold text-foreground capitalize">{profile?.role || "student"}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground font-medium">Date Enrolled / Joined</span>
                      <p className="font-semibold text-foreground">
                        {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "—"}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Contact & Guardian Information */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Shield className="w-4 h-4 text-blue-500" />
                      Contact & Guardian Info
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div className="space-y-1">
                      <span className="text-muted-foreground font-medium">Phone</span>
                      <p className="font-semibold text-foreground">{profile?.phone || "Not listed"}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground font-medium">Parent Email</span>
                      <p className="font-semibold text-foreground">{profile?.parent_email || "Not listed"}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground font-medium">Location</span>
                      <p className="font-semibold text-foreground">
                        {[profile?.city, profile?.country].filter(Boolean).join(", ") || "Not listed"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab 2: Courses */}
              <TabsContent value="courses" className="space-y-3 mt-3">
                {courses.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground border rounded-lg bg-card">
                    Student is not currently enrolled in any courses.
                  </div>
                ) : (
                  courses.map((c) => (
                    <div
                      key={c.course_id}
                      className="p-3.5 rounded-lg border bg-card flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-foreground truncate">{c.course_title}</span>
                          <Badge variant="outline" className="text-[10px]">{c.category}</Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          <Progress value={c.progress_percentage} className="h-2 w-48 sm:w-64" />
                          <span className="text-xs font-semibold text-primary">{c.progress_percentage}%</span>
                        </div>
                      </div>
                      <div className="text-right text-xs text-muted-foreground shrink-0">
                        <div>Enrolled: {c.enrolled_at ? new Date(c.enrolled_at).toLocaleDateString() : "Active"}</div>
                        <Badge className="mt-1 text-[10px] capitalize bg-emerald-500/10 text-emerald-600 border-0">
                          {c.status || "active"}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>

              {/* Tab 3: Grades Overview */}
              <TabsContent value="grades" className="space-y-3 mt-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border text-xs">
                  <span className="font-medium text-muted-foreground">Cumulative Grade Average:</span>
                  <span className="font-bold text-sm text-emerald-600">
                    {avgGrade !== null ? `${avgGrade}%` : "No graded projects yet"}
                  </span>
                </div>

                {grades.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground border rounded-lg bg-card">
                    No project submissions or grades on record yet.
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/60 text-muted-foreground font-semibold border-b">
                        <tr>
                          <th className="p-2.5">Activity / Project</th>
                          <th className="p-2.5">Course</th>
                          <th className="p-2.5">Submitted</th>
                          <th className="p-2.5">Status</th>
                          <th className="p-2.5 text-right">Grade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {grades.map((g) => (
                          <tr key={g.id} className="hover:bg-muted/20">
                            <td className="p-2.5 font-medium text-foreground">{g.title}</td>
                            <td className="p-2.5 text-muted-foreground">{g.course_title || "General"}</td>
                            <td className="p-2.5 text-muted-foreground">
                              {g.submitted_at ? new Date(g.submitted_at).toLocaleDateString() : "—"}
                            </td>
                            <td className="p-2.5">
                              <Badge variant="outline" className="capitalize text-[10px]">
                                {g.review_status || "submitted"}
                              </Badge>
                            </td>
                            <td className="p-2.5 text-right font-bold text-foreground">
                              {typeof g.grade === "number" ? `${g.grade}%` : "Pending"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>

              {/* Tab 4: Reports (Today's log, All logs, Outline, Complete) */}
              <TabsContent value="reports" className="space-y-3 mt-3">
                {/* Filter buttons */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button
                    size="sm"
                    variant={reportFilter === "all" ? "default" : "outline"}
                    onClick={() => setReportFilter("all")}
                    className="h-7 text-xs px-2.5"
                  >
                    All Reports ({reports.length})
                  </Button>
                  <Button
                    size="sm"
                    variant={reportFilter === "today" ? "default" : "outline"}
                    onClick={() => setReportFilter("today")}
                    className="h-7 text-xs px-2.5"
                  >
                    Today's Log
                  </Button>
                  <Button
                    size="sm"
                    variant={reportFilter === "outline" ? "default" : "outline"}
                    onClick={() => setReportFilter("outline")}
                    className="h-7 text-xs px-2.5"
                  >
                    Outline Reports
                  </Button>
                  <Button
                    size="sm"
                    variant={reportFilter === "complete" ? "default" : "outline"}
                    onClick={() => setReportFilter("complete")}
                    className="h-7 text-xs px-2.5"
                  >
                    Complete Reports
                  </Button>
                </div>

                {filteredReports.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground border rounded-lg bg-card">
                    No reports match this category.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredReports.map((r) => (
                      <div key={r.id} className="p-3 rounded-lg border bg-card hover:bg-muted/20 transition-colors">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-xs text-foreground">{r.title}</span>
                          <div className="flex items-center gap-1.5">
                            {typeof r.grade === "number" && (
                              <Badge className="bg-emerald-500/10 text-emerald-600 border-0 text-[10px]">
                                {r.grade}%
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {r.status}
                            </Badge>
                          </div>
                        </div>
                        {r.content && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.content}</p>
                        )}
                        <div className="text-[10px] text-muted-foreground mt-2">
                          Created: {new Date(r.created_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Tab 5: Certificates */}
              <TabsContent value="certificates" className="space-y-3 mt-3">
                <div className="p-10 text-center border rounded-lg bg-card space-y-2">
                  <Trophy className="w-10 h-10 text-amber-500 mx-auto opacity-70" />
                  <h4 className="font-semibold text-sm text-foreground">Certificates & Achievements</h4>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Certificates earned upon course completion will automatically appear here for verification and download.
                  </p>
                  <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30">
                    Auto-generated upon 100% completion
                  </Badge>
                </div>
              </TabsContent>

              {/* Tab 6: Login Activities & Audit */}
              <TabsContent value="activity" className="space-y-3 mt-3">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Clock className="w-4 h-4 text-primary" />
                      Platform Visits
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1">
                      <span className="text-muted-foreground font-medium">First time on the platform</span>
                      <p className="font-semibold text-foreground">{formatDateTime(firstVisit)}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground font-medium">Most recent visit</span>
                      <p className="font-semibold text-foreground">{formatDateTime(lastVisit)}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground font-medium">Last login</span>
                      <p className="font-semibold text-foreground">{formatDateTime(lastLogin)}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground font-medium">Last logout</span>
                      <p className="font-semibold text-foreground">{formatDateTime(lastLogout?.created_at)}</p>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <span className="text-muted-foreground font-medium">Last activity before logging out</span>
                      <p className="font-semibold text-foreground">
                        {lastActivityBeforeLogout
                          ? `${lastActivityBeforeLogout.action_type} · ${formatDateTime(lastActivityBeforeLogout.created_at)}`
                          : "No record yet"}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-lg border bg-card">
                    <div className="text-muted-foreground">Today's logs</div>
                    <div className="text-sm font-bold text-foreground">{todaysLogs.length}</div>
                  </div>
                  <div className="p-2.5 rounded-lg border bg-card">
                    <div className="text-muted-foreground">Logins</div>
                    <div className="text-sm font-bold text-foreground">{loginLogs.length}</div>
                  </div>
                  <div className="p-2.5 rounded-lg border bg-card">
                    <div className="text-muted-foreground">All events</div>
                    <div className="text-sm font-bold text-foreground">{auditLogs.length}</div>
                  </div>
                </div>

                {todaysLogs.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold text-foreground">Today's activity</div>
                    {todaysLogs.slice(0, 10).map((log) => (
                      <div
                        key={`today-${log.id}`}
                        className="p-2.5 rounded-md border bg-card flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Activity className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span className="font-mono text-foreground font-medium">{log.action_type}</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(log.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border text-xs">
                  <span className="text-muted-foreground font-medium">Session & Audit Trail</span>
                  <span className="text-muted-foreground">{auditLogs.length} events logged</span>
                </div>

                {auditLogs.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground border rounded-lg bg-card">
                    No recent login or audit events recorded for this student.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                    {auditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-2.5 rounded-md border bg-card flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Activity className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span className="font-mono text-foreground font-medium">{log.action_type}</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
