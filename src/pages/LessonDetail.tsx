import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LMSLayout } from '@/components/LMSLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, ChevronLeft, ChevronRight, CheckCircle2, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { LessonContentViewer } from '@/components/LessonContentViewer';
import { ActivityChecklist } from '@/components/lesson/ActivityChecklist';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { soundEffects } from '@/utils/audio';
import { awardXP, XP_REWARDS } from '@/utils/gamification';

export default function LessonDetail() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const [lesson, setLesson] = useState<any>(null);
  const [allLessons, setAllLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCompleted, setIsCompleted] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completedActivityIds, setCompletedActivityIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>("video");
  const [isQuizPassed, setIsQuizPassed] = useState<boolean>(false);
  const [isAssignmentSubmitted, setIsAssignmentSubmitted] = useState<boolean>(false);

  useEffect(() => {
    if (lessonId && userProfile) {
      fetchLesson();
    }
  }, [lessonId, userProfile]);

  useEffect(() => {
    if (lesson?.course_id) {
      fetchCourseLessons(lesson.course_id);
    }
  }, [lesson?.course_id]);

  // Real-time subscription for lesson updates
  useEffect(() => {
    if (!lessonId) return;

    const channel = supabase
      .channel(`lesson-${lessonId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'lessons',
          filter: `id=eq.${lessonId}`
        },
        (payload) => {
          setLesson(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [lessonId]);

  const fetchLesson = async () => {
    try {
      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('id', lessonId)
        .single();

      if (error) throw error;

      // Verify student enrollment access
      const userRole = (userProfile?.role || '').toLowerCase();
      const isStaff = ['admin', 'tutor', 'ultimate_tutor'].includes(userRole);
      if (!isStaff && data?.course_id) {
        const studentId = userProfile?.auth_user_id || user?.id;
        const { data: enrollment } = await supabase
          .from('enrollments')
          .select('id')
          .eq('course_id', data.course_id)
          .eq('student_id', studentId)
          .eq('status', 'active')
          .maybeSingle();

        if (!enrollment) {
          toast({
            title: "Enrollment Required",
            description: "You must be enrolled in this course to view this lesson.",
            variant: "destructive",
          });
          navigate('/courses');
          return;
        }
      }

      setLesson(data);

      // Check if student has completed this lesson
      if (user?.id || userProfile?.auth_user_id) {
        const studentAuthId = user?.id || userProfile?.auth_user_id;
        const { data: progress } = await supabase
          .from('lesson_progress')
          .select('completed')
          .eq('lesson_id', lessonId)
          .eq('student_id', studentAuthId)
          .maybeSingle();

        setIsCompleted(!!progress?.completed);

        // Load activity completions
        const stored = localStorage.getItem(`stemtribe_completed_activities_${studentAuthId}_${lessonId}`);
        if (stored) {
          try {
            setCompletedActivityIds(JSON.parse(stored));
          } catch {}
        } else if (progress?.completed && Array.isArray(data.exercises)) {
          // If lesson was already completed, default all activities to completed
          setCompletedActivityIds(data.exercises.map((e: any, idx: number) => e.id || `act_${idx}`));
        }

        // Check if quiz is passed
        const { data: qAttempt } = await supabase
          .from('quiz_attempts')
          .select('passed')
          .eq('course_id', data.course_id)
          .eq('student_id', studentAuthId)
          .eq('passed', true)
          .limit(1);
        if (qAttempt && qAttempt.length > 0) {
          setIsQuizPassed(true);
        }

        // Check if project was submitted
        const { data: projData } = await supabase
          .from('projects')
          .select('id')
          .eq('lesson_id', lessonId)
          .in('student_id', [userProfile?.id, userProfile?.auth_user_id].filter(Boolean))
          .limit(1);
        if (projData && projData.length > 0) {
          setIsAssignmentSubmitted(true);
        }
      }
    } catch (error: any) {
      console.error('Error fetching lesson:', error);
      toast({
        title: "Error",
        description: "Failed to load lesson",
        variant: "destructive",
      });
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActivity = async (id: string, completed: boolean, xpAmount: number) => {
    const studentAuthId = user?.id || userProfile?.auth_user_id;
    let next = [...completedActivityIds];
    if (completed) {
      if (!next.includes(id)) {
        next.push(id);
        try {
          await awardXP(userProfile, xpAmount, `Activity completed: ${id}`, lesson?.id);
        } catch (e) {
          console.warn("XP award note:", e);
        }
      }
    } else {
      next = next.filter(item => item !== id);
    }
    setCompletedActivityIds(next);
    if (studentAuthId && lesson?.id) {
      localStorage.setItem(`stemtribe_completed_activities_${studentAuthId}_${lesson.id}`, JSON.stringify(next));
    }
  };

  const fetchCourseLessons = async (courseId: string) => {
    try {
      const { data } = await supabase
        .from('lessons')
        .select('id, title, order_index')
        .eq('course_id', courseId)
        .order('order_index', { ascending: true });
      if (data) setAllLessons(data);
    } catch (err) {
      console.error("Error fetching course lessons:", err);
    }
  };

  const handleCompleteLesson = async () => {
    const studentAuthId = user?.id || userProfile?.auth_user_id;
    if (!studentAuthId || !lesson) return;

    setCompleting(true);
    try {
      const { error: progErr } = await supabase
        .from('lesson_progress')
        .upsert({
          student_id: studentAuthId,
          lesson_id: lesson.id,
          completed: true,
          completed_at: new Date().toISOString(),
        });

      if (progErr) throw progErr;

      setIsCompleted(true);
      soundEffects.playSuccess();

      // Record activity for streak tracking (1 point)
      try {
        await (supabase.rpc as any)('record_learning_activity', {
          _activity_type: 'lesson_complete',
          _lesson_id: lesson.id,
          _course_id: lesson.course_id,
          _points: 1,
        });
      } catch (streakErr) {
        console.warn('Streak activity note:', streakErr);
      }

      // Check streak badges
      try {
        await (supabase.rpc as any)('award_streak_badges');
      } catch (bErr) {
        console.warn('Badge award note:', bErr);
      }

      // Award 50 XP
      try {
        await awardXP(userProfile, XP_REWARDS.LESSON_COMPLETE, 'lesson_complete', lesson.id);
      } catch (xpErr) {
        console.warn('XP award note:', xpErr);
      }

      // Mark all activities completed
      if (Array.isArray(lesson.exercises)) {
        const allIds = lesson.exercises.map((e: any, idx: number) => e.id || `act_${idx}`);
        setCompletedActivityIds(allIds);
        localStorage.setItem(`stemtribe_completed_activities_${studentAuthId}_${lesson.id}`, JSON.stringify(allIds));
      }

      toast({
        title: "🎉 Lesson Complete! (+50 XP)",
        description: "Awesome job! You earned 50 XP and made real learning progress today.",
      });
    } catch (err: any) {
      console.error('Error marking lesson complete:', err);
      toast({
        title: "Could not save progress",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setCompleting(false);
    }
  };

  const handleAssignmentSubmitted = () => {
    toast({
      title: "Success!",
      description: "Your assignment has been submitted for review.",
    });
  };

  const currentIndex = allLessons.findIndex((l) => l.id === lesson?.id);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex >= 0 && currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  if (loading) {
    return (
      <LMSLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </LMSLayout>
    );
  }

  if (!lesson) {
    return (
      <LMSLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Lesson not found</p>
          <Button onClick={() => navigate(-1)} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </LMSLayout>
    );
  }

  return (
    <LMSLayout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold">{lesson.title}</h1>
              {isCompleted ? (
                <Badge className="bg-green-600 hover:bg-green-700 text-white gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Completed
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">In Progress</Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-1">Lesson {lesson.order_index}</p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              onClick={handleCompleteLesson}
              disabled={isCompleted || completing}
              variant={isCompleted ? "outline" : "default"}
              className={isCompleted ? "border-green-600 text-green-700 dark:text-green-400" : "bg-gradient-primary text-white"}
            >
              {completing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : isCompleted ? (
                <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              {isCompleted ? "Completed" : "Mark as Complete"}
            </Button>
            <Button variant="outline" onClick={() => navigate(`/courses/${lesson.course_id}`)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Course
            </Button>
          </div>
        </div>
        
        {/* Modular Activity Checklist */}
        <ActivityChecklist
          activities={lesson.exercises || []}
          completedIds={completedActivityIds}
          onToggleComplete={handleToggleActivity}
          hasQuiz={Boolean(lesson.quiz_required || lesson.quiz_data)}
          isQuizPassed={isQuizPassed}
          hasAssignment={Boolean(lesson.assignment_required)}
          isAssignmentSubmitted={isAssignmentSubmitted}
          onNavigateToTab={(tab) => setActiveTab(tab)}
        />

        <LessonContentViewer 
          lesson={lesson} 
          onSubmitAssignment={() => {
            setIsAssignmentSubmitted(true);
            handleAssignmentSubmitted();
          }}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          completedActivityIds={completedActivityIds}
          onToggleActivityComplete={handleToggleActivity}
          onQuizCompleted={() => setIsQuizPassed(true)}
        />

        {/* Bottom Lesson Navigation Bar */}
        {allLessons.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border rounded-xl bg-card shadow-sm mt-6">
            <Button
              variant="outline"
              disabled={!prevLesson}
              onClick={() => prevLesson && navigate(`/lesson/${prevLesson.id}`)}
              className="w-full sm:w-auto flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous Lesson</span>
            </Button>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
              <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Jump to:</span>
              <Select
                value={lesson.id}
                onValueChange={(id) => navigate(`/lesson/${id}`)}
              >
                <SelectTrigger className="w-[240px]">
                  <SelectValue placeholder="Select lesson..." />
                </SelectTrigger>
                <SelectContent>
                  {allLessons.map((l, i) => (
                    <SelectItem key={l.id} value={l.id}>
                      Lesson {i + 1}: {l.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="default"
              disabled={!nextLesson}
              onClick={() => nextLesson && navigate(`/lesson/${nextLesson.id}`)}
              className="w-full sm:w-auto flex items-center gap-2"
            >
              <span>Next Lesson</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </LMSLayout>
  );
}
