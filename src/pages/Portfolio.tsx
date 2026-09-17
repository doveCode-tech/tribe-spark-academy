import { useEffect, useState } from "react";
import { LMSLayout } from "@/components/LMSLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ExternalLink, Github, Code, Calendar, FileText, Trophy, Zap } from "lucide-react";
import { SharePortfolioButton } from "@/components/SharePortfolioButton";
import { ProjectCodeViewer } from "@/components/ProjectCodeViewer";
import { CertificateViewer } from "@/components/CertificateViewer";
import { GitHubPushDialog } from "@/components/GitHubPushDialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getDualIdArray } from "@/utils/identity";
import { calculateLevel, fetchStudentXP } from "@/utils/gamification";

function ProjectThumbnail({ screenshot, title, editorType }: { screenshot?: string; title: string; editorType?: string }) {
  const [hasError, setHasError] = useState(false);

  if (screenshot && !hasError) {
    return (
      <img 
        src={screenshot} 
        alt={title}
        onError={() => setHasError(true)}
        className="w-20 h-20 rounded-xl object-cover bg-muted border border-border shrink-0"
      />
    );
  }

  return (
    <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-indigo-500/15 via-purple-500/15 to-pink-500/15 border border-purple-500/30 flex flex-col items-center justify-center shrink-0 text-purple-600 shadow-xs">
      <Code className="w-7 h-7 text-purple-600" />
      <span className="text-[9px] font-bold mt-1 uppercase tracking-wider text-purple-700 dark:text-purple-300">
        {editorType?.replace("monaco_", "") || "Capstone"}
      </span>
    </div>
  );
}

