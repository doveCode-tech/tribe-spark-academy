import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ExternalLink, Download, Github, Globe, Award, Calendar, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { BadgeDisplay } from "./BadgeDisplay";

interface Project {
  id: string;
  title: string;
  description: string;
  link?: string;
  screenshot?: string;
  submitted_at: string;
  course_title?: string;
}

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  earned_at: string;
}

interface Portfolio {
  student_name: string;
  student_email: string;
  student_avatar?: string;
  projects: Project[];
  badges: Badge[];
  total_courses: number;
  completion_rate: number;
}

interface PortfolioViewerProps {
  studentId?: string;
  isPublic?: boolean;
}

export function PortfolioViewer({ studentId, isPublic = false }: PortfolioViewerProps) {
  const { userProfile } = useAuth();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const targetStudentId = studentId || userProfile?.auth_user_id;
    if (targetStudentId) {
      loadPortfolio(targetStudentId);
    }
  }, [studentId, userProfile]);

  const loadPortfolio = async (userId: string) => {
    try {
      setLoading(true);
      
      // Get user info
      const { data: userData } = await supabase
        .from('users')
        .select('first_name, last_name, email, avatar_url')
        .eq('auth_user_id', userId)
        .single();

      // Get projects
      const { data: projectsData } = await supabase
        .from('projects')
        .select(`
          *,
          courses(title)
        `)
        .eq('student_id', userId)
        .order('submitted_at', { ascending: false });

      // Get badges
      const { data: badgesData } = await supabase
        .from('student_badges')
        .select(`
          earned_at,
          badges(*)
        `)
        .eq('student_id', userId)
        .order('earned_at', { ascending: false });

      // Get course stats
      const { data: enrollmentData } = await supabase
        .from('enrollments')
        .select('*')
        .eq('student_id', userId);

      const { data: completedLessons } = await supabase
        .from('lesson_progress')
        .select('*')
        .eq('student_id', userId)
        .eq('completed', true);

      const totalCourses = enrollmentData?.length || 0;
      const completionRate = totalCourses > 0 ? Math.round((completedLessons?.length || 0) / totalCourses * 100) : 0;

      setPortfolio({
        student_name: userData ? `${userData.first_name || ''} ${userData.last_name || ''}`.trim() : 'Student',
        student_email: userData?.email || '',
        student_avatar: userData?.avatar_url,
        projects: projectsData?.map(p => ({
          ...p,
          course_title: p.courses?.title
        })) || [],
        badges: badgesData?.map(b => ({
          ...b.badges,
          earned_at: b.earned_at
        })) || [],
        total_courses: totalCourses,
        completion_rate: completionRate
      });
    } catch (error) {
      console.error('Error loading portfolio:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadProject = async (project: Project) => {
    // For demo purposes, this would trigger a download
    console.log('Downloading project:', project.title);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-4">Portfolio Not Found</h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/5">
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        {/* Header */}
        <Card className="mb-8 bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <Avatar className="w-24 h-24 border-4 border-primary/20">
                <AvatarImage src={portfolio.student_avatar} />
                <AvatarFallback className="text-2xl bg-gradient-to-br from-primary to-secondary text-primary-foreground">
                  {portfolio.student_name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              <div className="text-center md:text-left flex-1">
                <h1 className="text-3xl font-bold mb-2">{portfolio.student_name}</h1>
                <p className="text-muted-foreground mb-4">{portfolio.student_email}</p>
                
                <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" />
                    <span className="text-sm">{portfolio.total_courses} Courses</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-secondary" />
                    <span className="text-sm">{portfolio.badges.length} Badges</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-accent" />
                    <span className="text-sm">{portfolio.completion_rate}% Progress</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Projects */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  Projects ({portfolio.projects.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {portfolio.projects.length === 0 ? (
                  <div className="text-center py-8">
                    <Globe className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No projects yet</p>
                  </div>
                ) : (
                  <div className="grid gap-6">
                    {portfolio.projects.map((project) => (
                      <Card key={project.id} className="border border-muted/50 hover:border-primary/30 transition-colors">
                        <CardContent className="p-6">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold mb-2">{project.title}</h3>
                              <p className="text-muted-foreground text-sm mb-2">{project.description}</p>
                              {project.course_title && (
                                <Badge variant="secondary" className="mb-2">
                                  {project.course_title}
                                </Badge>
                              )}
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Calendar className="w-3 h-3" />
                                {new Date(project.submitted_at).toLocaleDateString()}
                              </div>
                            </div>
                            {project.screenshot && (
                              <div className="w-24 h-24 bg-muted rounded-lg flex items-center justify-center ml-4">
                                <img 
                                  src={project.screenshot} 
                                  alt={project.title}
                                  className="w-full h-full object-cover rounded-lg"
                                />
                              </div>
                            )}
                          </div>
                          
                          <div className="flex gap-2">
                            {project.link && (
                              <Button size="sm" variant="outline" asChild>
                                <a href={project.link} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="w-4 h-4 mr-2" />
                                  View Project
                                </a>
                              </Button>
                            )}
                            <Button size="sm" variant="outline" onClick={() => downloadProject(project)}>
                              <Download className="w-4 h-4 mr-2" />
                              Download
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Badges */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5" />
                  Achievements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <BadgeDisplay badges={portfolio.badges} size="sm" showDescription={false} />
              </CardContent>
            </Card>

            {/* Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Learning Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Courses Enrolled</span>
                  <span className="font-semibold">{portfolio.total_courses}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Projects Completed</span>
                  <span className="font-semibold">{portfolio.projects.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Badges Earned</span>
                  <span className="font-semibold">{portfolio.badges.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Completion Rate</span>
                  <span className="font-semibold">{portfolio.completion_rate}%</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}