import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
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
    course_id: 'none'
  });

  const isTutor = userProfile?.role === 'tutor' || userProfile?.role === 'ultimate_tutor';

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

  const createAndSubmitReport = async () => {
    try {
      if (!reportForm.title || !reportForm.content || !selectedStudent) {
        toast({
          title: "Validation Error",
          description: "Please fill in title and content.",
          variant: "destructive",
        });
        return;
      }

      const reportData = {
        title: reportForm.title,
        content: reportForm.content,
        student_id: selectedStudent.auth_user_id,
        course_id: reportForm.course_id === 'none' ? null : reportForm.course_id,
        tutor_id: userProfile?.auth_user_id,
        status: 'draft'
      };

      const { data, error } = await supabase
        .from('reports')
        .insert(reportData)
        .select('id')
        .single();

      if (error) throw error;

      // Submit the report immediately
      const { error: submitError } = await supabase
        .from('reports')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString()
        })
        .eq('id', data.id);

      if (submitError) throw submitError;

      // Notify admin
      await supabase.from('notifications').insert({
        recipient_role: 'admin',
        type: 'report_submitted',
        title: 'New Report Submitted',
        message: `A new report "${reportForm.title}" has been submitted for review`,
        data: { report_id: data.id }
      });

      toast({
        title: "Report Sent",
        description: "Your report has been sent to admin for review.",
      });

      setReportForm({ title: '', content: '', course_id: 'none' });
      setSelectedStudent(null);
    } catch (error: any) {
      console.error('Error creating report:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send report.",
        variant: "destructive",
      });
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

                {isTutor && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        size="sm"
                        onClick={() => setSelectedStudent(student)}
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Write Report
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Create Report for {getStudentDisplayName(student)}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="course">Course (Optional)</Label>
                          <Select
                            value={reportForm.course_id}
                            onValueChange={(value) => setReportForm(prev => ({ ...prev, course_id: value }))}
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
                            value={reportForm.title}
                            onChange={(e) => setReportForm(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="Enter report title"
                          />
                        </div>

                        <div>
                          <Label htmlFor="content">Report Content</Label>
                          <Textarea
                            id="content"
                            value={reportForm.content}
                            onChange={(e) => setReportForm(prev => ({ ...prev, content: e.target.value }))}
                            placeholder="Write your report here..."
                            rows={8}
                          />
                        </div>

                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setReportForm({ title: '', content: '', course_id: 'none' });
                              setSelectedStudent(null);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={createAndSubmitReport}
                            disabled={!reportForm.title || !reportForm.content}
                          >
                            <FileText className="w-4 h-4 mr-2" />
                            Send to Admin
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
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
    </div>
  );
}
