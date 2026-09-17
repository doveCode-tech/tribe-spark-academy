import { BookOpen, Trophy, Clock, MessageCircle, BarChart3, Star, GraduationCap, Sparkles, Search, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HeroSection } from "./HeroSection";
import { CourseCard } from "./CourseCard";
import { StudentProjectsList } from "./StudentProjectsList";
import { StreakDisplay } from "./StreakDisplay";
import { LearningCalendar } from "./LearningCalendar";
import { XPLevelWidget } from "./gamification/XPLevelWidget";
import { LevelUpModal } from "./gamification/LevelUpModal";
import { getDualIdArray } from "@/utils/identity";

export function StudentDashboard() {
  const { userProfile } = useAuth();
  const [enrolledCourses, setEnrolledCourses] = useState<any[]>([]);
  const [availableCourses, setAvailableCourses] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [portfolioProjects, setPortfolioProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseSearch, setCourseSearch] = useState("");

  const sortedAndFilteredCourses = useMemo(() => {
    // 1. Sort by:
    // - In-progress courses (0 < prog < 100) first (latest worked on / most incomplete)
    // - Unstarted courses (prog === 0) next
    // - 100% completed courses all the way at the bottom
    const sorted = [...enrolledCourses].sort((a, b) => {
      const progA = a.progress_percentage || 0;
      const progB = b.progress_percentage || 0;
      const isCompletedA = progA >= 100;
      const isCompletedB = progB >= 100;

      if (isCompletedA && !isCompletedB) return 1;
      if (!isCompletedA && isCompletedB) return -1;

      if (isCompletedA && isCompletedB) {
        return new Date(b.updated_at || b.enrolled_at || 0).getTime() -
               new Date(a.updated_at || a.enrolled_at || 0).getTime();
      }

      const inProgressA = progA > 0 && progA < 100;
      const inProgressB = progB > 0 && progB < 100;

      if (inProgressA && !inProgressB) return -1;
      if (!inProgressA && inProgressB) return 1;

      const timeA = new Date(a.updated_at || a.enrolled_at || 0).getTime();
      const timeB = new Date(b.updated_at || b.enrolled_at || 0).getTime();
      if (timeA !== timeB && Math.abs(timeA - timeB) > 5000) {
        return timeB - timeA;
      }

      return progA - progB;
    });

    if (!courseSearch.trim()) return sorted;
    const q = courseSearch.toLowerCase();
    return sorted.filter((e) => {
      const title = (e.courses?.title || "").toLowerCase();
      const desc = (e.courses?.description || "").toLowerCase();
      const cat = (e.courses?.category || "").toLowerCase();
      return title.includes(q) || desc.includes(q) || cat.includes(q);
    });
  }, [enrolledCourses, courseSearch]);

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
      const studentIds = getDualIdArray(userProfile);
      if (studentIds.length === 0) return;

      const { data, error } = await supabase
        .from('enrollments')
        .select(`
          *,
          courses (*)
        `)
        .in('student_id', studentIds)
        .eq('status', 'active');

      if (error) {
        console.error('Error fetching enrolled courses:', error);
      } else {
        // Only retain valid courses
        const valid = (data || []).filter(item => item.courses && item.courses.id);
        setEnrolledCourses(valid);
      }
    } catch (error) {
      console.error('Error fetching enrolled courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableCourses = async () => {
    try {
      setAvailableCourses([]);
    } catch (error) {
      console.error('Error fetching available courses:', error);
    }
  };

  const fetchAchievements = async () => {
    try {
      const studentIds = getDualIdArray(userProfile);
      if (studentIds.length === 0) return;

      const { data } = await supabase
        .from('student_badges')
        .select(`
          earned_at,
          badges(*)
        `)
        .in('student_id', studentIds);
      
      setAchievements(data?.map(b => ({ ...b.badges, earned_at: b.earned_at })) || []);
    } catch (error) {
      console.error('Error fetching achievements:', error);
      setAchievements([]);
    }
  };

  const fetchPortfolioProjects = async () => {
    try {
      const studentIds = getDualIdArray(userProfile);
      if (studentIds.length === 0) return;

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .in('student_id', studentIds);

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

  // Calculate overall average course progress
  const totalProgress = enrolledCourses.reduce(
    (acc, curr) => acc + (Number(curr.progress_percentage) || 0),
    0
  );
  const averageProgress = enrolledCourses.length > 0 
    ? Math.round(totalProgress / enrolledCourses.length) 
    : 0;

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <HeroSection 
        studentName={studentDisplayName}
        enrolledCount={enrolledCourses.length}
        progressPercentage={averageProgress}
        onStartLearning={() => window.location.href = '/courses'} 
      />

      {/* Level & XP Progression Widget */}
      <XPLevelWidget />

      {/* Level Up Celebratory Modal */}
      <LevelUpModal />

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
            <div className="text-sm text-muted-foreground">Certificates</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* My Active Courses */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-bold">My Courses</h2>
              <Badge variant="secondary" className="text-xs font-semibold px-2">
                {sortedAndFilteredCourses.length}
              </Badge>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Filter courses by name..."
                  value={courseSearch}
                  onChange={(e) => setCourseSearch(e.target.value)}
                  className="pl-9 pr-8 h-9 text-xs rounded-lg"
                />
                {courseSearch && (
                  <button
                    onClick={() => setCourseSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => window.location.href = '/courses'} className="shrink-0 text-xs">
                View All
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading courses...</p>
            </div>
          ) : enrolledCourses.length === 0 ? (
            <Card className="p-8 text-center bg-gradient-to-br from-primary/5 to-secondary/5">
              <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Welcome to Your Learning Space!</h3>
              <p className="text-muted-foreground mb-4">
                You haven't been enrolled in any courses yet. Your tutor or administrator will assign your courses shortly!
              </p>
            </Card>
          ) : sortedAndFilteredCourses.length === 0 ? (
            <Card className="p-8 text-center border-dashed">
              <Search className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-60" />
              <h3 className="text-base font-semibold mb-1">No courses match "{courseSearch}"</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Try searching with a different term or clear the filter.
              </p>
              <Button variant="outline" size="sm" onClick={() => setCourseSearch("")}>
                Clear Filter
              </Button>
            </Card>
          ) : (
            <div className="grid gap-6">
              {(courseSearch.trim() ? sortedAndFilteredCourses : sortedAndFilteredCourses.slice(0, 4)).map((enrollment) => (
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

        {/* Sidebar - Learning Calendar and Achievements */}
        <div className="space-y-6">
          {/* Streak Display */}
          <StreakDisplay />

          {/* Learning Calendar */}
          <LearningCalendar />

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