import { LMSLayout } from "@/components/LMSLayout";
import { BadgeDisplay } from "@/components/BadgeDisplay";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Award, Plus, Medal, Sparkles, UserCheck, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getDualIdArray } from "@/utils/identity";
import { soundEffects } from "@/utils/audio";
import { createNotification } from "@/utils/notifications";
import { awardXP } from "@/utils/gamification";

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

  // Award badge state for Staff
  const [awardOpen, setAwardOpen] = useState(false);
  const [awardStudentId, setAwardStudentId] = useState('');
  const [awardBadgeId, setAwardBadgeId] = useState('');
  const [awardReason, setAwardReason] = useState('');
  const [awarding, setAwarding] = useState(false);
  const [studentsList, setStudentsList] = useState<any[]>([]);

  const isStaff = userProfile && (
    userProfile.role === 'admin' ||
    userProfile.role === 'tutor' ||
    userProfile.role === 'ultimate_tutor' ||
    (userProfile.role_level ?? 0) >= 2
  );

  useEffect(() => {
    loadBadges();
    if (userProfile?.role === 'student') {
      loadStudentBadges();
    }
    if (isStaff) {
      loadStudents();
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
    const studentIds = getDualIdArray(userProfile);
    if (studentIds.length === 0) return;
    
    try {
      const { data, error } = await supabase
        .from('student_badges')
        .select(`
          earned_at,
          badge_id,
          badges:badges(*)
        `)
        .in('student_id', studentIds);
      
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

  const loadStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, auth_user_id, name, email, avatar_url')
        .eq('role', 'student')
        .order('name');
      if (error) throw error;
      setStudentsList(data || []);
    } catch (err) {
      console.error('Error loading students:', err);
    }
  };

  const handleAwardBadge = async () => {
    if (!awardStudentId || !awardBadgeId) {
      toast({ title: 'Selection required', description: 'Please select both a student and a badge.', variant: 'destructive' });
      return;
    }
    setAwarding(true);
    try {
      const targetStudent = studentsList.find(s => s.id === awardStudentId || s.auth_user_id === awardStudentId);
      const targetBadge = badges.find(b => b.id === awardBadgeId);
      
      const effectiveStudentId = targetStudent?.auth_user_id || awardStudentId;

      const { error } = await supabase.from('student_badges').insert({
        student_id: effectiveStudentId,
        badge_id: awardBadgeId,
        awarded_by: userProfile?.auth_user_id || userProfile?.id,
        earned_at: new Date().toISOString()
      });

      if (error) {
        if (error.code === '23505') {
          toast({ title: 'Already Awarded', description: 'This student has already received this badge.', variant: 'destructive' });
          setAwarding(false);
          return;
        }
        throw error;
      }

      // Award gamification XP (+50 XP) to student
      try {
        await awardXP(
          effectiveStudentId,
          50,
          `Awarded badge: ${targetBadge?.name || 'Achievement Badge'}`,
          awardBadgeId
        );
      } catch (xpErr) {
        console.warn('Could not award badge XP:', xpErr);
      }

      // Send notification to student
      try {
        createNotification({
          recipientUserId: effectiveStudentId,
          type: 'badge_earned',
          title: `🏅 Badge Awarded: ${targetBadge?.name || 'New Badge!'}`,
          message: `Your instructor awarded you the "${targetBadge?.name}" badge!${awardReason.trim() ? ` Note: "${awardReason.trim()}"` : ''} (+50 XP)`,
          data: { badge_id: awardBadgeId }
        });
      } catch (notifErr) {
        console.warn('Could not send badge notification:', notifErr);
      }

      soundEffects.playSuccess();
      toast({
        title: 'Badge Awarded!',
        description: `Successfully awarded "${targetBadge?.name}" to ${targetStudent?.name || 'student'}.`
      });

      setAwardOpen(false);
      setAwardStudentId('');
      setAwardBadgeId('');
      setAwardReason('');
    } catch (err: any) {
      console.error('Error awarding badge:', err);
      toast({ title: 'Failed to award badge', description: err.message, variant: 'destructive' });
    } finally {
      setAwarding(false);
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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Award className="w-6 h-6 text-primary" />
            <h1 className="text-3xl font-bold">Badge System</h1>
          </div>
          
          {isStaff && (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Award Badge to Student Modal */}
              <Dialog open={awardOpen} onOpenChange={setAwardOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 shadow-sm">
                    <Medal className="w-4 h-4" />
                    Award Badge to Student
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Medal className="w-5 h-5 text-amber-500" />
                      Award Badge to Student
                    </DialogTitle>
                    <DialogDescription>
                      Manually recognize a student's outstanding effort. This badge will immediately appear in their portfolio.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 pt-2">
                    {/* Student Picker */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Select Student</Label>
                      <Select value={awardStudentId} onValueChange={setAwardStudentId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a student..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {studentsList.map((st) => (
                            <SelectItem key={st.id} value={st.id}>
                              {st.name || st.email} ({st.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Badge Picker */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Select Badge to Award</Label>
                      <Select value={awardBadgeId} onValueChange={setAwardBadgeId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a badge..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {badges.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.name} — {b.description}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Optional Note */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Instructor Note (Optional)</Label>
                      <Textarea
                        placeholder="e.g. Outstanding problem solving on the Python project!"
                        value={awardReason}
                        onChange={(e) => setAwardReason(e.target.value)}
                        rows={2}
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="outline" onClick={() => setAwardOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={handleAwardBadge}
                        disabled={!awardStudentId || !awardBadgeId || awarding}
                        className="gap-1.5"
                      >
                        {awarding && <Loader2 className="w-4 h-4 animate-spin" />}
                        Award Badge (+50 XP)
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Create Badge Dialog */}
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-1.5">
                    <Plus className="w-4 h-4" />
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
            </div>
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
        
        {isStaff && (
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