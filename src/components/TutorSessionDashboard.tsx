import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Clock,
  Video,
  Bell,
  CheckCircle2,
  StopCircle,
  Copy,
  ExternalLink,
  Shield,
  FileCheck2,
  AlertTriangle,
  Users,
  KeyRound,
  PlayCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ClickableStudentName } from "@/components/ClickableStudentName";
import { SessionReportDialog } from "@/components/SessionReportDialog";
import { createNotification } from "@/utils/notifications";

interface ClassSession {
  id: string;
  title: string;
  course_id: string;
  student_id: string | null;
  tutor_id: string | null;
  session_group: string | null;
  start_time: string;
  end_time: string;
  status: string;
  meeting_provider: string;
  meeting_link: string;
  meeting_id: string | null;
  passcode: string | null;
  host_key: string | null;
  claimed_at: string | null;
  terms_accepted_version: string | null;
  reminder_sent_at: string | null;
  actual_ended_at: string | null;
  session_report_id: string | null;
  student?: {
    id: string;
    auth_user_id: string | null;
    name: string | null;
    email: string | null;
    avatar_url: string | null;
  };
  course?: {
    id: string;
    title: string;
  };
}

interface TutorSessionDashboardProps {
  onRefreshNeeded?: () => void;
}

export function TutorSessionDashboard({ onRefreshNeeded }: TutorSessionDashboardProps) {
  const { userProfile } = useAuth();
  const { toast } = useToast();

  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [sendingReminder, setSendingReminder] = useState<{ [id: string]: boolean }>({});

  // Active session for report dialog
  const [reportSession, setReportSession] = useState<any | null>(null);
  const [showReportDialog, setShowReportDialog] = useState<boolean>(false);

  const isSuperStaff = userProfile?.role === "admin" || userProfile?.role === "ultimate_tutor";

  useEffect(() => {
    if (userProfile) {
      fetchSessions();
    }
  }, [userProfile]);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const tutorId = userProfile?.id;
      const tutorAuthId = userProfile?.auth_user_id;

      let query = supabase
        .from("class_sessions")
        .select(`
          *,
          student:users!class_sessions_student_id_fkey(
            id,
            auth_user_id,
            name,
            email,
            avatar_url
          ),
          course:courses!class_sessions_course_id_fkey(
            id,
            title
          )
        `)
        .order("start_time", { ascending: true });

      // If tutor, only show sessions assigned to this tutor
      if (!isSuperStaff) {
        const tutorIds = [tutorId, tutorAuthId].filter(Boolean);
        if (tutorIds.length > 0) {
          query = query.in("tutor_id", tutorIds);
        } else {
          setSessions([]);
          setLoading(false);
          return;
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      setSessions((data || []) as any);
    } catch (err: any) {
      console.error("Error fetching class sessions:", err);
      toast({
        title: "Error Loading Sessions",
        description: err.message || "Failed to load class sessions.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemindStudent = async (session: ClassSession) => {
    if (!session.student_id && !session.student?.auth_user_id) {
      toast({
        title: "No Student Assigned",
        description: "Cannot send reminder because no student is assigned to this session.",
        variant: "destructive",
      });
      return;
    }

    setSendingReminder((prev) => ({ ...prev, [session.id]: true }));
    try {
      const nowIso = new Date().toISOString();
      const tutorId = userProfile?.id || userProfile?.auth_user_id;
      const recipientId = session.student?.auth_user_id || session.student_id!;

      // 1. Send real notification to student
      const startTimeFormatted = new Date(session.start_time).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      await createNotification({
        recipient_user_id: recipientId,
        title: "Class Session Reminder 🔔",
        message: `Your class for "${session.course?.title || session.title}" starts at ${startTimeFormatted}. Please be ready to join!`,
        type: "session_reminder",
        data: {
          session_id: session.id,
          course_id: session.course_id,
          meeting_link: session.meeting_link,
          start_time: session.start_time,
        },
      });

      // 2. Update session reminder timestamp
      const { error: updateError } = await supabase
        .from("class_sessions")
        .update({
          reminder_sent_at: nowIso,
          reminder_sent_by: tutorId,
        })
        .eq("id", session.id);

      if (updateError) throw updateError;

      // 3. Log to audit logs for Admin / Ultimate Tutor audit
      try {
        await supabase.from("audit_logs").insert({
          action_type: "send_session_reminder",
          performed_by: tutorId,
          target_type: "class_session",
          target_id: session.id,
          details: {
            student_id: session.student_id,
            start_time: session.start_time,
            sent_at: nowIso,
          },
          status: "success",
        });
      } catch (logErr) {
        console.warn("Could not log reminder audit:", logErr);
      }

      toast({
        title: "Reminder Sent ✅",
        description: "Student has been notified of the upcoming class.",
      });

      setSessions((prev) =>
        prev.map((s) =>
          s.id === session.id
            ? { ...s, reminder_sent_at: nowIso }
            : s
        )
      );
    } catch (err: any) {
      console.error("Error sending reminder:", err);
      toast({
        title: "Reminder Failed",
        description: err.message || "Failed to send reminder notification.",
        variant: "destructive",
      });
    } finally {
      setSendingReminder((prev) => ({ ...prev, [session.id]: false }));
    }
  };

  const handleEndSessionClick = (session: ClassSession) => {
    // Check if session report exists
    if (!session.session_report_id) {
      toast({
        title: "Report Required 📋",
        description: "Complete the session report before ending this session.",
        variant: "destructive",
      });

      // Open mandatory report dialog immediately
      setReportSession({
        id: session.id,
        title: session.title,
        course_id: session.course_id,
        student_id: session.student_id,
        student_name: session.student?.name || session.student?.email,
        course_title: session.course?.title,
      });
      setShowReportDialog(true);
      return;
    }

    // If report already exists, mark ended directly
    confirmEndSession(session.id);
  };

  const confirmEndSession = async (sessionId: string) => {
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from("class_sessions")
        .update({
          status: "ended",
          actual_ended_at: nowIso,
        })
        .eq("id", sessionId);

      if (error) throw error;

      toast({
        title: "Session Ended",
        description: "Class session marked as ended.",
      });

      fetchSessions();
      onRefreshNeeded?.();
    } catch (err: any) {
      console.error("Error ending session:", err);
      toast({
        title: "Error",
        description: "Failed to end session.",
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} Copied to Clipboard` });
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-muted-foreground text-sm">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3" />
        Loading your teaching sessions...
      </div>
    );
  }

  const upcomingSessions = sessions.filter((s) => s.status !== "ended" && s.status !== "cancelled");
  const pastSessions = sessions.filter((s) => s.status === "ended");

  return (
    <div className="space-y-6">
      {/* Active & Upcoming Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Active & Upcoming Sessions ({upcomingSessions.length})
            </span>
            <Button variant="outline" size="sm" onClick={fetchSessions}>
              Refresh
            </Button>
          </CardTitle>
          <CardDescription>
            Live class credentials, student reminders, and session report enforcement
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {upcomingSessions.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium text-foreground">No upcoming sessions assigned</p>
              <p className="text-xs text-muted-foreground mt-1">
                Claim sessions under "Classes Available" to schedule new teaching slots.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {upcomingSessions.map((session) => {
                const start = new Date(session.start_time);
                const end = new Date(session.end_time);
                const now = new Date();
                const isLive = now >= start && now <= end;

                return (
                  <div
                    key={session.id}
                    className={`p-5 rounded-lg border transition-all ${
                      isLive
                        ? "border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/10 shadow-sm"
                        : "bg-card"
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                      {/* Left: Info */}
                      <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-base text-foreground">{session.title}</h3>
                          {isLive && (
                            <Badge className="bg-emerald-600 text-white animate-pulse gap-1">
                              <PlayCircle className="w-3.5 h-3.5" />
                              LIVE NOW
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {session.session_group || "1-on-1 PT"}
                          </Badge>
                          <Badge
                            variant={session.status === "assigned" ? "secondary" : "default"}
                            className="text-xs capitalize"
                          >
                            {session.status}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>
                            Course: <strong>{session.course?.title || "STEM Course"}</strong>
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-primary" />
                            Student:{" "}
                            {session.student ? (
                              <ClickableStudentName
                                studentId={session.student.id}
                                name={session.student.name}
                                email={session.student.email}
                                className="font-semibold text-foreground ml-1"
                              />
                            ) : (
                              <span className="italic">Unassigned student</span>
                            )}
                          </span>
                        </div>

                        {/* Date & Time */}
                        <div className="flex items-center gap-3 text-xs pt-1">
                          <span className="flex items-center gap-1 text-foreground font-medium">
                            <Calendar className="w-3.5 h-3.5 text-primary" />
                            {start.toLocaleDateString(undefined, {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="w-3.5 h-3.5" />
                            {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
                            {end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>

                        {/* Dynamic Meeting Credentials (Non-Hardcoded) */}
                        <div className="p-3 bg-muted/40 rounded-md border text-xs space-y-1.5 mt-2">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold flex items-center gap-1.5 text-foreground">
                              <Video className="w-3.5 h-3.5 text-primary" />
                              Provider: {session.meeting_provider || "Online Meeting"}
                            </span>
                            {session.meeting_link && (
                              <a
                                href={session.meeting_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline flex items-center gap-1 font-medium"
                              >
                                Direct Meeting URL
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-muted-foreground">
                            {session.meeting_id && (
                              <div className="flex items-center justify-between bg-background p-1.5 rounded border">
                                <span>ID: <strong className="text-foreground">{session.meeting_id}</strong></span>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(session.meeting_id!, "Meeting ID")}
                                  className="text-muted-foreground hover:text-foreground"
                                  title="Copy ID"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}

                            {session.passcode && (
                              <div className="flex items-center justify-between bg-background p-1.5 rounded border">
                                <span>Passcode: <strong className="text-foreground">{session.passcode}</strong></span>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(session.passcode!, "Passcode")}
                                  className="text-muted-foreground hover:text-foreground"
                                  title="Copy Passcode"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}

                            {session.host_key && (
                              <div className="flex items-center justify-between bg-background p-1.5 rounded border col-span-full">
                                <span>Host Key: <strong className="text-foreground">{session.host_key}</strong></span>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(session.host_key!, "Host Key")}
                                  className="text-muted-foreground hover:text-foreground"
                                  title="Copy Host Key"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex flex-col sm:flex-row lg:flex-col gap-2 w-full lg:w-48 shrink-0">
                        {/* Join Meeting Button */}
                        {session.meeting_link && (
                          <Button asChild size="sm" className="w-full gap-1.5">
                            <a href={session.meeting_link} target="_blank" rel="noopener noreferrer">
                              <Video className="w-4 h-4" />
                              Join Meeting
                            </a>
                          </Button>
                        )}

                        {/* Remind Student Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemindStudent(session)}
                          disabled={sendingReminder[session.id] || !session.student_id}
                          className="w-full gap-1.5"
                          title={
                            session.reminder_sent_at
                              ? `Reminder sent at ${new Date(session.reminder_sent_at).toLocaleTimeString()}`
                              : "Send class reminder to student"
                          }
                        >
                          <Bell className="w-4 h-4 text-amber-500" />
                          {sendingReminder[session.id]
                            ? "Sending..."
                            : session.reminder_sent_at
                            ? "Remind Again"
                            : "Remind Student"}
                        </Button>

                        {/* End Session Button (Gated by mandatory session report) */}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleEndSessionClick(session)}
                          className="w-full gap-1.5"
                        >
                          <StopCircle className="w-4 h-4" />
                          End Session
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Past Completed Sessions */}
      {pastSessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Completed Sessions ({pastSessions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y border rounded-lg overflow-hidden text-xs">
              {pastSessions.map((ps) => (
                <div key={ps.id} className="p-3 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-foreground">{ps.title}</span>
                    <p className="text-muted-foreground">
                      {ps.course?.title} • Ended:{" "}
                      {ps.actual_ended_at
                        ? new Date(ps.actual_ended_at).toLocaleString()
                        : "Recorded"}
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">
                    Report Filed ✅
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mandatory Session Report Dialog */}
      <SessionReportDialog
        session={reportSession}
        open={showReportDialog}
        onOpenChange={setShowReportDialog}
        onReportSubmitted={() => {
          fetchSessions();
          onRefreshNeeded?.();
        }}
      />
    </div>
  );
}

export default TutorSessionDashboard;
