import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Sparkles, Brain, CheckCircle, Code2, HelpCircle, Trophy, ArrowRight } from "lucide-react";
import { ActivityItem } from "@/components/LessonActivityDialog";
import {
  LearningLevel,
  GeneratedActivityPackage,
  generateAIActivityAndQuiz
} from "@/utils/aiCourseAssistant";

interface AIAssistantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseTitle: string;
  category: string;
  onApplyActivity: (activity: ActivityItem) => void;
  onApplyQuiz: (quizData: any) => void;
}

export function AIAssistantDialog({
  open,
  onOpenChange,
  courseTitle,
  category,
  onApplyActivity,
  onApplyQuiz,
}: AIAssistantDialogProps) {
  const [level, setLevel] = useState<LearningLevel>("beginner");
  const [activeTab, setActiveTab] = useState<"preview_activity" | "preview_quiz">("preview_activity");

  const generatedPackage: GeneratedActivityPackage = generateAIActivityAndQuiz(courseTitle, category, level);

  const handleApplyActivityOnly = () => {
    onApplyActivity(generatedPackage.activity);
    onOpenChange(false);
  };

  const handleApplyQuizOnly = () => {
    onApplyQuiz(generatedPackage.quiz);
    onOpenChange(false);
  };

  const handleApplyBoth = () => {
    onApplyActivity(generatedPackage.activity);
    onApplyQuiz(generatedPackage.quiz);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-600">
              <Sparkles className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                AI Curriculum &amp; Quiz Assistant
                <Badge className="bg-purple-600 text-white text-[10px]">Kid-Friendly AI</Badge>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Intelligently suggests tailored activities &amp; matching quizzes for{" "}
                <span className="font-semibold text-foreground">{courseTitle || "your course"}</span>.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Level Selector */}
        <div className="space-y-3 py-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Select Learning Level:
          </Label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => setLevel("beginner")}
              className={`p-3 rounded-xl border text-left transition-all ${
                level === "beginner"
                  ? "border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/30"
                  : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">🟢 Beginner</span>
                <Badge variant="outline" className="text-[10px]">Ages 7–10</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-2">
                Discovery basics, friendly print outputs, visual analogies, and welcoming syntax.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setLevel("intermediate")}
              className={`p-3 rounded-xl border text-left transition-all ${
                level === "intermediate"
                  ? "border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/30"
                  : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-blue-700 dark:text-blue-400">🟡 Intermediate</span>
                <Badge variant="outline" className="text-[10px]">Ages 11–14</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-2">
                Builds on beginner: introduces lists, loops, if/else conditions, and real-time inputs.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setLevel("advanced")}
              className={`p-3 rounded-xl border text-left transition-all ${
                level === "advanced"
                  ? "border-purple-500 bg-purple-500/10 ring-2 ring-purple-500/30"
                  : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-purple-700 dark:text-purple-400">🔴 Advanced</span>
                <Badge variant="outline" className="text-[10px]">Ages 15+</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-2">
                Modular functions, data structures, error handling, algorithms, and capstone mastery.
              </p>
            </button>
          </div>

          {/* Curriculum Progression Memory Banner */}
          <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-xs flex items-start gap-2">
            <Brain className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
            <div className="space-y-0.5">
              <span className="font-semibold text-purple-900 dark:text-purple-300">
                AI Curriculum Progression Context:
              </span>
              <p className="text-muted-foreground text-[11px]">
                {generatedPackage.progressionContext}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs: Activity vs Quiz Preview */}
        <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="w-full">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="preview_activity" className="text-xs gap-1.5">
              <Code2 className="w-3.5 h-3.5 text-emerald-600" />
              Suggested Activity Blueprint
            </TabsTrigger>
            <TabsTrigger value="preview_quiz" className="text-xs gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
              Matching Quiz ({generatedPackage.quiz.questions.length} Questions)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="preview_activity" className="mt-3 space-y-3">
            <Card className="border bg-card/60">
              <CardContent className="p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-foreground">
                    {generatedPackage.activity.title}
                  </h4>
                  <Badge className="bg-amber-500 text-white text-xs font-bold">
                    +{generatedPackage.activity.xp_reward} XP
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground whitespace-pre-line">
                  {generatedPackage.activity.instructions}
                </p>
                {generatedPackage.activity.starter_code && (
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">Starter Code:</Label>
                    <pre className="text-xs p-3 rounded-lg bg-slate-950 text-emerald-400 font-mono overflow-x-auto max-h-44">
                      {generatedPackage.activity.starter_code}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preview_quiz" className="mt-3 space-y-3">
            <div className="space-y-2.5">
              {generatedPackage.quiz.questions.map((q, idx) => (
                <Card key={q.id || idx} className="border bg-card/60">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">
                        Question {idx + 1}: {q.question}
                      </span>
                      <Badge variant="outline" className="text-[10px]">70% to Pass</Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                      {q.options.map((opt, oIdx) => (
                        <div
                          key={oIdx}
                          className={`p-2 rounded-md text-xs border ${
                            oIdx === q.correctAnswer
                              ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-800 dark:text-emerald-300 font-medium"
                              : "bg-background/80 text-muted-foreground"
                          }`}
                        >
                          <span className="mr-1.5 font-bold">
                            {String.fromCharCode(65 + oIdx)}.
                          </span>
                          {opt} {oIdx === q.correctAnswer && "✓"}
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground italic">
                      💡 Reason/Explanation: {q.explanation}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex-wrap gap-2 sm:justify-between pt-3 border-t">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Cancel
          </Button>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleApplyActivityOnly}
              className="text-xs gap-1"
            >
              Apply Activity Only
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleApplyQuizOnly}
              className="text-xs gap-1"
            >
              Apply Quiz Only
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleApplyBoth}
              className="bg-purple-600 hover:bg-purple-700 text-white text-xs gap-1.5 font-semibold"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Apply Activity + Quiz ✨
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
