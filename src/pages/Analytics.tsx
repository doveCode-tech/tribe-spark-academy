import { useEffect, useState, useMemo } from "react";
import { LMSLayout } from "@/components/LMSLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Users,
  BookOpen,
  GraduationCap,
  Trophy,
  Flame,
  Sparkles,
  TrendingUp,
  RefreshCw,
  Printer,
  CheckCircle2,
  Clock,
  BarChart3,
  Award,
  ExternalLink,
  PieChart as PieIcon,
  ShieldCheck,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { LEVEL_TIERS, calculateLevel } from "@/utils/gamification";

interface CourseStat {
  id: string;
  title: string;
  enrollments: number;
  completed: number;
  avgCompletion: number;
}

interface ProjectSubmission {
  id: string;
  title: string;
  student_name: string;
  student_avatar?: string;
  course_title: string;
  submitted_at: string;
  grade: number | null;
  review_status: string;
}

interface TopLearner {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  total_xp: number;
  level: number;
  level_title: string;
  level_badge: string;
  streak: number;
}

type Timeframe = "all" | "30d" | "7d";

const CHART_COLORS = ["#3B82F6", "#10B981", "#8B5CF6", "#EC4899", "#F59E0B", "#EF4444"];

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeframe, setTimeframe] = useState<Timeframe>("all");

  // Core metrics
  const [totalStudents, setTotalStudents] = useState(0);
  const [activeStudents, setActiveStudents] = useState(0);
  const [totalEnrollments, setTotalEnrollments] = useState(0);
  const [completedEnrollments, setCompletedEnrollments] = useState(0);
  const [courseStats, setCourseStats] = useState<CourseStat[]>([]);
  const [recentProjects, setRecentProjects] = useState<ProjectSubmission[]>([]);
  const [topLearners, setTopLearners] = useState<TopLearner[]>([]);
  const [totalPlatformXP, setTotalPlatformXP] = useState(0);
  const [activeStreaksCount, setActiveStreaksCount] = useState(0);
  const [avgGrade, setAvgGrade] = useState<number | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);

      // 1. Fetch base entities concurrently
      const [
        coursesRes,
        studentsRes,
        enrollmentsRes,
        projectsRes,
        xpRes,
        streaksRes,
      ] = await Promise.all([
        supabase.from("courses").select("id, title"),
        supabase.from("users").select("id, auth_user_id, name, first_name, last_name, email, avatar_url").eq("role", "student"),
        supabase.from("enrollments").select("id, course_id, student_id, progress_percentage, status, created_at"),
        supabase.from("projects").select("id, title, student_id, course_id, submitted_at, grade, review_status, courses(title)").order("submitted_at", { ascending: false }).limit(20),
        supabase.from("student_xp_transactions").select("student_id, xp_amount"),
        supabase.from("user_streaks").select("student_id, current_streak, longest_streak"),
      ]);

      const courses = coursesRes.data || [];
      const students = studentsRes.data || [];
      const enrollments = enrollmentsRes.data || [];
      const projects = projectsRes.data || [];
      const xpData = xpRes.data || [];
      const streaks = streaksRes.data || [];

      // Student maps
      const studentMap: Record<string, any> = {};
      students.forEach((s) => {
        studentMap[s.id] = s;
        if (s.auth_user_id) studentMap[s.auth_user_id] = s;
      });

      // Total & Active Students
      setTotalStudents(students.length);
      const activeIds = new Set(enrollments.filter((e) => e.status === "active").map((e) => e.student_id));
      setActiveStudents(activeIds.size);

      // Total Enrollments & Completions
      setTotalEnrollments(enrollments.length);
      const completed = enrollments.filter(
        (e: any) => e.progress_percentage === 100 || e.status === "completed"
      ).length;
      setCompletedEnrollments(completed);

      // Per-Course Stats
      const byCourse: Record<string, { title: string; enrollments: number; completed: number; sumProgress: number; count: number }> = {};
      courses.forEach((c: any) => {
        byCourse[c.id] = { title: c.title, enrollments: 0, completed: 0, sumProgress: 0, count: 0 };
      });

      enrollments.forEach((e: any) => {
        if (!byCourse[e.course_id]) return;
        byCourse[e.course_id].enrollments += 1;
        const prog = typeof e.progress_percentage === "number" ? e.progress_percentage : 0;
        byCourse[e.course_id].sumProgress += prog;
        byCourse[e.course_id].count += 1;
        if (prog === 100 || e.status === "completed") {
          byCourse[e.course_id].completed += 1;
        }
      });

      const stats: CourseStat[] = Object.entries(byCourse).map(([id, v]) => ({
        id,
        title: v.title,
        enrollments: v.enrollments,
        completed: v.completed,
        avgCompletion: v.count ? Math.round(v.sumProgress / v.count) : 0,
      }));
      stats.sort((a, b) => b.enrollments - a.enrollments);
      setCourseStats(stats);

      // Projects & Average Grade
      const gradedProjects = projects.filter((p: any) => p.grade !== null);
      if (gradedProjects.length > 0) {
        const sumGrade = gradedProjects.reduce((acc: number, p: any) => acc + (p.grade || 0), 0);
        setAvgGrade(Math.round(sumGrade / gradedProjects.length));
      } else {
        setAvgGrade(null);
      }

      const formattedProjects: ProjectSubmission[] = projects.map((p: any) => {
        const student = studentMap[p.student_id];
        const studentName = student
          ? student.name || `${student.first_name || ""} ${student.last_name || ""}`.trim() || "Student"
          : "Student";
        return {
          id: p.id,
          title: p.title || "Project Activity",
          student_name: studentName,
          student_avatar: student?.avatar_url,
          course_title: p.courses?.title || "STEM Course",
          submitted_at: p.submitted_at || new Date().toISOString(),
          grade: p.grade,
          review_status: p.review_status || "submitted",
        };
      });
      setRecentProjects(formattedProjects);

      // Platform XP Accumulation
      const xpByStudent: Record<string, number> = {};
      let totalXP = 0;
      xpData.forEach((row: any) => {
        const amt = Number(row.xp_amount) || 0;
        totalXP += amt;
        xpByStudent[row.student_id] = (xpByStudent[row.student_id] || 0) + amt;
      });
      setTotalPlatformXP(totalXP);

      // Streaks
      const streakByStudent: Record<string, number> = {};
      let activeStreaks = 0;
      streaks.forEach((st: any) => {
        const s = st.current_streak || 0;
        streakByStudent[st.student_id] = s;
        if (s > 0) activeStreaks += 1;
      });
      setActiveStreaksCount(activeStreaks);

      // Top Learners / Leaderboard
      const leaderboard: TopLearner[] = students.map((s) => {
        const studentXP = (xpByStudent[s.id] || 0) + (s.auth_user_id ? xpByStudent[s.auth_user_id] || 0 : 0);
        const streak = (streakByStudent[s.id] || 0) + (s.auth_user_id ? streakByStudent[s.auth_user_id] || 0 : 0);
        const lvl = calculateLevel(studentXP).currentLevel;
        return {
          id: s.id,
          name: s.name || `${s.first_name || ""} ${s.last_name || ""}`.trim() || s.email,
          email: s.email,
          avatar_url: s.avatar_url,
          total_xp: studentXP,
          level: lvl.level,
          level_title: lvl.title,
          level_badge: lvl.badge,
          streak,
        };
      });

      leaderboard.sort((a, b) => b.total_xp - a.total_xp);
      setTopLearners(leaderboard.slice(0, 10));
    } catch (e) {
      console.error("Error loading analytics:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadAnalytics();
  };

  const handlePrint = () => {
    window.print();
  };

  // Gamification Level Distribution
  const levelDistribution = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    topLearners.forEach((l) => {
      counts[l.level] = (counts[l.level] || 0) + 1;
    });

    return LEVEL_TIERS.map((tier) => ({
      name: `${tier.badge} L${tier.level} ${tier.title}`,
      value: counts[tier.level] || 0,
      color: tier.color,
    })).filter((item) => item.value > 0 || totalStudents > 0);
  }, [topLearners, totalStudents]);

  // Overall completion percentage
  const platformCompletionRate =
    totalEnrollments > 0 ? Math.round((completedEnrollments / totalEnrollments) * 100) : 0;

  return (
    <LMSLayout>
      <div className="space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                STEM Learning Analytics
              </h1>
              <Badge className="bg-purple-700 hover:bg-purple-800 text-white text-xs">
                Realtime Intelligence
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Curricular engagement, gamification milestones, and academy performance metrics.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap print:hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="text-xs h-9 gap-1.5 border-purple-200 hover:bg-purple-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={handlePrint}
              className="text-xs h-9 gap-1.5 bg-purple-700 hover:bg-purple-800 text-white font-semibold"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Report
            </Button>
          </div>
        </div>

        {/* ── 1. Executive Metric KPI Row ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="border-purple-200/80 dark:border-purple-900 shadow-xs">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Students</span>
                <Users className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl font-extrabold text-foreground mt-1">
                {loading ? "—" : totalStudents}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {activeStudents} currently active
              </p>
            </CardContent>
          </Card>

          <Card className="border-purple-200/80 dark:border-purple-900 shadow-xs">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Enrollments</span>
                <BookOpen className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-extrabold text-foreground mt-1">
                {loading ? "—" : totalEnrollments}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Across {courseStats.length} tracks
              </p>
            </CardContent>
          </Card>

          <Card className="border-purple-200/80 dark:border-purple-900 shadow-xs">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Completion Rate</span>
                <GraduationCap className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-extrabold text-emerald-600 mt-1">
                {loading ? "—" : `${platformCompletionRate}%`}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {completedEnrollments} completed tracks
              </p>
            </CardContent>
          </Card>

          <Card className="border-purple-200/80 dark:border-purple-900 shadow-xs">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Average Grade</span>
                <Award className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-extrabold text-amber-600 mt-1">
                {loading ? "—" : avgGrade !== null ? `${avgGrade}%` : "—"}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">On graded projects</p>
            </CardContent>
          </Card>

          <Card className="border-purple-200/80 dark:border-purple-900 shadow-xs">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Platform XP</span>
                <Sparkles className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl font-extrabold text-purple-700 dark:text-purple-300 mt-1">
                {loading ? "—" : totalPlatformXP.toLocaleString()}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Gamified XP awarded</p>
            </CardContent>
          </Card>

          <Card className="border-purple-200/80 dark:border-purple-900 shadow-xs">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Active Streaks</span>
                <Flame className="w-4 h-4 text-orange-500" />
              </div>
              <div className="text-2xl font-extrabold text-orange-500 mt-1">
                {loading ? "—" : activeStreaksCount}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Consistent learners</p>
            </CardContent>
          </Card>
        </div>

        {/* ── 2. Analytics Tabs ─────────────────────────────────────────────────── */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-muted/60 p-1 border">
            <TabsTrigger value="overview" className="text-xs gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Overview & Charts</span>
            </TabsTrigger>
            <TabsTrigger value="courses" className="text-xs gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Course Performance</span>
            </TabsTrigger>
            <TabsTrigger value="gamification" className="text-xs gap-1.5">
              <Trophy className="w-3.5 h-3.5" />
              <span>Gamification & Streaks</span>
            </TabsTrigger>
            <TabsTrigger value="submissions" className="text-xs gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Recent Submissions</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: OVERVIEW & CHARTS */}
          <TabsContent value="overview" className="space-y-6 mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Bar Chart: Enrollments vs Completions */}
              <Card className="lg:col-span-2 border-purple-200/60 dark:border-purple-900 shadow-xs">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-bold flex items-center justify-between">
                    <span>Course Enrollment vs. Completion</span>
                    <span className="text-xs font-normal text-muted-foreground">Top Courses</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Compares total students registered against completed curriculums per track.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {loading ? (
                    <div className="h-64 flex items-center justify-center text-xs text-muted-foreground">
                      Loading chart...
                    </div>
                  ) : courseStats.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-xs text-muted-foreground">
                      No course data available.
                    </div>
                  ) : (
                    <div className="h-72 w-full pt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={courseStats.slice(0, 6)}
                          margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                        >
                          <XAxis
                            dataKey="title"
                            tick={{ fontSize: 11 }}
                            interval={0}
                            tickFormatter={(val) =>
                              val.length > 14 ? `${val.slice(0, 12)}…` : val
                            }
                          />
                          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                          <Tooltip
                            contentStyle={{
                              borderRadius: 8,
                              fontSize: 12,
                              backgroundColor: "hsl(var(--card))",
                              borderColor: "hsl(var(--border))",
                            }}
                          />
                          <Bar
                            dataKey="enrollments"
                            name="Enrolled"
                            fill="#8B5CF6"
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar
                            dataKey="completed"
                            name="Completed"
                            fill="#10B981"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Pie Chart: Level Tiers */}
              <Card className="border-purple-200/60 dark:border-purple-900 shadow-xs">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <PieIcon className="w-4 h-4 text-purple-600" />
                    Student Tier Distribution
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Current breakdown of students across gamification ranks.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {loading ? (
                    <div className="h-64 flex items-center justify-center text-xs text-muted-foreground">
                      Loading tiers...
                    </div>
                  ) : levelDistribution.every((d) => d.value === 0) ? (
                    <div className="h-64 flex items-center justify-center text-xs text-muted-foreground text-center">
                      No student level data yet.
                    </div>
                  ) : (
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={levelDistribution}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {levelDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              borderRadius: 8,
                              fontSize: 12,
                              backgroundColor: "hsl(var(--card))",
                              borderColor: "hsl(var(--border))",
                            }}
                          />
                          <Legend
                            verticalAlign="bottom"
                            wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Quick Leaderboard Row */}
            <Card className="border-purple-200/60 dark:border-purple-900 shadow-xs">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-purple-600" />
                  Top STEM Achievers (Platform Leaderboard)
                </CardTitle>
                <CardDescription className="text-xs">
                  Highest XP earners and most consistent learners across STEM Tribe.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {topLearners.slice(0, 5).map((learner, idx) => (
                    <div
                      key={learner.id}
                      className="p-4 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-6 text-center font-bold text-xs ${
                            idx === 0
                              ? "text-amber-500"
                              : idx === 1
                              ? "text-slate-400"
                              : idx === 2
                              ? "text-amber-700"
                              : "text-muted-foreground"
                          }`}
                        >
                          #{idx + 1}
                        </span>
                        <Avatar className="w-9 h-9 border border-purple-200">
                          <AvatarImage src={learner.avatar_url} />
                          <AvatarFallback className="bg-purple-100 text-purple-900 text-xs font-bold">
                            {learner.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <span className="font-bold text-sm text-foreground block">
                            {learner.name}
                          </span>
                          <span className="text-xs text-muted-foreground">{learner.email}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <Badge
                            variant="outline"
                            className="border-purple-300 text-purple-700 dark:text-purple-300 text-xs font-semibold gap-1"
                          >
                            <span>{learner.level_badge}</span>
                            <span>Level {learner.level}</span>
                          </Badge>
                          <span className="text-[11px] text-muted-foreground block mt-0.5">
                            {learner.level_title}
                          </span>
                        </div>
                        <div className="text-right min-w-[70px]">
                          <span className="font-extrabold text-sm text-purple-700 dark:text-purple-300 block">
                            {learner.total_xp.toLocaleString()} XP
                          </span>
                          {learner.streak > 0 && (
                            <span className="text-[10px] text-orange-500 font-semibold flex items-center justify-end gap-0.5">
                              <Flame className="w-3 h-3" />
                              {learner.streak}d streak
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {topLearners.length === 0 && (
                    <div className="p-8 text-center text-xs text-muted-foreground">
                      No student records found.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: COURSE PERFORMANCE */}
          <TabsContent value="courses" className="space-y-4 mt-0">
            <Card className="border-purple-200/60 dark:border-purple-900 shadow-xs">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-purple-600" />
                  Course-by-Course Engagement & Completion
                </CardTitle>
                <CardDescription className="text-xs">
                  Detailed progression metrics across each published STEM track.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/40 text-muted-foreground font-semibold">
                        <th className="py-3 px-4 text-left">Course Title</th>
                        <th className="py-3 px-4 text-center">Total Enrolled</th>
                        <th className="py-3 px-4 text-center">Completed</th>
                        <th className="py-3 px-4 text-center">Completion Rate</th>
                        <th className="py-3 px-4 text-left w-48">Average Progress</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {courseStats.map((c) => {
                        const rate =
                          c.enrollments > 0 ? Math.round((c.completed / c.enrollments) * 100) : 0;
                        return (
                          <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                            <td className="py-3.5 px-4 font-bold text-foreground">{c.title}</td>
                            <td className="py-3.5 px-4 text-center font-semibold">
                              {c.enrollments}
                            </td>
                            <td className="py-3.5 px-4 text-center font-semibold text-emerald-600">
                              {c.completed}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <Badge
                                variant={rate >= 50 ? "default" : "secondary"}
                                className={`text-[10px] ${
                                  rate >= 50 ? "bg-emerald-600 text-white" : ""
                                }`}
                              >
                                {rate}%
                              </Badge>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="space-y-1">
                                <Progress value={c.avgCompletion} className="h-2" />
                                <div className="text-[10px] text-muted-foreground text-right font-medium">
                                  {c.avgCompletion}%
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {courseStats.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-muted-foreground">
                            No courses found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: GAMIFICATION & STREAKS */}
          <TabsContent value="gamification" className="space-y-6 mt-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {LEVEL_TIERS.map((tier) => {
                const count = topLearners.filter((l) => l.level === tier.level).length;
                const percentage =
                  totalStudents > 0 ? Math.round((count / totalStudents) * 100) : 0;

                return (
                  <Card
                    key={tier.level}
                    className="border-purple-200/60 dark:border-purple-900 shadow-xs relative overflow-hidden"
                  >
                    <div
                      className="absolute top-0 left-0 right-0 h-1.5"
                      style={{ backgroundColor: tier.color }}
                    />
                    <CardHeader className="pb-2 pt-4">
                      <div className="flex items-center justify-between">
                        <span className="text-3xl">{tier.badge}</span>
                        <Badge
                          variant="outline"
                          className="text-xs font-bold"
                          style={{ borderColor: tier.color, color: tier.color }}
                        >
                          Level {tier.level}
                        </Badge>
                      </div>
                      <CardTitle className="text-base font-bold mt-2">{tier.title}</CardTitle>
                      <CardDescription className="text-xs line-clamp-2">
                        {tier.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-extrabold text-foreground">{count}</span>
                        <span className="text-xs text-muted-foreground font-medium">
                          {percentage}% of learners
                        </span>
                      </div>
                      <Progress value={percentage} className="h-1.5 mt-2" />
                      <span className="text-[10px] text-muted-foreground block mt-2">
                        XP Required: {tier.minXP.toLocaleString()} –{" "}
                        {tier.maxXP === Infinity ? "Max" : tier.maxXP.toLocaleString()} XP
                      </span>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* TAB 4: RECENT SUBMISSIONS */}
          <TabsContent value="submissions" className="space-y-4 mt-0">
            <Card className="border-purple-200/60 dark:border-purple-900 shadow-xs">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-600" />
                  Recent Project Submissions Feed
                </CardTitle>
                <CardDescription className="text-xs">
                  Latest activity assignments turned in by students across all courses.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {recentProjects.map((p) => (
                    <div
                      key={p.id}
                      className="p-4 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="w-9 h-9 border border-purple-200">
                          <AvatarImage src={p.student_avatar} />
                          <AvatarFallback className="bg-purple-100 text-purple-900 text-xs font-bold">
                            {p.student_name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <span className="font-bold text-sm text-foreground block truncate">
                            {p.title}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {p.student_name} · {p.course_title}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {p.grade !== null ? (
                          <Badge className="bg-emerald-600 text-white text-xs font-bold">
                            Graded ({p.grade}%)
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500 text-white text-xs">Pending Review</Badge>
                        )}
                        <span className="text-[11px] text-muted-foreground hidden sm:inline-block">
                          {new Date(p.submitted_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                  {recentProjects.length === 0 && (
                    <div className="p-8 text-center text-xs text-muted-foreground">
                      No project submissions yet.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </LMSLayout>
  );
}
