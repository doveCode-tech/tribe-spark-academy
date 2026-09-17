import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Trophy,
  Flame,
  BookOpen,
  Calendar,
  CheckCircle2,
  Printer,
  ExternalLink,
  Code2,
  FileText,
  HeartHandshake,
  GraduationCap,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";
import { resolveStudentIdentity } from "@/utils/identity";
import { calculateLevel, fetchStudentXP, LevelProgress } from "@/utils/gamification";

interface CourseEnrollment {
  id: string;
  course_id: string;
  progress_percentage: number;
  status: string;
  enrolled_at: string;
  course?: {
    id: string;
    title: string;
    description: string | null;
    thumbnail_url: string | null;
    level: string | null;
  };
}

interface TutorReport {
  id: string;
  title: string;
  content: string;
  status: string;
  grade: number | null;
  created_at: string;
  course_title?: string;
  tutor_name?: string;
  reviewer_comments?: string;
}

interface StudentProject {
  id: string;
  title: string;
  description: string | null;
  grade: number | null;
  feedback: string | null;
  link: string | null;
  file_path: string | null;
  submitted_at: string | null;
  editor_type: string | null;
}

interface EarnedBadge {
  id: string;
  earned_at: string;
  name: string;
  description: string;
  badge_image_url?: string;
  icon_name?: string;
}

