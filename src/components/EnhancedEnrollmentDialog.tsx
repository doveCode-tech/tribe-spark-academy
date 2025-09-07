import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Search, UserPlus, UserMinus, UserX, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  approved: boolean;
  username?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  auth_user_id: string;
}

interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
}

interface EnhancedEnrollmentDialogProps {
  course: Course;
  triggerLabel?: string;
}

export function EnhancedEnrollmentDialog({ course, triggerLabel = "Manage Enrollments" }: EnhancedEnrollmentDialogProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [enrolledUsers, setEnrolledUsers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const { userProfile } = useAuth();
  const { toast } = useToast();
  
  const isAdmin = userProfile?.role === 'admin';
  const isUltimateTutor = userProfile?.role_level >= 3;

  useEffect(() => {
    if (open) {
      loadUsers();
      loadEnrollments();
    }
  }, [open]);

  const loadUsers = async () => {
    try {
      // For now, get users directly from the users table since admin_list_users might have issues
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setUsers(data?.map(user => ({
        id: user.id,
        name: user.name || `${user.first_name} ${user.last_name}`.trim() || user.email,
        email: user.email,
        role: user.role,
        approved: user.approved,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        avatar_url: user.avatar_url,
        auth_user_id: user.auth_user_id
      })) || []);
    } catch (e: any) {
      console.error('Error loading users:', e);
      toast({ title: 'Error', description: 'Failed to load users', variant: 'destructive' });
    }
  };

  const loadEnrollments = async () => {
    try {
      const { data, error } = await supabase
        .from('enrollments')
        .select('student_id')
        .eq('course_id', course.id)
        .eq('status', 'active');
      
      if (error) throw error;
      setEnrolledUsers(data?.map(e => e.student_id) || []);
    } catch (e: any) {
      console.error('Error loading enrollments:', e);
    }
  };

  const enrollUser = async (userId: string) => {
    try {
      setLoading(true);
      
      // Direct enrollment without using the RPC function for now
      const { error } = await supabase
        .from('enrollments')
        .insert({
          student_id: userId,
          course_id: course.id,
          status: 'active',
          enrolled_by: userProfile?.auth_user_id
        });
      
      if (error) {
        // If user is already enrolled, update the status
        if (error.code === '23505') { // unique violation
          const { error: updateError } = await supabase
            .from('enrollments')
            .update({ 
              status: 'active',
              enrolled_at: new Date().toISOString(),
              enrolled_by: userProfile?.auth_user_id
            })
            .eq('student_id', userId)
            .eq('course_id', course.id);
          
          if (updateError) throw updateError;
        } else {
          throw error;
        }
      }
      
      setEnrolledUsers([...enrolledUsers, userId]);
      toast({ title: 'Success', description: 'User enrolled successfully' });
    } catch (e: any) {
      console.error('Error enrolling user:', e);
      toast({ title: 'Error', description: e.message || 'Failed to enroll user', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const unenrollUser = async (userId: string) => {
    try {
      setLoading(true);
      
      // Direct unenrollment
      const { error } = await supabase
        .from('enrollments')
        .delete()
        .eq('student_id', userId)
        .eq('course_id', course.id);
      
      if (error) throw error;
      
      setEnrolledUsers(enrolledUsers.filter(id => id !== userId));
      toast({ title: 'Success', description: 'User unenrolled successfully' });
    } catch (e: any) {
      console.error('Error unenrolling user:', e);
      toast({ title: 'Error', description: e.message || 'Failed to unenroll user', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const deregisterUser = async (userId: string) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('auth_user_id', userId);
      
      if (error) throw error;
      
      setUsers(users.filter(u => u.auth_user_id !== userId));
      setEnrolledUsers(enrolledUsers.filter(id => id !== userId));
      toast({ title: 'Success', description: 'User deregistered successfully' });
    } catch (e: any) {
      console.error('Error deregistering user:', e);
      toast({ title: 'Error', description: e.message || 'Failed to deregister user', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => 
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isAdmin && !isUltimateTutor) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus className="w-4 h-4 mr-2" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Course Enrollments</DialogTitle>
          <DialogDescription>
            Course: {course.title} - Enroll, unenroll, or deregister users
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search users by name, email, or username..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredUsers.map((user) => {
              const isEnrolled = enrolledUsers.includes(user.auth_user_id);
              const displayName = user.name || `${user.first_name} ${user.last_name}`.trim() || user.email;
              
              return (
                <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.avatar_url || undefined} alt={displayName} />
                      <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{displayName}</div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                      {user.username && (
                        <div className="text-xs text-muted-foreground">@{user.username}</div>
                      )}
                      <div className="flex gap-2 mt-1">
                        <Badge variant={user.role === 'admin' ? 'default' : user.role === 'tutor' ? 'secondary' : 'outline'}>
                          {user.role}
                        </Badge>
                        <Badge variant={user.approved ? 'default' : 'destructive'}>
                          {user.approved ? 'Approved' : 'Pending'}
                        </Badge>
                        {isEnrolled && <Badge variant="secondary">Enrolled</Badge>}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {/* View user details */}}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    
                    {user.role !== 'admin' && (
                      <>
                        {isEnrolled ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => unenrollUser(user.auth_user_id)}
                            disabled={loading}
                          >
                            <UserMinus className="w-4 h-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => enrollUser(user.auth_user_id)}
                            disabled={loading || !user.approved}
                          >
                            <UserPlus className="w-4 h-4" />
                          </Button>
                        )}
                        
                        {isAdmin && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deregisterUser(user.auth_user_id)}
                            disabled={loading}
                          >
                            <UserX className="w-4 h-4" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}