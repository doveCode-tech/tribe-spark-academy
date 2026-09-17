import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Star, FileCheck2, AlertCircle, Sparkles, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface SessionInfo {
  id: string;
  title: string;
  course_id: string;
  student_id?: string | null;
  student_name?: string | null;
  course_title?: string | null;
}

interface SessionReportDialogProps {
  session: SessionInfo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReportSubmitted: (reportId: string) => void;
}

export function SessionReportDialog({
  session,
  open,
  onOpenChange,
  onReportSubmitted,
}: SessionReportDialogProps) {
  const { userProfile } = useAuth();
  const { toast } = useToast();

  const [attendance, setAttendance] = useState<string>("attended");
  const [topicsCovered, setTopicsCovered] = useState<string>("");
  const [performance, setPerformance] = useState<number>(5);
  const [homeworkAssigned, setHomeworkAssigned] = useState<string>("");
  const [notesForParents, setNotesForParents] = useState<string>("");
  const [internalNotes, setInternalNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  if (!session) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!topicsCovered.trim()) {
      toast({
        title: "Topics Covered Required",
        description: "Please specify the topics covered during the session.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const tutorId = userProfile?.id || userProfile?.auth_user_id;

      // 1. Insert report
      const { data: reportData, error: reportError } = await supabase
        .from("session_reports")
        .insert({
          session_id: session.id,
          tutor_id: tutorId as string,
          student_id: session.student_id || null,
          course_id: session.course_id || null,
          attendance_status: attendance,
          topics_covered: topicsCovered.trim(),
          student_performance: performance,
          homework_assigned: homeworkAssigned.trim(),
          notes_for_parents: notesForParents.trim(),
          internal_notes: internalNotes.trim(),
        })
        .select()
        .single();

      if (reportError) throw reportError;

      const reportId = reportData.id;

      // 2. Mark session as ended and link report
      const { error: sessionUpdateError } = await supabase
        .from("class_sessions")
        .update({
          status: "ended",
          actual_ended_at: new Date().toISOString(),
          session_report_id: reportId,
        })
        .eq("id", session.id);

      if (sessionUpdateError) throw sessionUpdateError;

      // 3. Log audit record
      try {
        await supabase.from("audit_logs").insert({
          action_type: "end_session_with_report",
          performed_by: tutorId,
          target_type: "class_session",
          target_id: session.id,
          details: {
            report_id: reportId,
            student_id: session.student_id,
            attendance,
            performance,
          },
          status: "success",
        });
      } catch (logErr) {
        console.warn("Could not log audit event:", logErr);
      }

      toast({
        title: "Session Report Submitted & Class Ended ✅",
        description: "The session has been completed and the report is safely recorded.",
      });

      // Reset
      setTopicsCovered("");
      setHomeworkAssigned("");
      setNotesForParents("");
      setInternalNotes("");
      setAttendance("attended");
      setPerformance(5);

      onOpenChange(false);
      onReportSubmitted(reportId);
    } catch (err: any) {
      console.error("Error submitting session report:", err);
      toast({
        title: "Error Submitting Report",
        description: err.message || "Failed to submit report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) onOpenChange(v); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileCheck2 className="w-5 h-5 text-primary" />
            Mandatory Session Report
          </DialogTitle>
          <DialogDescription>
            You must submit this report before ending this session. It will be recorded in the student's learning profile.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Session & Student Banner */}
          <div className="p-3 bg-muted/40 rounded-lg border flex items-center justify-between text-sm">
            <div>
              <span className="font-semibold text-foreground">{session.title}</span>
              {session.course_title && (
                <p className="text-xs text-muted-foreground">{session.course_title}</p>
              )}
            </div>
            {session.student_name && (
              <Badge variant="secondary" className="font-normal">
                Student: {session.student_name}
              </Badge>
            )}
          </div>

          {/* Attendance */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="attendance">Attendance Status *</Label>
              <Select value={attendance} onValueChange={setAttendance}>
                <SelectTrigger id="attendance">
                  <SelectValue placeholder="Select attendance" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="attended">✅ Attended (On Time)</SelectItem>
                  <SelectItem value="late">⏰ Attended (Late)</SelectItem>
                  <SelectItem value="absent">❌ Absent (No Show)</SelectItem>
                  <SelectItem value="excused">📝 Excused Absence</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Performance Rating */}
            <div className="space-y-1.5">
              <Label>Student Engagement & Performance (1-5)</Label>
              <div className="flex items-center gap-2 pt-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setPerformance(star)}
                    className="p-1 hover:scale-110 transition-transform focus:outline-none"
                  >
                    <Star
                      className={`w-6 h-6 ${
                        star <= performance
                          ? "text-amber-400 fill-amber-400"
                          : "text-muted-foreground/30"
                      }`}
                    />
                  </button>
                ))}
                <span className="text-xs text-muted-foreground ml-1">
                  {performance === 5
                    ? "Excellent"
                    : performance === 4
                    ? "Good"
                    : performance === 3
                    ? "Satisfactory"
                    : performance === 2
                    ? "Needs Support"
                    : "Unsatisfactory"}
                </span>
              </div>
            </div>
          </div>

          {/* Topics Covered */}
          <div className="space-y-1.5">
            <Label htmlFor="topics">Topics & Concepts Covered *</Label>
            <Textarea
              id="topics"
              value={topicsCovered}
              onChange={(e) => setTopicsCovered(e.target.value)}
              placeholder="Detail what was taught, projects coded, exercises reviewed..."
              rows={3}
              required
            />
          </div>

          {/* Homework Assigned */}
          <div className="space-y-1.5">
            <Label htmlFor="homework">Homework / Next Steps Assigned</Label>
            <Input
              id="homework"
              value={homeworkAssigned}
              onChange={(e) => setHomeworkAssigned(e.target.value)}
              placeholder="e.g., Complete Python Exercise 4, submit project by Friday"
            />
          </div>

          {/* Notes for Parents */}
          <div className="space-y-1.5">
            <Label htmlFor="parents">Notes for Parents (Visible on Student Profile)</Label>
            <Textarea
              id="parents"
              value={notesForParents}
              onChange={(e) => setNotesForParents(e.target.value)}
              placeholder="Encouraging feedback, strengths observed, areas to practice..."
              rows={2}
            />
          </div>

          {/* Internal Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="internal" className="text-xs text-muted-foreground">
              Internal Notes (Admins & Tutors only)
            </Label>
            <Input
              id="internal"
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Optional notes for admin or replacement tutor"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !topicsCovered.trim()} className="gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {submitting ? "Saving & Ending..." : "Submit Report & End Session"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default SessionReportDialog;
