import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LMSLayout } from '@/components/LMSLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, BookOpen, Users, FileText, Star, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
}

interface Lesson {
  id: string;
  title: string;
  description: string;
  duration_minutes: number;
  order_index: number;
}

interface StudentSubmission {
  id: string;
  title: string;
  description: string;
  link: string;
  submitted_at: string;
  grade: number | null;
  feedback: string | null;
  review_status: string;
  graded_at: string | null;
  student: {
    name: string;
    email: string;
  };
}

export default function TutorCourseDetail() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [gradingSubmissionId, setGradingSubmissionId] = useState<string | null>(null);
  const [grade, setGrade] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (courseId && userProfile) {
      fetchCourseData();
    }
  }, [courseId, userProfile]);

  const fetchCourseData = async () => {
    try {
      // Fetch course details
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();

      if (courseError || !courseData) {
        throw courseError;
      }

      setCourse(courseData);

      // Fetch lessons
      const { data: lessonsData, error: lessonsError } = await supabase
        .from('lessons')
        .select('*')
        .eq('course_id', courseId)
        .order('order_index');

      if (lessonsError) {
        throw lessonsError;
      }

      setLessons(lessonsData || []);

      // Fetch student submissions for this course
      const { data: submissionsData, error: submissionsError } = await supabase
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
          graded_at,
          student:users!projects_student_id_fkey(name, email)
        `)
        .eq('course_id', courseId)
        .order('submitted_at', { ascending: false });

      if (submissionsError) {
        throw submissionsError;
      }

      setSubmissions(submissionsData as any || []);

    } catch (error: any) {
      console.error('Error fetching course data:', error);
      toast({
        title: "Error",
        description: "Failed to load course data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const gradeSubmission = async (submissionId: string) => {
    if (!grade || !feedback) {
      toast({
        title: "Error",
        description: "Please provide both grade and feedback.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('projects')
        .update({
          grade: parseInt(grade),
          feedback,
          review_status: 'graded'
        })
        .eq('id', submissionId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Project graded successfully!",
      });

      setGradingSubmissionId(null);
      setGrade('');
      setFeedback('');
      fetchCourseData(); // Refresh data
    } catch (error: any) {
      console.error('Error grading submission:', error);
      toast({
        title: "Error",
        description: "Failed to grade submission.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <LMSLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading course...</p>
          </div>
        </div>
      </LMSLayout>
    );
  }

  if (!course) {
    return (
      <LMSLayout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-4">Course Not Found</h2>
          <Button onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </LMSLayout>
    );
  }

  return (
    <LMSLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button 
            variant="outline" 
            onClick={() => navigate('/')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        {/* Course Info */}
        <Card className="shadow-card">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl">{course.title}</CardTitle>
                <CardDescription className="mt-2">{course.description}</CardDescription>
              </div>
              <Badge variant="secondary">{course.category}</Badge>
            </div>
          </CardHeader>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Lessons</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{lessons.length}</div>
            </CardContent>
          </Card>

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
              <CardTitle className="text-sm font-medium">Graded Projects</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {submissions.filter(s => s.review_status === 'graded').length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lessons */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              <BookOpen className="w-5 h-5 mr-2" />
              Course Lessons
            </CardTitle>
            <CardDescription>
              {lessons.length} lessons in this course
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {lessons.map((lesson, index) => (
              <div key={lesson.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-muted">
                      <span className="text-sm font-medium">{index + 1}</span>
                    </div>
                    <div>
                      <h4 className="font-semibold">{lesson.title}</h4>
                      <p className="text-sm text-muted-foreground">{lesson.description}</p>
                      <div className="flex items-center text-xs text-muted-foreground mt-1">
                        <span>{lesson.duration_minutes} minutes</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {lessons.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No lessons available in this course yet.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Student Submissions */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              Student Submissions
            </CardTitle>
            <CardDescription>
              Review and grade student projects
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {submissions.map((submission) => (
              <div key={submission.id} className="border rounded-lg p-4">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium">{submission.title}</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        {submission.description}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Student: {submission.student?.name}</span>
                        <span>
                          Submitted: {new Date(submission.submitted_at).toLocaleDateString()}
                        </span>
                        <Badge variant={
                          submission.review_status === 'graded' ? 'default' : 
                          submission.review_status === 'reviewed' ? 'secondary' : 'outline'
                        }>
                          {submission.review_status}
                        </Badge>
                      </div>
                      {submission.link && (
                        <a 
                          href={submission.link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:underline text-sm mt-2 inline-block"
                        >
                          View Project
                        </a>
                      )}
                      
                      {/* Display grade and feedback if already graded */}
                      {submission.grade !== null && (
                        <div className="mt-2 p-3 bg-muted rounded">
                          <div className="flex items-center gap-2 mb-1">
                            <CheckCircle className="w-4 h-4 text-success" />
                            <span className="font-medium">Grade: {submission.grade}/100</span>
                          </div>
                          {submission.feedback && (
                            <p className="text-sm text-muted-foreground">
                              Feedback: {submission.feedback}
                            </p>
                          )}
                          {submission.graded_at && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Graded on: {new Date(submission.graded_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      {submission.review_status !== 'graded' && (
                        <Button 
                          size="sm" 
                          onClick={() => setGradingSubmissionId(submission.id)}
                        >
                          Grade Project
                        </Button>
                      )}
                      {submission.review_status === 'graded' && (
                        <Button 
                          variant="outline"
                          size="sm" 
                          onClick={() => setGradingSubmissionId(submission.id)}
                        >
                          Re-grade
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {/* Grading Form */}
                  {gradingSubmissionId === submission.id && (
                    <div className="border-t pt-4 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Grade (0-100)</label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={grade}
                            onChange={(e) => setGrade(e.target.value)}
                            placeholder="Enter grade..."
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Review Status</label>
                          <Select defaultValue="graded">
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="reviewed">Reviewed</SelectItem>
                              <SelectItem value="graded">Graded</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Feedback</label>
                        <Textarea
                          value={feedback}
                          onChange={(e) => setFeedback(e.target.value)}
                          placeholder="Provide detailed feedback for the student..."
                          rows={3}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => gradeSubmission(submission.id)}>
                          Submit Grade
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setGradingSubmissionId(null);
                            setGrade('');
                            setFeedback('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {submissions.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No student submissions yet.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </LMSLayout>
  );
}