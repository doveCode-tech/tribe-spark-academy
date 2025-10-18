import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { FileText, ExternalLink, Calendar, Star, MessageSquare } from "lucide-react";

interface Project {
  id: string;
  title: string;
  description: string | null;
  link: string | null;
  submitted_at: string;
  grade: number | null;
  feedback: string | null;
  review_status: string | null;
  courses: {
    title: string;
  };
}

export function StudentProjectsList() {
  const { userProfile } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userProfile?.auth_user_id) {
      fetchProjects();
      
      // Real-time updates for project grades and feedback
      const projectsChannel = supabase
        .channel('student-projects-updates')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'projects',
            filter: `student_id=eq.${userProfile.auth_user_id}`
          },
          (payload) => {
            console.log('Project updated:', payload);
            fetchProjects();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(projectsChannel);
      };
    }
  }, [userProfile]);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
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
          courses (title)
        `)
        .eq('student_id', userProfile?.auth_user_id)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string | null, grade: number | null) => {
    if (grade !== null) {
      return <Badge variant="default" className="bg-success">Graded</Badge>;
    }
    
    switch (status) {
      case 'graded':
        return <Badge variant="default" className="bg-success">Graded</Badge>;
      case 'reviewed':
        return <Badge variant="default" className="bg-primary">Reviewed</Badge>;
      case 'submitted':
      default:
        return <Badge variant="secondary">Pending Review</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-4">Loading projects...</p>
        </CardContent>
      </Card>
    );
  }

  if (projects.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="w-5 h-5 mr-2" />
            My Projects
          </CardTitle>
          <CardDescription>View your submitted projects and feedback</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No projects submitted yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <FileText className="w-5 h-5 mr-2" />
          My Projects ({projects.length})
        </CardTitle>
        <CardDescription>View your submitted projects and feedback</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {projects.map((project) => (
          <Card key={project.id} className="border-2">
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h4 className="font-semibold text-lg">{project.title}</h4>
                  <p className="text-sm text-muted-foreground">
                    {project.courses?.title}
                  </p>
                </div>
                {getStatusBadge(project.review_status, project.grade)}
              </div>

              {project.description && (
                <p className="text-sm mb-3">{project.description}</p>
              )}

              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {new Date(project.submitted_at).toLocaleDateString()}
                </span>
                {project.link && (
                  <a
                    href={project.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View Project
                  </a>
                )}
              </div>

              {/* Grade Display */}
              {project.grade !== null && (
                <div className="bg-success/10 border border-success/20 rounded-lg p-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-success" />
                    <span className="font-semibold text-success">
                      Grade: {project.grade}/100
                    </span>
                  </div>
                </div>
              )}

              {/* Feedback Display */}
              {project.feedback && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <MessageSquare className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold text-sm mb-1">Tutor Feedback:</p>
                      <p className="text-sm whitespace-pre-wrap">{project.feedback}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Pending feedback indicator */}
              {!project.feedback && !project.grade && (
                <div className="bg-muted/50 border border-muted rounded-lg p-3">
                  <p className="text-sm text-muted-foreground text-center">
                    ⏳ Waiting for tutor review
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
}