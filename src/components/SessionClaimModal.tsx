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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar, Clock, Video, AlertTriangle, ShieldCheck, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export const TUTOR_TERMS_VERSION = "v1.2";

interface SessionData {
  id: string;
  title: string;
  course_id: string;
  course_title?: string;
  session_group?: string | null;
  start_time: string;
  end_time: string;
  meeting_provider?: string;
}

interface SessionClaimModalProps {
  session: SessionData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClaimSuccess: () => void;
}

export function SessionClaimModal({
  session,
  open,
  onOpenChange,
  onClaimSuccess,
}: SessionClaimModalProps) {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [agreed, setAgreed] = useState(false);
  const [claiming, setClaiming] = useState(false);

  if (!session) return null;

  const startDate = new Date(session.start_time);
  const endDate = new Date(session.end_time);

  const handleClaim = async () => {
    if (!agreed) {
      toast({
        title: "Agreement Required",
        description: "You must agree to the Terms & Conditions before claiming this class.",
        variant: "destructive",
      });
      return;
    }

    if (!userProfile?.id && !userProfile?.auth_user_id) {
      toast({
        title: "Authentication Error",
        description: "Please log in again to claim sessions.",
        variant: "destructive",
      });
      return;
    }

    setClaiming(true);
    try {
      const tutorId = userProfile.id || userProfile.auth_user_id;

      // 1. Try atomic claim RPC function first
      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        // @ts-ignore
        "claim_class_session",
        {
          _session_id: session.id,
          _tutor_id: tutorId,
          _terms_version: TUTOR_TERMS_VERSION,
        }
      );

      if (rpcError) {
        // Fallback to direct conditional update with concurrency lock (status must equal 'available')
        const { data: updated, error: updateError } = await supabase
          .from("class_sessions")
          .update({
            tutor_id: tutorId,
            status: "assigned",
            claimed_at: new Date().toISOString(),
            terms_accepted_version: TUTOR_TERMS_VERSION,
          })
          .eq("id", session.id)
          .eq("status", "available")
          .select();

        if (updateError) throw updateError;

        if (!updated || updated.length === 0) {
          throw new Error("This session has already been claimed or is no longer available.");
        }

        // Log audit event
        try {
          await supabase.from("audit_logs").insert({
            action_type: "claim_class_session",
            performed_by: tutorId,
            target_type: "class_session",
            target_id: session.id,
            details: {
              terms_version: TUTOR_TERMS_VERSION,
              session_title: session.title,
              claimed_at: new Date().toISOString(),
            },
            status: "success",
          });
        } catch (logErr) {
          console.warn("Could not write audit log:", logErr);
        }
      } else {
        const result = rpcResult as any;
        if (result && !result.success) {
          throw new Error(result.message || "Failed to claim class.");
        }
      }

      toast({
        title: "Class Claimed Successfully! 🎉",
        description: `You have been assigned to teach "${session.title}". View it under "My Sessions".`,
      });

      onOpenChange(false);
      setAgreed(false);
      onClaimSuccess();
    } catch (err: any) {
      console.error("Error claiming class:", err);
      toast({
        title: "Claim Failed",
        description: err.message || "Unable to claim this class. Please refresh and try again.",
        variant: "destructive",
      });
    } finally {
      setClaiming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!claiming) onOpenChange(v); }}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Claim Teaching Session
          </DialogTitle>
          <DialogDescription>
            Review session details and accept the tutor session terms to confirm your booking.
          </DialogDescription>
        </DialogHeader>

        {/* Session Summary Card */}
        <div className="p-4 bg-muted/40 rounded-lg border space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-base">{session.title}</h3>
              <p className="text-sm text-muted-foreground">{session.course_title || "Course Session"}</p>
            </div>
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
              {session.session_group || "1-on-1 PT"}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4 text-primary" />
              <span>{startDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4 text-primary" />
              <span>
                {startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
                {endDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground col-span-2">
              <Video className="w-4 h-4 text-primary" />
              <span>Platform: {session.meeting_provider || "Zoom / Online Meeting"}</span>
            </div>
          </div>
        </div>

        {/* Terms & Conditions ScrollArea */}
        <div className="space-y-2 flex-1 min-h-[160px]">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <span>Tutor Terms & Conditions</span>
            <Badge variant="secondary" className="text-[10px]">{TUTOR_TERMS_VERSION}</Badge>
          </div>

          <ScrollArea className="h-44 rounded-md border p-3 bg-card text-xs leading-relaxed space-y-3">
            <div className="space-y-2 text-muted-foreground">
              <p className="font-medium text-foreground">
                By claiming this session, you enter into a binding teaching commitment under STEMTribe LMS Policy:
              </p>
              <ul className="list-disc pl-4 space-y-1.5">
                <li>
                  <strong className="text-foreground">Punctuality & Attendance:</strong> You must join the live session at least 3 minutes before the scheduled start time. Missing a claimed session without 4 hours prior notice constitutes a missed session breach.
                </li>
                <li>
                  <strong className="text-foreground">Course Qualification:</strong> You certify that you are qualified and prepared to deliver the curriculum for this specific course.
                </li>
                <li>
                  <strong className="text-foreground">Mandatory Session Report:</strong> You MUST complete and submit the Session Report immediately upon completing the class. The system blocks ending the session until the report is saved.
                </li>
                <li>
                  <strong className="text-foreground">Student Safety & Privacy:</strong> All communications, code reviews, and links must remain strictly inside the STEMTribe educational platform.
                </li>
                <li>
                  <strong className="text-foreground">Cancellation & Penalties:</strong> Late cancellations or unfulfilled sessions may result in a formal warning, deduction from tutor compensation, or temporary claim suspension under the Penalties Framework.
                </li>
              </ul>
            </div>
          </ScrollArea>
        </div>

        {/* Agreement Checkbox */}
        <div className="flex items-start space-x-2 pt-2 border-t">
          <Checkbox
            id="terms-check"
            checked={agreed}
            onCheckedChange={(checked) => setAgreed(!!checked)}
            className="mt-0.5"
          />
          <label
            htmlFor="terms-check"
            className="text-xs font-medium leading-normal cursor-pointer text-foreground select-none"
          >
            I confirm that I am qualified to teach this course, and I agree to the STEMTribe Tutor Session Terms & Conditions ({TUTOR_TERMS_VERSION}).
          </label>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={claiming}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleClaim}
            disabled={!agreed || claiming}
            className="gap-2"
          >
            {claiming ? (
              <>Claiming Class...</>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Confirm & Claim Class
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SessionClaimModal;
