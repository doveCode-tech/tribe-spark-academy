import { BookOpen, Trophy, Clock, MessageCircle, BarChart3, Star, GraduationCap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";


export function StudentDashboard() {
  const { userProfile } = useAuth();
  const [enrolledCourses, setEnrolledCourses] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [portfolioProjects, setPortfolioProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userProfile) {
      fetchEnrolledCourses();
      fetchAchievements();
      fetchPortfolioProjects();
    }
  }, [userProfile]);

  const fetchEnrolledCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('enrollments')
        .select(`
          *,
          courses (*)
        `)
        .eq('student_id', userProfile?.id);

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

  const fetchAchievements = async () => {
    // For now, achievements will be empty by default
    // This can be implemented when the achievements system is built
    setAchievements([]);
  };

  const fetchPortfolioProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('student_id', userProfile?.id);

      if (error) {
        console.error('Error fetching portfolio projects:', error);
      } else {
        setPortfolioProjects(data || []);
      }
    } catch (error) {
      console.error('Error fetching portfolio projects:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-hero rounded-xl p-6 text-white shadow-elevated">
        <h1 className="text-3xl font-bold mb-2">
          Welcome back, {userProfile?.name || 'Student'}! 🚀
        </h1>
        <p className="text-white/90 mb-4">Ready to continue your learning journey?</p>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5" />
            <span className="font-semibold">{enrolledCourses.length} Courses</span>
          </div>
          <div className="flex items-center space-x-2">
            <Trophy className="w-5 h-5" />
            <span className="font-semibold">{achievements.length} Achievements</span>
          </div>
          <div className="flex items-center space-x-2">
            <GraduationCap className="w-5 h-5" />
            <span className="font-semibold">{portfolioProjects.length} Projects</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Button className="h-16 bg-gradient-primary hover:opacity-90 transition-opacity">
          <MessageCircle className="w-5 h-5 mr-2" />
          Ask AI Assistant
        </Button>
        <Button 
          variant="outline" 
          className="h-16"
          onClick={() => window.location.href = '/portfolio'}
        >
          <BookOpen className="w-5 h-5 mr-2" />
          View Portfolio
        </Button>
        <Button 
          variant="outline" 
          className="h-16"
          onClick={() => window.location.href = '/achievements'}
        >
          <Trophy className="w-5 h-5 mr-2" />
          Achievements
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* My Courses */}
        <div className="lg:col-span-2">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center">
                <BookOpen className="w-5 h-5 mr-2 text-primary" />
                My Courses
              </CardTitle>
              <CardDescription>Continue where you left off</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="text-muted-foreground mt-2">Loading courses...</p>
                </div>
              ) : enrolledCourses.length === 0 ? (
                <div className="text-center py-8">
                  <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Courses Yet</h3>
                  <p className="text-muted-foreground mb-4">
                    You haven't been enrolled in any courses yet. Contact your instructor or admin to get started.
                  </p>
                  <Button variant="outline" onClick={() => window.location.href = '/courses'}>
                    Browse Available Courses
                  </Button>
                </div>
              ) : (
                enrolledCourses.map((enrollment) => (
                  <div key={enrollment.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-lg">{enrollment.courses.title}</h3>
                        <p className="text-muted-foreground text-sm">{enrollment.courses.category}</p>
                      </div>
                      <Badge variant="secondary">{enrollment.progress_percentage || 0}%</Badge>
                    </div>
                    
                    <Progress value={enrollment.progress_percentage || 0} className="mb-3" />
                    
                    <div className="flex justify-between items-center">
                      <div className="text-sm text-muted-foreground">
                        Status: {enrollment.status}
                      </div>
                      <Button 
                        size="sm" 
                        className="ml-auto"
                        onClick={() => window.location.href = `/courses/${enrollment.course_id}`}
                      >
                        Continue
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
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