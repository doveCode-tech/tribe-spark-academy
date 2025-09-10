import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, CheckCircle, Award } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { QuizInterface } from './QuizInterface';
import { useToast } from '@/hooks/use-toast';

interface QuizSectionProps {
  courseId: string;
}

export function QuizSection({ courseId }: QuizSectionProps) {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [quiz, setQuiz] = useState<any>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizPassed, setQuizPassed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQuiz();
    checkQuizStatus();
  }, [courseId]);

  const fetchQuiz = async () => {
    try {
      const { data, error } = await supabase
        .from('quizzes')
        .select('*')
        .eq('course_id', courseId)
        .single();

      if (error) throw error;
      setQuiz(data);
    } catch (error) {
      console.error('Error fetching quiz:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkQuizStatus = async () => {
    try {
      const { data } = await supabase
        .from('quiz_attempts')
        .select('passed')
        .eq('course_id', courseId)
        .eq('student_id', userProfile?.auth_user_id)
        .eq('passed', true)
        .limit(1);

      setQuizPassed((data?.length || 0) > 0);
    } catch (error) {
      console.error('Error checking quiz status:', error);
    }
  };

  const handleQuizComplete = async (passed: boolean, score: number) => {
    if (passed) {
      setQuizPassed(true);
      
      // Award course completion badge
      try {
        // Check if a course completion badge exists
        const { data: badge } = await supabase
          .from('badges')
          .select('id')
          .eq('name', 'Course Completion')
          .limit(1);

        if (badge && badge.length > 0) {
          await supabase.rpc('award_badge', {
            _student_id: userProfile?.auth_user_id,
            _badge_id: badge[0].id
          });

          toast({
            title: "Badge Earned! 🏆",
            description: "You've been awarded the Course Completion badge!",
          });
        }
      } catch (error) {
        console.error('Error awarding badge:', error);
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