import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Star, MessageSquare, FileText, ExternalLink, User, Calendar } from "lucide-react";
import { Label } from "@/components/ui/label";

interface Project {
  id: string;
  title: string;
  description: string | null;
  link: string | null;
  submitted_at: string;
  grade: number | null;
  feedback: string | null;
  review_status: string | null;
  student: {
    name: string;
    email: string;
  };
  courses: {
    title: string;
  };
}

interface Props {
  projects: Project[];
  onUpdate: () => void;
}

export function ProjectGradingInterface({ projects, onUpdate }: Props) {
  const { toast } = useToast();
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [gradeValue, setGradeValue] = useState<{ [key: string]: string }>({});
  const [feedbackValue, setFeedbackValue] = useState<{ [key: string]: string }>({});
  const [saving, setSaving] = useState<{ [key: string]: boolean }>({});

  const handleSave = async (projectId: string, includeGrade: boolean) => {
    setSaving({ ...saving, [projectId]: true });
    
    try {
      const updates: any = {
        review_status: includeGrade ? 'graded' : 'reviewed',
      };

      // Add feedback if provided
      if (feedbackValue[projectId]?.trim()) {
        updates.feedback = feedbackValue[projectId].trim();
      }

      // Add grade if provided and requested
      if (includeGrade && gradeValue[projectId]) {
        const grade = parseInt(gradeValue[projectId]);
        if (isNaN(grade) || grade < 0 || grade > 100) {
          toast({
            title: "Invalid Grade",
            description: "Grade must be between 0 and 100",
            variant: "destructive",
          });
          return;
        }
        updates.grade = grade;
      }

      const { error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', projectId);

      if (error) throw error;

      toast({
        title: includeGrade ? "Project Graded" : "Feedback Saved",
        description: includeGrade 
          ? "Grade and feedback have been saved" 
          : "Feedback has been saved",
      });

      // Clear form values
      setGradeValue({ ...gradeValue, [projectId]: '' });
      setFeedbackValue({ ...feedbackValue, [projectId]: '' });
      setExpandedProject(null);
      
      onUpdate();
    } catch (error: any) {
      console.error('Error saving feedback/grade:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save",
        variant: "destructive",
      });
    } finally {
      setSaving({ ...saving, [projectId]: false });
    }
  };

  const toggleExpand = (projectId: string, currentGrade: number | null, currentFeedback: string | null) => {
    if (expandedProject === projectId) {
      setExpandedProject(null);
    } else {
      setExpandedProject(projectId);
      // Pre-fill with existing values
      if (currentGrade !== null) {
        setGradeValue({ ...gradeValue, [projectId]: currentGrade.toString() });
      }
      if (currentFeedback) {
        setFeedbackValue({ ...feedbackValue, [projectId]: currentFeedback });
      }
    }
  };

  if (projects.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="w-5 h-5 mr-2" />
            Student Projects
          </CardTitle>
          <CardDescription>Review and grade student submissions</CardDescription>
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
          Student Projects ({projects.length})
        </CardTitle>
        <CardDescription>Review and grade student submissions</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {projects.map((project) => {
          const isExpanded = expandedProject === project.id;
          const isSaving = saving[project.id];

          return (
            <Card key={project.id} className="border-2">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg">{project.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      {project.courses?.title}
                    </p>
                  </div>
                  {project.grade !== null ? (
                    <Badge variant="default" className="bg-success">
                      Graded: {project.grade}/100
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Pending Review</Badge>
                  )}
                </div>

                <div className="space-y-2 mb-3">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span>{project.student?.name || project.student?.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    Submitted: {new Date(project.submitted_at).toLocaleDateString()}
                  </div>
                </div>

                {project.description && (
                  <p className="text-sm mb-3 bg-muted/30 p-2 rounded">
                    {project.description}
                  </p>
                )}

                {project.link && (
                  <a
                    href={project.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-primary hover:underline text-sm mb-3"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View Project Link
                  </a>
                )}

                {project.feedback && !isExpanded && (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mb-3">
                    <p className="text-sm font-semibold mb-1">Current Feedback:</p>
                    <p className="text-sm whitespace-pre-wrap">{project.feedback}</p>
                  </div>
                )}

                {/* Grading Form */}
                {isExpanded && (
                  <div className="space-y-4 mt-4 p-4 bg-muted/30 rounded-lg">
                    <div>
                      <Label htmlFor={`grade-${project.id}`}>
                        Grade (0-100) - Optional
                      </Label>
                      <Input
                        id={`grade-${project.id}`}
                        type="number"
                        min="0"
                        max="100"
                        placeholder="Enter grade (optional)"
                        value={gradeValue[project.id] || ''}
                        onChange={(e) => setGradeValue({ ...gradeValue, [project.id]: e.target.value })}
                        disabled={isSaving}
                      />
                    </div>

                    <div>
                      <Label htmlFor={`feedback-${project.id}`}>
                        Feedback
                      </Label>
                      <Textarea
                        id={`feedback-${project.id}`}
                        placeholder="Provide feedback for the student..."
                        value={feedbackValue[project.id] || ''}
                        onChange={(e) => setFeedbackValue({ ...feedbackValue, [project.id]: e.target.value })}
                        rows={4}
                        disabled={isSaving}
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleSave(project.id, true)}
                        disabled={isSaving || !feedbackValue[project.id]?.trim()}
                        className="flex-1"
                      >
                        <Star className="w-4 h-4 mr-2" />
                        {gradeValue[project.id] ? 'Save Grade & Feedback' : 'Save Feedback Only'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setExpandedProject(null)}
                        disabled={isSaving}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Action Button */}
                {!isExpanded && (
                  <Button
                    onClick={() => toggleExpand(project.id, project.grade, project.feedback)}
                    variant="outline"
                    className="w-full"
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    {project.feedback ? 'Update Review' : 'Review Project'}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </CardContent>
    </Card>
  );
}