const Portfolio = () => {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [projects, setProjects] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [selectedCertificate, setSelectedCertificate] = useState<string | null>(null);
  const [showCodeViewer, setShowCodeViewer] = useState(false);
  const [showCertViewer, setShowCertViewer] = useState(false);
  const [githubTargetProject, setGithubTargetProject] = useState<any>(null);
  const [showGithubModal, setShowGithubModal] = useState(false);
  const [totalXP, setTotalXP] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userProfile?.auth_user_id) {
      fetchPortfolioData();
    }
  }, [userProfile]);

  const fetchPortfolioData = async () => {
    try {
      const studentIds = getDualIdArray(userProfile);
      if (studentIds.length === 0) return;

      // Fetch graded projects matching either users.id or auth_user_id
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
        .select('earned_at, badge_id, badges(*)')
        .in('student_id', studentIds);

      setBadges(
        badgesData
          ?.filter((b: any) => b.badges && b.badges.id)
          .map((b: any) => ({ ...b.badges, earned_at: b.earned_at })) || []
      );

      // Fetch certificates
      const { data: certificatesData } = await supabase
        .from('certificates')
        .select('*')
        .in('student_id', studentIds)
        .order('issued_at', { ascending: false });

      setCertificates(certificatesData || []);

      // Fetch student XP
      const xp = await fetchStudentXP(userProfile);
      setTotalXP(xp);
    } catch (error) {
      console.error('Error fetching portfolio data:', error);
      toast({
        title: "Error",
        description: "Failed to load portfolio data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <LMSLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading portfolio...</div>
        </div>
      </LMSLayout>
    );
  }
  
  const levelProgress = calculateLevel(totalXP);

  return (
    <LMSLayout>
      <div className="space-y-6">
        {/* Profile Header */}
        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <Avatar className="w-24 h-24">
                <AvatarImage src={userProfile?.avatar_url || "/placeholder.svg"} alt="Student" />
                <AvatarFallback className="text-2xl">
                  {userProfile?.name?.slice(0, 2).toUpperCase() || 'ST'}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap mb-2">
                  <h1 className="text-3xl font-bold">
                    {userProfile?.name || 'Student Portfolio'}
                  </h1>
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
                <p className="text-muted-foreground mb-4">
                  {userProfile?.bio || 'Passionate young coder exploring the exciting world of programming, robotics, and creative technology.'}
                </p>
                
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Joined {new Date(userProfile?.created_at || Date.now()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </div>
                  <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                    <Zap className="w-4 h-4 fill-amber-500 text-amber-500" />
                    {totalXP} Total XP
                  </div>
                  <div>
                    {certificates.length} Certificates Earned
                  </div>
                  <div>
                    {projects.length} Projects Completed
                  </div>
                  <div>
                    {badges.length} Badges Earned
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                {userProfile?.auth_user_id && (
                  <SharePortfolioButton studentId={userProfile.auth_user_id} />
                )}
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => window.location.href = '/achievements'}
                >
                  <Trophy className="w-4 h-4 mr-2" />
                  View All Achievements
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Projects */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>My Projects</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {projects.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Complete and get your projects graded to see them here
                  </p>
                ) : (
                  projects.map((project) => (
                    <div key={project.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start gap-4">
                        <ProjectThumbnail
                          screenshot={project.screenshot}
                          title={project.title}
                          editorType={project.editor_type}
                        />
                        
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="font-semibold text-lg">{project.title}</h3>
                            {project.grade && (
                              <Badge variant="default" className="shrink-0 bg-success">
                                {project.grade}%
                              </Badge>
                            )}
                          </div>
                          
                          <p className="text-muted-foreground text-sm mb-3">
                            {project.description}
                          </p>
                          
                          <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
                            <span>
                              Submitted: {new Date(project.submitted_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </span>
                          </div>
                          
                          {project.feedback && (
                            <div className="text-sm text-muted-foreground mb-3 italic">
                              Feedback: {project.feedback}
                            </div>
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
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setSelectedProject(project);
                                setShowCodeViewer(true);
                              }}
                            >
                              <Code className="w-4 h-4 mr-1" />
                              Code
                            </Button>
                            {Boolean(
                              project.is_capstone ||
                              project.is_assignment ||
                              project.type === "assignment" ||
                              project.type === "capstone" ||
                              project.title?.toLowerCase().includes("capstone") ||
                              project.title?.toLowerCase().includes("final") ||
                              (project.grade !== null && project.grade !== undefined)
                            ) && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  setGithubTargetProject(project);
                                  setShowGithubModal(true);
                                }}
                                className="border-slate-700 text-slate-800 dark:border-slate-300 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 gap-1 font-semibold"
                              >
                                <Github className="w-4 h-4 mr-1" />
                                Push to GitHub
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Badges */}
            {badges.length > 0 && (
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle>Badges Earned</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {badges.map((badge, index) => (
                    <div key={index} className="p-3 border rounded-lg flex items-center gap-3">
                      <div className="text-2xl">{badge.icon || '🏆'}</div>
                      <div>
                        <h4 className="font-medium text-sm">{badge.name}</h4>
                        <p className="text-xs text-muted-foreground">
                          Earned: {new Date(badge.earned_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Certificates */}
            {certificates.length > 0 && (
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle>Certificates</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {certificates.map((cert) => (
                    <div key={cert.id} className="p-3 border rounded-lg">
                      <h4 className="font-medium text-sm">{cert.course_title}</h4>
                      <p className="text-xs text-muted-foreground mb-2">
                        Issued: {new Date(cert.completion_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          setSelectedCertificate(cert.id);
                          setShowCertViewer(true);
                        }}
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        View Certificate
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Empty State */}
            {badges.length === 0 && certificates.length === 0 && (
              <Card className="shadow-card">
                <CardContent className="p-6 text-center">
                  <Trophy className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Complete lessons and courses to earn badges and certificates!
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <ProjectCodeViewer
        project={selectedProject}
        open={showCodeViewer}
        onOpenChange={setShowCodeViewer}
        onPushToGithub={(proj) => {
          setShowCodeViewer(false);
          setGithubTargetProject(proj);
          setShowGithubModal(true);
        }}
      />

      <CertificateViewer
        certificateId={selectedCertificate}
        open={showCertViewer}
        onOpenChange={setShowCertViewer}
      />

      <GitHubPushDialog
        open={showGithubModal}
        onOpenChange={setShowGithubModal}
        project={githubTargetProject}
        studentName={userProfile?.name}
      />
    </LMSLayout>
  );
};

export default Portfolio;
