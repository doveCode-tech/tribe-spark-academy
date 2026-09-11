import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen, Zap, Sparkles, TrendingUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface HeroSectionProps {
  onStartLearning: () => void;
  studentName?: string;
  enrolledCount?: number;
  progressPercentage?: number;
}

export function HeroSection({
  onStartLearning,
  studentName,
  enrolledCount = 0,
  progressPercentage = 0,
}: HeroSectionProps) {
  const displayName = studentName?.trim() || "";

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/95 via-primary to-blue-700 p-6 md:p-8 text-white shadow-md border border-primary/20">
      {/* Subtle background glow */}
      <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
      <div className="absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-blue-400/10 blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        {/* Left Welcome Details */}
        <div className="space-y-3 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm text-xs font-semibold tracking-wide uppercase">
            <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
            <span>Student Dashboard</span>
          </div>

          <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-white">
            {displayName ? `Welcome back, ${displayName}!` : "Welcome to STEMTribe!"}
          </h1>

          <p className="text-sm md:text-base text-white/85 leading-relaxed">
            {enrolledCount > 0
              ? `You are enrolled in ${enrolledCount} active course${enrolledCount > 1 ? "s" : ""}. Continue where you left off or explore your lessons!`
              : "Welcome to your personalized learning portal! Your tutor or admin will enroll you in your courses soon."}
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 pt-2">
            <Button
              size="default"
              className="bg-white text-primary hover:bg-white/90 font-semibold shadow-sm rounded-lg px-5"
              onClick={onStartLearning}
            >
              Start Learning Today
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>

            <Button
              variant="outline"
              size="default"
              className="border-white/40 bg-white/10 text-white hover:bg-white/20 font-medium rounded-lg px-5 backdrop-blur-sm"
              onClick={onStartLearning}
            >
              <Zap className="w-4 h-4 mr-2 text-yellow-300" />
              Interactive Lessons
            </Button>
          </div>
        </div>

        {/* Right Overall Progress Summary Card */}
        <div className="w-full md:w-72 bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/20 shadow-inner flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-300" />
              <span className="text-xs font-medium text-white/90">Overall Learning Progress</span>
            </div>
            <span className="text-lg font-extrabold text-white">{progressPercentage}%</span>
          </div>

          <Progress
            value={progressPercentage}
            className="h-2.5 bg-white/20"
          />

          <div className="flex items-center justify-between text-xs text-white/75 mt-3 pt-3 border-t border-white/10">
            <span>Enrolled Courses</span>
            <span className="font-semibold text-white">{enrolledCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}