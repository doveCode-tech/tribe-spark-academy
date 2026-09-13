import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, FileText, Upload, X, Save, Mail, Award, Edit, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { StudentDetailDialog } from "@/components/StudentDetailDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Student {
  id: string;
  auth_user_id: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  email: string;
  phone?: string;
  city?: string;
  country?: string;
  last_access?: string;
  avatar_url?: string;
}

interface Course {
  id: string;
  title: string;
}

export function StudentsList() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [reportForm, setReportForm] = useState({
    title: '',
    content: '',
    course_id: 'none',
    grade: '',
  });
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploadedAttachments, setUploadedAttachments] = useState<Array<{ name: string; path: string }>>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
  const [existingReport, setExistingReport] = useState<any>(null);
  const [duplicateCheckLoading, setDuplicateCheckLoading] = useState(false);
  const [detailStudent, setDetailStudent] = useState<Student | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const isTutor = userProfile?.role === 'tutor' || userProfile?.role === 'ultimate_tutor';
  const isAdmin = userProfile?.role === 'admin';

  const sendPortfolioEmail = async (student: Student) => {
    try {
      toast({
        title: "Sending Portfolio",
        description: "Generating and sending portfolio PDF...",
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke('send-portfolio-email', {
        body: {
          studentId: student.auth_user_id,
          adminId: user.id,
        },
      });

      if (error) throw error;

      if (!data.success) {
        toast({
          title: "Error",
          description: data.error || "Failed to send portfolio.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Portfolio Sent",
        description: data.message || "Portfolio PDF successfully sent to parent!",
      });
    } catch (error: any) {
      console.error('Error sending portfolio:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send portfolio.",
        variant: "destructive",
      });
    }
  };

  const sendCertificateEmail = async (student: Student) => {
    try {
      // First, fetch student's certificates
      const { data: certificates, error: certError } = await supabase
        .from('certificates')
        .select('id, course_title, completion_date')
        .eq('student_id', student.auth_user_id)
        .order('completion_date', { ascending: false });

      if (certError) throw certError;

      if (!certificates || certificates.length === 0) {
        toast({
          title: "No Certificates",
          description: "This student has no certificates yet.",
          variant: "destructive",
        });
        return;
      }

      // Use the most recent certificate
      const certificateId = certificates[0].id;

      toast({
        title: "Sending Certificate",
        description: "Generating and sending certificate PDF...",
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke('send-certificate-email', {
        body: {
          certificateId,
          adminId: user.id,
        },
      });

      if (error) throw error;

      if (!data.success) {
        toast({
          title: "Error",
          description: data.error || "Failed to send certificate.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Certificate Sent",
        description: data.message || "Certificate PDF successfully sent to parent!",
      });
    } catch (error: any) {
      console.error('Error sending certificate:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send certificate.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    loadStudents();
    loadCourses();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredStudents(students);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = students.filter(student => {
        const fullName = student.first_name 
          ? `${student.first_name} ${student.last_name || ''}`.toLowerCase()
          : (student.name || '').toLowerCase();
        const email = (student.email || '').toLowerCase();
        const username = (student.username || '').toLowerCase();
        const phone = (student.phone || '').toLowerCase();
        const city = (student.city || '').toLowerCase();

        return fullName.includes(query) || 
               email.includes(query) || 
               username.includes(query) ||
               phone.includes(query) ||
               city.includes(query);
      });
      setFilteredStudents(filtered);
    }
  }, [searchQuery, students]);

  const loadStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'student')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setStudents(data || []);
      setFilteredStudents(data || []);
    } catch (error) {
      console.error('Error loading students:', error);
      toast({
        title: "Error",
        description: "Failed to load students list.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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

  const loadEnrolledCourses = async (studentId: string) => {
    try {
      const { data, error } = await supabase
        .from('enrollments')
        .select('course_id, courses(id, title)')
        .eq('student_id', studentId)
        .eq('status', 'active');

      if (error) throw error;

      const enrolled = (data || [])
        .map(enrollment => enrollment.courses)
        .filter(Boolean) as Course[];
      
      setEnrolledCourses(enrolled);
    } catch (error) {
      console.error('Error loading enrolled courses:', error);
    }
  };

  const checkForDuplicateReport = async (studentId: string, courseId: string) => {
    if (courseId === 'none') {
      setExistingReport(null);
      return;
    }

    setDuplicateCheckLoading(true);
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('student_id', studentId)
        .eq('course_id', courseId)
        .eq('tutor_id', userProfile?.auth_user_id)
        .in('status', ['pending_review', 'approved'])
        .maybeSingle();

      if (error) throw error;

      setExistingReport(data || null);
    } catch (error) {
      console.error('Error checking for duplicate report:', error);
      setExistingReport(null);
    } finally {
      setDuplicateCheckLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setAttachments(prev => [...prev, ...newFiles]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const uploadAttachments = async () => {
    if (attachments.length === 0) return [];

    setIsUploading(true);
    const uploaded: Array<{ name: string; path: string }> = [];

    try {
      for (const file of attachments) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${userProfile?.auth_user_id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('report-attachments')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        uploaded.push({ name: file.name, path: filePath });
      }

      setUploadedAttachments(uploaded);
      return uploaded;
    } catch (error) {
      console.error('Error uploading files:', error);
      toast({
        title: "Upload Error",
        description: "Failed to upload some attachments.",
        variant: "destructive",
      });
      return [];
    } finally {
      setIsUploading(false);
    }
  };

  const saveReport = async (sendToAdmin: boolean = false) => {
    try {
      if (!reportForm.title || !reportForm.content || !selectedStudent) {
        toast({
          title: "Validation Error",
          description: "Please fill in title and content.",
          variant: "destructive",
        });
        return;
      }

      if (reportForm.course_id === 'none') {
        toast({
          title: "Course Required",
          description: "Please select a course for this report.",
          variant: "destructive",
        });
        return;
      }

      if (existingReport) {
        toast({
          title: "Duplicate Report",
          description: "An active report already exists for this student and course.",
          variant: "destructive",
        });
        return;
      }

      setIsSaving(true);

      // Upload attachments if any
      const uploadedFiles = await uploadAttachments();

      const reportData = {
        title: reportForm.title,
        content: reportForm.content,
        student_id: selectedStudent.auth_user_id,
        course_id: reportForm.course_id === 'none' ? null : reportForm.course_id,
        tutor_id: userProfile?.auth_user_id,
        grade: reportForm.grade ? parseInt(reportForm.grade) : null,
        attachments: uploadedFiles.length > 0 ? uploadedFiles : null,
        status: sendToAdmin ? 'submitted' : 'draft',
        submitted_at: sendToAdmin ? new Date().toISOString() : null
      };

      const { data, error } = await supabase
        .from('reports')
        .insert(reportData)
        .select('id')
        .single();

      if (error) throw error;

      // Notify admin if sending for review
      if (sendToAdmin) {
        await supabase.from('notifications').insert({
          recipient_role: 'admin',
          type: 'report_submitted',
          title: 'New Report Submitted',
          message: `A new report "${reportForm.title}" has been submitted for review`,
          data: { report_id: data.id }
        });
      }

      toast({
        title: sendToAdmin ? "Report Sent" : "Draft Saved",
        description: sendToAdmin 
          ? "Your report has been sent to admin for review." 
          : "Your report has been saved as a draft.",
      });

      // Reset form
      setReportForm({ title: '', content: '', course_id: 'none', grade: '' });
      setAttachments([]);
      setUploadedAttachments([]);
      setSelectedStudent(null);
      setEnrolledCourses([]);
      setExistingReport(null);
      setDialogOpen(false);
    } catch (error: any) {
      console.error('Error saving report:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save report.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getStudentDisplayName = (student: Student) => {
    if (student.first_name) {
      return `${student.first_name} ${student.last_name || ''}`.trim();
    }
    return student.name || student.email;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Students List</h2>
          <p className="text-muted-foreground">View and manage student reports</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, username, phone, or city..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Students List */}
      <Card>
        <CardHeader>
          <CardTitle>Students ({filteredStudents.length})</CardTitle>
          <CardDescription>
            {searchQuery ? `Showing ${filteredStudents.length} matching students` : `Total students: ${students.length}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredStudents.map((student) => (
              <div key={student.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                <div className="flex items-center gap-4 flex-1">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={student.avatar_url} alt={getStudentDisplayName(student)} />
                    <AvatarFallback>
                      {getStudentDisplayName(student).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1">
                    <h4 className="font-semibold text-base">
                      {getStudentDisplayName(student)}
                    </h4>
                    {student.username && (
                      <p className="text-sm text-muted-foreground">@{student.username}</p>
                    )}
                    <p className="text-sm text-muted-foreground">{student.email}</p>
                    
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                      {student.phone && (
                        <div className="flex items-center gap-1">
                          <span>📞</span>
                          <span>{student.phone}</span>
                        </div>
                      )}
                      {student.city && (
                        <div className="flex items-center gap-1">
                          <span>📍</span>
                          <span>{student.city}{student.country ? `, ${student.country}` : ''}</span>
                        </div>
                      )}
                      {student.last_access && (
                        <div className="flex items-center gap-1">
                          <span>🕒</span>
                          <span>Last seen: {new Date(student.last_access).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDetailStudent(student);
                      setDetailOpen(true);
                    }}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View Details
                  </Button>
                  {isTutor && (
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                       <DialogTrigger asChild>
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedStudent(student);
                            setReportForm({ title: '', content: '', course_id: 'none', grade: '' });
                            setEnrolledCourses([]);
                            setExistingReport(null);
                            setAttachments([]);
                            loadEnrolledCourses(student.auth_user_id);
                            setDialogOpen(true);
                          }}
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          Write Report
                        </Button>
                      </DialogTrigger>
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Create Report for {getStudentDisplayName(student)}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="course">Course *</Label>
                          <Select
                            value={reportForm.course_id}
                            onValueChange={(value) => {
                              setReportForm(prev => ({ ...prev, course_id: value }));
                              if (selectedStudent && value !== 'none') {
                                checkForDuplicateReport(selectedStudent.auth_user_id, value);
                              } else {
                                setExistingReport(null);
                              }
                            }}
                            disabled={enrolledCourses.length === 0}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={
                                enrolledCourses.length === 0
                                  ? "Student not enrolled in any courses"
                                  : "Select course"
                              } />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none" disabled>Select a course</SelectItem>
                              {enrolledCourses.map((course) => (
                                <SelectItem key={course.id} value={course.id}>
                                  {course.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {enrolledCourses.length === 0 && (
                            <p className="text-sm text-amber-600 mt-1">
                              This student is not enrolled in any courses. Please enroll them first.
                            </p>
                          )}
                        </div>

                        {duplicateCheckLoading && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                            Checking for existing reports...
                          </div>
                        )}

                        {existingReport && (
                          <div className="p-4 border border-amber-200 bg-amber-50 rounded-lg space-y-2">
                            <div className="flex items-start gap-2">
                              <div className="text-amber-600 mt-0.5">⚠️</div>
                              <div className="flex-1">
                                <p className="font-semibold text-amber-900">Active Report Already Exists</p>
                                <p className="text-sm text-amber-700 mt-1">
                                  You have an active {existingReport.status} report for this student and course: "{existingReport.title}"
                                </p>
                                <div className="flex gap-2 mt-3">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      navigate('/reports');
                                    }}
                                  >
                                    <Edit className="w-3 h-3 mr-1" />
                                    View in Reports Page
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setReportForm(prev => ({ ...prev, course_id: 'none' }));
                                      setExistingReport(null);
                                    }}
                                  >
                                    Select Different Course
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="grade">Grade (Optional)</Label>
                            <Input
                              id="grade"
                              type="number"
                              min="0"
                              max="100"
                              value={reportForm.grade}
                              onChange={(e) => setReportForm(prev => ({ ...prev, grade: e.target.value }))}
                              placeholder="Enter grade (0-100)"
                            />
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="title">Report Title *</Label>
                          <Input
                            id="title"
                            value={reportForm.title}
                            onChange={(e) => setReportForm(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="Enter report title"
                          />
                        </div>

                        <div>
                          <Label htmlFor="content">Report Body *</Label>
                          <Textarea
                            id="content"
                            value={reportForm.content}
                            onChange={(e) => setReportForm(prev => ({ ...prev, content: e.target.value }))}
                            placeholder="Write your detailed report here... You can include progress updates, observations, recommendations, and any relevant feedback about the student's performance."
                            rows={10}
                            className="resize-none"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            {reportForm.content.length} characters
                          </p>
                        </div>

                        <div>
                          <Label>Attachments (Optional)</Label>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                onChange={handleFileSelect}
                                className="hidden"
                                accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                              >
                                <Upload className="w-4 h-4 mr-2" />
                                Choose Files
                              </Button>
                              <span className="text-xs text-muted-foreground">
                                PDF, DOC, TXT, or images
                              </span>
                            </div>

                            {attachments.length > 0 && (
                              <div className="space-y-1">
                                {attachments.map((file, index) => (
                                  <div key={index} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                                    <span className="truncate">{file.name}</span>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeAttachment(index)}
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-4 border-t">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setReportForm({ title: '', content: '', course_id: 'none', grade: '' });
                              setAttachments([]);
                              setUploadedAttachments([]);
                              setSelectedStudent(null);
                              setDialogOpen(false);
                            }}
                            disabled={isSaving || isUploading}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => saveReport(false)}
                            disabled={!reportForm.title || !reportForm.content || isSaving || isUploading}
                          >
                            <Save className="w-4 h-4 mr-2" />
                            Save Draft
                          </Button>
                          <Button
                            onClick={() => saveReport(true)}
                            disabled={!reportForm.title || !reportForm.content || isSaving || isUploading}
                          >
                            <FileText className="w-4 h-4 mr-2" />
                            Send to Admin
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  )}

                  {isAdmin && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => sendPortfolioEmail(student)}
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        Send Portfolio
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => sendCertificateEmail(student)}
                      >
                        <Award className="w-4 h-4 mr-2" />
                        Send Certificate
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}

            {filteredStudents.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {searchQuery ? 'No students found matching your search' : 'No students found'}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      {detailStudent && (
        <StudentDetailDialog
          studentId={detailStudent.auth_user_id}
          studentName={getStudentDisplayName(detailStudent)}
          open={detailOpen}
          onOpenChange={setDetailOpen}
        />
      )}
    </div>
  );
}
