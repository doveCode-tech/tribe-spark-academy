import { useState, useEffect } from "react";
import { LMSLayout } from "@/components/LMSLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Plus, 
  Clock, 
  Sparkles, 
  Flame, 
  CheckCircle2, 
  Trophy,
  BookOpen,
  ArrowRight
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { 
  StudyPlan, 
  StudyGoal, 
  fetchStudyPlans, 
  fetchStudyGoal, 
  saveStudyGoal 
} from "@/utils/studyPlans";
import { StudyHabitsCard } from "@/components/calendar/StudyHabitsCard";
import { StudyPlanDialog } from "@/components/calendar/StudyPlanDialog";
import { DayDetailSheet } from "@/components/calendar/DayDetailSheet";
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  isToday 
} from "date-fns";
import { useNavigate } from "react-router-dom";

export default function StudyCalendarPage() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [goal, setGoal] = useState<StudyGoal>({ target_days_per_week: 4, target_minutes_per_day: 30 });
  const [currentStreak, setCurrentStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [selectedDayDate, setSelectedDayDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [daySheetOpen, setDaySheetOpen] = useState(false);

  useEffect(() => {
    if (userProfile) {
      loadCalendarData();
    }
  }, [currentDate, userProfile]);

  const loadCalendarData = async () => {
    try {
      setLoading(true);
      const start = format(startOfWeek(startOfMonth(currentDate)), "yyyy-MM-dd");
      const end = format(endOfWeek(endOfMonth(currentDate)), "yyyy-MM-dd");

      const [plansData, goalData, streakRes, activitiesRes] = await Promise.all([
        fetchStudyPlans(userProfile, start, end),
        fetchStudyGoal(userProfile),
        supabase.rpc("get_user_streak"),
        supabase.rpc("get_learning_activity_calendar", { _start_date: start, _end_date: end })
      ]);

      setPlans(plansData);
      setGoal(goalData);

      if (streakRes.data) {
        setCurrentStreak((streakRes.data as any).current_streak || 0);
      }

      setActivities(activitiesRes.data || []);
    } catch (err) {
      console.error("Error loading calendar data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateGoal = async (newGoal: StudyGoal) => {
    setGoal(newGoal);
    await saveStudyGoal(userProfile, newGoal);
  };

  const handlePlanCreated = (newPlan: StudyPlan) => {
    setPlans(prev => [...prev, newPlan]);
  };

  const handleDayClick = (date: Date) => {
    setSelectedDayDate(format(date, "yyyy-MM-dd"));
    setDaySheetOpen(true);
  };

  const handleScheduleForDay = (dayStr: string) => {
    setSelectedDayDate(dayStr);
    setPlanDialogOpen(true);
  };

  // Calendar grid math
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Filter helpers
  const activityDates = activities.map(a => a.activity_date);
  const plannedDates = plans.map(p => p.scheduled_date);

  const upcomingPlans = plans
    .filter(p => p.scheduled_date >= format(new Date(), "yyyy-MM-dd") && p.status === "planned")
    .slice(0, 5);

  return (
    <LMSLayout>
      <div className="space-y-6">
        {/* Header Hero Banner */}
        <div className="bg-gradient-to-r from-primary via-purple-900 to-indigo-950 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-yellow-300 animate-pulse" />
                <span className="text-xs font-semibold uppercase tracking-wider text-purple-200">
                  Daily Learning Schedule
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                Study Calendar & Habit Planner
              </h1>
              <p className="text-purple-200 text-sm max-w-xl mt-1.5 leading-relaxed">
                Build consistent study habits! Schedule your coding and robotics sessions, track daily streaks, and celebrate weekly achievements.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={() => {
                  setSelectedDayDate(format(new Date(), "yyyy-MM-dd"));
                  setPlanDialogOpen(true);
                }}
                className="bg-yellow-400 hover:bg-yellow-300 text-purple-950 font-bold shadow-md gap-1.5 h-10 px-5"
              >
                <Plus className="w-4 h-4" />
                <span>Schedule Session</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Habits Card Tracker */}
        <StudyHabitsCard
          goal={goal}
          onUpdateGoal={handleUpdateGoal}
          activityDates={activityDates}
          plannedDates={plannedDates}
          currentStreak={currentStreak}
        />

        {/* Main Content Layout: Calendar Grid + Upcoming Sessions */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Calendar Grid (3 columns on large screens) */}
          <Card className="lg:col-span-3 shadow-card border-border/80">
            <CardHeader className="pb-4 border-b">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <CalendarIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold">
                      {format(currentDate, "MMMM yyyy")}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">Click any date to see sessions or schedule learning</p>
                  </div>
                </div>

                {/* Month Navigator Controls */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setCurrentDate(prev => subMonths(prev, 1))}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-semibold px-3"
                    onClick={() => setCurrentDate(new Date())}
                  >
                    Today
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setCurrentDate(prev => addMonths(prev, 1))}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-3 sm:p-5">
              {/* Day Headers M T W T F S S */}
              <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((dayName) => (
                  <div
                    key={dayName}
                    className="text-xs font-bold text-muted-foreground uppercase py-1"
                  >
                    {dayName}
                  </div>
                ))}
              </div>

              {/* Month Grid */}
              <div className="grid grid-cols-7 gap-1.5">
                {calendarDays.map((day, idx) => {
                  const dayStr = format(day, "yyyy-MM-dd");
                  const inCurrentMonth = isSameMonth(day, currentDate);
                  const isCurrentDay = isToday(day);
                  const dayPlans = plans.filter(p => p.scheduled_date === dayStr);
                  const dayActivity = activities.find(a => a.activity_date === dayStr);
                  const hasCompletedActivity = !!dayActivity;

                  return (
                    <div
                      key={idx}
                      onClick={() => handleDayClick(day)}
                      className={`min-h-[85px] sm:min-h-[105px] p-1.5 sm:p-2 rounded-xl border text-left cursor-pointer transition-all hover:border-primary/50 hover:shadow-md flex flex-col justify-between ${
                        !inCurrentMonth
                          ? "opacity-35 bg-muted/20 border-transparent"
                          : isCurrentDay
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm"
                          : hasCompletedActivity
                          ? "bg-green-50/40 dark:bg-green-950/15 border-green-500/20"
                          : "bg-card border-border/70"
                      }`}
                    >
                      {/* Day Header row */}
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                            isCurrentDay
                              ? "bg-primary text-white font-extrabold shadow-sm"
                              : hasCompletedActivity
                              ? "text-green-700 dark:text-green-300"
                              : "text-foreground"
                          }`}
                        >
                          {format(day, "d")}
                        </span>

                        {hasCompletedActivity && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                        )}
                      </div>

                      {/* Day Content Badges */}
                      <div className="space-y-1 my-1 flex-1 overflow-hidden">
                        {dayPlans.slice(0, 2).map((plan) => (
                          <div
                            key={plan.id}
                            className={`text-[10px] truncate px-1.5 py-0.5 rounded font-medium ${
                              plan.status === "completed"
                                ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                                : "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                            }`}
                            title={`${plan.title} (${plan.scheduled_time || 'Planned'})`}
                          >
                            {plan.scheduled_time ? `${plan.scheduled_time} ` : ""}{plan.title}
                          </div>
                        ))}

                        {dayPlans.length > 2 && (
                          <span className="text-[9px] text-muted-foreground font-semibold block px-1">
                            +{dayPlans.length - 2} more
                          </span>
                        )}
                      </div>

                      {/* Footer Info (Points or Status) */}
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
                        {dayActivity && dayActivity.points_earned ? (
                          <span className="text-green-600 dark:text-green-400 font-bold flex items-center gap-0.5">
                            <Sparkles className="w-2.5 h-2.5" /> +{dayActivity.points_earned} XP
                          </span>
                        ) : dayPlans.length > 0 ? (
                          <span className="text-purple-600 dark:text-purple-400 font-semibold">
                            {dayPlans.length} session{dayPlans.length > 1 ? "s" : ""}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-4 mt-2 border-t justify-center">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span>Activity Completed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-purple-500" />
                  <span>Scheduled Session</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full border-2 border-primary" />
                  <span>Today</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Sessions Sidebar (1 column) */}
          <div className="space-y-5">
            <Card className="shadow-card border-border/80">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  Upcoming Sessions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {upcomingPlans.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-xs space-y-2">
                    <CalendarIcon className="w-8 h-8 mx-auto text-muted-foreground/50" />
                    <p className="font-medium">No upcoming study sessions</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 gap-1"
                      onClick={() => {
                        setSelectedDayDate(format(new Date(), "yyyy-MM-dd"));
                        setPlanDialogOpen(true);
                      }}
                    >
                      <Plus className="w-3 h-3" /> Schedule One Now
                    </Button>
                  </div>
                ) : (
                  upcomingPlans.map((plan) => (
                    <div
                      key={plan.id}
                      className="p-3 rounded-xl border bg-muted/20 hover:bg-muted/40 transition-all space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h5 className="font-bold text-xs text-foreground leading-tight">
                            {plan.title}
                          </h5>
                          {plan.courses?.title && (
                            <p className="text-[11px] text-primary font-medium mt-0.5">
                              {plan.courses.title}
                            </p>
                          )}
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {format(new Date(plan.scheduled_date), "MMM d")}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                        <span>{plan.scheduled_time || "Anytime"} ({plan.duration_minutes}m)</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[11px] text-primary p-0 hover:underline gap-1"
                          onClick={() => {
                            if (plan.course_id) {
                              navigate(`/courses/${plan.course_id}`);
                            } else {
                              navigate("/courses");
                            }
                          }}
                        >
                          Start <ArrowRight className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Motivation Quote Card for Kids */}
            <Card className="bg-gradient-to-br from-purple-900 to-indigo-950 text-white shadow-md border-0">
              <CardContent className="p-4 text-center space-y-2">
                <Trophy className="w-8 h-8 text-yellow-300 mx-auto" />
                <h4 className="font-bold text-sm">STEM Superpower Tip 🚀</h4>
                <p className="text-xs text-purple-200 leading-relaxed">
                  "Studying 20 minutes every day is 10x better than cramming for 2 hours once a week. Keep that streak alive!"
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Plan Dialog */}
      <StudyPlanDialog
        open={planDialogOpen}
        onOpenChange={setPlanDialogOpen}
        defaultDate={selectedDayDate}
        onPlanCreated={handlePlanCreated}
      />

      {/* Day Detail Sheet */}
      <DayDetailSheet
        open={daySheetOpen}
        onOpenChange={setDaySheetOpen}
        selectedDate={selectedDayDate}
        plans={plans.filter(p => p.scheduled_date === selectedDayDate)}
        activities={activities.filter(a => a.activity_date === selectedDayDate)}
        onPlansUpdated={loadCalendarData}
        onScheduleForDay={handleScheduleForDay}
      />
    </LMSLayout>
  );
}
