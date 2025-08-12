import { LMSLayout } from "@/components/LMSLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CourseStat { id: string; title: string; enrollments: number; avgCompletion: number; }
interface Project { id: string; title: string; submitted_at: string; course_id: string; }

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [totalStudents, setTotalStudents] = useState(0);
  const [activeStudents, setActiveStudents] = useState(0);
  const [courseStats, setCourseStats] = useState<CourseStat[]>([]);
  const [completedCourses, setCompletedCourses] = useState(0);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        // Fetch base data
        const [coursesRes, studentsRes, enrollmentsRes, projectsRes] = await Promise.all([
          supabase.from('courses').select('id, title'),
          supabase.from('users').select('id').eq('role','student'),
          supabase.from('enrollments').select('course_id, student_id, progress_percentage, status'),
          supabase.from('projects').select('id,title,submitted_at,course_id').order('submitted_at',{ascending:false}).limit(5),
        ]);

        const courses = coursesRes.data || [];
        const students = studentsRes.data || [];
        const enrollments = enrollmentsRes.data || [];
        const projects = projectsRes.data || [];

        setTotalStudents(students.length);
        const active = new Set(enrollments.filter(e => e.status === 'active').map(e => e.student_id)).size;
        setActiveStudents(active);

        // Completed courses = enrollments with 100% progress
        setCompletedCourses(enrollments.filter((e:any) => e.progress_percentage === 100).length);

        // Build per-course stats
        const byCourse: Record<string, { title: string; enrollments: number; avgSum: number; count: number; }> = {};
        courses.forEach((c:any) => byCourse[c.id] = { title: c.title, enrollments: 0, avgSum: 0, count: 0 });
        for (const e of enrollments as any[]) {
          if (!byCourse[e.course_id]) continue;
          byCourse[e.course_id].enrollments += 1;
          if (typeof e.progress_percentage === 'number') {
            byCourse[e.course_id].avgSum += e.progress_percentage;
            byCourse[e.course_id].count += 1;
          }
        }
        const stats: CourseStat[] = Object.entries(byCourse).map(([id, v]) => ({
          id,
          title: v.title,
          enrollments: v.enrollments,
          avgCompletion: v.count ? Math.round(v.avgSum / v.count) : 0,
        }));
        stats.sort((a,b)=>b.enrollments-a.enrollments);
        setCourseStats(stats);
        setRecentProjects(projects as any);
      } catch (e) {
        console.error('Error loading analytics:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const top5 = courseStats.slice(0,5);

  return (
    <LMSLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">Key platform metrics</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader><CardTitle>Active Students</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold">{loading ? '—' : activeStudents}</div></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Total Students</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold">{loading ? '—' : totalStudents}</div></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Completed Courses</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold">{loading ? '—' : completedCourses}</div></CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Top 5 Courses by Enrollments</CardTitle></CardHeader>
            <CardContent>
              {loading ? '—' : (
                <ul className="space-y-2">
                  {top5.map(c => (
                    <li key={c.id} className="flex justify-between"><span>{c.title}</span><span>{c.enrollments}</span></li>
                  ))}
                  {top5.length === 0 && <div className="text-muted-foreground">No enrollments yet.</div>}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Average Completion by Course</CardTitle></CardHeader>
            <CardContent>
              {loading ? '—' : (
                <ul className="space-y-2">
                  {courseStats.map(c => (
                    <li key={c.id} className="flex justify-between"><span>{c.title}</span><span>{c.avgCompletion}%</span></li>
                  ))}
                  {courseStats.length === 0 && <div className="text-muted-foreground">No data available.</div>}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Recent Project Submissions</CardTitle></CardHeader>
          <CardContent>
            {loading ? '—' : (
              <ul className="space-y-2">
                {recentProjects.map(p => (
                  <li key={p.id} className="flex justify-between"><span>{p.title}</span><span>{new Date(p.submitted_at).toLocaleString()}</span></li>
                ))}
                {recentProjects.length === 0 && <div className="text-muted-foreground">No recent submissions.</div>}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </LMSLayout>
  );
}
