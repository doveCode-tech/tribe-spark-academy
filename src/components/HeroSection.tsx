import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen, Zap, Trophy } from "lucide-react";

interface HeroSectionProps {
  onStartLearning: () => void;
  studentName?: string;
}

export function HeroSection({ onStartLearning, studentName }: HeroSectionProps) {
  const displayName = studentName?.trim() || "";

  return (
    <div className="relative overflow-hidden bg-gradient-hero rounded-3xl p-8 md:p-12 text-white shadow-glow">
      {/* Background decorations */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32"></div>
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-24 -translate-x-24"></div>
      
      <div className="relative z-10 max-w-4xl">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div className="space-y-6">
            <div className="space-y-4">
              <h1 className="text-4xl md:text-6xl font-bold leading-tight">
                {displayName ? `Welcome, ${displayName}!` : "Learn to Code,"}
                <br />
                <span className="bg-gradient-rainbow bg-clip-text text-transparent">
                  {displayName ? "Ready to Build Amazing Projects?" : "Create Amazing Projects"}
                </span>
              </h1>
              
              <p className="text-xl text-white/90 leading-relaxed">
                Join thousands of young learners on an exciting educational journey. 
                Build games, websites, robots, and bring your creative ideas to life.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                size="lg" 
                className="bg-white text-primary hover:bg-white/90 font-bold text-lg px-8 py-4 rounded-xl"
                onClick={onStartLearning}
              >
                Start Learning Today
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              
              <Button 
                variant="outline" 
                size="lg"
                className="border-white/30 text-white hover:bg-white/10 font-semibold text-lg px-8 py-4 rounded-xl"
                onClick={onStartLearning}
              >
                <Zap className="w-5 h-5 mr-2" />
                Interactive Lessons
              </Button>
            </div>

            <div className="flex items-center space-x-8 pt-4">
              <div className="flex items-center space-x-2">
                <BookOpen className="w-6 h-6 text-cyan" />
                <div className="text-sm">
                  <div className="font-semibold">10+ Courses</div>
                  <div className="text-white/70">From Python to AI</div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Trophy className="w-6 h-6 text-yellow" />
                <div className="text-sm">
                  <div className="font-semibold">Real Projects</div>
                  <div className="text-white/70">Build portfolio</div>
                </div>
              </div>
            </div>
          </div>

          <div className="hidden md:block">
            <div className="relative">
              {/* Floating code elements with professional icons */}
              <div className="absolute -top-4 -right-4 bg-white/20 backdrop-blur-sm rounded-xl p-4 rotate-12 animate-bounce">
                <BookOpen className="w-8 h-8" />
                <div className="text-xs font-mono mt-2">Python</div>
              </div>
              
              <div className="absolute top-16 -left-8 bg-white/20 backdrop-blur-sm rounded-xl p-4 -rotate-12 animate-bounce" style={{ animationDelay: '0.5s' }}>
                <Zap className="w-8 h-8" />
                <div className="text-xs font-mono mt-2">AI & ML</div>
              </div>
              
              <div className="absolute bottom-8 right-8 bg-white/20 backdrop-blur-sm rounded-xl p-4 rotate-6 animate-bounce" style={{ animationDelay: '1s' }}>
                <Trophy className="w-8 h-8" />
                <div className="text-xs font-mono mt-2">Games</div>
              </div>
              
              {/* Main illustration placeholder */}
              <div className="w-full h-64 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                <div className="text-center space-y-4">
                  <BookOpen className="w-16 h-16 mx-auto" />
                  <div className="text-lg font-semibold">Start Your Journey</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}