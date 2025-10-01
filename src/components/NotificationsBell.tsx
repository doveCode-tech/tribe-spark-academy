import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface NotificationRow {
  id: string;
  recipient_user_id: string | null;
  recipient_role: string | null;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  data: any;
}

export function NotificationsBell() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const isAdmin = useMemo(() => userProfile?.role === 'admin', [userProfile?.role]);

  const load = async () => {
    try {
      if (isAdmin) {
        // For admins, get only unresolved enrollment requests using the new function
        const { data: enrollmentData, error: enrollmentError } = await supabase
          .rpc('get_unresolved_enrollment_notifications');
        
        if (enrollmentError) throw enrollmentError;
        
        // Also get other admin notifications
        const { data: otherData, error: otherError } = await supabase
          .from('notifications')
          .select('*')
          .neq('type', 'enrollment_request')
          .or(`recipient_role.eq.admin,recipient_user_id.eq.${userProfile?.auth_user_id}`)
          .order('created_at', { ascending: false })
          .limit(25);
          
        if (otherError) throw otherError;
        
        // Combine and sort results
        const combined = [...(enrollmentData || []), ...(otherData || [])]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 25);
        
        setItems(combined as any);
      } else {
        // For regular users, get their notifications
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('recipient_user_id', userProfile?.auth_user_id)
          .order('created_at', { ascending: false })
          .limit(25);

        if (error) throw error;
        setItems(data as any);
      }
    } catch (e: any) {
      console.error('Failed to load notifications', e);
    }
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
        load();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, () => {
        load();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notifications' }, () => {
        load();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'enrollment_requests' }, () => {
        load();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, userProfile?.auth_user_id]);

  const markRead = async (id: string) => {
    const prev = items;
    setItems((s) => s.map(i => i.id === id ? { ...i, read: true } : i));
    const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
    if (error) {
      console.error(error);
      setItems(prev);
    }
  };

  const approve = async (n: NotificationRow) => {
    try {
      if (n.type === 'user_signup') {
        // Handle user signup approval
        const userId = n.data?.user_id as string;
        const { error } = await supabase.rpc('admin_approve_user', { _auth_user_id: userId });
        if (error) throw error;
        
        // Mark notification as read
        await supabase.from('notifications').update({ read: true }).eq('id', n.id);
        toast({ title: 'User Approved', description: 'User has been approved successfully.' });
        load();
        return;
      }
      
      // Handle enrollment request approval
      const requestId = n.data?.request_id as string;
      
      // Check if already resolved
      const { data: statusCheck } = await supabase.rpc('check_enrollment_request_status', { 
        _request_id: requestId 
      });
      
      if (statusCheck === 'approved' || statusCheck === 'rejected') {
        // Remove the notification since it's already resolved
        await supabase.rpc('cleanup_resolved_notifications', { _request_id: requestId });
        toast({ title: 'Already Resolved', description: 'This request was already processed.' });
        load(); // Refresh notifications
        return;
      }
      
      if (statusCheck === 'not_found') {
        await supabase.rpc('cleanup_resolved_notifications', { _request_id: requestId });
        toast({ title: 'Request Not Found', description: 'This enrollment request no longer exists.' });
        load();
        return;
      }

      const { error } = await supabase.rpc('admin_approve_enrollment_request', { _request_id: requestId });
      if (error) throw error;
      
      await markRead(n.id);
      await supabase.rpc('cleanup_resolved_notifications', { _request_id: requestId });
      toast({ title: 'Approved', description: 'Enrollment approved.' });
      load(); // Refresh to remove processed notifications
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Error', description: e.message || 'Failed to approve', variant: 'destructive' });
    }
  };

  const reject = async (n: NotificationRow) => {
    try {
      if (n.type === 'user_signup') {
        // Handle user signup rejection - just mark as read
        await supabase.from('notifications').update({ read: true }).eq('id', n.id);
        toast({ title: 'Noted', description: 'User signup notification marked as read.' });
        load();
        return;
      }
      
      // Handle enrollment request rejection
      const requestId = n.data?.request_id as string;
      
      // Check if already resolved
      const { data: statusCheck } = await supabase.rpc('check_enrollment_request_status', { 
        _request_id: requestId 
      });
      
      if (statusCheck === 'approved' || statusCheck === 'rejected') {
        await supabase.rpc('cleanup_resolved_notifications', { _request_id: requestId });
        toast({ title: 'Already Resolved', description: 'This request was already processed.' });
        load();
        return;
      }
      
      if (statusCheck === 'not_found') {
        await supabase.rpc('cleanup_resolved_notifications', { _request_id: requestId });
        toast({ title: 'Request Not Found', description: 'This enrollment request no longer exists.' });
        load();
        return;
      }

      const { error } = await supabase.rpc('admin_reject_enrollment_request', { _request_id: requestId });
      if (error) throw error;
      
      await markRead(n.id);
      await supabase.rpc('cleanup_resolved_notifications', { _request_id: requestId });
      toast({ title: 'Rejected', description: 'Enrollment rejected.' });
      load();
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Error', description: e.message || 'Failed to reject', variant: 'destructive' });
    }
  };

  const unread = items.filter(i => !i.read).length;
  const unresolvedCount = items.filter(i => !i.read && i.type === 'enrollment_request').length;
  const displayCount = isAdmin ? unresolvedCount : unread;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className="w-4 h-4" />
          {displayCount > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex items-center justify-center text-[10px] font-medium rounded-full bg-primary text-primary-foreground h-4 min-w-4 px-1">
              {displayCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-96" align="end">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {displayCount > 0 && <Badge variant="secondary">{displayCount} new</Badge>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 && (
          <div className="py-6 text-center text-muted-foreground text-sm">No notifications</div>
        )}
        {items.map((n) => (
          <div key={n.id} className="px-2 py-2 border-b last:border-b-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium">{n.title}</div>
                <div className="text-sm text-muted-foreground">{n.message}</div>
                {n.type === 'user_signup' && n.data && (
                  <div className="text-xs text-muted-foreground mt-1">
                    User: {n.data.user_name} ({n.data.user_email})
                  </div>
                )}
              </div>
              {!n.read && (
                <Badge variant="outline">new</Badge>
              )}
            </div>
            {isAdmin && n.type === 'enrollment_request' && (
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="default" onClick={() => approve(n)}>
                  <Check className="w-4 h-4 mr-1" /> Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => reject(n)}>
                  <X className="w-4 h-4 mr-1" /> Reject
                </Button>
              </div>
            )}
            {isAdmin && n.type === 'user_signup' && !n.read && (
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="default" onClick={() => approve(n)}>
                  <Check className="w-4 h-4 mr-1" /> Approve User
                </Button>
                <Button size="sm" variant="ghost" onClick={() => reject(n)}>
                  Mark Read
                </Button>
              </div>
            )}
            {!n.read && n.type !== 'user_signup' && n.type !== 'enrollment_request' && (
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="ghost" onClick={() => markRead(n.id)}>
                  Mark Read
                </Button>
              </div>
            )}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
