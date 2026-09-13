import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Flame, TrendingUp, Calendar, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface StreakData {
  current_streak: number;
  longest_streak: number;
  total_learning_days: number;
  last_activity_date: string | null;
  streak_freezes_remaining: number;
}

export function StreakDisplay() {
  const { userProfile } = useAuth();
  const [streakData, setStreakData] = useState<StreakData>({
    current_streak: 0,
    longest_streak: 0,
    total_learning_days: 0,
    last_activity_date: null,
    streak_freezes_remaining: 3
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStreakData();

    // Real-time updates for streak changes
    const streakChannel = supabase
      .channel('streak-display-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_streaks',
          filter: `student_id=eq.${userProfile?.auth_user_id}`
        },
        () => fetchStreakData()
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
      
      setStreakData(data as StreakData);
    } catch (error) {
      console.error('Error fetching streak data:', error);
    } finally {
      setLoading(false);
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
          <div className="text-center text-xs text-muted-foreground">
            <Award className="w-3 h-3 inline mr-1" />
            {streakData.streak_freezes_remaining} streak freeze(s) available
          </div>
        )}

        {!isStreakActive && streakData.current_streak > 0 && (
          <div className="text-center text-xs text-orange-500 font-medium">
            Complete a lesson today to keep your streak!
          </div>
        )}
      </CardContent>
    </Card>
  );
}
