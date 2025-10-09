import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Send, Check, X, Eye, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Report {
  id: string;
  title: string;
  content: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  student_id: string;
  tutor_id: string;
  course_id?: string;
  submitted_at?: string;
  reviewed_at?: string;
  reviewed_by?: string;
  reviewer_comments?: string;
  created_at: string;
  student_name?: string;
  tutor_name?: string;
  course_title?: string;
}

interface Student {
  auth_user_id: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  email: string;
}

interface Course {
  id: string;
  title: string;
}

export function ReportManagement() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [reports, setReports] = useState<Report[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [newReport, setNewReport] = useState({
    title: '',
    content: '',
    student_id: '',
    course_id: ''
  });
  const [reviewComments, setReviewComments] = useState('');

  const isAdmin = userProfile?.role === 'admin';
  const isUltimateTutor = userProfile?.role === 'ultimate_tutor';
  const isTutor = userProfile?.role === 'tutor';
  const canReview = isAdmin || isUltimateTutor;
  const canWrite = isTutor || isUltimateTutor || isAdmin;

  useEffect(() => {
    if (userProfile) {
      loadReports();
      if (canWrite) {
        loadStudents();
        loadCourses();
      }
    }
  }, [userProfile]);

  const loadReports = async () => {
    try {
      let query = supabase.from('reports').select('*');

      if (isTutor && !isUltimateTutor && !isAdmin) {
        // Basic tutor can only see their own reports
        query = query.eq('tutor_id', userProfile?.auth_user_id);
      }

      const { data: reportsData, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      const repList = reportsData || [];

      const studentIds = Array.from(new Set(repList.map((r: any) => r.student_id).filter(Boolean)));
      const tutorIds = Array.from(new Set(repList.map((r: any) => r.tutor_id).filter(Boolean)));
      const userIds = Array.from(new Set([...studentIds, ...tutorIds]));
      const courseIds = Array.from(new Set(repList.map((r: any) => r.course_id).filter(Boolean)));

      const [usersRes, coursesRes] = await Promise.all([
        userIds.length
          ? supabase
              .from('users')
              .select('auth_user_id, first_name, last_name, name, email')
              .in('auth_user_id', userIds)
          : Promise.resolve({ data: [], error: null }),
        courseIds.length
          ? supabase.from('courses').select('id, title').in('id', courseIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (usersRes.error) throw usersRes.error;
      if (coursesRes.error) throw coursesRes.error;

      const usersMap = new Map((usersRes.data || []).map((u: any) => [u.auth_user_id, u]));
      const coursesMap = new Map((coursesRes.data || []).map((c: any) => [c.id, c]));

      const formattedReports = repList.map((report: any) => {
        const student = usersMap.get(report.student_id);
        const tutor = usersMap.get(report.tutor_id);
        const course = report.course_id ? coursesMap.get(report.course_id) : null;
        return {
          ...report,
          status: report.status as 'draft' | 'submitted' | 'approved' | 'rejected',
          student_name: student?.first_name
            ? `${student.first_name} ${student.last_name}`.trim()
            : student?.name || student?.email || 'Unknown',
          tutor_name: tutor?.first_name
            ? `${tutor.first_name} ${tutor.last_name}`.trim()
            : tutor?.name || tutor?.email || 'Unknown',
          course_title: course?.title,
        };
      });

      setReports(formattedReports);
    } catch (error) {
      console.error('Error loading reports:', error);
      toast({
        title: "Error",
        description: "Failed to load reports.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('auth_user_id, first_name, last_name, name, email')
        .eq('role', 'student');

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('Error loading students:', error);
    }
  };

  const loadCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('id, title')
        .order('title');

      if (error) throw error;
      setCourses(data || []);
    } catch (error) {
      console.error('Error loading courses:', error);
    }
  };

  const createReport = async () => {
    try {
      const { error } = await supabase
        .from('reports')
        .insert({
          ...newReport,
          tutor_id: userProfile?.auth_user_id,
          status: 'draft'
        });

      if (error) throw error;

      toast({
        title: "Report Created",
        description: "Your report has been saved as a draft.",
      });

      setNewReport({ title: '', content: '', student_id: '', course_id: '' });
      loadReports();
    } catch (error: any) {
      console.error('Error creating report:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create report.",
        variant: "destructive",
      });
    }
  };

  const submitReport = async (reportId: string) => {
    try {
      const { error } = await supabase
        .from('reports')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString()
        })
        .eq('id', reportId);

      if (error) throw error;

      // Notify admin about new report submission
      const report = reports.find(r => r.id === reportId);
      if (report) {
        await supabase.from('notifications').insert({
          recipient_role: 'admin',
          type: 'report_submitted',
          title: 'New Report Submitted',
          message: `A new report "${report.title}" has been submitted for review by ${report.tutor_name}`,
          data: { report_id: reportId }
        });
      }

      toast({
        title: "Report Sent to Admin",
        description: "Your report has been sent to admin for review.",
      });

      loadReports();
    } catch (error: any) {
      console.error('Error submitting report:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit report.",
        variant: "destructive",
      });
    }
  };

  const reviewReport = async (reportId: string, status: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('reports')
        .update({
          status,
          reviewed_at: new Date().toISOString(),
          reviewed_by: userProfile?.auth_user_id,
          reviewer_comments: reviewComments
        })
        .eq('id', reportId);

      if (error) throw error;

      toast({
        title: `Report ${status}`,
        description: `The report has been ${status}.`,
      });

      setSelectedReport(null);
      setReviewComments('');
      loadReports();
    } catch (error: any) {
      console.error('Error reviewing report:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to review report.",
        variant: "destructive",
      });
    }
  };

  const sendReportToParent = async (report: Report) => {
    try {
      // Get student details including parent email
      const { data: studentData, error: studentError } = await supabase
        .from('users')
        .select('email, first_name, last_name, name')
        .eq('auth_user_id', report.student_id)
        .single();

      if (studentError) throw studentError;

      if (!studentData?.email) {
        throw new Error('Student email not found');
      }

      // Get tutor name
      const { data: tutorData } = await supabase
        .from('users')
        .select('first_name, last_name, name')
        .eq('auth_user_id', report.tutor_id)
        .single();

      const studentName = studentData.first_name
        ? `${studentData.first_name} ${studentData.last_name || ''}`.trim()
        : studentData.name || studentData.email;

      const tutorName = tutorData?.first_name
        ? `${tutorData.first_name} ${tutorData.last_name || ''}`.trim()
        : tutorData?.name || 'Your Tutor';

      // Send email via edge function
      const { data, error } = await supabase.functions.invoke('send-report-email', {
        body: {
          reportId: report.id,
          parentEmail: studentData.email,
          studentName,
          reportTitle: report.title,
          reportContent: report.content,
          tutorName,
          courseName: report.course_title || undefined
        }
      });

      if (error) throw error;

      toast({
        title: "Report Sent",
        description: `Report has been sent to ${studentData.email}`,
      });
    } catch (error: any) {
      console.error('Error sending report to parent:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send report to parent.",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-muted text-muted-foreground';
      case 'submitted': return 'bg-blue-100 text-blue-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Report Management</h2>
        {canWrite && (
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Report
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Report</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="student">Student</Label>
                  <Select
                    value={newReport.student_id}
                    onValueChange={(value) => setNewReport(prev => ({ ...prev, student_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select student" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((student) => (
                        <SelectItem key={student.auth_user_id} value={student.auth_user_id}>
                          {student.first_name 
                            ? `${student.first_name} ${student.last_name}`.trim()
                            : student.name || student.email
                          }
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="course">Course (Optional)</Label>
                  <Select
                    value={newReport.course_id || 'none'}
                    onValueChange={(value) => setNewReport(prev => ({ ...prev, course_id: value === 'none' ? '' : value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select course" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No specific course</SelectItem>
                      {courses.map((course) => (
                        <SelectItem key={course.id} value={course.id}>
                          {course.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="title">Report Title</Label>
                  <Input
                    id="title"
                    value={newReport.title}
                    onChange={(e) => setNewReport(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter report title"
                  />
                </div>

                <div>
                  <Label htmlFor="content">Report Content</Label>
                  <Textarea
                    id="content"
                    value={newReport.content}
                    onChange={(e) => setNewReport(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="Write your report here..."
                    rows={8}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setNewReport({ title: '', content: '', student_id: '', course_id: '' })}
                  >
                    Clear
                  </Button>
                  <Button
                    onClick={createReport}
                    disabled={!newReport.title || !newReport.content || !newReport.student_id}
                  >
                    Save Draft
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        </div>
      ) : (
        <div className="grid gap-4">
          {reports.map((report) => (
            <Card key={report.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{report.title}</h3>
                      <Badge className={getStatusColor(report.status)}>
                        {report.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Student: {report.student_name}
                    </p>
                    <p className="text-sm text-muted-foreground mb-2">
                      Tutor: {report.tutor_name}
                    </p>
                    {report.course_title && (
                      <p className="text-sm text-muted-foreground mb-2">
                        Course: {report.course_title}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Created: {new Date(report.created_at).toLocaleDateString()}
                    </p>
                    {report.reviewer_comments && (
                      <div className="mt-2 p-2 bg-muted rounded">
                        <p className="text-sm font-medium">Reviewer Comments:</p>
                        <p className="text-sm">{report.reviewer_comments}</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Eye className="w-4 h-4 mr-2" />
                          View
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>{report.title}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="bg-muted p-4 rounded">
                            <pre className="whitespace-pre-wrap font-sans text-sm">
                              {report.content}
                            </pre>
                          </div>
                          
                          {canReview && report.status === 'submitted' && (
                            <div className="space-y-4 border-t pt-4">
                              <div>
                                <Label htmlFor="review-comments">Review Comments</Label>
                                <Textarea
                                  id="review-comments"
                                  value={reviewComments}
                                  onChange={(e) => setReviewComments(e.target.value)}
                                  placeholder="Add your review comments..."
                                  rows={4}
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="default"
                                  onClick={() => reviewReport(report.id, 'approved')}
                                >
                                  <Check className="w-4 h-4 mr-2" />
                                  Approve
                                </Button>
                                <Button
                                  variant="destructive"
                                  onClick={() => reviewReport(report.id, 'rejected')}
                                >
                                  <X className="w-4 h-4 mr-2" />
                                  Reject
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>

                    {report.status === 'draft' && (report.tutor_id === userProfile?.auth_user_id || canReview) && (
                      <Button
                        size="sm"
                        onClick={() => submitReport(report.id)}
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Send to Admin
                      </Button>
                    )}

                    {report.status === 'approved' && canReview && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => sendReportToParent(report)}
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Send to Parent
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {reports.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No reports found</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}