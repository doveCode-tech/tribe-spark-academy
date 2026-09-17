import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle2, 
  Circle, 
  Video, 
  BookOpen, 
  Code2, 
  Sparkles, 
  ExternalLink, 
  FileText, 
  Trophy, 
  HelpCircle,
  Zap,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { soundEffects } from "@/utils/audio";

export interface ActivityChecklistItem {
  id: string;
  title: string;
  type?: string;
  editor_type?: string;
  xp_reward?: number;
  is_assignment?: boolean;
  instructions?: string;
}

interface ActivityChecklistProps {
  activities: ActivityChecklistItem[];
  completedIds: string[];
  onToggleComplete: (id: string, completed: boolean, xpAmount: number) => void;
  hasQuiz?: boolean;
  isQuizPassed?: boolean;
  hasAssignment?: boolean;
  isAssignmentSubmitted?: boolean;
  onNavigateToTab?: (tab: string) => void;
}

export function ActivityChecklist({
  activities,
  completedIds,
  onToggleComplete,
  hasQuiz,
  isQuizPassed,
  hasAssignment,
  isAssignmentSubmitted,
  onNavigateToTab
}: ActivityChecklistProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Build unified activity list
  const totalItems: {
    id: string;
    title: string;
    icon: any;
    xp: number;
    completed: boolean;
    tabTarget: string;
    badgeLabel?: string;
  }[] = [];

  // 1. Regular exercises
  activities.forEach((act, idx) => {
    let icon = Code2;
    let tabTarget = "exercises";
    let defaultXp = 40;

    if (act.editor_type === "scratch") {
      icon = Sparkles;
      defaultXp = 40;
    } else if (act.editor_type === "external") {
      icon = ExternalLink;
      defaultXp = 30;
    } else if (act.editor_type === "none" || act.type === "reading") {
      icon = BookOpen;
      defaultXp = 20;
    } else if (act.type === "video") {
      icon = Video;
      tabTarget = "video";
      defaultXp = 25;
    }

    if (act.is_assignment) {
      defaultXp = 100;
    }

    totalItems.push({
      id: act.id || `act_${idx}`,
      title: act.title || `Activity ${idx + 1}`,
      icon,
      xp: act.xp_reward || defaultXp,
      completed: completedIds.includes(act.id || `act_${idx}`),
      tabTarget,
      badgeLabel: act.is_assignment ? "Assignment" : undefined
    });
  });

  // 2. Lesson Quiz (if applicable)
  if (hasQuiz) {
    totalItems.push({
      id: "lesson_quiz",
      title: "Knowledge Check Quiz",
      icon: HelpCircle,
      xp: 30,
      completed: !!isQuizPassed,
      tabTarget: "quiz",
      badgeLabel: "Quiz"
    });
  }

  // 3. Final Assignment (if required and not covered in exercises)
  if (hasAssignment && !activities.some(a => a.is_assignment)) {
    totalItems.push({
      id: "lesson_final_assignment",
      title: "Hands-on Project Submission",
      icon: FileText,
      xp: 100,
      completed: !!isAssignmentSubmitted,
      tabTarget: "assignment",
      badgeLabel: "Project"
    });
  }

  const completedCount = totalItems.filter(item => item.completed).length;
  const progressPercent = totalItems.length > 0 ? Math.round((completedCount / totalItems.length) * 100) : 100;
  const totalAvailableXP = totalItems.reduce((acc, curr) => acc + curr.xp, 0);
  const earnedXP = totalItems.filter(i => i.completed).reduce((acc, curr) => acc + curr.xp, 0);

  if (totalItems.length === 0) {
    return null;
  }

  return (
    <Card className="border shadow-sm bg-card/80 backdrop-blur">
      <CardHeader className="p-3.5 sm:p-4 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <CardTitle className="text-sm font-semibold">
              Lesson Activities Checklist
            </CardTitle>
            <Badge variant="outline" className="text-xs font-semibold px-2 py-0 border-primary/30 bg-primary/5 text-primary">
              {completedCount} / {totalItems.length} Done
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-xs font-bold gap-1">
              <Zap className="w-3 h-3 fill-amber-500 text-amber-500" />
              <span>{earnedXP} / {totalAvailableXP} XP</span>
            </Badge>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Toggle checklist"
            >
              {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1 pt-2">
          <Progress value={progressPercent} className="h-2" />
        </div>
      </CardHeader>

      {!collapsed && (
        <CardContent className="p-3.5 sm:p-4 pt-1 space-y-2">
          <div className="divide-y divide-border/60">
            {totalItems.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between py-2 px-1.5 rounded-lg transition-colors hover:bg-muted/40 ${
                    item.completed ? "opacity-90" : ""
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <button
                      onClick={() => {
                        soundEffects.playChime();
                        onToggleComplete(item.id, !item.completed, item.xp);
                      }}
                      className="shrink-0 text-muted-foreground hover:text-primary transition-colors focus:outline-none"
                    >
                      {item.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-100 dark:fill-emerald-950/50" />
                      ) : (
                        <Circle className="w-5 h-5 text-muted-foreground hover:border-primary" />
                      )}
                    </button>

                    <div 
                      className="cursor-pointer truncate flex-1"
                      onClick={() => onNavigateToTab?.(item.tabTarget)}
                      title={`Go to ${item.tabTarget}`}
                    >
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className={`text-xs font-medium truncate ${item.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {item.title}
                        </span>
                        {item.badgeLabel && (
                          <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                            {item.badgeLabel}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <Badge 
                      variant="outline" 
                      className={`text-[11px] font-semibold gap-1 ${
                        item.completed 
                          ? "border-emerald-300 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30" 
                          : "border-amber-300 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30"
                      }`}
                    >
                      <Zap className="w-2.5 h-2.5 fill-current" />
                      <span>+{item.xp} XP</span>
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
