import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, UserPlus } from "lucide-react";

interface User {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  approved: boolean | null;
  auth_user_id: string;
}

interface TutorAssignDialogProps {
  courseId: string;
  users: User[];
  onChange?: () => void;
}

export function TutorAssignDialog({ courseId, users, onChange }: TutorAssignDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedTutorAuthId, setSelectedTutorAuthId] = useState<string | undefined>();
  const [assignedTutorAuthIds, setAssignedTutorAuthIds] = useState<string[]>([]);

  const tutorUsers = useMemo(() =>
    users.filter((u) => u.role === 'tutor' || u.role === 'ultimate_tutor'),
  [users]);

  const tutorsByAuthId = useMemo(() => {
    const map = new Map<string, User>();
    tutorUsers.forEach((t) => {
      if (t.auth_user_id) map.set(t.auth_user_id, t);
    });
    return map;
  }, [tutorUsers]);

  const loadAssignments = async () => {
    const { data, error } = await supabase
      .from('course_tutors')
      .select('tutor_id')
      .eq('course_id', courseId);
    if (error) {
      toast({ title: 'Error', description: 'Failed to load tutor assignments', variant: 'destructive' });
      return;
    }
    setAssignedTutorAuthIds((data || []).map((d) => d.tutor_id as string));
  };

  useEffect(() => {
    if (open) {
      loadAssignments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleAssign = async () => {
    if (!selectedTutorAuthId) return;
    setLoading(true);
    const { error } = await supabase
      .from('course_tutors')
      .insert({ course_id: courseId, tutor_id: selectedTutorAuthId });
    setLoading(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Tutor assigned', description: 'Tutor assigned to course successfully.' });
    setSelectedTutorAuthId(undefined);
    await loadAssignments();
    onChange?.();
  };

  const handleRemove = async (tutorAuthId: string) => {
    setLoading(true);
    const { error } = await supabase
      .from('course_tutors')
      .delete()
      .match({ course_id: courseId, tutor_id: tutorAuthId });
    setLoading(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Removed', description: 'Tutor unassigned from course.' });
    await loadAssignments();
    onChange?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus className="w-4 h-4 mr-1" /> Assign Tutors
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Tutors to Course</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground">Select a tutor to assign</label>
            <div className="mt-2 flex gap-2">
              <Select value={selectedTutorAuthId} onValueChange={setSelectedTutorAuthId}>
                <SelectTrigger className="min-w-[220px]">
                  <SelectValue placeholder="Choose tutor" />
                </SelectTrigger>
                <SelectContent>
                  {tutorUsers.map((tutor) => (
                    <SelectItem key={tutor.auth_user_id} value={tutor.auth_user_id}>
                      {tutor.name || tutor.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleAssign} disabled={!selectedTutorAuthId || loading}>
                Assign
              </Button>
            </div>
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Currently assigned</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {assignedTutorAuthIds.length === 0 ? (
                <span className="text-sm text-muted-foreground">No tutors assigned yet.</span>
              ) : (
                assignedTutorAuthIds.map((authId) => {
                  const tutor = tutorsByAuthId.get(authId);
                  return (
                    <div key={authId} className="flex items-center gap-2">
                      <Badge variant="secondary">{tutor?.name || tutor?.email || authId}</Badge>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleRemove(authId)}
                        disabled={loading}
                        aria-label={`Remove ${tutor?.name || tutor?.email}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
