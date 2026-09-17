import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { CheckCircle, XCircle, Trophy, RotateCcw, HelpCircle, Key, AlertTriangle, Sparkles, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { soundEffects } from "@/utils/audio";

export interface Question {
  id: string | number;
  question: string;
  options: string[];
  correctAnswer?: number;
  correct?: number; // Support both field names
  explanation?: string;
}

export interface QuizInterfaceProps {
  quiz: {
    id: string;
    title: string;
    description?: string;
    questions: Question[];
    pass_percentage?: number;
    course_id?: string;
  };
  onComplete?: (passed: boolean, score: number) => void;
}

// Utility to shuffle an array (Fisher-Yates)
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Shuffle questions and options while preserving the correct answer mapping
function prepareShuffledQuiz(questions: Question[]): Question[] {
  const shuffledQuestions = shuffleArray(questions);
  return shuffledQuestions.map((q) => {
    const origCorrect = q.correctAnswer ?? q.correct ?? 0;
    const optionPairs = q.options.map((opt, idx) => ({
      text: opt,
      isCorrect: idx === origCorrect,
    }));
    const shuffledPairs = shuffleArray(optionPairs);
    const newCorrectIndex = shuffledPairs.findIndex((p) => p.isCorrect);

    return {
      ...q,
      options: shuffledPairs.map((p) => p.text),
      correctAnswer: newCorrectIndex >= 0 ? newCorrectIndex : 0,
    };
  });
}

export function QuizInterface({ quiz, onComplete }: QuizInterfaceProps) {
  const { userProfile, user } = useAuth();
  const { toast } = useToast();

  const studentId = userProfile?.auth_user_id || user?.id || "anon";
  const passThreshold = quiz.pass_percentage || 70;

  // Active shuffled questions for current attempt
  const [activeQuestions, setActiveQuestions] = useState<Question[]>(() =>
    prepareShuffledQuiz(quiz.questions || [])
  );
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<{ [key: number]: number }>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [passed, setPassed] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Extra attempts granted by Admin / Ultimate Tutor
  const extraAttemptKey = `quiz_extra_attempts_${quiz.id}_${studentId}`;
  const [extraAttempts, setExtraAttempts] = useState<number>(() => {
    try {
      return parseInt(localStorage.getItem(extraAttemptKey) || "0", 10) || 0;
    } catch {
      return 0;
    }
  });

  const maxAllowedAttempts = 2 + extraAttempts;
  const userRole = (userProfile?.role || "").toLowerCase();
  const isStaff = userRole === "admin" || userRole === "ultimate_tutor" || userRole === "tutor" || userRole === "superadmin";

  useEffect(() => {
    loadAttempts();
  }, [quiz.id, studentId]);

  const loadAttempts = async () => {
    try {
      const { data } = await supabase
        .from("quiz_attempts")
        .select("attempt_number")
        .eq("student_id", studentId)
        .eq("quiz_id", quiz.id)
        .order("attempt_number", { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        setAttempts(data[0].attempt_number);
      }
    } catch (error) {
      console.warn("Could not load attempt count:", error);
    }
  };

  const handleAnswerSelect = (qIndex: number, optIndex: number) => {
    setAnswers((prev) => ({
      ...prev,
      [qIndex]: optIndex,
    }));
  };

  const calculateScore = () => {
    if (activeQuestions.length === 0) return 0;
    let correct = 0;
    activeQuestions.forEach((q, idx) => {
      const target = q.correctAnswer ?? q.correct ?? 0;
      if (answers[idx] === target) {
        correct++;
      }
    });
    return Math.round((correct / activeQuestions.length) * 100);
  };

  // Called from Finish Quiz Confirmation modal
  const handleConfirmSubmit = async () => {
    setConfirmOpen(false);
    setSubmitting(true);

    const finalScore = calculateScore();
    const isPassed = finalScore >= passThreshold;

    setScore(finalScore);
    setPassed(isPassed);
    setIsSubmitted(true);

    if (isPassed) {
      soundEffects.playSuccess();
    } else {
      soundEffects.playError();
    }

    try {
      const newAttemptNum = attempts + 1;
      setAttempts(newAttemptNum);

      // Save quiz attempt in Supabase
      const { data: attemptData, error } = await supabase
        .from("quiz_attempts")
        .insert({
          student_id: studentId,
          quiz_id: quiz.id,
          course_id: quiz.course_id || null,
          answers: Object.entries(answers).map(([qIdx, ansIdx]) => {
            const question = activeQuestions[parseInt(qIdx)];
            const correctAnswer = question.correctAnswer ?? question.correct ?? 0;
            return {
              questionIndex: parseInt(qIdx),
              questionText: question.question,
              answerIndex: ansIdx,
              correct: correctAnswer === ansIdx,
            };
          }),
          score: finalScore,
          passed: isPassed,
          attempt_number: newAttemptNum,
          completed_at: new Date().toISOString(),
        })
        .select()
        .maybeSingle();

      if (error) {
        console.warn("Quiz attempt insert note:", error);
      }

      // Record streak learning activity if passed
      if (isPassed && quiz.course_id) {
        try {
          await supabase.rpc("record_learning_activity", {
            _activity_type: "quiz_complete",
            _course_id: quiz.course_id,
            _points: 2,
          });
        } catch (e) {
          console.warn("Streak note:", e);
        }

        try {
          await supabase.rpc("award_streak_badges");
        } catch (e) {
          console.warn("Streak badges note:", e);
        }

        if (attemptData) {
          try {
            await (supabase.rpc as any)("generate_certificate", {
              _student_id: studentId,
              _course_id: quiz.course_id,
              _quiz_attempt_id: attemptData.id,
            });
          } catch (e) {
            console.warn("Certificate note:", e);
          }
        }

        toast({
          title: "🎉 Congratulations! Quiz Passed!",
          description: `You scored ${finalScore}% (>= ${passThreshold}%). Certificate & XP awarded!`,
        });
      } else {
        toast({
          title: `Quiz Finished: ${finalScore}%`,
          description: `Passing grade is ${passThreshold}%. Review the questions below to see why and improve!`,
          variant: "destructive",
        });
      }

      onComplete?.(isPassed, finalScore);
    } catch (err: any) {
      console.error("Error submitting quiz:", err);
      toast({
        title: "Submission Error",
        description: err.message || "Failed to submit quiz attempt.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Reattempt handler: shuffles questions & options and restarts
  const handleTryAgain = () => {
    if (attempts >= maxAllowedAttempts) {
      toast({
        title: "Attempt Limit Reached",
        description: `You have used your ${maxAllowedAttempts} attempts. An Admin or Tutor must authorize extra attempts.`,
        variant: "destructive",
      });
      return;
    }

    // Reshuffle questions and choices
    setActiveQuestions(prepareShuffledQuiz(quiz.questions || []));
    setCurrentQuestion(0);
    setAnswers({});
    setIsSubmitted(false);
    setScore(0);
    setPassed(false);
    toast({
      title: "Quiz Reset 🎲",
      description: "Questions and options have been reshuffled. Good luck!",
    });
  };

  // Admin / Ultimate Tutor overrides limit and grants +1 attempt
  const handleAuthorizeExtraAttempt = () => {
    const updated = extraAttempts + 1;
    setExtraAttempts(updated);
    try {
      localStorage.setItem(extraAttemptKey, String(updated));
    } catch {}
    soundEffects.playChime();
    toast({
      title: "🔑 Extra Attempt Authorized!",
      description: `Admin authorization granted! Total allowed attempts: ${2 + updated}.`,
    });
  };

  const answeredCount = Object.keys(answers).length;
  const progressPercent = activeQuestions.length > 0
    ? ((currentQuestion + 1) / activeQuestions.length) * 100
    : 0;

  // ── 1. Results / Review View ───────────────────────────────────────────────
  if (isSubmitted) {
    const isRetryAvailable = attempts < maxAllowedAttempts;

    return (
      <Card className="max-w-3xl mx-auto border shadow-md">
        <CardHeader className="text-center pb-2">
          <div
            className={`w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center ${
              passed ? "bg-emerald-500/20 text-emerald-600" : "bg-red-500/20 text-red-600"
            }`}
          >
            {passed ? <Trophy className="w-9 h-9" /> : <XCircle className="w-9 h-9" />}
          </div>
          <CardTitle className={`text-2xl font-extrabold ${passed ? "text-emerald-600" : "text-red-600"}`}>
            {passed ? "🎉 Quiz Passed Successfully!" : "Quiz Needs Improvement"}
          </CardTitle>
          <CardDescription className="text-xs">
            Attempt {attempts} of {maxAllowedAttempts} | Passing Threshold: {passThreshold}%
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5 text-center">
          <div className="p-4 rounded-xl border bg-muted/20">
            <div className="text-3xl font-black text-foreground">{score}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {passed
                ? `Outstanding! You achieved ${score}%, surpassing the ${passThreshold}% required score.`
                : `You scored ${score}%. A minimum score of 70% is required to pass.`}
            </p>
          </div>

          {!passed && (
            <div className="p-3.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-left text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Why Did I Fail &amp; How Can I Pass?</span>
              </div>
              <p className="text-muted-foreground">
                Your score was below 70%. Review the questions below to see which answers were incorrect,
                understand the reasoning, and try again!
              </p>
            </div>
          )}

          {/* Itemized Wrong & Right Answer Breakdown */}
          <div className="space-y-3 text-left">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Answer Breakdown &amp; Explanations:
            </h4>
            {activeQuestions.map((question, qIdx) => {
              const userAnswerIdx = answers[qIdx];
              const correctIdx = question.correctAnswer ?? question.correct ?? 0;
              const isCorrect = userAnswerIdx === correctIdx;

              return (
                <div
                  key={qIdx}
                  className={`p-3.5 rounded-lg border transition-all ${
                    isCorrect
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-red-500/30 bg-red-500/5"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {isCorrect ? (
                      <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 space-y-1.5">
                      <p className="text-xs font-semibold text-foreground">
                        {qIdx + 1}. {question.question}
                      </p>

                      <div className="text-xs space-y-0.5">
                        <p className={isCorrect ? "text-emerald-700 dark:text-emerald-300 font-medium" : "text-red-700 dark:text-red-300"}>
                          Your Answer: {question.options[userAnswerIdx] !== undefined ? question.options[userAnswerIdx] : "(Not Answered)"}{" "}
                          {isCorrect ? "✓ (Correct)" : "✗ (Incorrect)"}
                        </p>

                        {!isCorrect && (
                          <p className="text-emerald-700 dark:text-emerald-400 font-medium">
                            Correct Answer: {question.options[correctIdx]} ✓
                          </p>
                        )}
                      </div>

                      {question.explanation && (
                        <div className="p-2 rounded bg-background/80 border text-[11px] text-muted-foreground">
                          💡 <strong>Why:</strong> {question.explanation}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Bar */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            {!passed && isRetryAvailable && (
              <Button onClick={handleTryAgain} className="w-full sm:w-auto bg-primary text-primary-foreground gap-2">
                <RotateCcw className="w-4 h-4" />
                Try Again (Attempt {attempts + 1} of {maxAllowedAttempts})
              </Button>
            )}

            {!passed && !isRetryAvailable && (
              <div className="w-full p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-xs text-red-800 dark:text-red-300 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span>Maximum retry limit reached (2/2 attempts).</span>
                </div>
                {isStaff && (
                  <Button
                    size="sm"
                    onClick={handleAuthorizeExtraAttempt}
                    className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5 text-xs font-semibold"
                  >
                    <Key className="w-3.5 h-3.5" />
                    Authorize Extra Attempt (+1)
                  </Button>
                )}
              </div>
            )}

            {passed && (
              <Button
                onClick={() => onComplete?.(true, score)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-bold px-6"
              >
                <Sparkles className="w-4 h-4" />
                Continue Course
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── 2. Active Question Taking View ─────────────────────────────────────────
  const currentQ = activeQuestions[currentQuestion];
  if (!currentQ) {
    return (
      <Card className="max-w-2xl mx-auto p-6 text-center">
        <p className="text-xs text-muted-foreground">No questions found in this quiz.</p>
      </Card>
    );
  }

  const isLastQuestion = currentQuestion === activeQuestions.length - 1;

  return (
    <>
      <Card className="max-w-2xl mx-auto border shadow-md">
        <CardHeader>
          <div className="flex justify-between items-center mb-1">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-primary" />
              {quiz.title}
            </CardTitle>
            <Badge variant="outline" className="text-xs font-semibold">
              Question {currentQuestion + 1} of {activeQuestions.length}
            </Badge>
          </div>
          <Progress value={progressPercent} className="h-2 w-full" />
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="p-3.5 rounded-lg border bg-muted/20">
            <h3 className="text-sm font-semibold text-foreground leading-relaxed">
              {currentQ.question}
            </h3>
          </div>

          <RadioGroup
            value={answers[currentQuestion] !== undefined ? answers[currentQuestion].toString() : ""}
            onValueChange={(val) => handleAnswerSelect(currentQuestion, parseInt(val, 10))}
            className="space-y-2.5"
          >
            {currentQ.options.map((option, idx) => {
              const isSelected = answers[currentQuestion] === idx;
              return (
                <div
                  key={idx}
                  onClick={() => handleAnswerSelect(currentQuestion, idx)}
                  className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <RadioGroupItem value={idx.toString()} id={`q-opt-${idx}`} />
                  <Label htmlFor={`q-opt-${idx}`} className="flex-1 cursor-pointer text-xs font-medium">
                    <span className="font-bold mr-2">{String.fromCharCode(65 + idx)}.</span>
                    {option}
                  </Label>
                </div>
              );
            })}
          </RadioGroup>

          <div className="flex justify-between items-center pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentQuestion((prev) => Math.max(0, prev - 1))}
              disabled={currentQuestion === 0}
              className="text-xs"
            >
              Previous
            </Button>

            <div className="text-xs text-muted-foreground">
              Answered: <strong className="text-foreground">{answeredCount}</strong> / {activeQuestions.length}
            </div>

            {isLastQuestion ? (
              <Button
                onClick={() => setConfirmOpen(true)}
                disabled={submitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Finish Quiz
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => setCurrentQuestion((prev) => prev + 1)}
                className="text-xs"
              >
                Next
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Finish Quiz Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Save and Submit Quiz?
            </DialogTitle>
            <DialogDescription className="text-xs pt-1">
              You have answered <strong className="text-foreground">{answeredCount}</strong> of{" "}
              <strong className="text-foreground">{activeQuestions.length}</strong> questions.
              Once submitted, your final score will be recorded and checked against the{" "}
              <strong>70%</strong> passing mark.
            </DialogDescription>
          </DialogHeader>

          {answeredCount < activeQuestions.length && (
            <div className="p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs text-amber-800 dark:text-amber-200">
              ⚠️ You still have {activeQuestions.length - answeredCount} unanswered question(s). Are you sure you want to finish now?
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-between pt-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)} className="text-xs">
              Review Answers
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmSubmit}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              Save &amp; Submit Quiz 🚀
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}