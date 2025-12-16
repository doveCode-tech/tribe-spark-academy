import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, FileText, CheckCircle, XCircle, Loader2, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Submission {
  id: string;
  title: string;
  description: string | null;
  link: string | null;
  file_path: string | null;
  review_status: string | null;
  grade: number | null;
  feedback: string | null;
  submitted_at: string | null;
  student: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
}

interface LessonSubmissionsProps {
  lessonId: string;
  courseId: string;
}

export function LessonSubmissions({ lessonId, courseId }: LessonSubmissionsProps) {
  const { toast } = useToast();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [grade, setGrade] = useState("");
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchSubmissions();
    
    // Real-time subscription for new submissions
    const channel = supabase
      .channel(`lesson-submissions-${lessonId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects',
          filter: `lesson_id=eq.${lessonId}`
        },
        () => {
          fetchSubmissions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [lessonId]);

  const fetchSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          id,
          title,
          description,
          link,
          file_path,
          review_status,
          grade,
          feedback,
          submitted_at,
          student_id
        `)
        .eq('lesson_id', lessonId)
        .order('submitted_at', { ascending: false });

      if (error) throw error;

      // Fetch student info for each submission
      const submissionsWithStudents = await Promise.all(
        (data || []).map(async (submission) => {
          const { data: student } = await supabase
            .from('users')
            .select('first_name, last_name, email')
            .eq('auth_user_id', submission.student_id)
            .single();
          
          return {
            ...submission,
            student
          };
        })
      );

      setSubmissions(submissionsWithStudents);
    } catch (error: any) {
      console.error('Error fetching submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGrade = async (submissionId: string) => {
    if (!grade) {
      toast({
        title: "Error",
        description: "Please enter a grade",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          grade: parseInt(grade),
          feedback: feedback || null,
          review_status: 'graded'
        })
        .eq('id', submissionId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Submission graded successfully",
      });

      setGradingId(null);
      setGrade("");
      setFeedback("");
      fetchSubmissions();
    } catch (error: any) {
      console.error('Error grading submission:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to grade submission",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'graded':
        return <Badge className="bg-green-500">Graded</Badge>;
      case 'submitted':
        return <Badge className="bg-yellow-500">Pending Review</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>No submissions yet for this lesson</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg">Student Submissions ({submissions.length})</h3>
      
      {submissions.map((submission) => (
        <Card key={submission.id}>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base">{submission.title}</CardTitle>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <User className="w-4 h-4" />
                  <span>
                    {submission.student?.first_name} {submission.student?.last_name}
                    {submission.student?.email && ` (${submission.student.email})`}
                  </span>
                </div>
              </div>
              {getStatusBadge(submission.review_status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {submission.description && (
              <p className="text-sm text-muted-foreground">{submission.description}</p>
            )}
            
            <div className="flex gap-2">
              {submission.link && (
                <Button variant="outline" size="sm" asChild>
                  <a href={submission.link} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 mr-1" />
                    View Project
                  </a>
                </Button>
              )}
              {submission.file_path && (
                <Button variant="outline" size="sm" asChild>
                  <a 
                    href={`${supabase.storage.from('project-submissions').getPublicUrl(submission.file_path).data.publicUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FileText className="w-4 h-4 mr-1" />
                    Download File
                  </a>
                </Button>
              )}
            </div>

            {submission.grade !== null && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="font-medium">Grade: {submission.grade}/100</span>
                </div>
                {submission.feedback && (
                  <p className="text-sm mt-2">{submission.feedback}</p>
                )}
              </div>
            )}

            {gradingId === submission.id ? (
              <div className="space-y-3 p-3 border rounded-lg">
                <div className="space-y-2">
                  <Label htmlFor="grade">Grade (0-100)</Label>
                  <Input
                    id="grade"
                    type="number"
                    min="0"
                    max="100"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    placeholder="Enter grade"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="feedback">Feedback (Optional)</Label>
                  <Textarea
                    id="feedback"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Enter feedback for the student"
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={() => handleGrade(submission.id)}
                    disabled={submitting}
                    size="sm"
                  >
                    {submitting ? "Saving..." : "Submit Grade"}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setGradingId(null);
                      setGrade("");
                      setFeedback("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              submission.review_status !== 'graded' && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setGradingId(submission.id)}
                >
                  Grade Submission
                </Button>
              )
            )}

            <p className="text-xs text-muted-foreground">
              Submitted: {submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : 'Unknown'}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}