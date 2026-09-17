import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Flame, Target, Clock, CheckCircle2, Trophy, Sparkles, Settings2 } from "lucide-react";
import { StudyGoal } from "@/utils/studyPlans";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";

interface StudyHabitsCardProps {
  goal: StudyGoal;
  onUpdateGoal: (goal: StudyGoal) => Promise<void>;
  activityDates: string[]; // 'yyyy-MM-dd' of completed learning activity
  plannedDates: string[]; // 'yyyy-MM-dd' of planned sessions
  currentStreak: number;
}

export function StudyHabitsCard({
  goal,
  onUpdateGoal,
  activityDates,
  plannedDates,
  currentStreak,
}: StudyHabitsCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [targetDays, setTargetDays] = useState(goal.target_days_per_week || 4);
  const [targetMins, setTargetMins] = useState(goal.target_minutes_per_day || 30);
  const [saving, setSaving] = useState(false);

  // Compute current week days (Monday to Sunday)
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Count days with activity this week
  const daysWithActivityThisWeek = weekDays.filter(day => {
    const dayStr = format(day, "yyyy-MM-dd");
    return activityDates.includes(dayStr);
  }).length;

  const weeklyProgressPct = Math.min(
    100,
    Math.round((daysWithActivityThisWeek / Math.max(1, goal.target_days_per_week)) * 100)
  );

  const estimatedMinutesThisWeek = daysWithActivityThisWeek * (goal.target_minutes_per_day || 30);

  const handleSave = async () => {
    setSaving(true);
    await onUpdateGoal({
      target_days_per_week: targetDays,
      target_minutes_per_day: targetMins
    });
    setSaving(false);
    setDialogOpen(false);
  };

  const getMotivationMessage = () => {
    if (daysWithActivityThisWeek >= goal.target_days_per_week) {
      return "Weekly goal achieved! You're a STEM superstar! 🌟";
    }
    const daysLeft = goal.target_days_per_week - daysWithActivityThisWeek;
    if (daysLeft === 1) return "Just 1 more day to crush this week's target! 🎯";
    return `${daysLeft} more learning days to hit your target this week!`;
  };

  return (
    <>
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-purple-50/50 to-background dark:from-primary/10 dark:via-purple-950/20 dark:to-background shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Target className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">Weekly Study Habit</CardTitle>
              <p className="text-xs text-muted-foreground">{getMotivationMessage()}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              setTargetDays(goal.target_days_per_week);
              setTargetMins(goal.target_minutes_per_day);
              setDialogOpen(true);
            }}
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Goal</span>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Day Badges M T W T F S S */}
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day, idx) => {
              const dayStr = format(day, "yyyy-MM-dd");
              const hasActivity = activityDates.includes(dayStr);
              const isToday = isSameDay(day, today);
              const hasPlanned = plannedDates.includes(dayStr);

              return (
                <div key={idx} className="flex flex-col items-center gap-1">
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    {format(day, "EEE").charAt(0)}
                  </span>
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      hasActivity
                        ? "bg-green-600 text-white shadow-sm ring-2 ring-green-600/30"
                        : hasPlanned
                        ? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-400 border-dashed"
                        : "bg-muted text-muted-foreground"
                    } ${isToday ? "ring-2 ring-primary ring-offset-1" : ""}`}
                    title={`${format(day, "MMM d")}: ${
                      hasActivity ? "Activity completed!" : hasPlanned ? "Session planned" : "No activity"
                    }`}
                  >
                    {hasActivity ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <span>{format(day, "d")}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground font-medium">Goal Progress</span>
              <span className="font-bold text-primary">
                {daysWithActivityThisWeek} / {goal.target_days_per_week} Days ({weeklyProgressPct}%)
              </span>
            </div>
            <Progress value={weeklyProgressPct} className="h-2" />
          </div>

          {/* Summary Stats Grid */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t text-center">
            <div className="bg-background/80 p-2 rounded-lg border border-border/60">
              <div className="flex items-center justify-center gap-1 text-primary mb-0.5">
                <Clock className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">Study Time</span>
              </div>
              <div className="text-lg font-bold">~{estimatedMinutesThisWeek}m</div>
              <div className="text-[10px] text-muted-foreground">This Week</div>
            </div>

            <div className="bg-background/80 p-2 rounded-lg border border-border/60">
              <div className="flex items-center justify-center gap-1 text-orange-500 mb-0.5">
                <Flame className="w-3.5 h-3.5 fill-orange-500" />
                <span className="text-xs font-medium">Streak</span>
              </div>
              <div className="text-lg font-bold text-orange-600">{currentStreak}</div>
              <div className="text-[10px] text-muted-foreground">Days Active</div>
            </div>

            <div className="bg-background/80 p-2 rounded-lg border border-border/60">
              <div className="flex items-center justify-center gap-1 text-yellow-500 mb-0.5">
                <Trophy className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">Daily Target</span>
              </div>
              <div className="text-lg font-bold">{goal.target_minutes_per_day}m</div>
              <div className="text-[10px] text-muted-foreground">Per Session</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Adjust Goal Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Set Your Weekly Learning Goal
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <Label className="font-semibold">Target Learning Days per Week</Label>
                <span className="text-lg font-bold text-primary">{targetDays} days / week</span>
              </div>
              <Slider
                value={[targetDays]}
                min={1}
                max={7}
                step={1}
                onValueChange={(val) => setTargetDays(val[0])}
              />
              <p className="text-xs text-muted-foreground">
                We recommend 3 to 5 days a week for steady STEM skill building!
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <Label className="font-semibold">Target Study Time per Day</Label>
                <span className="text-lg font-bold text-primary">{targetMins} minutes</span>
              </div>
              <Slider
                value={[targetMins]}
                min={15}
                max={120}
                step={15}
                onValueChange={(val) => setTargetMins(val[0])}
              />
              <p className="text-xs text-muted-foreground">
                Bite-sized sessions (20-30 minutes) keep your focus sharp and fun!
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Goal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
