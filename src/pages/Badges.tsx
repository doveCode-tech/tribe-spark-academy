import { LMSLayout } from "@/components/LMSLayout";
import { BadgeDisplay } from "@/components/BadgeDisplay";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Award, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  earned_at?: string;
}

export default function Badges() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [studentBadges, setStudentBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();

  useEffect(() => {
    loadBadges();
    if (userProfile?.role === 'student') {
      loadStudentBadges();
    }
  }, [userProfile]);

  const loadBadges = async () => {
    try {
      const { data, error } = await supabase
        .from('badges')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setBadges((data || []).map(badge => ({
        ...badge,
        description: badge.description || 'No description available',
        icon: badge.icon || 'Award',
        color: badge.color || '#FFD700'
      })));
    } catch (error) {
      console.error('Error loading badges:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStudentBadges = async () => {
    if (!userProfile?.auth_user_id) return;
    
    try {
      const { data, error } = await supabase
        .from('student_badges')
        .select(`
          earned_at,
          badge_id,
          badges:badges(*)
        `)
        .eq('student_id', userProfile.auth_user_id);
      
      if (error) throw error;
      
      const earnedBadges = data?.map(sb => ({
        ...sb.badges,
        description: sb.badges?.description || 'No description available',
        icon: sb.badges?.icon || 'Award',
        color: sb.badges?.color || '#FFD700',
        earned_at: sb.earned_at
      })) || [];
      
      setStudentBadges(earnedBadges);
    } catch (error) {
      console.error('Error loading student badges:', error);
    }
  };

  if (loading) {
    return (
      <LMSLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading badges...</div>
        </div>
      </LMSLayout>
    );
  }

  return (
    <LMSLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-6 h-6 text-primary" />
            <h1 className="text-3xl font-bold">Badge System</h1>
          </div>
          
          {(userProfile?.role === 'admin' || userProfile?.role === 'tutor') && (
            <Button variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Create Badge
            </Button>
          )}
        </div>
        
        {userProfile?.role === 'student' && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>My Earned Badges ({studentBadges.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {studentBadges.length > 0 ? (
                  <BadgeDisplay badges={studentBadges} />
                ) : (
                  <p className="text-muted-foreground">You haven't earned any badges yet. Complete courses and activities to earn badges!</p>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Available Badges</CardTitle>
              </CardHeader>
              <CardContent>
                <BadgeDisplay badges={badges} showDescription={true} />
              </CardContent>
            </Card>
          </>
        )}
        
        {(userProfile?.role === 'admin' || userProfile?.role === 'tutor') && (
          <Card>
            <CardHeader>
              <CardTitle>All Badges ({badges.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {badges.length > 0 ? (
                <BadgeDisplay badges={badges} showDescription={true} />
              ) : (
                <p className="text-muted-foreground">No badges created yet.</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </LMSLayout>
  );
}