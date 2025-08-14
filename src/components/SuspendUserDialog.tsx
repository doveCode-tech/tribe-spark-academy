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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { UserX, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SuspendUserDialogProps {
  user: {
    id: string;
    auth_user_id: string;
    name?: string;
    email: string;
    suspended?: boolean;
  };
  onSuccess?: () => void;
}

export function SuspendUserDialog({ user, onSuccess }: SuspendUserDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSuspend = async (suspend: boolean) => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('admin_suspend_user', {
        _user_id: user.auth_user_id,
        _suspended: suspend
      });

      if (error) throw error;

      // Send notification to user
      if (suspend) {
        await supabase.from('notifications').insert({
          recipient_user_id: user.auth_user_id,
          type: 'account_suspended',
          title: 'Account Suspended',
          message: reason || 'Your account has been suspended. Please contact administration.',
          data: { reason }
        });
      } else {
        await supabase.from('notifications').insert({
          recipient_user_id: user.auth_user_id,
          type: 'account_unsuspended',
          title: 'Account Restored',
          message: 'Your account has been restored. You can now log in normally.',
        });
      }

      toast({
        title: suspend ? "User Suspended" : "User Unsuspended",
        description: suspend 
          ? `${user.name || user.email} has been suspended.`
          : `${user.name || user.email} has been unsuspended.`,
      });

      setOpen(false);
      setReason("");
      onSuccess?.();
    } catch (error: any) {
      console.error('Error updating user suspension:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update user status.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={user.suspended ? "default" : "destructive"}
          size="sm"
        >
          {user.suspended ? (
            <>
              <UserCheck className="w-4 h-4 mr-2" />
              Unsuspend
            </>
          ) : (
            <>
              <UserX className="w-4 h-4 mr-2" />
              Suspend
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {user.suspended ? 'Unsuspend User' : 'Suspend User'}
          </DialogTitle>
          <DialogDescription>
            {user.suspended 
              ? `Restore access for ${user.name || user.email}? They will be able to log in again.`
              : `Suspend ${user.name || user.email}? They will not be able to log in until unsuspended.`
            }
          </DialogDescription>
        </DialogHeader>
        
        {!user.suspended && (
          <div className="space-y-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea
              id="reason"
              placeholder="Enter reason for suspension..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant={user.suspended ? "default" : "destructive"}
            onClick={() => handleSuspend(!user.suspended)}
            disabled={loading}
          >
            {loading ? "Processing..." : user.suspended ? "Unsuspend" : "Suspend"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}