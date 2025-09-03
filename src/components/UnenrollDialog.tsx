import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AlertTriangle, UserMinus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface UnenrollDialogProps {
  userId: string;
  userName?: string;
  onChange?: () => void;
}

export function UnenrollDialog({ userId, userName, onChange }: UnenrollDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [enrollments, setEnrollments] = useState<any[]>([]);

  const loadEnrollments = async () => {
    try {
      const { data, error } = await supabase
        .from('enrollments')
        .select(`
          id,
          course_id,
          progress_percentage,
          courses (
            id,
            title,
            category
          )
        `)
        .eq('student_id', userId);

      if (error) throw error;
      setEnrollments(data || []);
    } catch (error) {
      console.error('Error loading enrollments:', error);
    }
  };

  const handleUnenroll = async (courseId: string, courseTitle: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('admin_unenroll_student', {
        _student_id: userId,
        _course_id: courseId,
        _reason: 'Unenrolled by administrator'
      });

      if (error) throw error;

      toast({
        title: "Student Unenrolled",
        description: `Successfully unenrolled from ${courseTitle}. All progress has been erased.`,
      });

      loadEnrollments(); // Refresh list
      onChange?.();
    } catch (error: any) {
      console.error('Error unenrolling student:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to unenroll student.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      loadEnrollments();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserMinus className="w-4 h-4 mr-2" />
          Manage Enrollments
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Enrollments</DialogTitle>
          <DialogDescription>
            {userName ? `Manage course enrollments for ${userName}` : 'Manage course enrollments'}
          </DialogDescription>
        </DialogHeader>
        
        {enrollments.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            No active enrollments found.
          </div>
        ) : (
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Warning:</strong> Unenrolling will permanently erase all course progress, 
                completed lessons, quiz attempts, and certificates. This action cannot be undone.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {enrollments.map((enrollment) => (
                <div key={enrollment.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium">{enrollment.courses.title}</h4>
                    <p className="text-sm text-muted-foreground">{enrollment.courses.category}</p>
                    <p className="text-xs text-muted-foreground">
                      Progress: {enrollment.progress_percentage}%
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleUnenroll(enrollment.course_id, enrollment.courses.title)}
                    disabled={loading}
                  >
                    {loading ? "Removing..." : "Unenroll"}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}