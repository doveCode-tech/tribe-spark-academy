import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Search, Users, UserPlus, UserMinus, CheckCircle2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { createNotification } from "@/utils/notifications";

interface Participant {
  enrollment_id: string;
  student_id: string;
  enrolled_at: string;
  progress_percentage: number;
  status: string;
  name: string;
  email: string;
  avatar_url?: string;
  username?: string;
}

interface UserOption {
  id: string;
  auth_user_id: string;
  name: string;
  email: string;
  role: string;
  avatar_url?: string;
}

interface CourseParticipantsDialogProps {
  courseId: string;
  courseTitle: string;
  triggerLabel?: string;
  onEnrollmentChanged?: () => void;
}

export function CourseParticipantsDialog({
  courseId,
  courseTitle,
  triggerLabel = "Participants",
  onEnrollmentChanged,
}: CourseParticipantsDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"participants" | "add">("participants");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { userProfile } = useAuth();
  const { toast } = useToast();

  const canManage = 
    userProfile?.role === "admin" || 
    userProfile?.role === "ultimate_tutor" || 
    userProfile?.role === "tutor";

  useEffect(() => {
    if (open) {
      loadParticipants();
      if (canManage) {
        loadAllUsers();
      }
    }
  }, [open, courseId]);

  const loadParticipants = async () => {
    try {
      setLoading(true);
      const { data: enrollmentsData, error } = await supabase
        .from("enrollments")
        .select(`
          id,
          student_id,
          enrolled_at,
          progress_percentage,
          status,
          users:student_id (
            name,
            first_name,
            last_name,
            email,
            avatar_url,
            username
          )
        `)
        .eq("course_id", courseId)
        .eq("status", "active")
        .order("enrolled_at", { ascending: false });

      if (error) throw error;

      const formatted: Participant[] = (enrollmentsData || []).map((item: any) => {
        const u = item.users;
        const displayName = u?.name || `${u?.first_name || ""} ${u?.last_name || ""}`.trim() || u?.email || "Student";
        return {
          enrollment_id: item.id,
          student_id: item.student_id,
          enrolled_at: item.enrolled_at,
          progress_percentage: item.progress_percentage || 0,
          status: item.status,
          name: displayName,
          email: u?.email || "",
          avatar_url: u?.avatar_url,
          username: u?.username,
        };
      });

      setParticipants(formatted);
    } catch (err: any) {
      console.error("Error loading participants:", err);
      toast({
        title: "Error",
        description: "Failed to load course participants.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAllUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("id, auth_user_id, name, first_name, last_name, email, role, avatar_url")
        .eq("role", "student")
        .order("name", { ascending: true });

      if (error) throw error;

      setAllUsers((data || []).map(u => ({
        id: u.id,
        auth_user_id: u.auth_user_id,
        name: u.name || `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email,
        email: u.email,
        role: u.role,
        avatar_url: u.avatar_url,
      })));
    } catch (err) {
      console.error("Error loading eligible users:", err);
    }
  };

  const handleEnrollStudent = async (studentAuthId: string) => {
    try {
      setActionLoading(studentAuthId);
      const { error } = await supabase
        .from("enrollments")
        .upsert({
          student_id: studentAuthId,
          course_id: courseId,
          status: "active",
          enrolled_by: userProfile?.auth_user_id,
          enrolled_at: new Date().toISOString(),
          progress_percentage: 0,
        });

      if (error) throw error;

      createNotification({
        recipientUserId: studentAuthId,
        type: 'course_enrollment',
        title: `Enrolled in ${courseTitle}`,
        message: `You have been enrolled in "${courseTitle}". Check your courses to begin!`,
        data: { course_id: courseId },
      });

      toast({
        title: "Student Enrolled",
        description: "Student has been added to this course.",
      });

      await loadParticipants();
      onEnrollmentChanged?.();
    } catch (err: any) {
      console.error("Enroll error:", err);
      toast({
        title: "Enrollment Failed",
        description: err?.message || "Could not enroll student.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnenrollStudent = async (enrollmentId: string, studentId: string) => {
    try {
      setActionLoading(enrollmentId);
      const { error } = await supabase
        .from("enrollments")
        .delete()
        .eq("id", enrollmentId);

      if (error) throw error;

      toast({
        title: "Student Unenrolled",
        description: "Student has been removed from this course.",
      });

      setParticipants(prev => prev.filter(p => p.enrollment_id !== enrollmentId));
      onEnrollmentChanged?.();
    } catch (err: any) {
      console.error("Unenroll error:", err);
      toast({
        title: "Unenroll Failed",
        description: err?.message || "Could not unenroll student.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const enrolledStudentIds = new Set(participants.map(p => p.student_id));

  const filteredParticipants = participants.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const availableToEnroll = allUsers.filter(u =>
    !enrolledStudentIds.has(u.auth_user_id) &&
    (u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
     u.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Users className="w-4 h-4 text-primary" />
          <span>{triggerLabel}</span>
          {participants.length > 0 && (
            <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
              {participants.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Course Participants: {courseTitle}
          </DialogTitle>
          <DialogDescription>
            View all students enrolled in this course, monitor their progress, or manage enrollments.
          </DialogDescription>
        </DialogHeader>

        {/* Action Tabs */}
        {canManage && (
          <div className="flex border-b border-border gap-4 text-sm font-medium">
            <button
              onClick={() => setActiveTab("participants")}
              className={`pb-2 transition-colors ${
                activeTab === "participants"
                  ? "border-b-2 border-primary text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Enrolled Students ({participants.length})
            </button>
            <button
              onClick={() => setActiveTab("add")}
              className={`pb-2 transition-colors ${
                activeTab === "add"
                  ? "border-b-2 border-primary text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Add Students ({availableToEnroll.length})
            </button>
          </div>
        )}

        {/* Search */}
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === "participants" ? "Search participants..." : "Search students to add..."}
            className="pl-9 h-9 text-sm"
          />
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto space-y-2 mt-2 pr-1 max-h-[50vh]">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading participants...</div>
          ) : activeTab === "participants" ? (
            filteredParticipants.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                {participants.length === 0
                  ? "No students enrolled in this course yet."
                  : "No participants match your search."}
              </div>
            ) : (
              filteredParticipants.map((p) => (
                <div
                  key={p.enrollment_id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="w-9 h-9">
                      <AvatarImage src={p.avatar_url} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {p.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate text-foreground">{p.name}</span>
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                          Enrolled
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                      
                      {/* Progress Bar */}
                      <div className="flex items-center gap-2 mt-1 w-40 sm:w-48">
                        <Progress value={p.progress_percentage} className="h-1.5 flex-1" />
                        <span className="text-[11px] text-muted-foreground font-medium shrink-0">
                          {p.progress_percentage}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {canManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleUnenrollStudent(p.enrollment_id, p.student_id)}
                      disabled={actionLoading === p.enrollment_id}
                      className="text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10 h-8 gap-1 shrink-0"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                      Unenroll
                    </Button>
                  )}
                </div>
              ))
            )
          ) : (
            /* Add Students Tab */
            availableToEnroll.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                All registered students are already enrolled!
              </div>
            ) : (
              availableToEnroll.map((student) => (
                <div
                  key={student.auth_user_id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="w-9 h-9">
                      <AvatarImage src={student.avatar_url} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {student.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <span className="font-semibold text-sm truncate text-foreground block">
                        {student.name}
                      </span>
                      <p className="text-xs text-muted-foreground truncate">{student.email}</p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => handleEnrollStudent(student.auth_user_id)}
                    disabled={actionLoading === student.auth_user_id}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-8 gap-1 shrink-0"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Enroll
                  </Button>
                </div>
              ))
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
