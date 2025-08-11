import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UnenrollDialogProps {
  userId: string;
  userName?: string;
  triggerLabel?: string;
  onChange?: () => void;
}

export function UnenrollDialog({ userId, userName, triggerLabel = 'Unenroll', onChange }: UnenrollDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [enrollments, setEnrollments] = useState<{ course_id: string; courses: { id: string; title: string } }[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      const { data, error } = await supabase
        .from('enrollments')
        .select('course_id, courses ( id, title )')
        .eq('student_id', userId)
        .eq('status', 'active');
      if (error) {
        console.error(error);
        return;
      }
      setEnrollments((data as any) || []);
    };
    load();
  }, [open, userId]);

  const submit = async () => {
    if (!selectedCourseId) return;
    setLoading(true);
    const { error } = await supabase.rpc('admin_unenroll_student', { _student_id: userId, _course_id: selectedCourseId });
    setLoading(false);
    if (error) {
      console.error(error);
      toast({ title: 'Error', description: error.message || 'Failed to unenroll', variant: 'destructive' });
      return;
    }
    toast({ title: 'Unenrolled', description: `${userName || 'Student'} was unenrolled.` });
    setOpen(false);
    onChange?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unenroll {userName || 'student'}</DialogTitle>
          <DialogDescription>Select a course to unenroll the student from.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Select onValueChange={setSelectedCourseId} value={selectedCourseId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a course" />
            </SelectTrigger>
            <SelectContent>
              {enrollments.map((e) => (
                <SelectItem key={e.course_id} value={e.course_id}>{e.courses?.title || e.course_id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={submit} disabled={!selectedCourseId || loading}>
            {loading ? 'Unenrolling...' : 'Unenroll'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
