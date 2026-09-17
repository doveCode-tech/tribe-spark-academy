import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { awardXP, XP_REWARDS } from "@/utils/gamification";

interface Props { courseId: string; }

export function ProjectSubmission({ courseId }: Props) {
  const { toast } = useToast();
  const { user, userProfile } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [link, setLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let file_path: string | null = null;
      if (file) {
        const path = `${courseId}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from('project-submissions').upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        file_path = path;
      }

      if (!user) throw new Error('User not authenticated');

      // Use the secure RPC function for project submission
      const { data: projectResult, error: rpcError } = await supabase.rpc('submit_student_project', {
        _course_id: courseId,
        _title: title || 'Project submission',
        _description: description || null,
        _link: link || null,
        _file_path: file_path
      });

      if (rpcError) throw rpcError;

      const projectId = projectResult?.id;

      // Record learning activity for streak tracking
      try {
        await supabase.rpc('record_learning_activity', {
          _activity_type: 'project_submit',
          _course_id: courseId,
          _points: 3 // Projects worth the most points
        });
      } catch (streakError) {
        console.error('Failed to record learning activity:', streakError);
        // Don't fail the submission if streak tracking fails
      }

      // Award streak badges if applicable
      try {
        await supabase.rpc('award_streak_badges');
      } catch (badgeError) {
        console.error('Failed to award streak badges:', badgeError);
        // Don't fail the submission if badge awarding fails
      }

      // Notify admins and tutors
      try {
        if (projectId) {
          await supabase.functions.invoke('notify-project-submission', {
            body: {
              projectId: projectId,
              courseId: courseId,
              studentId: user.id,
              projectTitle: title || 'Project submission',
            }
          });
        }
      } catch (notifError) {
        console.error('Failed to send notifications:', notifError);
        // Don't fail the submission if notifications fail
      }

      // Award 100 XP for project submission
      try {
        await awardXP(userProfile, XP_REWARDS.PROJECT_SUBMITTED, 'project_submitted', projectId);
      } catch (xpErr) {
        console.warn('Project XP award note:', xpErr);
      }

      toast({ 
        title: '🚀 Project Submitted! (+100 XP)', 
        description: 'Your awesome work has been sent to your tutor! You earned 100 XP.' 
      });
      setTitle(""); setDescription(""); setLink(""); setFile(null);
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Error', description: e.message || 'Failed to submit project', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>Submit Your Project 🎯</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Input placeholder="Project title" value={title} onChange={(e)=>setTitle(e.target.value)} disabled={loading} />
          </div>
          <div>
            <Textarea placeholder="Describe your project (optional)" value={description} onChange={(e)=>setDescription(e.target.value)} rows={3} disabled={loading} />
          </div>
          <div>
            <Input placeholder="Link to your project (optional)" value={link} onChange={(e)=>setLink(e.target.value)} disabled={loading} />
          </div>
          <div>
            <Input type="file" onChange={(e)=>setFile(e.target.files?.[0] || null)} disabled={loading} />
            <p className="text-xs text-muted-foreground mt-1">You can upload a file or just share a link — either works! ✨</p>
          </div>
          <div>
            <Button type="submit" disabled={loading}>{loading ? 'Submitting...' : 'Submit Project'}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
