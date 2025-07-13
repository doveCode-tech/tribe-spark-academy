import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Users2, UserCheck, FileText, Star } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  approved: boolean;
}

interface EnrollmentDialogProps {
  courses: Course[];
  users: User[];
  onEnrollmentComplete: () => void;
}

export function EnrollmentDialog({ courses, users, onEnrollmentComplete }: EnrollmentDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');

  const handleEnroll = async () => {
    if (!selectedCourse || !selectedStudent) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('enrollments')
        .insert([{
          course_id: selectedCourse,
          student_id: selectedStudent,
          status: 'active',
          progress_percentage: 0,
        }]);

      if (error) throw error;

      const student = users.find(u => u.id === selectedStudent);
      const course = courses.find(c => c.id === selectedCourse);

      toast({
        title: "Student Enrolled",
        description: `${student?.name} has been enrolled in ${course?.title}`,
      });

      setSelectedCourse('');
      setSelectedStudent('');
      setOpen(false);
      onEnrollmentComplete();
    } catch (error: any) {
      console.error('Error enrolling student:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to enroll student",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const students = users.filter(user => user.role === 'student' && user.approved);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserCheck className="w-4 h-4 mr-2" />
          Enroll Student
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enroll Student in Course</DialogTitle>
          <DialogDescription>
            Select a student and course to create an enrollment
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="student-select">Select Student</Label>
            <Select value={selectedStudent} onValueChange={setSelectedStudent}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a student..." />
              </SelectTrigger>
              <SelectContent>
                {students.map((student) => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.name} ({student.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="course-select">Select Course</Label>
            <Select value={selectedCourse} onValueChange={setSelectedCourse}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a course..." />
              </SelectTrigger>
              <SelectContent>
                {courses.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.title} - {course.category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleEnroll} 
            disabled={loading || !selectedCourse || !selectedStudent}
          >
            {loading ? 'Enrolling...' : 'Enroll Student'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}