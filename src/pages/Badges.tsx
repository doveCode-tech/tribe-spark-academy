import { LMSLayout } from "@/components/LMSLayout";
import { BadgeDisplay } from "@/components/BadgeDisplay";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Award, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [newBadge, setNewBadge] = useState({ name: '', description: '', icon: 'Award', color: '#FFD700' });
  const iconOptions = ['Award','Trophy','Star','Gamepad2','BookOpen','Users','FileText','GraduationCap'];

  useEffect(() => {
    loadBadges();
    if (userProfile?.role === 'student') {
      loadStudentBadges();
    }

    // Real-time updates for badges and student badges
    const badgesChannel = supabase
      .channel('badges-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'badges'
        },
        () => loadBadges()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'student_badges',
          filter: `student_id=eq.${userProfile?.auth_user_id}`
        },
        () => loadStudentBadges()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(badgesChannel);
    };
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

  const handleCreateBadge = async () => {
    try {
      if (!newBadge.name) {
        toast({ title: 'Name required', description: 'Please enter a badge name.', variant: 'destructive' });
        return;
      }
      const { error } = await supabase.from('badges').insert({
        name: newBadge.name,
        description: newBadge.description || null,
        icon: newBadge.icon,
        color: newBadge.color || '#FFD700',
      });
      if (error) throw error;
      toast({ title: 'Badge created', description: 'New badge has been added.' });
      setCreateOpen(false);
      setNewBadge({ name: '', description: '', icon: 'Award', color: '#FFD700' });
      await loadBadges();
    } catch (e: any) {
      console.error('Error creating badge:', e);
      toast({ title: 'Error', description: e.message || 'Failed to create badge', variant: 'destructive' });
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
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Badge
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                  <DialogTitle>Create Badge</DialogTitle>
                  <DialogDescription>Define the badge details below.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="badge-name">Name</Label>
                    <Input id="badge-name" value={newBadge.name} onChange={(e)=>setNewBadge({ ...newBadge, name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="badge-desc">Description</Label>
                    <Textarea id="badge-desc" rows={3} value={newBadge.description} onChange={(e)=>setNewBadge({ ...newBadge, description: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Icon</Label>
                      <Select value={newBadge.icon} onValueChange={(v)=>setNewBadge({ ...newBadge, icon: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select icon" />
                        </SelectTrigger>
                        <SelectContent>
                          {iconOptions.map((opt)=> (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="badge-color">Color</Label>
                      <Input id="badge-color" type="color" value={newBadge.color} onChange={(e)=>setNewBadge({ ...newBadge, color: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={()=>setCreateOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreateBadge} disabled={!newBadge.name}>Create</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
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