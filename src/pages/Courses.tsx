import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Clock, Users, Star, ChevronRight, Filter, Search, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { LMSLayout } from "@/components/LMSLayout";
import { CourseCard } from "@/components/CourseCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { EnhancedEnrollmentDialog } from "@/components/EnhancedEnrollmentDialog";
import { TutorAssignDialog } from "@/components/TutorAssignDialog";

export default function Courses() {
  const [enrolledCourses, setEnrolledCourses] = useState<any[]>([]);
  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
const [selectedCategory, setSelectedCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const isAdmin = userProfile?.role === 'admin';
  const isUltimateTutor = userProfile?.role_level >= 3;

  useEffect(() => {
    if (user) {
      fetchEnrolledCourses();
      fetchAllCourses();
      if (isAdmin || isUltimateTutor) {
        fetchUsers();
      }
    }
  }, [user, isAdmin, isUltimateTutor]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchEnrolledCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('enrollments')
        .select(`
          id,
          status,
          progress_percentage,
          enrolled_at,
          courses (
            id,
            title,
            description,
            category
          )
        `)
        .eq('student_id', user?.id)
        .eq('status', 'active');

      if (error) throw error;

      setEnrolledCourses(data || []);
    } catch (error: any) {
      console.error('Error fetching enrolled courses:', error);
      toast({
        title: "Error",
        description: "Failed to load your courses.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAllCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setAllCourses(data || []);
    } catch (error: any) {
      console.error('Error fetching all courses:', error);
      toast({
        title: "Error",
        description: "Failed to load courses.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isStudent = !isAdmin && !isUltimateTutor && userProfile?.role !== 'tutor';

  // For students: only show their enrolled courses. For staff/admin: show all courses
  const baseCourses = isStudent
    ? enrolledCourses.map(e => ({
        ...e.courses,
        enrollment: e,
      })).filter(c => !!c && !!c.id)
    : allCourses;

  const categories = ["All", ...new Set(baseCourses.map((course: any) => course.category).filter(Boolean))];
  
  const filteredCourses = baseCourses.filter((course: any) => {
    const matchesSearch = (course.title || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (course.description || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (course.category || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "All" || course.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleCourseClick = (courseId: string) => {
    navigate(`/courses/${courseId}`);
  };

  if (loading) {
    return (
      <LMSLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading your courses...</p>
          </div>
        </div>
      </LMSLayout>
    );
  }

  return (
    <LMSLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="bg-gradient-hero rounded-3xl p-8 text-white">
          <div className="max-w-4xl">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              {isStudent ? "My Enrolled Courses 📚" : "Course Management & Catalog 📚"}
            </h1>
            <p className="text-xl text-white/90 mb-6">
              {isStudent 
                ? "Here are the courses you are currently enrolled in. Continue your learning adventure!" 
                : "Explore and manage courses designed for young learners! From coding to robotics."}
            </p>
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5" />
                <span className="font-semibold">
                  {baseCourses.length} {isStudent ? "Enrolled Course" : "Course"}{baseCourses.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <BookOpen className="w-5 h-5" />
                <span className="font-semibold">{isStudent ? "Active Learning" : "Beginner Friendly"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input 
              placeholder="Search for courses..." 
              className="pl-10 h-12 text-base"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                className={`whitespace-nowrap ${
                  selectedCategory === category 
                    ? "bg-gradient-primary text-white" 
                    : "hover:bg-primary/10"
                }`}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </Button>
            ))}
          </div>
        </div>

        {/* Course Grid */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">
              {selectedCategory === "All" ? "All Courses" : selectedCategory}
              <span className="text-muted-foreground text-lg ml-2">
                ({filteredCourses.length} course{filteredCourses.length !== 1 ? 's' : ''})
              </span>
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center min-h-[50vh]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading amazing courses...</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredCourses.length > 0 ? (
                filteredCourses.map((course) => {
                  const enrollment = enrolledCourses.find(e => e.course_id === course.id);
                  const isEnrolled = !!enrollment;
                  
                  return (
                    <CourseCard
                      key={course.id}
                      course={course}
                      enrollment={enrollment}
                      isEnrolled={isEnrolled}
                      customEnrollButton={
                        (isAdmin || isUltimateTutor) ? (
                          <div className="flex gap-2">
                            <EnhancedEnrollmentDialog 
                              course={course} 
                              triggerLabel="Manage Enrollments"
                            />
                            <TutorAssignDialog
                              courseId={course.id}
                              users={users}
                              onChange={fetchUsers}
                            />
                          </div>
                        ) : undefined
                      }
                      onEnroll={async () => {
                        try {
                          // Check existing pending request to avoid duplicates
                          const { data: existing } = await supabase
                            .from('enrollment_requests')
                            .select('id, status')
                            .eq('student_id', user!.id)
                            .eq('course_id', course.id)
                            .eq('status', 'pending')
                            .limit(1)
                            .maybeSingle();

                          if (existing) {
                            toast({
                              title: 'Already Requested',
                              description: `You already asked to join ${course.title}. We'll notify you soon!`,
                            });
                            return;
                          }

                          const { error } = await supabase
                            .from('enrollment_requests')
                            .insert({ student_id: user!.id, course_id: course.id });
                          if (error) throw error;
                          toast({
                            title: 'Enrollment Request Sent',
                            description: `Request to enroll in ${course.title} was sent. You'll be notified once approved.`,
                          });
                        } catch (e: any) {
                          const msg = String(e?.message || '')
                          if (msg.includes('uniq_pending_enrollment_request') || msg.includes('duplicate key value')) {
                            toast({
                              title: 'Already Requested',
                              description: `You already asked to join ${course.title}. We'll notify you soon!`,
                            });
                          } else {
                            console.error(e);
                            toast({ title: 'Error', description: msg || 'Failed to request enrollment', variant: 'destructive' });
                          }
                        }
                      }}
                      onContinue={() => handleCourseClick(course.id)}
                    />
                  );
                })
              ) : (
                <div className="col-span-full text-center py-12">
                  <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-semibold mb-2">
                    {searchTerm 
                      ? 'No matching courses found' 
                      : isStudent 
                        ? 'No active course enrollments yet' 
                        : 'No courses available'}
                  </h3>
                  <p className="text-muted-foreground">
                    {searchTerm 
                      ? 'Try adjusting your search terms or filters' 
                      : isStudent 
                        ? 'Your tutor or admin will enroll you in your course soon!' 
                        : 'Check back later for new courses!'
                    }
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </LMSLayout>
  );
}