import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Users, FileText, Star } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ClickableStudentName } from "@/components/ClickableStudentName";

interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
}

interface Submission {
  id: string;
  title: string;
  description: string;
  link: string;
  submitted_at: string;
  grade: number | null;
  feedback: string | null;
  review_status: string | null;
  student_id?: string;
  student: {
    name: string;
    email: string;
  };
  courses: {
    title: string;
  };
}

export function TutorDashboard() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [trainingCourses, setTrainingCourses] = useState<Course[]>([]);
  const [qualifiedCourses, setQualifiedCourses] = useState<Course[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = userProfile?.role === 'admin';

  useEffect(() => {
    if (!userProfile) return;
    fetchData();

    // Real-time updates for lessons, submissions, and project updates
    const changesChannel = supabase
      .channel('tutor-dashboard-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lessons'
        },
        () => {
          fetchData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects'
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(changesChannel);
    };
  }, [userProfile]);

  const fetchData = async () => {
    try {
      let assignedCourseIds: string[] | null = null;

      if (!isAdmin) {
        const tutorIds = [userProfile?.auth_user_id, userProfile?.id].filter(Boolean);
        if (tutorIds.length > 0) {
          const { data: ctData } = await supabase
            .from('course_tutors')
            .select('course_id')
            .in('tutor_id', tutorIds);
          assignedCourseIds = (ctData || []).map((ct: any) => ct.course_id);
          const { data: qualificationData } = await supabase
            .from("tutor_qualifications")
            .select("course_id")
            .in("tutor_id", tutorIds);
          const qualifiedCourseIds = (qualificationData || []).map((row) => row.course_id);
          const allQualifiedIds = Array.from(new Set([...assignedCourseIds, ...qualifiedCourseIds]));
          if (allQualifiedIds.length > 0) {
            const { data: qualifiedData } = await supabase
              .from("courses")
              .select("*")
              .in("id", allQualifiedIds)
              .order("created_at", { ascending: false });
            setQualifiedCourses(qualifiedData || []);
          } else {
            setQualifiedCourses([]);
          }
        } else {
          assignedCourseIds = [];
          setQualifiedCourses([]);
        }
      }

      const learnerIds = [userProfile?.id, userProfile?.auth_user_id].filter(Boolean);
      const { data: trainingEnrollments } = await supabase
        .from("enrollments")
        .select("courses(*)")
        .in("student_id", learnerIds);
      setTrainingCourses(
        (trainingEnrollments || [])
          .map((row: any) => row.courses)
          .filter(Boolean)
      );

      // Fetch courses
      let coursesQuery = supabase
        .from('courses')
        .select('*')
        .order('created_at', { ascending: false });

      if (assignedCourseIds !== null) {
        if (assignedCourseIds.length === 0) {
          setCourses([]);
          setSubmissions([]);
          setLoading(false);
          return;
        }
        coursesQuery = coursesQuery.in('id', assignedCourseIds);
      }

      const { data: coursesData, error: coursesError } = await coursesQuery;
      if (coursesError) throw coursesError;

      // Fetch student submissions with student and course info
      let submissionsQuery = supabase
        .from('projects')
        .select(`
          id,
          title,
          description,
          link,
          submitted_at,
          grade,
          feedback,
          review_status,
          student_id,
          course_id,
          student:users!projects_student_id_fkey(name, email),
          courses:courses!projects_course_id_fkey(title)
        `)
        .order('submitted_at', { ascending: false });

      if (assignedCourseIds !== null) {
        submissionsQuery = submissionsQuery.in('course_id', assignedCourseIds);
      }

      const { data: submissionsData, error: submissionsError } = await submissionsQuery;
      if (submissionsError) throw submissionsError;

      setCourses(coursesData || []);
      setSubmissions(submissionsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Welcome Tutor, {userProfile?.name || 'User'}
          </h1>
          <p className="text-muted-foreground mt-1">
            Review student submissions and provide guidance
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Courses</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{courses.length}</div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Training Courses</CardTitle><CardDescription>Courses you are taking as a learner.</CardDescription></CardHeader>
            <CardContent><p className="text-2xl font-bold">{trainingCourses.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Qualified Courses</CardTitle><CardDescription>Courses approved for teaching.</CardDescription></CardHeader>
            <CardContent><p className="text-2xl font-bold">{isAdmin ? courses.length : qualifiedCourses.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Assigned Teaching</CardTitle><CardDescription>Courses currently assigned to you.</CardDescription></CardHeader>
            <CardContent><p className="text-2xl font-bold">{courses.length}</p></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Student Submissions</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{submissions.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {submissions.filter(s => s.review_status === 'submitted' || !s.review_status).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Available Courses */}
      <Card>
        <CardHeader>
          <CardTitle>Available Courses</CardTitle>
          <CardDescription>Courses you can supervise and grade</CardDescription>
        </CardHeader>
        <CardContent>
          {courses.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No courses available</h3>
              <p className="text-muted-foreground">
                Courses will appear here once the admin creates them
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {courses.map((course) => (
                <div key={course.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">{course.title}</h4>
                    <p className="text-sm text-muted-foreground">{course.description}</p>
                    <Badge variant="secondary" className="mt-1">
                      {course.category}
                    </Badge>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate(`/tutor/course/${course.id}`)}
                  >
                    View Details
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Submissions</CardTitle>
          <CardDescription>Open a submission to review, grade, or request a resubmission.</CardDescription>
        </CardHeader>
        <CardContent>
          {submissions.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No submissions are available for your teaching scope.</p>
          ) : (
            <div className="space-y-3">
              {submissions.slice(0, 10).map((submission) => (
                <div key={submission.id} className="flex items-center justify-between gap-4 rounded-lg border p-4">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{submission.title || "Project submission"}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <ClickableStudentName
                        studentId={submission.student_id}
                        name={submission.student?.name}
                        email={submission.student?.email}
                      />
                      <span>· {submission.courses?.title || "Course"}</span>
                    </p>
                    <Badge variant={submission.review_status === "graded" ? "secondary" : "default"} className="mt-2">
                      {submission.review_status === "graded" ? "Graded" : "Pending review"}
                    </Badge>
                  </div>
                  <Button size="sm" onClick={() => navigate(`/dashboard/submissions/${submission.id}`)}>
                    View Submission
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}