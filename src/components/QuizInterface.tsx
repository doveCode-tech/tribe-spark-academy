import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle, Trophy, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Question {
  id: string | number;
  question: string;
  options: string[];
  correctAnswer?: number;
  correct?: number; // Support both field names
  explanation?: string;
}

interface QuizInterfaceProps {
  quiz: {
    id: string;
    title: string;
    description?: string;
    questions: Question[];
    pass_percentage: number;
    course_id: string;
  };
  onComplete?: (passed: boolean, score: number) => void;
}

export function QuizInterface({ quiz, onComplete }: QuizInterfaceProps) {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<{ [key: number]: number }>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [passed, setPassed] = useState(false);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    loadAttempts();
  }, []);

  const loadAttempts = async () => {
    try {
      const { data } = await supabase
        .from('quiz_attempts')
        .select('attempt_number')
        .eq('student_id', userProfile?.auth_user_id)
        .eq('quiz_id', quiz.id)
        .order('attempt_number', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        setAttempts(data[0].attempt_number);
      }
    } catch (error) {
      console.error('Error loading attempts:', error);
    }
  };

  const handleAnswerSelect = (questionIndex: number, answerIndex: number) => {
    setAnswers(prev => ({
      ...prev,
      [questionIndex]: answerIndex
    }));
  };

  const calculateScore = () => {
    let correct = 0;
    quiz.questions.forEach((question, index) => {
      const correctAnswer = question.correctAnswer ?? question.correct ?? 0;
      if (answers[index] === correctAnswer) {
        correct++;
      }
    });
    return Math.round((correct / quiz.questions.length) * 100);
  };

  const submitQuiz = async () => {
    const finalScore = calculateScore();
    const isPassed = finalScore >= quiz.pass_percentage;
    
    setScore(finalScore);
    setPassed(isPassed);
    setIsSubmitted(true);

    try {
      // Save quiz attempt
      const { data: attemptData, error } = await supabase
        .from('quiz_attempts')
        .insert({
          student_id: userProfile?.auth_user_id,
          quiz_id: quiz.id,
          course_id: quiz.course_id,
          answers: Object.entries(answers).map(([questionIndex, answerIndex]) => {
            const question = quiz.questions[parseInt(questionIndex)];
            const correctAnswer = question.correctAnswer ?? question.correct ?? 0;
            return {
              questionIndex: parseInt(questionIndex),
              answerIndex,
              correct: correctAnswer === answerIndex
            };
          }),
          score: finalScore,
          passed: isPassed,
          attempt_number: attempts + 1,
          completed_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // Record learning activity for streak tracking (only for passed quizzes)
      if (isPassed) {
        await supabase.rpc('record_learning_activity', {
          _activity_type: 'quiz_complete',
          _course_id: quiz.course_id,
          _points: 2 // Quizzes worth more points
        });

        // Award streak badges if applicable
        try {
          await supabase.rpc('award_streak_badges');
        } catch (badgeError) {
          console.error('Error awarding streak badges:', badgeError);
          // Don't fail the quiz submission if badge awarding fails
        }
      }

      // Generate certificate if passed
      if (isPassed && attemptData) {
        await supabase.rpc('generate_certificate', {
          _student_id: userProfile?.auth_user_id,
          _course_id: quiz.course_id,
          _quiz_attempt_id: attemptData.id
        });

        toast({
          title: "Congratulations! 🎉",
          description: "You passed the quiz! A certificate has been generated for you.",
        });
      } else {
        toast({
          title: "Quiz Completed",
          description: `You scored ${finalScore}%. ${isPassed ? 'Great job!' : 'You can try again!'}`,
          variant: isPassed ? "default" : "destructive"
        });
      }

      onComplete?.(isPassed, finalScore);
    } catch (error) {
      console.error('Error submitting quiz:', error);
      toast({
        title: "Error",
        description: "Failed to submit quiz. Please try again.",
        variant: "destructive"
      });
    }
  };

  const resetQuiz = () => {
    setCurrentQuestion(0);
    setAnswers({});
    setIsSubmitted(false);
    setScore(0);
    setPassed(false);
  };

  const progress = ((currentQuestion + 1) / quiz.questions.length) * 100;

  if (isSubmitted) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${
            passed ? 'bg-success/20' : 'bg-destructive/20'
          }`}>
            {passed ? (
              <Trophy className="w-8 h-8 text-success" />
            ) : (
              <XCircle className="w-8 h-8 text-destructive" />
            )}
          </div>
          <CardTitle className={passed ? 'text-success' : 'text-destructive'}>
            {passed ? 'Congratulations!' : 'Quiz Complete'}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <div className="text-2xl font-bold">Score: {score}%</div>
          <div className="text-muted-foreground">
            {passed 
              ? `You passed with ${score}%! A certificate has been generated.`
              : `You need ${quiz.pass_percentage}% to pass. Don't give up!`
            }
          </div>
          <div className="space-y-3">
            {quiz.questions.map((question, qIndex) => {
              const userAnswer = answers[qIndex];
              const correctAnswer = question.correctAnswer ?? question.correct ?? 0;
              const isCorrect = userAnswer === correctAnswer;
              
              return (
                <div key={qIndex} className="p-3 border rounded-lg text-left">
                  <div className="flex items-start gap-2">
                    {isCorrect ? (
                      <CheckCircle className="w-5 h-5 text-success mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-destructive mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{question.question}</p>
                      <p className="text-sm text-muted-foreground">
                        Your answer: {question.options[userAnswer]} {isCorrect ? '✓' : '✗'}
                      </p>
                      {!isCorrect && (
                        <p className="text-sm text-success">
                          Correct answer: {question.options[correctAnswer]}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {!passed && (
            <Button onClick={resetQuiz} className="mt-4">
              <RotateCcw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const currentQ = quiz.questions[currentQuestion];

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex justify-between items-center mb-2">
          <CardTitle>{quiz.title}</CardTitle>
          <span className="text-sm text-muted-foreground">
            Question {currentQuestion + 1} of {quiz.questions.length}
          </span>
        </div>
        <Progress value={progress} className="w-full" />
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-4">{currentQ.question}</h3>
          <RadioGroup
            value={answers[currentQuestion]?.toString()}
            onValueChange={(value) => handleAnswerSelect(currentQuestion, parseInt(value))}
          >
            {currentQ.options.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <RadioGroupItem value={index.toString()} id={`option-${index}`} />
                <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                  {option}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrentQuestion(prev => Math.max(0, prev - 1))}
            disabled={currentQuestion === 0}
          >
            Previous
          </Button>
          
          {currentQuestion === quiz.questions.length - 1 ? (
            <Button
              onClick={submitQuiz}
              disabled={Object.keys(answers).length !== quiz.questions.length}
              className="bg-success hover:bg-success/90"
            >
              Submit Quiz
            </Button>
          ) : (
            <Button
              onClick={() => setCurrentQuestion(prev => prev + 1)}
              disabled={answers[currentQuestion] === undefined}
            >
              Next
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}