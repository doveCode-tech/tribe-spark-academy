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
      // Admins see admin role notifications; everyone sees user-targeted ones
      const orFilter = isAdmin
        ? `recipient_role.eq.admin,recipient_user_id.eq.${userProfile?.auth_user_id}`
        : `recipient_user_id.eq.${userProfile?.auth_user_id}`;

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .or(orFilter)
        .order('created_at', { ascending: false })
        .limit(25);

      if (error) throw error;
      setItems(data as any);
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
      const requestId = n.data?.request_id as string;
      const { error } = await supabase.rpc('admin_approve_enrollment_request', { _request_id: requestId });
      if (error) throw error;
      await markRead(n.id);
      toast({ title: 'Approved', description: 'Enrollment approved.' });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Error', description: e.message || 'Failed to approve', variant: 'destructive' });
    }
  };

  const reject = async (n: NotificationRow) => {
    try {
      const requestId = n.data?.request_id as string;
      const { error } = await supabase.rpc('admin_reject_enrollment_request', { _request_id: requestId });
      if (error) throw error;
      await markRead(n.id);
      toast({ title: 'Rejected', description: 'Enrollment rejected.' });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Error', description: e.message || 'Failed to reject', variant: 'destructive' });
    }
  };

  const unread = items.filter(i => !i.read).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className="w-4 h-4" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex items-center justify-center text-[10px] font-medium rounded-full bg-primary text-primary-foreground h-4 min-w-4 px-1">
              {unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-96" align="end">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          <Badge variant="secondary">{unread} new</Badge>
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
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
