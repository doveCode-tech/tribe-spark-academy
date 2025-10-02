import { useEffect, useState } from "react";
import { LMSLayout } from "@/components/LMSLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Star, Target, Zap, Award, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const achievementTemplates = [
  {
    id: 1,
    name: "First Steps",
    description: "Complete your first lesson",
    icon: Star,
    xp: 50,
    category: "Milestone"
  },
  {
    id: 2,
    name: "Python Master",
    description: "Complete the Python Fundamentals course",
    icon: Trophy,
    earned: true,
    earnedDate: "2024-01-20",
    xp: 200,
    category: "Course"
  },
  {
    id: 3,
    name: "Week Warrior",
    description: "Maintain a 7-day learning streak",
    icon: Zap,
    earned: true,
    earnedDate: "2024-01-22",
    xp: 100,
    category: "Streak"
  },
  {
    id: 4,
    name: "Project Pioneer",
    description: "Submit your first project",
    icon: Target,
    earned: true,
    earnedDate: "2024-01-25",
    xp: 150,
    category: "Project"
  },
  {
    id: 5,
    name: "Speed Learner",
    description: "Complete 3 lessons in one day",
    icon: Clock,
    earned: false,
    xp: 75,
    category: "Speed"
  },
  {
    id: 6,
    name: "Code Champion",
    description: "Complete 5 coding challenges",
    icon: Award,
    earned: false,
    xp: 300,
    category: "Challenge"
  }
];

const Achievements = () => {
  const { userProfile } = useAuth();
  const [badges, setBadges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userProfile?.auth_user_id) {
      fetchBadges();
    }
  }, [userProfile]);

  const fetchBadges = async () => {
    try {
      const { data } = await supabase
        .from('student_badges')
        .select('earned_at, badges(*)')
        .eq('student_id', userProfile?.auth_user_id);

      setBadges(data?.map(b => ({ ...b.badges, earned_at: b.earned_at })) || []);
    } catch (error) {
      console.error('Error fetching badges:', error);
    } finally {
      setLoading(false);
    }
  };

  const earnedAchievements = badges.filter(b => b.earned_at);
  const totalXP = earnedAchievements.length * 100;

  return (
    <LMSLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-primary rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Your Achievements</h1>
              <p className="text-primary-foreground/80">
                {earnedAchievements.length} achievements earned
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold">{totalXP}</div>
              <div className="text-primary-foreground/80">Total XP</div>
            </div>
          </div>
          
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-2">
              <span>Badges Earned</span>
              <span>{earnedAchievements.length} total</span>
            </div>
            <Progress 
              value={earnedAchievements.length > 0 ? 100 : 0} 
              className="h-2"
            />
          </div>
        </div>

        {/* Achievement Categories */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <p className="col-span-full text-center text-muted-foreground">Loading achievements...</p>
          ) : earnedAchievements.length === 0 ? (
            <p className="col-span-full text-center text-muted-foreground py-8">
              Complete lessons and earn badges to see your achievements here!
            </p>
          ) : (
            badges.map((achievement) => {
            const IconComponent = Trophy;
            
            return (
              <Card 
                key={achievement.id}
                className="shadow-card transition-all duration-200 hover:shadow-lg ring-2 ring-success/20 bg-success/5"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center bg-success text-success-foreground text-2xl">
                      {achievement.icon || '🏆'}
                    </div>
                    <div className="text-right">
                      <Badge variant="default" className="mb-1 bg-success">
                        Earned
                      </Badge>
                      <div className="text-sm text-muted-foreground">
                        +100 XP
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <h3 className="font-semibold text-lg mb-2">{achievement.name}</h3>
                  <p className="text-muted-foreground text-sm mb-3">
                    {achievement.description}
                  </p>
                  
                  {achievement.earned_at && (
                    <div className="text-xs text-success">
                      Earned on {new Date(achievement.earned_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
          )}
        </div>
      </div>
    </LMSLayout>
  );
};

export default Achievements;