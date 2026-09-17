import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, ArrowUp, ArrowDown, HelpCircle, CheckCircle2, AlertCircle } from "lucide-react";
import { QuizQuestion } from "@/utils/aiCourseAssistant";

export interface QuizData {
  id: string;
  title: string;
  pass_percentage: number;
  questions: QuizQuestion[];
}

interface QuizCuratorProps {
  quizData: QuizData | null;
  onChange: (quiz: QuizData) => void;
  lessonTitle?: string;
}

export function QuizCurator({ quizData, onChange, lessonTitle = "Lesson" }: QuizCuratorProps) {
  const currentQuiz: QuizData = quizData || {
    id: crypto.randomUUID(),
    title: `${lessonTitle} Quiz`,
    pass_percentage: 70,
    questions: [],
  };

  const updateQuizField = (field: keyof QuizData, value: any) => {
    onChange({
      ...currentQuiz,
      [field]: value,
    });
  };

  const addQuestion = () => {
    const newQ: QuizQuestion = {
      id: crypto.randomUUID(),
      question: "",
      options: ["Option A", "Option B", "Option C", "Option D"],
      correctAnswer: 0,
      explanation: "",
    };
    updateQuizField("questions", [...currentQuiz.questions, newQ]);
  };

  const updateQuestion = (index: number, field: keyof QuizQuestion, value: any) => {
    const updated = currentQuiz.questions.map((q, i) =>
      i === index ? { ...q, [field]: value } : q
    );
    updateQuizField("questions", updated);
  };

  const updateOption = (qIndex: number, optIndex: number, text: string) => {
    const q = currentQuiz.questions[qIndex];
    const newOptions = [...q.options];
    newOptions[optIndex] = text;
    updateQuestion(qIndex, "options", newOptions);
  };

  const removeQuestion = (index: number) => {
    const updated = currentQuiz.questions.filter((_, i) => i !== index);
    updateQuizField("questions", updated);
  };

  const moveQuestion = (index: number, direction: "up" | "down") => {
    const newIdx = direction === "up" ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= currentQuiz.questions.length) return;
    const copy = [...currentQuiz.questions];
    const temp = copy[index];
    copy[index] = copy[newIdx];
    copy[newIdx] = temp;
    updateQuizField("questions", copy);
  };

  return (
    <div className="space-y-4 p-4 rounded-xl border border-blue-500/30 bg-blue-500/5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-blue-950 dark:text-blue-200 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-blue-600" />
            Quiz Curator &amp; Question Builder ({currentQuiz.questions.length} questions)
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Curate quiz questions for this lesson. Students must achieve 70% to pass and earn XP!
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs">
            <Label className="text-[11px] font-semibold text-muted-foreground">Passing Score:</Label>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={50}
                max={100}
                value={currentQuiz.pass_percentage || 70}
                onChange={(e) => updateQuizField("pass_percentage", parseInt(e.target.value) || 70)}
                className="w-14 h-7 text-xs text-center font-bold"
              />
              <span className="text-xs font-bold text-muted-foreground">%</span>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={addQuestion}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-1 h-8 text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Question
          </Button>
        </div>
      </div>

      {currentQuiz.questions.length === 0 ? (
        <div className="text-center py-6 border border-dashed rounded-lg bg-background/50 space-y-2">
          <AlertCircle className="w-6 h-6 text-muted-foreground mx-auto" />
          <p className="text-xs text-muted-foreground">
            No questions added to this quiz yet. Click <strong>Add Question</strong> or use the{" "}
            <strong>AI Assistant</strong> to auto-generate questions!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {currentQuiz.questions.map((q, idx) => (
            <Card key={q.id || idx} className="border bg-background shadow-xs">
              <CardContent className="p-3.5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px] font-bold">
                      Q{idx + 1}
                    </Badge>
                    <span className="text-xs font-semibold text-foreground">Question {idx + 1}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => moveQuestion(idx, "up")}
                      disabled={idx === 0}
                      className="h-6 w-6 p-0"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => moveQuestion(idx, "down")}
                      disabled={idx === currentQuiz.questions.length - 1}
                      className="h-6 w-6 p-0"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeQuestion(idx)}
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-muted-foreground">Question Text:</Label>
                  <Input
                    placeholder="e.g. What function outputs text to the terminal in Python?"
                    value={q.question}
                    onChange={(e) => updateQuestion(idx, "question", e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                {/* 4 Options */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-muted-foreground flex items-center justify-between">
                    <span>Options &amp; Correct Answer (select radio for correct option):</span>
                    <span className="text-[10px] text-emerald-600 font-semibold">
                      ✓ Correct: Option {String.fromCharCode(65 + (q.correctAnswer ?? 0))}
                    </span>
                  </Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {q.options.map((opt, oIdx) => {
                      const isCorrect = (q.correctAnswer ?? 0) === oIdx;
                      return (
                        <div
                          key={oIdx}
                          className={`flex items-center gap-1.5 p-1.5 rounded-md border text-xs ${
                            isCorrect
                              ? "border-emerald-500/60 bg-emerald-500/10"
                              : "border-slate-200 dark:border-slate-800 bg-background"
                          }`}
                        >
                          <input
                            type="radio"
                            name={`correct_${q.id || idx}`}
                            checked={isCorrect}
                            onChange={() => updateQuestion(idx, "correctAnswer", oIdx)}
                            className="cursor-pointer text-emerald-600"
                          />
                          <span className="font-bold text-[11px] text-muted-foreground w-4">
                            {String.fromCharCode(65 + oIdx)}.
                          </span>
                          <Input
                            value={opt}
                            onChange={(e) => updateOption(idx, oIdx, e.target.value)}
                            placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                            className="h-6 text-xs border-none shadow-none focus-visible:ring-0 p-0"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Explanation / Why */}
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                    <span>Why / Explanation (shown when students fail or review answers):</span>
                  </Label>
                  <Input
                    placeholder="e.g. print() is the built-in function that displays text in the terminal."
                    value={q.explanation || ""}
                    onChange={(e) => updateQuestion(idx, "explanation", e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
