import { BookOpen, Trophy, Clock, MessageCircle, BarChart3, Star, GraduationCap, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HeroSection } from "./HeroSection";
import { CourseCard } from "./CourseCard";
import { StudentProjectsList } from "./StudentProjectsList";


export function StudentDashboard() {
  const { userProfile } = useAuth();
  const [enrolledCourses, setEnrolledCourses] = useState<any[]>([]);
  const [availableCourses, setAvailableCourses] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [portfolioProjects, setPortfolioProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userProfile) {
      fetchEnrolledCourses();
      fetchAvailableCourses();
      fetchAchievements();
      fetchPortfolioProjects();
    }

    // Real-time updates for enrollments, badges, projects, and lessons
    const changesChannel = supabase
      .channel('student-dashboard-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'enrollments',
          filter: `student_id=eq.${userProfile?.auth_user_id}`
        },
        () => fetchEnrolledCourses()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'student_badges',
          filter: `student_id=eq.${userProfile?.auth_user_id}`
        },
        () => fetchAchievements()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects',
          filter: `student_id=eq.${userProfile?.auth_user_id}`
        },
        () => fetchPortfolioProjects()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lessons'
        },
        () => {
          console.log('Lesson updated - refreshing enrolled courses');
          fetchEnrolledCourses();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(changesChannel);
    };
  }, [userProfile]);

  const fetchEnrolledCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('enrollments')
        .select(`
          *,
          courses (*)
        `)
        .eq('student_id', userProfile?.auth_user_id);

      if (error) {
        console.error('Error fetching enrolled courses:', error);
      } else {
        setEnrolledCourses(data || []);
      }
    } catch (error) {
      console.error('Error fetching enrolled courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableCourses = async () => {
    try {
      // Students should only see enrolled courses, not all available courses
      // Remove this to prevent showing "Enroll Now" for students
      setAvailableCourses([]);
    } catch (error) {
      console.error('Error fetching available courses:', error);
    }
  };

  const fetchAchievements = async () => {
    try {
      const { data } = await supabase
        .from('student_badges')
        .select(`
          earned_at,
          badges(*)
        `)
        .eq('student_id', userProfile?.auth_user_id);
      
      setAchievements(data?.map(b => ({ ...b.badges, earned_at: b.earned_at })) || []);
    } catch (error) {
      console.error('Error fetching achievements:', error);
      setAchievements([]);
    }
  };

  const fetchPortfolioProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('student_id', userProfile?.auth_user_id);

      if (error) {
        console.error('Error fetching portfolio projects:', error);
      } else {
        setPortfolioProjects(data || []);
      }
    } catch (error) {
      console.error('Error fetching portfolio projects:', error);
    }
  };

  const studentDisplayName = userProfile?.first_name 
    ? `${userProfile.first_name}${userProfile.last_name ? ` ${userProfile.last_name}` : ''}`
    : (userProfile?.name || '');

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <HeroSection 
        studentName={studentDisplayName}
        onStartLearning={() => window.location.href = '/courses'} 
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-4 text-center">
            <BookOpen className="w-8 h-8 mx-auto text-primary mb-2" />
            <div className="text-2xl font-bold text-primary">{enrolledCourses.length}</div>
            <div className="text-sm text-muted-foreground">Active Courses</div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
          <CardContent className="p-4 text-center">
            <Trophy className="w-8 h-8 mx-auto text-success mb-2" />
            <div className="text-2xl font-bold text-success">{achievements.length}</div>
            <div className="text-sm text-muted-foreground">Achievements</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-secondary/10 to-secondary/5 border-secondary/20">
          <CardContent className="p-4 text-center">
            <GraduationCap className="w-8 h-8 mx-auto text-secondary mb-2" />
            <div className="text-2xl font-bold text-secondary">{portfolioProjects.length}</div>
            <div className="text-sm text-muted-foreground">Projects</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20">
          <CardContent className="p-4 text-center">
            <Sparkles className="w-8 h-8 mx-auto text-warning mb-2" />
            <div className="text-2xl font-bold text-warning">0</div>
            <div className="text-sm text-muted-foreground">Streak Days</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* My Active Courses */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold flex items-center">
              <BookOpen className="w-6 h-6 mr-2 text-primary" />
              My Courses
            </h2>
            <Button variant="outline" onClick={() => window.location.href = '/courses'}>
              View All
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading courses...</p>
            </div>
          ) : enrolledCourses.length === 0 ? (
            <Card className="p-8 text-center bg-gradient-to-br from-primary/5 to-secondary/5">
              <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Ready to Start Learning?</h3>
              <p className="text-muted-foreground mb-6">
                Choose from our amazing collection of kid-friendly courses!
              </p>
              <Button className="bg-gradient-primary" onClick={() => window.location.href = '/courses'}>
                <BookOpen className="w-4 h-4 mr-2" />
                Browse Courses
              </Button>
            </Card>
          ) : (
            <div className="grid gap-6">
              {enrolledCourses.slice(0, 3).map((enrollment) => (
                <CourseCard
                  key={enrollment.id}
                  course={enrollment.courses}
                  enrollment={enrollment}
                  isEnrolled={true}
                  onContinue={() => window.location.href = `/courses/${enrollment.course_id}`}
                />
              ))}
            </div>
          )}

          {/* Student Projects List */}
          <StudentProjectsList />
        </div>

        {/* Sidebar - Achievements and AI Recommendations */}
        <div className="space-y-6">
          {/* Recent Achievements */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Trophy className="w-5 h-5 mr-2 text-warning" />
                Achievements
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {achievements.length === 0 ? (
                <div className="text-center py-6">
                  <Trophy className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No achievements earned yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Complete lessons and courses to earn achievements!
                  </p>
                </div>
              ) : (
                achievements.map((achievement, index) => (
                  <div key={index} className={`flex items-center space-x-3 p-2 rounded-lg ${
                    achievement.earned ? 'bg-success/10' : 'bg-muted/50'
                  }`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      achievement.earned ? 'bg-success text-success-foreground' : 'bg-muted'
                    }`}>
                      <Trophy className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{achievement.name}</p>
                      <p className="text-xs text-muted-foreground">{achievement.description}</p>
                    </div>
                  </div>
                ))
              )}
              {achievements.length > 0 && (
                <Button variant="outline" size="sm" className="w-full mt-3">
                  View All Achievements
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Portfolio Preview */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center">
                <GraduationCap className="w-5 h-5 mr-2 text-secondary" />
                Portfolio
              </CardTitle>
              <CardDescription>Your completed projects</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {portfolioProjects.length === 0 ? (
                <div className="text-center py-6">
                  <GraduationCap className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No projects yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Complete courses to add capstone projects to your portfolio!
                  </p>
                </div>
              ) : (
                portfolioProjects.slice(0, 3).map((project) => (
                  <div key={project.id} className="p-3 bg-secondary/10 rounded-lg border border-secondary/20">
                    <h4 className="font-medium text-sm mb-1">{project.title}</h4>
                    <p className="text-xs text-muted-foreground">{project.description}</p>
                  </div>
                ))
              )}
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full mt-3"
                onClick={() => window.location.href = '/portfolio'}
              >
                <GraduationCap className="w-4 h-4 mr-2" />
                View Full Portfolio
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}