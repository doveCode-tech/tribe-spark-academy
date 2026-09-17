import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Award, Calendar, User, Eye, Download, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getDualIdArray } from "@/utils/identity";

interface StudentReport {
  id: string;
  title: string;
  content: string;
  status: string;
  grade?: number;
  reviewed_at?: string;
  created_at: string;
  reviewer_comments?: string;
  attachments?: Array<{ name: string; path: string }>;
  tutor_name?: string;
  course_title?: string;
}

export function StudentReportsView() {
  const { userProfile } = useAuth();
  const [reports, setReports] = useState<StudentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<StudentReport | null>(null);

  useEffect(() => {
    fetchStudentReports();
  }, [userProfile]);

  const fetchStudentReports = async () => {
    try {
      setLoading(true);
      const studentIds = getDualIdArray(userProfile);
      if (studentIds.length === 0) return;

      const { data: reportsData, error } = await supabase
        .from('reports')
        .select('*')
        .in('student_id', studentIds)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const list = reportsData || [];
      const tutorIds = Array.from(new Set(list.map((r: any) => r.tutor_id).filter(Boolean)));
      const courseIds = Array.from(new Set(list.map((r: any) => r.course_id).filter(Boolean)));

      const [tutorsRes, coursesRes] = await Promise.all([
        tutorIds.length
          ? supabase.from('users').select('auth_user_id, name, first_name, last_name, email').in('auth_user_id', tutorIds)
          : Promise.resolve({ data: [] }),
        courseIds.length
          ? supabase.from('courses').select('id, title').in('id', courseIds)
          : Promise.resolve({ data: [] })
      ]);

      const tutorsMap = new Map((tutorsRes.data || []).map((t: any) => [
        t.auth_user_id,
        t.first_name ? `${t.first_name} ${t.last_name || ''}`.trim() : t.name || 'Tutor'
      ]));
      const coursesMap = new Map((coursesRes.data || []).map((c: any) => [c.id, c.title]));

      const enriched: StudentReport[] = list.map((r: any) => ({
        ...r,
        tutor_name: tutorsMap.get(r.tutor_id) || 'Tutor',
        course_title: coursesMap.get(r.course_id) || 'General Progress'
      }));

      setReports(enriched);
    } catch (err) {
      console.error('Error fetching student reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const grades = reports.map(r => r.grade).filter((g): g is number => typeof g === 'number');
  const avgGrade = grades.length ? Math.round(grades.reduce((a, b) => a + b, 0) / grades.length) : null;

  if (loading) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
        <p>Loading your progress reports...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-primary to-purple-800 rounded-xl p-6 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Your Progress Reports</h1>
            <p className="text-purple-200 text-sm mt-1">
              Feedback, evaluations, and academic milestones from your tutors
            </p>
          </div>
          <div className="flex items-center gap-6 bg-white/10 px-5 py-3 rounded-lg backdrop-blur-sm">
            <div className="text-center">
              <div className="text-3xl font-extrabold">{reports.length}</div>
              <div className="text-xs text-purple-200">Total Reports</div>
            </div>
            {avgGrade !== null && (
              <>
                <div className="h-8 w-px bg-white/20" />
                <div className="text-center">
                  <div className="text-3xl font-extrabold text-yellow-300">{avgGrade}%</div>
                  <div className="text-xs text-purple-200">Avg Score</div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Reports Listing */}
      {reports.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="py-16 text-center text-muted-foreground space-y-3">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground/40" />
            <h3 className="font-semibold text-lg text-foreground">No reports available yet</h3>
            <p className="text-sm max-w-md mx-auto">
              Your tutors will publish learning reports and term evaluations here as you complete course milestones.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {reports.map((report) => (
            <Card key={report.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg font-bold">{report.title}</CardTitle>
                    <CardDescription className="flex items-center gap-1.5 mt-1">
                      <BookOpen className="w-3.5 h-3.5 text-primary" />
                      <span>{report.course_title}</span>
                    </CardDescription>
                  </div>
                  {typeof report.grade === 'number' && (
                    <Badge variant="secondary" className="text-sm font-semibold bg-primary/10 text-primary border-primary/20">
                      Score: {report.grade}%
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {report.content.replace(/<[^>]*>?/gm, '')}
                </p>

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t">
                  <div className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    <span>Tutor: {report.tutor_name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{new Date(report.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1 text-xs"
                  onClick={() => setSelectedReport(report)}
                >
                  <Eye className="w-3.5 h-3.5" /> View Full Report
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View Report Dialog */}
      {selectedReport && (
        <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">{selectedReport.title}</DialogTitle>
              <div className="flex items-center gap-3 text-sm text-muted-foreground pt-1">
                <span>Course: {selectedReport.course_title}</span>
                <span>•</span>
                <span>Tutor: {selectedReport.tutor_name}</span>
                {typeof selectedReport.grade === 'number' && (
                  <>
                    <span>•</span>
                    <Badge className="bg-primary text-white">Score: {selectedReport.grade}%</Badge>
                  </>
                )}
              </div>
            </DialogHeader>

            <div className="space-y-4 my-4">
              <div className="bg-muted/30 p-4 rounded-lg border text-sm leading-relaxed whitespace-pre-wrap">
                {selectedReport.content}
              </div>

              {selectedReport.reviewer_comments && (
                <div className="bg-purple-50 dark:bg-purple-950/40 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                  <h4 className="font-semibold text-xs text-purple-900 dark:text-purple-300 uppercase tracking-wider mb-1">
                    Academic Reviewer Notes
                  </h4>
                  <p className="text-sm text-purple-950 dark:text-purple-200">
                    {selectedReport.reviewer_comments}
                  </p>
                </div>
              )}

              {selectedReport.attachments && selectedReport.attachments.length > 0 && (
                <div className="pt-2">
                  <h4 className="font-semibold text-sm mb-2">Attachments</h4>
                  <div className="space-y-1">
                    {selectedReport.attachments.map((file, idx) => (
                      <a
                        key={idx}
                        href={file.path}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 text-xs text-primary hover:underline"
                      >
                        <Download className="w-3.5 h-3.5" /> {file.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
