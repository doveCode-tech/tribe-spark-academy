import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Trophy, ChevronRight, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { calculateLevel, fetchStudentXP, LevelProgress } from "@/utils/gamification";

interface XPLevelWidgetProps {
  compact?: boolean;
}

export function XPLevelWidget({ compact = false }: XPLevelWidgetProps) {
  const { userProfile } = useAuth();
  const [levelProgress, setLevelProgress] = useState<LevelProgress>(calculateLevel(0));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadXP();

    const handleLevelUp = () => {
      loadXP();
    };

    window.addEventListener("stemtribe-levelup", handleLevelUp);
    return () => {
      window.removeEventListener("stemtribe-levelup", handleLevelUp);
    };
  }, [userProfile]);

  const loadXP = async () => {
    if (!userProfile) return;
    try {
      const totalXP = await fetchStudentXP(userProfile);
      setLevelProgress(calculateLevel(totalXP));
    } catch {
      // Non-blocking
    } finally {
      setLoading(false);
    }
  };

  const { currentLevel, nextLevel, totalXP, progressPercentage, xpNeededForNextLevel, isMaxLevel } = levelProgress;

  if (compact) {
    return (
      <div className="flex items-center gap-2 bg-background/80 border border-primary/20 rounded-full px-3 py-1 shadow-sm">
        <span className="text-base" role="img" aria-label="level-badge">
          {currentLevel.badge}
        </span>
        <div className="text-xs">
          <span className="font-bold text-foreground">Lvl {currentLevel.level}</span>
          <span className="text-muted-foreground ml-1">({totalXP} XP)</span>
        </div>
      </div>
    );
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-purple-500/5 to-background dark:from-primary/15 dark:via-purple-950/20 dark:to-background shadow-sm overflow-hidden relative">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-md border"
              style={{
                backgroundColor: `${currentLevel.color}15`,
                borderColor: `${currentLevel.color}40`
              }}
            >
              {currentLevel.badge}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <Badge
                  variant="outline"
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: currentLevel.color, borderColor: `${currentLevel.color}40` }}
                >
                  Level {currentLevel.level}
                </Badge>
                <span className="text-xs font-semibold text-muted-foreground">STEM Rank</span>
              </div>
              <CardTitle className="text-xl font-extrabold mt-0.5 text-foreground">
                {currentLevel.title}
              </CardTitle>
            </div>
          </div>

          <div className="text-right">
            <div className="text-2xl font-black text-primary flex items-center justify-end gap-1">
              <Zap className="w-5 h-5 fill-primary text-primary" />
              <span>{totalXP}</span>
            </div>
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Total XP Points
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        <p className="text-xs text-muted-foreground">
          {currentLevel.description}
        </p>

        {/* Progress bar towards next level */}
        {!isMaxLevel && nextLevel ? (
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-muted-foreground">
                Progress to <span className="font-bold text-foreground">{nextLevel.title}</span> ({nextLevel.badge})
              </span>
              <span className="font-bold text-primary">
                {xpNeededForNextLevel} XP needed ({progressPercentage}%)
              </span>
            </div>
            <Progress value={progressPercentage} className="h-2.5 bg-primary/10" />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>{currentLevel.minXP} XP</span>
              <span>{nextLevel.minXP} XP</span>
            </div>
          </div>
        ) : (
          <div className="pt-1 flex items-center gap-1.5 text-xs text-yellow-600 dark:text-yellow-400 font-semibold bg-yellow-50 dark:bg-yellow-950/30 p-2 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <Trophy className="w-4 h-4 text-yellow-500 shrink-0" />
            <span>Maximum Rank Reached! You are a legendary STEM Champion.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
