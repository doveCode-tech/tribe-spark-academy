import { useEffect, useState } from "react";
import { LMSLayout } from "@/components/LMSLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Award, Lock, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getDualIdArray } from "@/utils/identity";

interface AchievementBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color?: string;
  earned: boolean;
  earned_at?: string;
}

const Achievements = () => {
  const { userProfile } = useAuth();
  const [allBadges, setAllBadges] = useState<AchievementBadge[]>([]);
  const [filter, setFilter] = useState<"all" | "earned" | "locked">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAchievements();
  }, [userProfile]);

  const fetchAchievements = async () => {
    try {
      setLoading(true);
      // 1. Fetch system badges
      const { data: systemBadges, error: badgeErr } = await supabase
        .from('badges')
        .select('*')
        .order('name');

      if (badgeErr) throw badgeErr;

      // 2. Fetch earned student badges matching either student_id
      const studentIds = getDualIdArray(userProfile);
      let earnedMap = new Map<string, string>();

      if (studentIds.length > 0) {
        const { data: studentBadges, error: studentBadgeErr } = await supabase
          .from('student_badges')
          .select('badge_id, earned_at')
          .in('student_id', studentIds);

        if (!studentBadgeErr && studentBadges) {
          studentBadges.forEach(sb => {
            if (sb.badge_id) earnedMap.set(sb.badge_id, sb.earned_at);
          });
        }
      }

      const combined: AchievementBadge[] = (systemBadges || []).map(b => {
        const earned_at = earnedMap.get(b.id);
        return {
          id: b.id,
          name: b.name,
          description: b.description || 'Complete activities to unlock this badge',
          icon: b.icon || '🏆',
          color: b.color || '#3E0075',
          earned: !!earned_at,
          earned_at: earned_at
        };
      });

      setAllBadges(combined);
    } catch (error) {
      console.error('Error fetching achievements:', error);
    } finally {
      setLoading(false);
    }
  };

  const earnedBadges = allBadges.filter(b => b.earned);
  const lockedBadges = allBadges.filter(b => !b.earned);
  const completionPct = allBadges.length > 0 ? Math.round((earnedBadges.length / allBadges.length) * 100) : 0;
  const totalXP = earnedBadges.length * 100;

  const displayedBadges = filter === "all"
    ? allBadges
    : filter === "earned"
    ? earnedBadges
    : lockedBadges;

  return (
    <LMSLayout>
      <div className="space-y-6">
        {/* Hero Header */}
        <div className="bg-gradient-to-r from-primary to-purple-800 rounded-xl p-6 text-white shadow-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-5 h-5 text-yellow-300 animate-pulse" />
                <span className="text-xs font-semibold uppercase tracking-wider text-purple-200">STEMTribe Milestones</span>
              </div>
              <h1 className="text-3xl font-bold">Your Achievements</h1>
              <p className="text-purple-200 text-sm mt-1">
                {earnedBadges.length} of {allBadges.length} badges unlocked ({completionPct}%)
              </p>
            </div>
            <div className="flex items-center gap-6 bg-white/10 px-5 py-3 rounded-lg backdrop-blur-sm">
              <div className="text-center">
                <div className="text-3xl font-extrabold text-yellow-300">{totalXP}</div>
                <div className="text-xs text-purple-200">Total XP</div>
              </div>
              <div className="h-8 w-px bg-white/20" />
              <div className="text-center">
                <div className="text-3xl font-extrabold">{earnedBadges.length}</div>
                <div className="text-xs text-purple-200">Badges</div>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-1.5">
            <div className="flex justify-between text-xs text-purple-200">
              <span>Collection Progress</span>
              <span>{completionPct}% Completed</span>
            </div>
            <Progress value={completionPct} className="h-2.5 bg-purple-900/50" />
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center justify-between">
          <Tabs value={filter} onValueChange={(v: any) => setFilter(v)}>
            <TabsList>
              <TabsTrigger value="all">All Badges ({allBadges.length})</TabsTrigger>
              <TabsTrigger value="earned">Earned ({earnedBadges.length})</TabsTrigger>
              <TabsTrigger value="locked">To Unlock ({lockedBadges.length})</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Badges Grid */}
        {loading ? (
          <div className="py-12 text-center text-muted-foreground">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
            <p className="text-sm">Loading your achievements...</p>
          </div>
        ) : displayedBadges.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground border-2 border-dashed rounded-xl">
            <Award className="w-12 h-12 mx-auto mb-2 text-muted-foreground/50" />
            <p className="font-medium">No badges in this category yet.</p>
            <p className="text-xs mt-1">Complete lessons, take quizzes, and submit projects to unlock achievements!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {displayedBadges.map((badge) => (
              <Card
                key={badge.id}
                className={`transition-all duration-200 ${
                  badge.earned
                    ? "shadow-sm hover:shadow-md border-green-500/30 bg-gradient-to-br from-green-500/5 to-emerald-500/5"
                    : "opacity-75 hover:opacity-100 border-muted bg-muted/20"
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-sm ${
                        badge.earned
                          ? "bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-300"
                          : "bg-muted text-muted-foreground grayscale"
                      }`}
                    >
                      {badge.icon.startsWith("http") ? (
                        <img src={badge.icon} alt={badge.name} className="w-8 h-8 object-contain" />
                      ) : (
                        badge.icon || <Trophy className="w-6 h-6" />
                      )}
                    </div>
                    <div>
                      {badge.earned ? (
                        <Badge className="bg-green-600 hover:bg-green-600 text-white gap-1 text-xs">
                          <Sparkles className="w-3 h-3" /> Earned
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground gap-1 text-xs">
                          <Lock className="w-3 h-3" /> Locked
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="flex items-baseline justify-between mb-1">
                    <h3 className="font-bold text-base leading-snug">{badge.name}</h3>
                    <span className="text-xs font-semibold text-primary">+100 XP</span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                    {badge.description}
                  </p>
                  {badge.earned && badge.earned_at ? (
                    <div className="text-[11px] text-green-600 dark:text-green-400 font-medium">
                      Unlocked on {new Date(badge.earned_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  ) : (
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Unlocks upon completion
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </LMSLayout>
  );
};

export default Achievements;