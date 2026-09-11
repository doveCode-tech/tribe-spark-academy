import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LMSLayout } from '@/components/LMSLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, BookOpen, Clock, Play, CheckCircle, Lock, Trophy, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { CourseProgressTracker } from '@/components/CourseProgressTracker';
import { InCourseGames } from '@/components/InCourseGames';
import { QuizInterface } from '@/components/QuizInterface';
import { ProjectSubmission } from '@/components/ProjectSubmission';
import { CourseAccordionLessons } from '@/components/CourseAccordionLessons';
import { CourseParticipantsDialog } from '@/components/CourseParticipantsDialog';
import { QuizSection } from '@/components/QuizSection';

interface Lesson {
  id: string;
  course_id: string;
  title: string;
  description: string;
  content?: string;
  duration_minutes: number;
  order_index: number;
  video_urls?: string[] | null;
  youtube_urls?: string[] | null;
  exercise_video_urls?: string[] | null;
  exercise_youtube_urls?: string[] | null;
  exercises?: any;
  assignment_required?: boolean;
  quiz_required?: boolean;
  is_end_of_course?: boolean;
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
  const { user, userProfile } = useAuth();
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

  // Real-time subscription for lesson updates
  useEffect(() => {
    if (!courseId) return;

    const channel = supabase
      .channel(`lessons-${courseId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lessons',
          filter: `course_id=eq.${courseId}`
        },
        () => {
          fetchCourseData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [courseId, user]);

  const fetchCourseData = async () => {
    try {
      const userRole = (userProfile?.role || "").toLowerCase();
      const isStaff = userRole === "admin" || userRole === "ultimate_tutor" || userRole === "tutor";

      if (!isStaff) {
        // Check if student is enrolled in this course (checking both user.id and auth_user_id)
        const studentId = userProfile?.auth_user_id || user?.id;
        const { data: enrollment, error: enrollmentError } = await supabase
          .from('enrollments')
          .select('*')
          .eq('course_id', courseId)
          .eq('student_id', studentId)
          .eq('status', 'active')
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
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Button 
            variant="outline" 
            onClick={() => navigate('/courses')}
            className="mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Courses
          </Button>

          {/* Participants Dialog visible to all tutors and admins */}
          {(userProfile?.role === 'admin' || userProfile?.role === 'ultimate_tutor' || userProfile?.role === 'tutor') && (
            <div className="flex items-center gap-2 mb-2">
              <CourseParticipantsDialog
                courseId={course.id}
                courseTitle={course.title}
                triggerLabel="View Course Participants"
                onEnrollmentChanged={fetchCourseData}
              />
            </div>
          )}
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

        {/* Lessons Accordion View */}
        <Card className="shadow-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center text-xl">
                  <BookOpen className="w-5 h-5 mr-2 text-primary" />
                  Course Content & Lessons
                </CardTitle>
                <CardDescription className="mt-1">
                  Click on any lesson below to expand videos, exercises, and assignment instructions.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs">
                {lessons.length} {lessons.length === 1 ? 'Lesson' : 'Lessons'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {lessons.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-40 text-primary" />
                <p className="font-medium">No lessons available in this course yet.</p>
                <p className="text-xs mt-1">Lessons will appear here once added by your tutor.</p>
              </div>
            ) : (
              <CourseAccordionLessons
                courseId={course.id}
                lessons={lessons}
                canEdit={userProfile?.role === 'admin' || userProfile?.role === 'ultimate_tutor' || userProfile?.role === 'tutor'}
                onStartLesson={startLesson}
              />
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