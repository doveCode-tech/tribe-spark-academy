import { useState, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Trophy, CheckCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getDualIdArray } from "@/utils/identity";

interface CourseProgressTrackerProps {
  courseId: string;
  className?: string;
}

export function CourseProgressTracker({ courseId, className = "" }: CourseProgressTrackerProps) {
  const { user, userProfile } = useAuth();
  const [progress, setProgress] = useState({
    lessonsCompleted: 0,
    totalLessons: 0,
    quizPassed: false,
    progressPercentage: 0
  });

  useEffect(() => {
    if (courseId && user) {
      fetchProgress();
    }

    // Real-time updates for lesson progress and quiz attempts
    const progressChannel = supabase
      .channel(`course-progress-changes-${courseId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lesson_progress'
        },
        () => fetchProgress()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quiz_attempts'
        },
        () => fetchProgress()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(progressChannel);
    };
  }, [courseId, user, userProfile]);

  const fetchProgress = async () => {
    try {
      // Get total lessons in course
      const { data: lessonsData, error: lessonsError } = await supabase
        .from('lessons')
        .select('id')
        .eq('course_id', courseId);

      if (lessonsError) throw lessonsError;

      const totalLessons = lessonsData?.length || 0;
      const courseLessonIdSet = new Set((lessonsData || []).map((l) => l.id));

      const studentIds = getDualIdArray(userProfile);
      const studentIdList = studentIds.length > 0 ? studentIds : [user?.id].filter(Boolean);

      // Get completed lessons strictly belonging to this course
      const { data: progressData, error: progressError } = await supabase
        .from('lesson_progress')
        .select('lesson_id, completed')
        .in('student_id', studentIdList)
        .eq('completed', true);

      if (progressError) throw progressError;

      // Filter progress strictly to this course's lessons
      const lessonsCompleted = progressData
        ? progressData.filter((p) => courseLessonIdSet.has(p.lesson_id)).length
        : 0;

      // Check quiz completion for this course
      const { data: quizData, error: quizError } = await supabase
        .from('quiz_attempts')
        .select('passed')
        .eq('course_id', courseId)
        .in('student_id', studentIdList)
        .eq('passed', true)
        .limit(1);

      if (quizError) throw quizError;

      const quizPassed = (quizData?.length || 0) > 0;

      // Calculate progress percentage
      let progressPercentage = 0;
      if (totalLessons > 0) {
        const lessonProgress = (lessonsCompleted / totalLessons) * 90; // Lessons worth 90%
        const quizProgress = quizPassed ? 10 : 0; // Quiz worth 10%
        progressPercentage = Math.round(lessonProgress + quizProgress);
      }

      setProgress({
        lessonsCompleted,
        totalLessons,
        quizPassed,
        progressPercentage
      });

    } catch (error) {
      console.error('Error fetching progress:', error);
    }
  };

  const getProgressStatus = () => {
    if (progress.progressPercentage === 100) {
      return { label: "Course Completed", variant: "default" as const, icon: Trophy };
    } else if (progress.lessonsCompleted === progress.totalLessons) {
      return { label: "Ready for Quiz", variant: "secondary" as const, icon: CheckCircle };
    } else {
      return { label: "In Progress", variant: "outline" as const, icon: Clock };
    }
  };

  const status = getProgressStatus();
  const StatusIcon = status.icon;

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon className="w-4 h-4 text-primary" />
          <span className="font-medium">Course Progress</span>
        </div>
        <Badge variant={status.variant}>
          <StatusIcon className="w-3 h-3 mr-1" />
          {status.label}
        </Badge>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            {progress.lessonsCompleted} of {progress.totalLessons} lessons completed
            {progress.quizPassed && " • Quiz passed"}
          </span>
          <span className="font-medium">{progress.progressPercentage}%</span>
        </div>
        <Progress 
          value={progress.progressPercentage} 
          className="h-2"
        />
      </div>
      
      {progress.progressPercentage === 100 && (
        <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/20 rounded-lg">
          <Trophy className="w-4 h-4 text-success" />
          <span className="text-sm font-medium text-success">
            Congratulations! You've completed this course.
          </span>
        </div>
      )}
    </div>
  );
}