import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LMSLayout } from '@/components/LMSLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, BookOpen, Users, FileText, Star, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

interface Project {
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [gradingProject, setGradingProject] = useState<string | null>(null);

  useEffect(() => {
    if (courseId) {
      fetchCourseData();
    }
  }, [courseId]);

  const fetchCourseData = async () => {
    try {
      // Fetch course details
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();

      if (courseError) throw courseError;
      setCourse(courseData);

      // Fetch lessons
      const { data: lessonsData, error: lessonsError } = await supabase
        .from('lessons')
        .select('*')
        .eq('course_id', courseId)
        .order('order_index');

      if (lessonsError) throw lessonsError;
      setLessons(lessonsData || []);

      // Fetch student projects with student info
      const { data: projectsData, error: projectsError } = await supabase
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

      if (projectsError) throw projectsError;
      setProjects(projectsData || []);

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

  const gradeProject = async (projectId: string, grade: number, feedback: string, reviewStatus: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          grade,
          feedback,
          review_status: reviewStatus,
        })
        .eq('id', projectId);

      if (error) throw error;

      toast({
        title: "Project Graded",
        description: "Grade and feedback have been saved successfully.",
      });

      setGradingProject(null);
      fetchCourseData(); // Refresh data
    } catch (error: any) {
      console.error('Error grading project:', error);
      toast({
        title: "Error",
        description: "Failed to save grade.",
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
              <div className="text-2xl font-bold">{projects.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {projects.filter(p => p.review_status === 'submitted').length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lessons */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BookOpen className="w-5 h-5 mr-2" />
              Course Lessons
            </CardTitle>
            <CardDescription>
              {lessons.length} lessons in this course
            </CardDescription>
          </CardHeader>
          <CardContent>
            {lessons.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No lessons yet</h3>
                <p className="text-muted-foreground">
                  Lessons will appear here once they are created
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {lessons.map((lesson, index) => (
                  <div key={lesson.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-medium">{index + 1}</span>
                        </div>
                        <div>
                          <h4 className="font-semibold">{lesson.title}</h4>
                          <p className="text-sm text-muted-foreground">{lesson.description}</p>
                          <div className="text-xs text-muted-foreground mt-1">
                            Duration: {lesson.duration_minutes} minutes
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Student Submissions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="w-5 h-5 mr-2" />
              Student Project Submissions
            </CardTitle>
            <CardDescription>
              Review and grade student work
            </CardDescription>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No submissions yet</h3>
                <p className="text-muted-foreground">
                  Student submissions will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {projects.map((project) => (
                  <div key={project.id} className="p-6 border rounded-lg">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-lg">{project.title}</h4>
                          <p className="text-muted-foreground mt-1">{project.description}</p>
                          
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-3">
                            <span>Student: {project.student?.name}</span>
                            <span>
                              Submitted: {new Date(project.submitted_at).toLocaleDateString()}
                            </span>
                          </div>
                          
                          {project.link && (
                            <a 
                              href={project.link} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-primary hover:underline text-sm mt-2"
                            >
                              <ExternalLink className="w-4 h-4 mr-1" />
                              View Project
                            </a>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Badge variant={
                            project.review_status === 'graded' ? 'default' : 
                            project.review_status === 'reviewed' ? 'secondary' : 'outline'
                          }>
                            {project.review_status}
                          </Badge>
                          {project.grade !== null && (
                            <Badge variant="default">
                              Grade: {project.grade}/100
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Existing Grade/Feedback Display */}
                      {project.grade !== null && (
                        <div className="bg-muted p-4 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">Grade: {project.grade}/100</span>
                            {project.graded_at && (
                              <span className="text-sm text-muted-foreground">
                                Graded: {new Date(project.graded_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          {project.feedback && (
                            <p className="text-sm text-muted-foreground">{project.feedback}</p>
                          )}
                        </div>
                      )}

                      {/* Grading Form */}
                      {gradingProject === project.id ? (
                        <GradingForm 
                          project={project}
                          onSubmit={gradeProject}
                          onCancel={() => setGradingProject(null)}
                        />
                      ) : (
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setGradingProject(project.id)}
                          >
                            {project.grade !== null ? 'Update Grade' : 'Grade Project'}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </LMSLayout>
  );
}

// Grading Form Component
function GradingForm({ 
  project, 
  onSubmit, 
  onCancel 
}: { 
  project: Project;
  onSubmit: (projectId: string, grade: number, feedback: string, reviewStatus: string) => void;
  onCancel: () => void;
}) {
  const [grade, setGrade] = useState(project.grade?.toString() || '');
  const [feedback, setFeedback] = useState(project.feedback || '');
  const [reviewStatus, setReviewStatus] = useState(project.review_status || 'reviewed');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!grade || isNaN(Number(grade))) {
      return;
    }
    onSubmit(project.id, Number(grade), feedback, reviewStatus);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-muted p-4 rounded-lg">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Grade (0-100)</label>
          <Input
            type="number"
            min="0"
            max="100"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            placeholder="Enter grade..."
            required
          />
        </div>
        
        <div>
          <label className="text-sm font-medium mb-2 block">Status</label>
          <Select value={reviewStatus} onValueChange={setReviewStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="reviewed">Reviewed</SelectItem>
              <SelectItem value="graded">Graded</SelectItem>
              <SelectItem value="needs_revision">Needs Revision</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div>
        <label className="text-sm font-medium mb-2 block">Feedback</label>
        <Textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Provide feedback to the student..."
          rows={4}
        />
      </div>
      
      <div className="flex gap-2">
        <Button type="submit" size="sm">
          Save Grade
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
