import { LMSLayout } from "@/components/LMSLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Star, Target, Zap, Award, Clock } from "lucide-react";

const achievements = [
  {
    id: 1,
    name: "First Steps",
    description: "Complete your first lesson",
    icon: Star,
    earned: true,
    earnedDate: "2024-01-15",
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
  const earnedAchievements = achievements.filter(a => a.earned);
  const totalXP = earnedAchievements.reduce((sum, a) => sum + a.xp, 0);

  return (
    <LMSLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-primary rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Your Achievements</h1>
              <p className="text-primary-foreground/80">
                {earnedAchievements.length} of {achievements.length} achievements earned
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold">{totalXP}</div>
              <div className="text-primary-foreground/80">Total XP</div>
            </div>
          </div>
          
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-2">
              <span>Progress</span>
              <span>{Math.round((earnedAchievements.length / achievements.length) * 100)}%</span>
            </div>
            <Progress 
              value={(earnedAchievements.length / achievements.length) * 100} 
              className="h-2"
            />
          </div>
        </div>

        {/* Achievement Categories */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {achievements.map((achievement) => {
            const IconComponent = achievement.icon;
            
            return (
              <Card 
                key={achievement.id}
                className={`shadow-card transition-all duration-200 hover:shadow-lg ${
                  achievement.earned 
                    ? 'ring-2 ring-success/20 bg-success/5' 
                    : 'opacity-75 hover:opacity-100'
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      achievement.earned 
                        ? 'bg-success text-success-foreground' 
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      <IconComponent className="w-6 h-6" />
                    </div>
                    <div className="text-right">
                      <Badge 
                        variant={achievement.earned ? "default" : "secondary"}
                        className="mb-1"
                      >
                        {achievement.category}
                      </Badge>
                      <div className="text-sm text-muted-foreground">
                        +{achievement.xp} XP
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <h3 className="font-semibold text-lg mb-2">{achievement.name}</h3>
                  <p className="text-muted-foreground text-sm mb-3">
                    {achievement.description}
                  </p>
                  
                  {achievement.earned && achievement.earnedDate && (
                    <div className="text-xs text-success">
                      Earned on {new Date(achievement.earnedDate).toLocaleDateString()}
                    </div>
                  )}
                  
                  {!achievement.earned && (
                    <div className="text-xs text-muted-foreground">
                      Not yet earned
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </LMSLayout>
  );
};

export default Achievements;