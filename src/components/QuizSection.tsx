import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, CheckCircle, Award } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { QuizInterface } from './QuizInterface';
import { useToast } from '@/hooks/use-toast';
import { awardXP, XP_REWARDS } from '@/utils/gamification';

import { getDualIdArray } from '@/utils/identity';

interface QuizSectionProps {
  courseId: string;
}

export function QuizSection({ courseId }: QuizSectionProps) {
  const { userProfile, user } = useAuth();
  const { toast } = useToast();
  const [quiz, setQuiz] = useState<any>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizPassed, setQuizPassed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQuiz();
    checkQuizStatus();
  }, [courseId, userProfile]);

  const fetchQuiz = async () => {
    try {
      // 1. Try from quizzes table
      const { data: qData } = await supabase
        .from('quizzes')
        .select('*')
        .eq('course_id', courseId)
        .maybeSingle();

      if (qData && qData.questions && qData.questions.length > 0) {
        setQuiz(qData);
        return;
      }

      // 2. Try from lessons quiz_data in this course
      const { data: lessonData } = await supabase
        .from('lessons')
        .select('quiz_data')
        .eq('course_id', courseId)
        .not('quiz_data', 'is', null)
        .limit(1);

      if (lessonData && lessonData.length > 0 && lessonData[0].quiz_data) {
        const qd = lessonData[0].quiz_data;
        setQuiz({
          id: qd.id || `quiz_${courseId}`,
          title: qd.title || "Course Quiz",
          pass_percentage: qd.pass_percentage || 70,
          course_id: courseId,
          questions: qd.questions || [],
        });
      }
    } catch (error) {
      console.warn('Error fetching quiz:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkQuizStatus = async () => {
    try {
      const studentIds = getDualIdArray(userProfile);
      const studentIdList = studentIds.length > 0 ? studentIds : [userProfile?.auth_user_id, user?.id].filter(Boolean);

      const { data } = await supabase
        .from('quiz_attempts')
        .select('passed')
        .eq('course_id', courseId)
        .in('student_id', studentIdList)
        .eq('passed', true)
        .limit(1);

      setQuizPassed((data?.length || 0) > 0);
    } catch (error) {
      console.warn('Error checking quiz status:', error);
    }
  };

  const handleQuizComplete = async (passed: boolean, score: number) => {
    if (passed) {
      setQuizPassed(true);
      
      // Award course completion badge via secure milestone RPC
      try {
        const { data: badgeRes } = await (supabase.rpc as any)('award_milestone_badge', {
          _badge_name: 'Course Completion',
          _student_id: userProfile?.auth_user_id
        });

        if (badgeRes?.awarded) {
          toast({
            title: "Badge Earned! 🏆",
            description: "You've been awarded the Course Completion badge!",
          });
        }
      } catch (error) {
        console.warn('Milestone badge note:', error);
      }

      // Award XP for passing quiz
      try {
        await awardXP(userProfile, XP_REWARDS.QUIZ_PASSED, 'quiz_passed', quiz?.id);
        toast({
          title: "Quiz Passed! 🎯 (+30 XP)",
          description: "Great work! You scored high and earned 30 XP points.",
        });
      } catch (xpErr) {
        console.warn('Quiz XP award note:', xpErr);
      }
    }
    setShowQuiz(false);
  };

  if (loading) {
    return (
      <Card className="shadow-card">
        <CardContent className="p-6">
          <div className="text-center">Loading quiz...</div>
        </CardContent>
      </Card>
    );
  }

  if (!quiz) {
    return (
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Trophy className="w-5 h-5 mr-2 text-primary" />
            Final Quiz
          </CardTitle>
          <CardDescription>
            No quiz available for this course yet.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (showQuiz) {
    return <QuizInterface quiz={quiz} onComplete={handleQuizComplete} />;
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center">
          {quizPassed ? (
            <CheckCircle className="w-5 h-5 mr-2 text-success" />
          ) : (
            <Trophy className="w-5 h-5 mr-2 text-primary" />
          )}
          Final Quiz
        </CardTitle>
        <CardDescription>
          {quizPassed 
            ? "You've successfully completed this course quiz!"
            : `Complete the course quiz to earn your certificate (${quiz.pass_percentage}% required to pass)`
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        {quizPassed ? (
          <div className="flex items-center gap-2 p-4 bg-success/10 border border-success/20 rounded-lg">
            <CheckCircle className="w-5 h-5 text-success" />
            <span className="font-medium text-success">Quiz Completed Successfully!</span>
          </div>
        ) : (
          <Button 
            onClick={() => setShowQuiz(true)}
            className="w-full"
          >
            <Trophy className="w-4 h-4 mr-2" />
            Start Final Quiz
          </Button>
        )}
      </CardContent>
    </Card>
  );
}