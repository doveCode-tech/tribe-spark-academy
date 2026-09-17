import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  BookOpen, 
  CheckCircle2, 
  Play, 
  Trash2, 
  Plus, 
  Trophy, 
  Sparkles,
  Award
} from "lucide-react";
import { StudyPlan, updateStudyPlanStatus, deleteStudyPlan } from "@/utils/studyPlans";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { awardXP, XP_REWARDS } from "@/utils/gamification";

interface DayDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: string; // 'yyyy-MM-dd'
  plans: StudyPlan[];
  activities: any[];
  onPlansUpdated: () => void;
  onScheduleForDay: (date: string) => void;
}

export function DayDetailSheet({
  open,
  onOpenChange,
  selectedDate,
  plans,
  activities,
  onPlansUpdated,
  onScheduleForDay,
}: DayDetailSheetProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userProfile } = useAuth();

  const formattedTitle = selectedDate 
    ? format(parseISO(selectedDate), "EEEE, MMMM d, yyyy") 
    : "Day Overview";

  const handleToggleComplete = async (plan: StudyPlan) => {
    const nextStatus = plan.status === "completed" ? "planned" : "completed";
    const ok = await updateStudyPlanStatus(plan.id, nextStatus);
    if (ok) {
      if (nextStatus === "completed") {
        try {
          await awardXP(userProfile, XP_REWARDS.STUDY_SESSION, "study_session", plan.id);
        } catch {
          // non-blocking
        }
      }
      toast({
        title: nextStatus === "completed" ? "Study Session Completed! 🎉 (+40 XP)" : "Status reset to planned",
        description: nextStatus === "completed" 
          ? "Great job! You earned 40 XP, and your streak and habit score have been updated." 
          : "Session marked as planned."
      });
      onPlansUpdated();
    }
  };

  const handleDelete = async (planId: string) => {
    const ok = await deleteStudyPlan(planId);
    if (ok) {
      toast({ title: "Session Removed", description: "The study session has been deleted." });
      onPlansUpdated();
    }
  };

  const handleStartSession = (plan: StudyPlan) => {
    onOpenChange(false);
    if (plan.course_id) {
      navigate(`/courses/${plan.course_id}`);
    } else {
      navigate("/courses");
    }
  };

  const getActivityIcon = (type: string) => {
    if (type?.includes("quiz")) return <Trophy className="w-4 h-4 text-yellow-500" />;
    if (type?.includes("project")) return <Award className="w-4 h-4 text-purple-500" />;
    return <CheckCircle2 className="w-4 h-4 text-green-500" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="pb-2 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-primary" />
              <DialogTitle className="text-lg font-bold">{formattedTitle}</DialogTitle>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-xs h-8 border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => {
                onOpenChange(false);
                onScheduleForDay(selectedDate);
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Schedule Session</span>
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-3">
          {/* Scheduled Study Plans */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-primary" />
              Scheduled Study Sessions ({plans.length})
            </h4>

            {plans.length === 0 ? (
              <div className="bg-muted/30 border border-dashed rounded-xl p-6 text-center text-muted-foreground">
                <Sparkles className="w-8 h-8 text-primary/40 mx-auto mb-2" />
                <p className="text-sm font-medium">No sessions scheduled for this day</p>
                <p className="text-xs mt-1">Plan a 20-30 minute session to stay consistent with your STEM goals!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    className={`p-4 rounded-xl border transition-all ${
                      plan.status === "completed"
                        ? "bg-green-50/60 dark:bg-green-950/20 border-green-500/30"
                        : "bg-card hover:shadow-sm border-border"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="font-bold text-sm text-foreground">{plan.title}</h5>
                          {plan.status === "completed" ? (
                            <Badge className="bg-green-600 hover:bg-green-600 text-white text-[10px] gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Done
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-purple-600 dark:text-purple-400 border-purple-300 text-[10px]">
                              Planned
                            </Badge>
                          )}
                        </div>

                        {plan.courses?.title && (
                          <div className="flex items-center gap-1 text-xs text-primary font-medium mt-1">
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>{plan.courses.title}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5">
                          {plan.scheduled_time && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {plan.scheduled_time}
                            </span>
                          )}
                          <span>Duration: {plan.duration_minutes || 30} mins</span>
                        </div>

                        {plan.notes && (
                          <p className="text-xs text-muted-foreground italic mt-2 bg-muted/40 p-2 rounded-md">
                            "{plan.notes}"
                          </p>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-col sm:flex-row items-end gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          variant={plan.status === "completed" ? "outline" : "default"}
                          className={`h-7 text-xs gap-1 ${
                            plan.status === "completed" 
                              ? "text-green-700 dark:text-green-300 border-green-300"
                              : "bg-primary text-white"
                          }`}
                          onClick={() => handleToggleComplete(plan)}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{plan.status === "completed" ? "Mark Planned" : "Complete"}</span>
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 text-primary hover:bg-primary/10"
                          onClick={() => handleStartSession(plan)}
                        >
                          <Play className="w-3 h-3 fill-primary" />
                          <span>Start</span>
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(plan.id)}
                          title="Delete session"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Completed Activities Logged on this day */}
          {activities.length > 0 && (
            <div className="pt-2 border-t">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                Completed Learning Activities ({activities.length})
              </h4>

              <div className="space-y-2">
                {activities.map((act, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-lg bg-green-50/40 dark:bg-green-950/20 border border-green-500/20 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      {getActivityIcon(act.activity_type)}
                      <div>
                        <span className="font-semibold text-foreground capitalize">
                          {act.activity_type.replace(/_/g, " ")}
                        </span>
                        {act.courses?.title && (
                          <span className="text-muted-foreground ml-1.5">
                            • {act.courses.title}
                          </span>
                        )}
                      </div>
                    </div>

                    <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-200">
                      +{act.points_earned || 1} XP Points
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