export default function ParentStudentView() {
  const { studentId } = useParams<{ studentId: string }>();
  const [loading, setLoading] = useState(true);
  const [studentProfile, setStudentProfile] = useState<any>(null);
  const [levelProgress, setLevelProgress] = useState<LevelProgress | null>(null);
  const [streakData, setStreakData] = useState<{ current_streak: number; longest_streak: number; total_days: number }>({
    current_streak: 0,
    longest_streak: 0,
    total_days: 0,
  });
  const [enrollments, setEnrollments] = useState<CourseEnrollment[]>([]);
  const [reports, setReports] = useState<TutorReport[]>([]);
  const [projects, setProjects] = useState<StudentProject[]>([]);
  const [badges, setBadges] = useState<EarnedBadge[]>([]);

  useEffect(() => {
    if (studentId) {
      loadParentData();
    }
  }, [studentId]);

  const loadParentData = async () => {
    if (!studentId) return;
    setLoading(true);
    try {
      // 1. Resolve identity
      const identity = await resolveStudentIdentity(studentId);
      const studentIds = identity ? [identity.dbId, identity.authUserId] : [studentId];

      // 2. Fetch User Profile
      const { data: userData } = await supabase
        .from("users")
        .select("id, auth_user_id, name, first_name, last_name, email, parent_email, avatar_url, created_at")
        .or(`id.eq.${studentId},auth_user_id.eq.${studentId}`)
        .maybeSingle();

      setStudentProfile(userData);

      // 3. Fetch XP and Level
      const totalXP = await fetchStudentXP(studentIds);
      setLevelProgress(calculateLevel(totalXP));

      // 4. Fetch Streak Data
      const { data: streakRes } = await supabase
        .from("user_streaks")
        .select("current_streak, longest_streak, total_learning_days")
        .in("student_id", studentIds)
        .maybeSingle();

      if (streakRes) {
        setStreakData({
          current_streak: streakRes.current_streak || 0,
          longest_streak: streakRes.longest_streak || 0,
          total_days: streakRes.total_learning_days || 0,
        });
      }

      // 5. Fetch Active & Completed Course Enrollments
      const { data: enrollData } = await supabase
        .from("enrollments")
        .select("id, course_id, progress_percentage, status, enrolled_at, courses(id, title, description, thumbnail_url, level)")
        .in("student_id", studentIds)
        .order("enrolled_at", { ascending: false });

      if (enrollData) {
        setEnrollments(
          enrollData.map((e: any) => ({
            id: e.id,
            course_id: e.course_id,
            progress_percentage: Number(e.progress_percentage) || 0,
            status: e.status,
            enrolled_at: e.enrolled_at,
            course: e.courses,
          }))
        );
      }

      // 6. Fetch Published Tutor Reports
      const { data: reportsData } = await supabase
        .from("reports")
        .select("id, title, content, status, grade, created_at, reviewer_comments, courses(title)")
        .in("student_id", studentIds)
        .in("status", ["approved", "submitted"])
        .order("created_at", { ascending: false });

      if (reportsData) {
        setReports(
          reportsData.map((r: any) => ({
            id: r.id,
            title: r.title,
            content: r.content,
            status: r.status,
            grade: r.grade,
            created_at: r.created_at,
            reviewer_comments: r.reviewer_comments,
            course_title: r.courses?.title,
          }))
        );
      }

      // 7. Fetch Graded Projects
      const { data: projectsData } = await supabase
        .from("projects")
        .select("id, title, description, grade, feedback, link, file_path, submitted_at, editor_type")
        .in("student_id", studentIds)
        .eq("review_status", "graded")
        .order("submitted_at", { ascending: false });

      if (projectsData) {
        setProjects(projectsData);
      }

      // 8. Fetch Badges
      const { data: badgesData } = await supabase
        .from("student_badges")
        .select("earned_at, badges(id, name, description, badge_image_url, icon_name)")
        .in("student_id", studentIds);

      if (badgesData) {
        setBadges(
          badgesData
            .filter((b: any) => b.badges)
            .map((b: any) => ({
              id: b.badges.id,
              earned_at: b.earned_at,
              name: b.badges.name,
              description: b.badges.description,
              badge_image_url: b.badges.badge_image_url,
              icon_name: b.badges.icon_name,
            }))
        );
      }
    } catch (err) {
      console.error("Error loading parent student data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto" />
          <p className="text-sm font-semibold text-muted-foreground">Loading STEM Learning Report...</p>
        </div>
      </div>
    );
  }

  const studentDisplayName =
    studentProfile?.name ||
    `${studentProfile?.first_name || ""} ${studentProfile?.last_name || ""}`.trim() ||
    "Student";

  const totalCourses = enrollments.length;
  const completedCoursesCount = enrollments.filter(
    (e) => e.progress_percentage === 100 || e.status === "completed"
  ).length;
  const avgProgress =
    totalCourses > 0
      ? Math.round(
          enrollments.reduce((acc, curr) => acc + curr.progress_percentage, 0) / totalCourses
        )
      : 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-foreground py-8 px-4 sm:px-6 lg:px-8">
      {/* Top Navbar / Navigation Header */}
      <div className="max-w-5xl mx-auto mb-6 flex items-center justify-between print:hidden">
        <Button variant="ghost" size="sm" asChild className="gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <Link to="/">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to LMS
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handlePrint}
            className="gap-1.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Report Card
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto space-y-6">
        {/* ── 1. Parent Banner Header ─────────────────────────────────────────── */}
        <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-purple-900 via-indigo-950 to-purple-950 text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16 sm:w-20 sm:h-20 border-2 border-purple-300 shadow-md">
                <AvatarImage src={studentProfile?.avatar_url} />
                <AvatarFallback className="bg-purple-800 text-purple-200 font-bold text-lg">
                  {studentDisplayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    {studentDisplayName}
                  </h1>
                  <Badge className="bg-purple-500/20 text-purple-200 border-purple-400/30 text-xs px-2.5 py-0.5">
                    Parent Progress View
                  </Badge>
                </div>
                <p className="text-xs sm:text-sm text-purple-200 mt-1">
                  STEMTribe Learning Academy · Official Progress & Academic Report
                </p>
                {studentProfile?.parent_email && (
                  <p className="text-xs text-purple-300/80 mt-0.5 flex items-center gap-1">
                    <HeartHandshake className="w-3.5 h-3.5 text-purple-300" />
                    Guardian Account: {studentProfile.parent_email}
                  </p>
                )}
              </div>
            </div>

            {/* Level Rank Badge Pill */}
            {levelProgress && (
              <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-xl border border-white/15 flex items-center gap-3">
                <span className="text-3xl">{levelProgress.currentLevel.badge}</span>
                <div>
                  <span className="text-[11px] font-semibold text-purple-200 block uppercase tracking-wider">
                    Current STEM Rank
                  </span>
                  <div className="text-base font-bold text-white">
                    Level {levelProgress.currentLevel.level}: {levelProgress.currentLevel.title}
                  </div>
                  <span className="text-xs text-purple-300 font-medium">
                    {levelProgress.totalXP.toLocaleString()} Total XP
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── 2. Quick Key Performance Metrics ─────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-purple-200/80 dark:border-purple-900 shadow-xs">
            <CardContent className="p-4 text-center">
              <BookOpen className="w-6 h-6 mx-auto mb-1.5 text-purple-600" />
              <div className="text-2xl font-bold text-foreground">
                {completedCoursesCount} / {totalCourses}
              </div>
              <div className="text-xs text-muted-foreground font-medium">Courses Completed</div>
            </CardContent>
          </Card>

          <Card className="border-purple-200/80 dark:border-purple-900 shadow-xs">
            <CardContent className="p-4 text-center">
              <GraduationCap className="w-6 h-6 mx-auto mb-1.5 text-indigo-600" />
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                {avgProgress}%
              </div>
              <div className="text-xs text-muted-foreground font-medium">Average Progress</div>
            </CardContent>
          </Card>

          <Card className="border-orange-200 dark:border-orange-900 shadow-xs">
            <CardContent className="p-4 text-center">
              <Flame className="w-6 h-6 mx-auto mb-1.5 text-orange-500" />
              <div className="text-2xl font-bold text-orange-500">
                {streakData.current_streak} Days
              </div>
              <div className="text-xs text-muted-foreground font-medium">
                Active Streak ({streakData.total_days} Days Total)
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-200 dark:border-emerald-900 shadow-xs">
            <CardContent className="p-4 text-center">
              <Trophy className="w-6 h-6 mx-auto mb-1.5 text-emerald-600" />
              <div className="text-2xl font-bold text-emerald-600">
                {badges.length}
              </div>
              <div className="text-xs text-muted-foreground font-medium">Badges & Honors</div>
            </CardContent>
          </Card>
        </div>

        {/* ── 3. Course-by-Course Learning Progress ────────────────────────────── */}
        <Card className="shadow-xs border-purple-200/60 dark:border-purple-900">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-purple-600" />
              Enrolled STEM Courses & Curricular Milestones
            </CardTitle>
            <CardDescription className="text-xs">
              Overview of technical learning tracks and completion status.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            {enrollments.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                No enrolled courses found for this student.
              </p>
            ) : (
              enrollments.map((enrollment) => (
                <div
                  key={enrollment.id}
                  className="p-4 rounded-xl border border-purple-100 dark:border-purple-900/50 bg-card hover:bg-purple-50/30 transition-colors space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <h3 className="font-bold text-sm text-foreground">
                        {enrollment.course?.title || "STEM Course Track"}
                      </h3>
                      {enrollment.course?.level && (
                        <span className="text-[11px] text-muted-foreground capitalize font-medium">
                          Track Level: {enrollment.course.level}
                        </span>
                      )}
                    </div>
                    <div>
                      {enrollment.progress_percentage === 100 ? (
                        <Badge className="bg-emerald-600 text-white text-xs gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Complete (100%)
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-purple-300 text-purple-700 dark:text-purple-300 text-xs">
                          {enrollment.progress_percentage}% Completed
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <Progress value={enrollment.progress_percentage} className="h-2 bg-purple-100 dark:bg-purple-950" />
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Curriculum Progression</span>
                      <span className="font-semibold text-foreground">{enrollment.progress_percentage}%</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* ── 4. Published Tutor Progress Reports ──────────────────────────────── */}
        <Card className="shadow-xs border-purple-200/60 dark:border-purple-900">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-600" />
              Tutor Evaluation & Progress Reports
            </CardTitle>
            <CardDescription className="text-xs">
              Official qualitative reviews and performance feedback submitted by instructors.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            {reports.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs space-y-1">
                <FileText className="w-8 h-8 mx-auto opacity-30 text-purple-500" />
                <p>No published tutor progress reports yet.</p>
                <p className="text-[11px]">Reports appear here once submitted and approved by your tutor.</p>
              </div>
            ) : (
              reports.map((report) => (
                <div
                  key={report.id}
                  className="p-5 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/40 dark:bg-purple-950/20 space-y-3"
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <h4 className="font-bold text-sm text-foreground">{report.title}</h4>
                      <p className="text-xs text-muted-foreground">
                        {report.course_title ? `Course: ${report.course_title} · ` : ""}
                        Published on {new Date(report.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {report.grade !== null && (
                      <Badge className="bg-purple-700 text-white text-xs font-bold px-2.5 py-0.5">
                        Evaluation Grade: {report.grade}%
                      </Badge>
                    )}
                  </div>

                  <div className="p-3.5 bg-background rounded-lg border border-purple-100 dark:border-purple-900 text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                    {report.content}
                  </div>

                  {report.reviewer_comments && (
                    <div className="p-3 bg-purple-100/50 dark:bg-purple-900/30 rounded-lg text-xs text-purple-900 dark:text-purple-200">
                      <span className="font-semibold block mb-0.5">Instructor Remarks:</span>
                      <p>{report.reviewer_comments}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* ── 5. Hands-on Project Showcase ─────────────────────────────────────── */}
        <Card className="shadow-xs border-purple-200/60 dark:border-purple-900">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Code2 className="w-4 h-4 text-purple-600" />
              Hands-On Projects & Code Creations
            </CardTitle>
            <CardDescription className="text-xs">
              Coding and robotics projects designed and implemented by {studentDisplayName}.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5">
            {projects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs">
                No graded projects available yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {projects.map((proj) => (
                  <div
                    key={proj.id}
                    className="p-4 rounded-xl border border-purple-100 dark:border-purple-900 bg-card space-y-2.5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-bold text-sm text-foreground">{proj.title}</h4>
                        {proj.grade !== null && (
                          <Badge className="bg-emerald-600 text-white text-[11px] font-semibold">
                            {proj.grade}%
                          </Badge>
                        )}
                      </div>
                      {proj.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                          {proj.description}
                        </p>
                      )}
                      {proj.feedback && (
                        <div className="mt-2 p-2 bg-purple-50 dark:bg-purple-950/40 rounded text-[11px] text-purple-800 dark:text-purple-300">
                          <span className="font-semibold">Tutor Feedback: </span>
                          {proj.feedback}
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t flex items-center justify-between text-xs">
                      <span className="text-muted-foreground text-[10px]">
                        {proj.submitted_at ? new Date(proj.submitted_at).toLocaleDateString() : ""}
                      </span>
                      {proj.link && (
                        <a
                          href={proj.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-purple-700 dark:text-purple-300 font-semibold hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View Project
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── 6. Milestone Badges & Honors ─────────────────────────────────────── */}
        <Card className="shadow-xs border-purple-200/60 dark:border-purple-900">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Trophy className="w-4 h-4 text-purple-600" />
              Milestone Badges & Honors
            </CardTitle>
            <CardDescription className="text-xs">
              Achievements earned across coding exercises, streak milestones, and quizzes.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5">
            {badges.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                No badges earned yet.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {badges.map((b) => (
                  <div
                    key={b.id}
                    className="p-3 rounded-xl border border-purple-100 dark:border-purple-900/50 bg-card text-center space-y-1.5 shadow-2xs hover:border-purple-300 transition-colors"
                  >
                    <div className="w-10 h-10 mx-auto rounded-full bg-purple-100 dark:bg-purple-950 flex items-center justify-center text-lg">
                      {b.badge_image_url ? (
                        <img src={b.badge_image_url} alt={b.name} className="w-7 h-7 object-contain" />
                      ) : (
                        "🎖️"
                      )}
                    </div>
                    <h5 className="font-bold text-xs text-foreground truncate">{b.name}</h5>
                    <p className="text-[10px] text-muted-foreground line-clamp-2">{b.description}</p>
                    <span className="text-[9px] text-muted-foreground block pt-1">
                      {new Date(b.earned_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── 7. Official Academy Sign-Off / Printable Footer ───────────────────── */}
        <div className="p-6 rounded-xl bg-card border border-purple-200 dark:border-purple-900 text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-purple-700 dark:text-purple-300 font-bold text-sm">
            <ShieldCheck className="w-5 h-5 text-purple-600" />
            STEMTribe Learning Academy Official Verification
          </div>
          <p className="text-xs text-muted-foreground max-w-xl mx-auto leading-relaxed">
            This learning record reflects active enrollment, verified coursework progress, and instructor assessments. For inquiries, reach out to support@stemtribe.org.
          </p>
          <p className="text-[10px] text-muted-foreground pt-2">
            Generated on {new Date().toLocaleDateString()} · STEMTribe LMS
          </p>
        </div>
      </div>
    </div>
  );
}
