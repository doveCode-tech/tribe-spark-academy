import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Flame, TrendingUp, Calendar, Award, Snowflake } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { createNotification } from "@/utils/notifications";

interface StreakData {
  current_streak: number;
  longest_streak: number;
  total_learning_days: number;
  last_activity_date: string | null;
  streak_freezes_remaining: number;
}

export function StreakDisplay() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [streakData, setStreakData] = useState<StreakData>({
    current_streak: 0,
    longest_streak: 0,
    total_learning_days: 0,
    last_activity_date: null,
    streak_freezes_remaining: 3
  });
  const [loading, setLoading] = useState(true);
  const [usingFreeze, setUsingFreeze] = useState(false);

  useEffect(() => {
    if (!userProfile) return;
    fetchStreakData();

    // Real-time updates for streak changes matching either DB ID or auth UID
    const streakChannel = supabase
      .channel(`streak-display-${userProfile.id || userProfile.auth_user_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_streaks'
        },
        (payload) => {
          const updatedStudentId = (payload.new as any)?.student_id;
          if (
            !updatedStudentId ||
            updatedStudentId === userProfile.id ||
            updatedStudentId === userProfile.auth_user_id
          ) {
            fetchStreakData();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(streakChannel);
    };
  }, [userProfile]);

  const fetchStreakData = async () => {
    try {
      const { data, error } = await supabase.rpc('get_user_streak');
      
      if (error) throw error;
      
      const streakInfo = data as StreakData;
      setStreakData(streakInfo);

      // Check if streak is at risk and notify student once per day
      if (streakInfo && streakInfo.current_streak > 0) {
        const hasLearnedToday = streakInfo.last_activity_date
          ? new Date(streakInfo.last_activity_date).toDateString() === new Date().toDateString()
          : false;

        if (!hasLearnedToday) {
          const todayStr = new Date().toISOString().slice(0, 10);
          const studentAuthId = userProfile?.auth_user_id || userProfile?.id;
          const notificationKey = `streak_notified_${studentAuthId}_${todayStr}`;

          if (studentAuthId && !localStorage.getItem(notificationKey)) {
            localStorage.setItem(notificationKey, "true");
            createNotification({
              recipientUserId: studentAuthId,
              type: "streak_at_risk",
              title: `Streak at Risk! 🔥 (${streakInfo.current_streak} Day${streakInfo.current_streak > 1 ? "s" : ""})`,
              message: `Don't let your ${streakInfo.current_streak}-day learning streak cool off! Complete an activity or study plan today to keep the momentum going!`,
              data: { current_streak: streakInfo.current_streak }
            }).catch((e) => console.warn("Failed to dispatch streak at risk notification:", e));
          }
        }
      }
    } catch (error) {
      console.error('Error fetching streak data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUseFreeze = async () => {
    if (streakData.streak_freezes_remaining <= 0) return;
    setUsingFreeze(true);
    try {
      const { data, error } = await supabase.rpc('use_streak_freeze');
      if (error) throw error;
      const res = data as any;
      if (res?.success) {
        toast({
          title: "Streak Protected! ❄️",
          description: `Streak freeze used successfully. You have ${res.streak_freezes_remaining} freeze(s) left.`,
        });
        fetchStreakData();
      } else {
        toast({
          title: "Streak Freeze",
          description: res?.message || "Could not apply streak freeze.",
          variant: "destructive"
        });
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to use streak freeze.",
        variant: "destructive"
      });
    } finally {
      setUsingFreeze(false);
    }
  };

  const getStreakColor = (streak: number) => {
    if (streak >= 30) return 'text-purple-500';
    if (streak >= 14) return 'text-orange-500';
    if (streak >= 7) return 'text-yellow-500';
    if (streak >= 3) return 'text-green-500';
    return 'text-gray-500';
  };

  const getStreakMessage = (streak: number) => {
    if (streak >= 30) return 'Incredible! You\'re on fire! 🔥';
    if (streak >= 14) return 'Amazing consistency! Keep it up!';
    if (streak >= 7) return 'Great job! One week strong!';
    if (streak >= 3) return 'Good start! Build momentum!';
    if (streak >= 1) return 'Keep going! Every day counts!';
    return 'Start your learning journey today!';
  };

  const isStreakActive = streakData.last_activity_date 
    ? new Date(streakData.last_activity_date).toDateString() === new Date().toDateString()
    : false;

  const getFlameIntensity = (streak: number) => {
    if (streak >= 30) return 'animate-pulse';
    if (streak >= 14) return 'animate-bounce';
    return '';
  };

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-orange-500/10 to-red-500/5 border-orange-500/20">
        <CardContent className="p-4 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-orange-500/10 to-red-500/5 border-orange-500/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center">
          <Flame className={`w-4 h-4 mr-2 ${getStreakColor(streakData.current_streak)} ${getFlameIntensity(streakData.current_streak)}`} />
          Learning Streak
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-center">
          <div className={`text-4xl font-bold ${getStreakColor(streakData.current_streak)}`}>
            {streakData.current_streak}
          </div>
          <div className="text-xs text-muted-foreground">Day Streak</div>
        </div>

        {streakData.current_streak > 0 && (
          <div className="text-center text-xs text-muted-foreground italic">
            {getStreakMessage(streakData.current_streak)}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="text-center p-2 bg-background/50 rounded-lg">
            <TrendingUp className="w-3 h-3 mx-auto mb-1 text-green-500" />
            <div className="font-semibold">{streakData.longest_streak}</div>
            <div className="text-muted-foreground">Best</div>
          </div>
          <div className="text-center p-2 bg-background/50 rounded-lg">
            <Calendar className="w-3 h-3 mx-auto mb-1 text-blue-500" />
            <div className="font-semibold">{streakData.total_learning_days}</div>
            <div className="text-muted-foreground">Total Days</div>
          </div>
        </div>

        {streakData.streak_freezes_remaining > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Award className="w-3.5 h-3.5 text-blue-500" />
              <span>{streakData.streak_freezes_remaining} streak freeze(s) available</span>
            </div>
            {!isStreakActive && streakData.current_streak > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs h-7 border-blue-400/50 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
                onClick={handleUseFreeze}
                disabled={usingFreeze}
              >
                <Snowflake className="w-3 h-3 mr-1 text-blue-500" />
                {usingFreeze ? "Applying freeze..." : "Use Streak Freeze"}
              </Button>
            )}
          </div>
        )}

        {!isStreakActive && streakData.current_streak > 0 && (
          <div className="space-y-2 pt-1 border-t border-orange-500/20">
            <div className="text-center text-xs text-orange-600 dark:text-orange-400 font-medium flex items-center justify-center gap-1">
              <Flame className="w-3.5 h-3.5 animate-pulse text-orange-500 shrink-0" />
              Complete an activity today to keep your streak!
            </div>
            <Button
              size="sm"
              variant="outline"
              asChild
              className="w-full text-xs h-7 border-orange-400/50 text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-950/40"
            >
              <Link to="/calendar">
                <Calendar className="w-3 h-3 mr-1 text-orange-500" />
                Open Learning Calendar
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
