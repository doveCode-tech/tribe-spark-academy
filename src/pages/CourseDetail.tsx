import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LMSLayout } from '@/components/LMSLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, BookOpen, Clock, Play, CheckCircle, Lock, Trophy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { CourseProgressTracker } from '@/components/CourseProgressTracker';
import { InCourseGames } from '@/components/InCourseGames';
import { QuizInterface } from '@/components/QuizInterface';
import { ProjectSubmission } from '@/components/ProjectSubmission';
import { QuizSection } from '@/components/QuizSection';

interface Lesson {
  id: string;
  title: string;
  description: string;
  duration_minutes: number;
  order_index: number;
  completed?: boolean;
}

interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
}

export default function CourseDetail() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [lessonsProgress, setLessonsProgress] = useState(0);

  useEffect(() => {
    if (courseId && user) {
      fetchCourseData();
    }
  }, [courseId, user]);

  const fetchCourseData = async () => {
    try {
      // Check if user is enrolled in this course
      const { data: enrollment, error: enrollmentError } = await supabase
        .from('enrollments')
        .select('*')
        .eq('course_id', courseId)
        .eq('student_id', user?.id)
        .maybeSingle();

      if (enrollmentError || !enrollment) {
        toast({
          title: "Access Denied",
          description: "You are not enrolled in this course.",
          variant: "destructive",
        });
        navigate('/courses');
        return;
      }

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

      // Fetch lesson progress
      const { data: progressData } = await supabase
        .from('lesson_progress')
        .select('lesson_id, completed')
        .eq('student_id', user?.id);

      const progressMap = new Map(
        progressData?.map(p => [p.lesson_id, p.completed]) || []
      );

      const lessonsWithProgress = lessonsData?.map(lesson => ({
        ...lesson,
        completed: progressMap.get(lesson.id) || false
      })) || [];

      setLessons(lessonsWithProgress);

      // Calculate overall progress
      const completedCount = lessonsWithProgress.filter(l => l.completed).length;
      const progressPercentage = lessonsWithProgress.length > 0 
        ? Math.round((completedCount / lessonsWithProgress.length) * 100) 
        : 0;
      setLessonsProgress(progressPercentage);

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

  const startLesson = async (lessonId: string) => {
    try {
      // Mark lesson as started/update progress
      const { error } = await supabase
        .from('lesson_progress')
        .upsert({
          student_id: user?.id,
          lesson_id: lessonId,
          completed: true,
          completed_at: new Date().toISOString()
        });

      if (error) throw error;

      // Refresh data
      fetchCourseData();

      toast({
        title: "Lesson Completed!",
        description: "Great job on completing this lesson.",
      });

    } catch (error: any) {
      console.error('Error updating lesson progress:', error);
      toast({
        title: "Error",
        description: "Failed to update lesson progress.",
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
          <Button onClick={() => navigate('/courses')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Courses
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
            onClick={() => navigate('/courses')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Courses
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
            <div className="mt-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Lesson Progress</span>
                <span className="text-sm text-muted-foreground">{lessonsProgress}% Complete</span>
              </div>
              <Progress value={lessonsProgress} className="w-full" />
            </div>
          </CardHeader>
        </Card>

        {/* Course Progress Tracker */}
        <CourseProgressTracker courseId={course.id} />

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
              <div key={lesson.id}>
                <div
                  className={`border rounded-lg p-4 transition-all ${
                    lesson.completed 
                      ? 'bg-success/5 border-success/20' 
                      : 'hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        lesson.completed 
                          ? 'bg-success text-success-foreground' 
                          : 'bg-muted'
                      }`}>
                        {lesson.completed ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : (
                          <span className="text-sm font-medium">{index + 1}</span>
                        )}
                      </div>
                      <div>
                        <h4 className="font-semibold">{lesson.title}</h4>
                        <p className="text-sm text-muted-foreground">{lesson.description}</p>
                        <div className="flex items-center text-xs text-muted-foreground mt-1">
                          <Clock className="w-3 h-3 mr-1" />
                          {lesson.duration_minutes} minutes
                        </div>
                      </div>
                    </div>
                    
                    <Button
                      size="sm"
                      variant={lesson.completed ? "outline" : "default"}
                      onClick={() => startLesson(lesson.id)}
                    >
                      {lesson.completed ? (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Completed
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Start Lesson
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                
                {/* Mini-games after lessons 3 and 7 */}
                {(index + 1 === 3 || index + 1 === 7) && lesson.completed && (
                  <div className="mt-4">
                    <InCourseGames courseId={course.id} lessonNumber={index + 1} />
                  </div>
                )}
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

        {/* Quiz Section */}
        {lessonsProgress >= 90 && (
          <QuizSection courseId={course.id} />
        )}

        {/* Project Submission */}
        <ProjectSubmission courseId={course.id} />
      </div>
    </LMSLayout>
  );
}