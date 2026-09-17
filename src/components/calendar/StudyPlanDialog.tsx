import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, Clock, BookOpen, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { createStudyPlan, StudyPlan } from "@/utils/studyPlans";
import { getDualIdArray } from "@/utils/identity";
import { useToast } from "@/hooks/use-toast";

interface StudyPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: string; // 'yyyy-MM-dd'
  onPlanCreated: (plan: StudyPlan) => void;
}

interface EnrolledCourse {
  id: string;
  title: string;
}

export function StudyPlanDialog({
  open,
  onOpenChange,
  defaultDate,
  onPlanCreated
}: StudyPlanDialogProps) {
  const { userProfile } = useAuth();
  const { toast } = useToast();

  const [courses, setCourses] = useState<EnrolledCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("general");
  const [title, setTitle] = useState("");
  const [scheduledDate, setScheduledDate] = useState(defaultDate || new Date().toISOString().split("T")[0]);
  const [scheduledTime, setScheduledTime] = useState("16:00");
  const [duration, setDuration] = useState<number>(30);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (defaultDate) {
      setScheduledDate(defaultDate);
    }
  }, [defaultDate]);

  useEffect(() => {
    if (open && userProfile) {
      loadEnrolledCourses();
    }
  }, [open, userProfile]);

  const loadEnrolledCourses = async () => {
    try {
      const studentIds = getDualIdArray(userProfile);
      if (studentIds.length === 0) return;

      const { data } = await supabase
        .from("enrollments")
        .select("course_id, courses:courses(id, title)")
        .in("student_id", studentIds);

      const enrolled = (data || [])
        .map((e: any) => e.courses)
        .filter((c: any): c is EnrolledCourse => !!c && !!c.title);

      setCourses(enrolled);
      if (enrolled.length > 0 && selectedCourseId === "general") {
        setSelectedCourseId(enrolled[0].id);
        if (!title) {
          setTitle(`Study: ${enrolled[0].title}`);
        }
      }
    } catch (e) {
      console.error("Failed to load enrolled courses:", e);
    }
  };

  const handleCourseChange = (courseId: string) => {
    setSelectedCourseId(courseId);
    const matched = courses.find(c => c.id === courseId);
    if (matched) {
      setTitle(`Study: ${matched.title}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({
        title: "Session Title Required",
        description: "Please enter a topic or goal for this study session.",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      const plan = await createStudyPlan(userProfile, {
        title: title.trim(),
        course_id: selectedCourseId === "general" ? null : selectedCourseId,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime || null,
        duration_minutes: duration,
        notes: notes.trim() || null,
      });

      toast({
        title: "Session Scheduled! 🗓️",
        description: `Your study session is scheduled for ${scheduledDate}. You're on track!`
      });

      onPlanCreated(plan);
      onOpenChange(false);
      // Reset
      setTitle("");
      setNotes("");
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to schedule study session",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Sparkles className="w-5 h-5 text-primary" />
            Schedule Study Session
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Target Course */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-primary" />
              Target Course
            </Label>
            <Select value={selectedCourseId} onValueChange={handleCourseChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select course to study" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">🌟 General STEM Practice</SelectItem>
                {courses.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Session Title / Goal */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Study Goal / Focus</Label>
            <Input
              placeholder="e.g., Complete Python Loops Quiz or Build Robot Arm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Date & Time Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <CalendarIcon className="w-3.5 h-3.5 text-primary" />
                Date
              </Label>
              <Input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-primary" />
                Start Time
              </Label>
              <Input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
              />
            </div>
          </div>

          {/* Target Duration Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Target Duration</Label>
            <div className="grid grid-cols-4 gap-2">
              {[15, 30, 45, 60].map((mins) => (
                <Button
                  key={mins}
                  type="button"
                  size="sm"
                  variant={duration === mins ? "default" : "outline"}
                  className={`text-xs ${
                    duration === mins ? "bg-primary text-white font-bold" : ""
                  }`}
                  onClick={() => setDuration(mins)}
                >
                  {mins} mins
                </Button>
              ))}
            </div>
          </div>

          {/* Optional Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Notes / Reminders (Optional)</Label>
            <Textarea
              placeholder="Questions to ask tutor, topics to review, or challenges to complete..."
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Scheduling..." : "Save Session"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
