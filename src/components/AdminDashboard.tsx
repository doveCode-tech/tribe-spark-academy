import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, BookOpen, Users, GraduationCap, Settings, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CourseCreator } from "./CourseCreator";
import { PasswordReset } from "./PasswordReset";
import { EnrollmentDialog } from "./EnrollmentDialog";
import { TutorAssignDialog } from "./TutorAssignDialog";
import { CourseParticipantsDialog } from "./CourseParticipantsDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UnenrollDialog } from "./UnenrollDialog";
import { BulkUserRegistration } from "./BulkUserRegistration";
import { SuspendUserDialog } from "./SuspendUserDialog";
import { AdminOnly, UltimateTutorAndAbove } from "./RoleBasedAccess";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminLessonsList } from "./AdminLessonsList";

interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  created_at: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  approved: boolean;
  created_at: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  role_level?: number;
  auth_user_id: string;
  phone?: string;
  city?: string;
  country?: string;
  last_access?: string;
  suspended?: boolean;
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();

    // Real-time updates for projects
    const projectsChannel = supabase
      .channel('admin-projects-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects'
        },
        () => {
          console.log('Project updated - refreshing data');
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(projectsChannel);
    };
  }, []);

  const fetchData = async () => {
    try {
      // Fetch courses
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select('*')
        .order('created_at', { ascending: false });

      if (coursesError) throw coursesError;

      // Fetch users via secure admin RPC
      const { data: usersData, error: usersError } = await supabase
        .rpc('admin_list_users');

      if (usersError) throw usersError;

      // Fetch all project submissions
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select(`
          id,
          title,
          description,
          link,
          submitted_at,
          grade,
          feedback,
          review_status,
          student_id,
          course_id,
          student:users!projects_student_id_fkey(name, email),
          courses:courses!projects_course_id_fkey(title)
        `)
        .order('submitted_at', { ascending: false });

      if (projectsError) throw projectsError;

      setCourses(coursesData || []);
      setUsers(usersData || []);
      setProjects(projectsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const approveUser = async (authUserId: string) => {
    try {
      const { error } = await supabase.rpc('admin_approve_user', {
        _auth_user_id: authUserId
      });
      
      if (error) throw error;
      
      toast({
        title: "User approved successfully",
        description: "The user can now access the system.",
      });
      
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error approving user",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      setUsers(users.filter(user => user.id !== userId));
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive",
      });
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      const roleLevel = newRole === 'student' ? 1 : newRole === 'tutor' ? 2 : newRole === 'ultimate_tutor' ? 3 : 4;
      
      const { error } = await supabase
        .from('users')
        .update({ role: newRole, role_level: roleLevel })
        .eq('id', userId);

      if (error) throw error;

      setUsers(users.map(user => 
        user.id === userId ? { ...user, role: newRole, role_level: roleLevel } : user
      ));
      
      toast({
        title: "Success",
        description: `User role updated to ${newRole}`,
      });
    } catch (error) {
      console.error('Error updating user role:', error);
      toast({
        title: "Error",
        description: "Failed to update user role",
        variant: "destructive",
      });
    }
  };

  const resetUserPassword = async (userEmail: string) => {
    try {
      // Create notification for password reset request
      const { error } = await supabase
        .from('notifications')
        .insert({
          recipient_role: 'admin',
          type: 'password_reset_request',
          title: 'Password Reset Request',
          message: `Password reset requested for: ${userEmail}`,
          data: { user_email: userEmail }
        });

      if (error) throw error;

      toast({
        title: "Password Reset",
        description: "Password reset request created. Check notifications for follow-up.",
      });
    } catch (error) {
      console.error('Error creating password reset request:', error);
      toast({
        title: "Error",
        description: "Failed to create password reset request",
        variant: "destructive",
      });
    }
  };

  const deleteCourse = async (courseId: string) => {
    try {
      const { data, error } = await supabase.rpc('admin_delete_or_archive_course', {
        p_course_id: courseId,
      });

      if (error) throw error;

      toast({
        title: data === 'archived' ? "Course archived" : "Success",
        description: data === 'archived'
          ? "This course has history and was archived to preserve records."
          : "Course deleted successfully",
      });

      fetchData();
    } catch (error: any) {
      console.error('Error deleting course:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete course",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Welcome Admin{userProfile?.first_name ? `, ${userProfile.first_name}` : ''}
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage courses, users, and oversee the learning platform
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Courses</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{courses.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Students</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(user => user.role === 'student').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tutors</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(user => user.role === 'tutor').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Courses Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Course Management</CardTitle>
              <CardDescription>Create and manage courses</CardDescription>
            </div>
            <div className="flex gap-2 flex-wrap">
              <EnrollmentDialog 
                courses={courses} 
                users={users} 
                onEnrollmentComplete={fetchData} 
              />
              <AdminOnly>
                <CourseCreator onCourseCreated={fetchData} />
              </AdminOnly>
              <AdminOnly>
                <BulkUserRegistration onComplete={fetchData} />
              </AdminOnly>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {courses.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No courses yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first course to get started
              </p>
              <CourseCreator onCourseCreated={fetchData} />
            </div>
          ) : (
            <div className="grid gap-4">
              {courses.map((course) => (
                <CourseCardWithLessons 
                  key={course.id}
                  course={course}
                  users={users}
                  onDelete={() => deleteCourse(course.id)}
                  onRefresh={fetchData}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Management */}
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>Manage students and tutors</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={(user as any)?.avatar_url || undefined} alt={user.name || user.email} />
                    <AvatarFallback>{(user.name || user.email || '?').slice(0,2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="font-medium">
                      {user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email}
                    </h4>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    {user.username && (
                      <p className="text-xs text-muted-foreground">@{user.username}</p>
                    )}
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <Badge variant={
                        user.role === 'admin' ? 'default' : 
                        user.role === 'ultimate_tutor' ? 'secondary' :
                        user.role === 'tutor' ? 'secondary' : 'outline'
                      }>
                        {user.role === 'ultimate_tutor' ? 'Ultimate Tutor' : user.role}
                      </Badge>
                      <Badge variant={user.approved ? 'default' : 'destructive'}>
                        {user.approved ? 'Approved' : 'Pending'}
                      </Badge>
                      {user.suspended && (
                        <Badge variant="destructive">Suspended</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1 mt-2">
                      {user.phone && <div>📞 {user.phone}</div>}
                      {user.city && user.country && <div>📍 {user.city}, {user.country}</div>}
                      {user.last_access && (
                        <div>🕒 Last seen: {new Date(user.last_access).toLocaleDateString()}</div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {user.role !== 'admin' && (
                    <>
                      {!user.approved && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={async () => {
                            try {
                              const { error } = await supabase.rpc('admin_approve_user', { _auth_user_id: user.auth_user_id });
                              if (error) throw error;
                              setUsers(users.map(u => u.id === user.id ? { ...u, approved: true } : u));
                              toast({ title: 'Approved', description: 'User has been approved.' });
                            } catch (e) {
                              console.error(e);
                              toast({ title: 'Error', description: 'Failed to approve user', variant: 'destructive' });
                            }
                          }}
                        >Approve</Button>
                      )}
                      
                      <Select 
                        value={user.role || 'student'} 
                        onValueChange={(newRole) => updateUserRole(user.id, newRole)}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="student">Student</SelectItem>
                          <SelectItem value="tutor">Tutor</SelectItem>
                          <AdminOnly>
                            <SelectItem value="ultimate_tutor">Ultimate Tutor</SelectItem>
                          </AdminOnly>
                        </SelectContent>
                      </Select>

                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => resetUserPassword(user.email)}
                      >
                        Reset Password
                      </Button>
                      
                      <UnenrollDialog userId={user.id} userName={user.name} onChange={fetchData} />
                      
                      <UltimateTutorAndAbove>
                        <SuspendUserDialog user={user} onSuccess={fetchData} />
                      </UltimateTutorAndAbove>
                      
                      <AdminOnly>
                        {!user.approved && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => approveUser(user.auth_user_id)}
                          >
                            Approve
                          </Button>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => deleteUser(user.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AdminOnly>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Password Reset Management */}
      <PasswordReset users={users} onPasswordReset={fetchData} />

      <Card>
        <CardHeader>
          <CardTitle>Recent Project Submissions</CardTitle>
          <CardDescription>All review and grading opens in the central submission workflow.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {projects.slice(0, 10).map((project) => (
            <div key={project.id} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">{project.title || "Project submission"}</p>
                <p className="text-sm text-muted-foreground">{project.review_status || "submitted"}</p>
              </div>
              <Button size="sm" onClick={() => navigate(`/dashboard/submissions/${project.id}`)}>
                View Submission
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// Course Card with inline lessons
function CourseCardWithLessons({ 
  course, 
  users, 
  onDelete, 
  onRefresh 
}: { 
  course: Course; 
  users: User[]; 
  onDelete: () => void; 
  onRefresh: () => void;
}) {
  const [lessonsExpanded, setLessonsExpanded] = useState(false);

  return (
    <div className="p-4 border rounded-lg space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h4 className="font-medium">{course.title}</h4>
          <p className="text-sm text-muted-foreground">{course.description}</p>
          <Badge variant="secondary" className="mt-1">
            {course.category}
          </Badge>
        </div>
        <div className="flex gap-2 flex-wrap">
          <TutorAssignDialog courseId={course.id} users={users} onChange={onRefresh} />
          <CourseParticipantsDialog
            courseId={course.id}
            courseTitle={course.title}
            triggerLabel="Participants"
            onEnrollmentChanged={onRefresh}
          />
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-1" /> Course Settings
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{course.title} Settings</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <p><span className="font-medium">Category:</span> {course.category || "Not set"}</p>
                <p><span className="font-medium">Description:</span> {course.description || "Not set"}</p>
                <p className="text-muted-foreground">Course metadata is managed from the course editor.</p>
              </div>
            </DialogContent>
          </Dialog>
          <Button
            variant="destructive"
            size="sm"
            onClick={onDelete}
          >
            Delete
          </Button>
        </div>
      </div>
      
      <AdminLessonsList 
        courseId={course.id}
        courseTitle={course.title}
        category={course.category}
        isExpanded={lessonsExpanded}
        onToggle={() => setLessonsExpanded(prev => !prev)}
      />
    </div>
  );
}