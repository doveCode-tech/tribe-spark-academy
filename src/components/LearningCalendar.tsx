import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, CheckCircle, BookOpen, Trophy, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ActivityDay {
  activity_date: string;
  activity_count: number;
  points_earned: number;
  activity_types: string[];
}

export function LearningCalendar() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activityData, setActivityData] = useState<ActivityDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivityData();
  }, [currentDate, userProfile]);

  const fetchActivityData = async () => {
    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      
      // Extend range to include full months before/after for better UX
      const startDate = new Date(startOfMonth);
      startDate.setDate(startDate.getDate() - 7);
      
      const endDate = new Date(endOfMonth);
      endDate.setDate(endDate.getDate() + 7);

      const { data, error } = await supabase.rpc('get_learning_activity_calendar', {
        _start_date: format(startDate, 'yyyy-MM-dd'),
        _end_date: format(endDate, 'yyyy-MM-dd')
      });

      if (error) throw error;
      
      setActivityData(data || []);
    } catch (error) {
      console.error('Error fetching activity data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityForDate = (date: Date): ActivityDay | null => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return activityData.find(day => day.activity_date === dateStr) || null;
  };

  const getActivityLevel = (activity: ActivityDay | null): number => {
    if (!activity) return 0;
    if (activity.activity_count >= 4) return 4;
    if (activity.activity_count >= 3) return 3;
    if (activity.activity_count >= 2) return 2;
    return 1;
  };

  const getActivityColor = (level: number): string => {
    switch (level) {
      case 4: return 'bg-green-500';
      case 3: return 'bg-green-400';
      case 2: return 'bg-green-300';
      case 1: return 'bg-green-200';
      default: return 'bg-gray-100 dark:bg-gray-800';
    }
  };

  const getActivityIcon = (activity: ActivityDay) => {
    if (activity.activity_types.includes('quiz_complete')) {
      return <Trophy className="w-3 h-3 text-yellow-500" />;
    }
    if (activity.activity_types.includes('lesson_complete')) {
      return <CheckCircle className="w-3 h-3 text-green-500" />;
    }
    return <BookOpen className="w-3 h-3 text-blue-500" />;
  };

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const renderCalendarDays = () => {
    const days = [];
    const today = new Date();
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(
        <div key={`empty-${i}`} className="h-8 w-8" />
      );
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const activity = getActivityForDate(date);
      const activityLevel = getActivityLevel(activity);
      const isToday = date.toDateString() === today.toDateString();
      const isFuture = date > today;

      days.push(
        <div
          key={day}
          className={`h-8 w-8 flex items-center justify-center rounded-md cursor-pointer transition-all hover:scale-110
            ${isToday ? 'ring-2 ring-primary ring-offset-2' : ''}
            ${isFuture ? 'opacity-30 cursor-not-allowed' : ''}
          `}
          title={activity ? `${activity.activity_count} activities, ${activity.points_earned} points` : 'No activity'}
        >
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium
            ${getActivityColor(activityLevel)}
            ${isToday ? 'font-bold' : ''}
          `}>
            {activity && !isFuture && getActivityIcon(activity)}
            {!activity && !isFuture && day}
          </div>
        </div>
      );
    }

    return days;
  };

  const getMonthStats = () => {
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startStr = format(startOfMonth, 'yyyy-MM-dd');
    const endStr = format(endOfMonth, 'yyyy-MM-dd');
    
    const monthActivities = activityData.filter(day => {
      return day.activity_date >= startStr && day.activity_date <= endStr;
    });

    const activeDays = monthActivities.length;
    const totalPoints = monthActivities.reduce((sum, day) => sum + day.points_earned, 0);
    const totalActivities = monthActivities.reduce((sum, day) => sum + day.activity_count, 0);

    return { activeDays, totalPoints, totalActivities };
  };

  const stats = getMonthStats();

  if (loading) {
    return (
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <CalendarIcon className="w-5 h-5 mr-2 text-primary" />
            Learning Calendar
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <CalendarIcon className="w-5 h-5 mr-2 text-primary" />
            Learning Calendar
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={goToToday} className="h-7 text-xs">
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs text-primary gap-1 border-primary/30 hover:bg-primary/10"
              onClick={() => navigate('/calendar')}
            >
              <span>Full Calendar</span>
              <ExternalLink className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Month Navigation */}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={previousMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h3 className="font-semibold">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h3>
          <Button variant="outline" size="sm" onClick={nextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {/* Day headers */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="font-medium text-muted-foreground py-1">
              {day}
            </div>
          ))}
          
          {/* Calendar days */}
          {renderCalendarDays()}
        </div>

        {/* Activity Legend */}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <span>Less</span>
          {[1, 2, 3, 4].map(level => (
            <div
              key={level}
              className={`w-3 h-3 rounded-full ${getActivityColor(level)}`}
            />
          ))}
          <span>More</span>
        </div>

        {/* Month Stats */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t">
          <div className="text-center">
            <div className="text-lg font-bold text-primary">{stats.activeDays}</div>
            <div className="text-xs text-muted-foreground">Active Days</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-500">{stats.totalActivities}</div>
            <div className="text-xs text-muted-foreground">Activities</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-yellow-500">{stats.totalPoints}</div>
            <div className="text-xs text-muted-foreground">Points</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
