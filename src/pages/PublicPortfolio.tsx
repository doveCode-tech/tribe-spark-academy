import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, ExternalLink, Download, Code, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { resolveStudentIdentity } from "@/utils/identity";
import { calculateLevel, fetchStudentXP } from "@/utils/gamification";

export default function PublicPortfolio() {
  const { studentId } = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [portfolio, setPortfolio] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);
  const [totalXP, setTotalXP] = useState<number>(0);

  useEffect(() => {
    fetchPortfolio();
  }, [studentId]);

  const fetchPortfolio = async () => {
    if (!studentId) return;
    try {
      // Resolve both users.id and auth_user_id
      const identity = await resolveStudentIdentity(studentId);
      const studentIds = identity ? [identity.dbId, identity.authUserId] : [studentId];

      // Fetch portfolio
      const { data: portfolioData } = await supabase
        .from('portfolios')
        .select('*')
        .in('student_id', studentIds)
        .eq('is_public', true)
        .maybeSingle();

      if (!portfolioData) {
        toast({
          title: "Portfolio not found",
          description: "This portfolio is not public or doesn't exist",
          variant: "destructive",
        });
        return;
      }

      setPortfolio(portfolioData);

      // Fetch projects
      const { data: projectsData } = await supabase
        .from('projects')
        .select('*')
        .in('student_id', studentIds)
        .eq('review_status', 'graded')
        .order('submitted_at', { ascending: false });

      setProjects(projectsData || []);

      // Fetch badges
      const { data: badgesData } = await supabase
        .from('student_badges')
        .select('earned_at, badges(*)')
        .in('student_id', studentIds);

      setBadges(badgesData?.map(b => ({ ...b.badges, earned_at: b.earned_at })) || []);

      // Fetch student XP
      const xp = await fetchStudentXP(studentIds);
      setTotalXP(xp);
    } catch (error) {
      console.error('Error fetching portfolio:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-2">Portfolio Not Found</h2>
            <p className="text-muted-foreground">
              This portfolio is not public or doesn't exist.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const levelProgress = calculateLevel(totalXP);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <Card className="border-2 shadow-card" style={{ borderColor: portfolio.theme_color }}>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 flex-wrap mb-2">
                  <CardTitle className="text-4xl">{portfolio.title}</CardTitle>
                  <Badge 
                    className="text-white border-none font-semibold px-3 py-1 flex items-center gap-1.5 shadow-sm text-sm"
                    style={{ backgroundColor: levelProgress.currentLevel.color }}
                  >
                    <span>{levelProgress.currentLevel.badge}</span>
                    <span>Level {levelProgress.currentLevel.level}: {levelProgress.currentLevel.title}</span>
                  </Badge>
                  <Badge variant="outline" className="border-amber-400/50 bg-amber-50/70 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-bold px-2.5 py-1 flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                    <span>{totalXP} XP</span>
                  </Badge>
                </div>
                <p className="text-lg text-muted-foreground">{portfolio.description}</p>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Badges Section */}
        {badges.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5" />
                Achievements & Badges
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {badges.map((badge, index) => (
                  <div
                    key={index}
                    className="p-4 rounded-lg text-center border-2"
                    style={{ borderColor: badge.color }}
                  >
                    <div className="text-4xl mb-2">{badge.icon}</div>
                    <h4 className="font-semibold mb-1">{badge.name}</h4>
                    <p className="text-xs text-muted-foreground">{badge.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Projects Section */}
        <Card>
          <CardHeader>
            <CardTitle>Projects</CardTitle>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No projects to display yet
              </p>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {projects.map((project) => (
                  <Card key={project.id}>
                    <CardHeader>
                      <CardTitle className="text-lg">{project.title}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {project.description}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {project.screenshot && (
                        <img
                          src={project.screenshot}
                          alt={project.title}
                          className="w-full h-48 object-cover rounded-lg"
                        />
                      )}
                      {project.grade && (
                        <Badge variant="default" className="gap-1">
                          Grade: {project.grade}%
                        </Badge>
                      )}
                      <div className="flex gap-2 flex-wrap">
                        {project.link && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(project.link, '_blank')}
                          >
                            <ExternalLink className="w-4 h-4 mr-1" />
                            View Project
                          </Button>
                        )}
                        {project.file_path && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(project.file_path, '_blank')}
                          >
                            <Code className="w-4 h-4 mr-1" />
                            View Code
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}