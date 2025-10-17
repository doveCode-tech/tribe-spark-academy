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
import { FileText, Send, Check, X, Eye, Plus, Download, Edit } from "lucide-react";
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
  grade?: number;
  attachments?: Array<{ name: string; path: string }>;
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
    course_id: 'none',
    grade: '',
  });
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [reviewComments, setReviewComments] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'submitted' | 'approved' | 'rejected'>('all');
  const [editingReport, setEditingReport] = useState<Report | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editedContent, setEditedContent] = useState({
    title: '',
    content: '',
    grade: '',
  });

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
      // Get students who require reports (report_required = true)
      const { data: allStudents, error: studentsError } = await supabase
        .from('users')
        .select('auth_user_id, first_name, last_name, name, email, report_required')
        .eq('role', 'student')
        .eq('report_required', true);

      if (studentsError) throw studentsError;

      setStudents(allStudents || []);
    } catch (error) {
      console.error('Error loading students:', error);
    }
  };

  const resetReportingCycle = async () => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ report_required: true })
        .eq('role', 'student');

      if (error) throw error;

      toast({
        title: "Reporting Cycle Reset",
        description: "All students have been marked as requiring reports.",
      });

      loadStudents();
    } catch (error: any) {
      console.error('Error resetting reporting cycle:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to reset reporting cycle.",
        variant: "destructive",
      });
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
      if (!newReport.title || !newReport.content || !newReport.student_id) {
        toast({
          title: "Validation Error",
          description: "Please select a student and fill in title and content.",
          variant: "destructive",
        });
        return;
      }

      setUploading(true);

      const reportData = {
        title: newReport.title,
        content: newReport.content,
        student_id: newReport.student_id,
        course_id: newReport.course_id === 'none' ? null : newReport.course_id,
        grade: newReport.grade ? parseInt(newReport.grade) : null,
        tutor_id: userProfile?.auth_user_id,
        status: 'draft'
      };

      const { data: createdReport, error: createError } = await supabase
        .from('reports')
        .insert(reportData)
        .select('id')
        .single();

      if (createError) throw createError;

      // Create audit log for report creation
      await supabase.from('audit_logs').insert({
        action_type: 'report_created',
        performed_by: userProfile?.auth_user_id,
        target_id: createdReport.id,
        target_type: 'report',
        status: 'success',
        details: {
          report_title: newReport.title,
          student_id: newReport.student_id,
          course_id: newReport.course_id === 'none' ? null : newReport.course_id,
        },
      });

      // Upload attachments if any
      const attachments = await uploadAttachments(createdReport.id);

      // Update report with attachments
      if (attachments.length > 0) {
        const { error: updateError } = await supabase
          .from('reports')
          .update({ attachments })
          .eq('id', createdReport.id);

        if (updateError) throw updateError;
      }

      toast({
        title: "Report Created",
        description: "Your report has been saved as a draft.",
      });

      setNewReport({ title: '', content: '', student_id: '', course_id: 'none', grade: '' });
      setUploadedFiles([]);
      setIsReportDialogOpen(false);
      loadReports();
    } catch (error: any) {
      console.error('Error creating report:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create report.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const uploadAttachments = async (reportId: string) => {
    if (uploadedFiles.length === 0) return [];

    const attachments: Array<{ name: string; path: string }> = [];

    for (const file of uploadedFiles) {
      const fileName = `${reportId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('report-attachments')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      attachments.push({
        name: file.name,
        path: fileName,
      });
    }

    return attachments;
  };

  const createAndSubmitReport = async () => {
    try {
      if (!newReport.title || !newReport.content || !newReport.student_id) {
        toast({
          title: "Validation Error",
          description: "Please select a student and fill in title and content.",
          variant: "destructive",
        });
        return;
      }

      setUploading(true);

      // Create report first
      const reportData = {
        title: newReport.title,
        content: newReport.content,
        student_id: newReport.student_id,
        course_id: newReport.course_id === 'none' ? null : newReport.course_id,
        grade: newReport.grade ? parseInt(newReport.grade) : null,
        tutor_id: userProfile?.auth_user_id,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      };

      const { data: createdReport, error: createError } = await supabase
        .from('reports')
        .insert(reportData)
        .select('id, title')
        .single();

      if (createError) throw createError;

      // Create audit log for report creation and submission
      await supabase.from('audit_logs').insert({
        action_type: 'report_sent',
        performed_by: userProfile?.auth_user_id,
        target_id: createdReport.id,
        target_type: 'report',
        status: 'success',
        details: {
          report_title: newReport.title,
          student_id: newReport.student_id,
          course_id: newReport.course_id === 'none' ? null : newReport.course_id,
          submitted_to: 'admin',
        },
      });

      // Upload attachments if any
      const attachments = await uploadAttachments(createdReport.id);

      // Update report with attachments
      if (attachments.length > 0) {
        const { error: updateError } = await supabase
          .from('reports')
          .update({ attachments })
          .eq('id', createdReport.id);

        if (updateError) throw updateError;
      }

      // Get tutor name for notification
      const tutorName = userProfile?.first_name
        ? `${userProfile.first_name} ${userProfile.last_name || ''}`.trim()
        : userProfile?.name || 'A tutor';

      // Create notification for admin
      await supabase.from('notifications').insert({
        recipient_role: 'admin',
        type: 'report_submitted',
        title: 'New Report Submitted',
        message: `A new report "${createdReport.title}" has been submitted for review by ${tutorName}`,
        data: { report_id: createdReport.id }
      });

      toast({
        title: "Report Sent to Admin",
        description: "Your report has been submitted successfully.",
      });

      // Reset form and close dialog
      setNewReport({ title: '', content: '', student_id: '', course_id: 'none', grade: '' });
      setUploadedFiles([]);
      setIsReportDialogOpen(false);
      loadReports();
    } catch (error: any) {
      console.error('Error creating and submitting report:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send report to admin.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
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

      // Create audit log for report submission
      await supabase.from('audit_logs').insert({
        action_type: 'report_sent',
        performed_by: userProfile?.auth_user_id,
        target_id: reportId,
        target_type: 'report',
        status: 'success',
        details: {
          submitted_to: 'admin',
        },
      });

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
      // Validate rejection reason
      if (status === 'rejected' && !reviewComments.trim()) {
        toast({
          title: "Rejection Reason Required",
          description: "Please provide a reason for rejecting this report.",
          variant: "destructive",
        });
        return;
      }

      // Get report details for notification
      const report = reports.find(r => r.id === reportId);
      if (!report) throw new Error('Report not found');

      // Update report status
      const { error: updateError } = await supabase
        .from('reports')
        .update({
          status,
          reviewed_at: new Date().toISOString(),
          reviewed_by: userProfile?.auth_user_id,
          reviewer_comments: reviewComments
        })
        .eq('id', reportId);

      if (updateError) throw updateError;

      // Create audit log for report review
      await supabase.from('audit_logs').insert({
        action_type: status === 'approved' ? 'report_approved' : 'report_rejected',
        performed_by: userProfile?.auth_user_id,
        target_id: reportId,
        target_type: 'report',
        status: 'success',
        details: {
          report_title: report.title,
          tutor_id: report.tutor_id,
          student_id: report.student_id,
          reviewer_comments: reviewComments,
        },
      });

      // Get tutor details for notification
      const { data: tutorData, error: tutorError } = await supabase
        .from('users')
        .select('email, first_name, last_name, name')
        .eq('auth_user_id', report.tutor_id)
        .single();

      if (tutorError) throw tutorError;

      const tutorName = tutorData.first_name
        ? `${tutorData.first_name} ${tutorData.last_name || ''}`.trim()
        : tutorData.name || 'Tutor';

      // Create in-app notification for tutor
      await supabase.from('notifications').insert({
        recipient_user_id: report.tutor_id,
        type: `report_${status}`,
        title: `Report ${status === 'approved' ? 'Approved' : 'Rejected'}`,
        message: `Your report "${report.title}" has been ${status}${reviewComments ? ': ' + reviewComments : ''}`,
        data: { report_id: reportId, status, reviewer_comments: reviewComments }
      });

      // Send email notification to tutor
      if (tutorData.email) {
        try {
          await supabase.functions.invoke('send-tutor-notification', {
            body: {
              tutorEmail: tutorData.email,
              tutorName,
              reportTitle: report.title,
              status,
              reviewerComments: reviewComments,
              studentName: report.student_name
            }
          });

          // Log email send
          await supabase.from('audit_logs').insert({
            action_type: 'email_sent',
            performed_by: userProfile?.auth_user_id,
            target_id: reportId,
            target_type: 'report',
            status: 'success',
            details: {
              email_type: `report_${status}`,
              recipient_email: tutorData.email,
              report_title: report.title,
            },
          });
        } catch (emailError) {
          console.error('Error sending email notification:', emailError);
          
          // Log email failure
          await supabase.from('audit_logs').insert({
            action_type: 'email_sent',
            performed_by: userProfile?.auth_user_id,
            target_id: reportId,
            target_type: 'report',
            status: 'failed',
            error_message: emailError instanceof Error ? emailError.message : 'Unknown error',
            details: {
              email_type: `report_${status}`,
              recipient_email: tutorData.email,
            },
          });
          // Don't fail the whole operation if email fails
        }
      }

      toast({
        title: `Report ${status === 'approved' ? 'Approved' : 'Rejected'}`,
        description: `The report has been ${status} and the tutor has been notified.`,
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

  const sendReportToParent = async (reportId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      toast({
        title: "Sending Report",
        description: "Sending report to parent...",
      });

      const { data, error } = await supabase.functions.invoke('send-report-to-parent', {
        body: {
          reportId,
          adminId: user.id,
        },
      });

      if (error) throw error;

      if (!data.success) {
        toast({
          title: "Error",
          description: data.error || "Failed to send report to parent.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Report Sent",
        description: data.message || "Report successfully sent to parent!",
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

  const openEditDialog = (report: Report) => {
    setEditingReport(report);
    setEditedContent({
      title: report.title,
      content: report.content,
      grade: report.grade?.toString() || '',
    });
    setIsEditDialogOpen(true);
  };

  const resubmitReport = async () => {
    if (!editingReport) return;

    try {
      if (!editedContent.title || !editedContent.content) {
        toast({
          title: "Validation Error",
          description: "Please fill in title and content.",
          variant: "destructive",
        });
        return;
      }

      setUploading(true);

      // Update report with new content and set status to submitted
      const { error: updateError } = await supabase
        .from('reports')
        .update({
          title: editedContent.title,
          content: editedContent.content,
          grade: editedContent.grade ? parseInt(editedContent.grade) : null,
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          reviewer_comments: null,
          reviewed_at: null,
          reviewed_by: null,
        })
        .eq('id', editingReport.id);

      if (updateError) throw updateError;

      // Create audit log for resubmission
      await supabase.from('audit_logs').insert({
        action_type: 'report_sent',
        performed_by: userProfile?.auth_user_id,
        target_id: editingReport.id,
        target_type: 'report',
        status: 'success',
        details: {
          report_title: editedContent.title,
          student_id: editingReport.student_id,
          resubmission: true,
          previous_status: 'rejected',
        },
      });

      // Get tutor name for notification
      const tutorName = userProfile?.first_name
        ? `${userProfile.first_name} ${userProfile.last_name || ''}`.trim()
        : userProfile?.name || 'A tutor';

      // Notify admin about resubmission
      await supabase.from('notifications').insert({
        recipient_role: 'admin',
        type: 'report_submitted',
        title: 'Report Resubmitted',
        message: `Report "${editedContent.title}" has been edited and resubmitted for review by ${tutorName}`,
        data: { 
          report_id: editingReport.id,
          resubmission: true 
        }
      });

      toast({
        title: "Report Resubmitted",
        description: "Your report has been resubmitted for review.",
      });

      setIsEditDialogOpen(false);
      setEditingReport(null);
      setEditedContent({ title: '', content: '', grade: '' });
      loadReports();
    } catch (error: any) {
      console.error('Error resubmitting report:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to resubmit report.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
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

  const filteredReports = statusFilter === 'all' 
    ? reports 
    : reports.filter(report => report.status === statusFilter);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Report Management</h2>
        <div className="flex gap-2">
          {isAdmin && (
            <Button
              variant="outline"
              onClick={resetReportingCycle}
            >
              <FileText className="w-4 h-4 mr-2" />
              Reset Reporting Cycle
            </Button>
          )}
          {canWrite && (
            <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  New Report
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Report</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="student">Student *</Label>
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
                    value={newReport.course_id}
                    onValueChange={(value) => setNewReport(prev => ({ ...prev, course_id: value }))}
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
                  <Label htmlFor="title">Report Title *</Label>
                  <Input
                    id="title"
                    value={newReport.title}
                    onChange={(e) => setNewReport(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter report title"
                  />
                </div>

                <div>
                  <Label htmlFor="content">Report Content *</Label>
                  <Textarea
                    id="content"
                    value={newReport.content}
                    onChange={(e) => setNewReport(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="Write your report here..."
                    rows={8}
                  />
                </div>

                <div>
                  <Label htmlFor="grade">Grade (Optional)</Label>
                  <Input
                    id="grade"
                    type="number"
                    min="0"
                    max="100"
                    value={newReport.grade}
                    onChange={(e) => setNewReport(prev => ({ ...prev, grade: e.target.value }))}
                    placeholder="Enter grade (0-100)"
                  />
                </div>

                <div>
                  <Label htmlFor="attachments">Attachments (Optional)</Label>
                  <Input
                    id="attachments"
                    type="file"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setUploadedFiles(files);
                    }}
                  />
                  {uploadedFiles.length > 0 && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {uploadedFiles.length} file(s) selected
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setNewReport({ title: '', content: '', student_id: '', course_id: 'none', grade: '' })}
                  >
                    Clear
                  </Button>
                  <Button
                    onClick={createReport}
                    disabled={uploading || !newReport.title || !newReport.content || !newReport.student_id}
                  >
                    Save Draft
                  </Button>
                  <Button
                    onClick={createAndSubmitReport}
                    disabled={uploading || !newReport.title || !newReport.content || !newReport.student_id}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Send to Admin
                  </Button>
                </div>
              </div>
            </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Status Filter Tabs */}
      {canReview && (
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('all')}
          >
            All ({reports.length})
          </Button>
          <Button
            variant={statusFilter === 'submitted' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('submitted')}
            className={statusFilter === 'submitted' ? '' : 'border-blue-200 text-blue-700 hover:bg-blue-50'}
          >
            Pending ({reports.filter(r => r.status === 'submitted').length})
          </Button>
          <Button
            variant={statusFilter === 'approved' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('approved')}
            className={statusFilter === 'approved' ? '' : 'border-green-200 text-green-700 hover:bg-green-50'}
          >
            Approved ({reports.filter(r => r.status === 'approved').length})
          </Button>
          <Button
            variant={statusFilter === 'rejected' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('rejected')}
            className={statusFilter === 'rejected' ? '' : 'border-red-200 text-red-700 hover:bg-red-50'}
          >
            Rejected ({reports.filter(r => r.status === 'rejected').length})
          </Button>
          <Button
            variant={statusFilter === 'draft' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('draft')}
            className={statusFilter === 'draft' ? '' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}
          >
            Draft ({reports.filter(r => r.status === 'draft').length})
          </Button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredReports.map((report) => (
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
                    {report.grade !== null && report.grade !== undefined && (
                      <p className="text-sm text-muted-foreground mb-2">
                        Grade: {report.grade}%
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
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="font-medium">Student:</span> {report.student_name}
                            </div>
                            <div>
                              <span className="font-medium">Tutor:</span> {report.tutor_name}
                            </div>
                            {report.course_title && (
                              <div>
                                <span className="font-medium">Course:</span> {report.course_title}
                              </div>
                            )}
                            {report.grade !== null && report.grade !== undefined && (
                              <div>
                                <span className="font-medium">Grade:</span> {report.grade}%
                              </div>
                            )}
                          </div>

                          <div className="bg-muted p-4 rounded">
                            <pre className="whitespace-pre-wrap font-sans text-sm">
                              {report.content}
                            </pre>
                          </div>

                          {report.attachments && report.attachments.length > 0 && (
                            <div>
                              <Label className="mb-2 block">Attachments</Label>
                              <div className="space-y-2">
                                {report.attachments.map((attachment, index) => (
                                  <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                                    <span className="text-sm">{attachment.name}</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={async () => {
                                        try {
                                          const { data, error } = await supabase.storage
                                            .from('report-attachments')
                                            .download(attachment.path);
                                          
                                          if (error) throw error;
                                          
                                          const url = URL.createObjectURL(data);
                                          const a = document.createElement('a');
                                          a.href = url;
                                          a.download = attachment.name;
                                          a.click();
                                          URL.revokeObjectURL(url);
                                        } catch (error) {
                                          console.error('Error downloading file:', error);
                                          toast({
                                            title: "Error",
                                            description: "Failed to download file",
                                            variant: "destructive",
                                          });
                                        }
                                      }}
                                    >
                                      <Download className="w-4 h-4" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
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
                        onClick={() => sendReportToParent(report.id)}
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Send to Parent
                      </Button>
                    )}

                    {report.status === 'rejected' && report.tutor_id === userProfile?.auth_user_id && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(report)}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit & Resubmit
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredReports.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {statusFilter === 'all' ? 'No reports found' : `No ${statusFilter} reports found`}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Edit & Resubmit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit & Resubmit Report</DialogTitle>
          </DialogHeader>
          
          {editingReport && (
            <div className="space-y-4">
              {/* Show rejection reason */}
              {editingReport.reviewer_comments && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <X className="w-5 h-5 text-destructive mt-0.5" />
                    <div>
                      <p className="font-medium text-destructive">Rejection Reason:</p>
                      <p className="text-sm mt-1">{editingReport.reviewer_comments}</p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="edit-title">Report Title *</Label>
                <Input
                  id="edit-title"
                  value={editedContent.title}
                  onChange={(e) => setEditedContent(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter report title"
                />
              </div>

              <div>
                <Label htmlFor="edit-content">Report Content *</Label>
                <Textarea
                  id="edit-content"
                  value={editedContent.content}
                  onChange={(e) => setEditedContent(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Write your report here..."
                  rows={12}
                />
              </div>

              <div>
                <Label htmlFor="edit-grade">Grade (Optional)</Label>
                <Input
                  id="edit-grade"
                  type="number"
                  min="0"
                  max="100"
                  value={editedContent.grade}
                  onChange={(e) => setEditedContent(prev => ({ ...prev, grade: e.target.value }))}
                  placeholder="Enter grade (0-100)"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setEditingReport(null);
                    setEditedContent({ title: '', content: '', grade: '' });
                  }}
                  disabled={uploading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={resubmitReport}
                  disabled={uploading || !editedContent.title || !editedContent.content}
                >
                  <Send className="w-4 h-4 mr-2" />
                  {uploading ? 'Resubmitting...' : 'Resubmit to Admin'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}