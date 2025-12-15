import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LMSLayout } from '@/components/LMSLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { LessonContentViewer } from '@/components/LessonContentViewer';

export default function LessonDetail() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [lesson, setLesson] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (lessonId && userProfile) {
      fetchLesson();
    }
  }, [lessonId, userProfile]);

  // Real-time subscription for lesson updates
  useEffect(() => {
    if (!lessonId) return;

    const channel = supabase
      .channel(`lesson-${lessonId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'lessons',
          filter: `id=eq.${lessonId}`
        },
        (payload) => {
          setLesson(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [lessonId]);

  const fetchLesson = async () => {
    try {
      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('id', lessonId)
        .single();

      if (error) throw error;
      setLesson(data);
    } catch (error: any) {
      console.error('Error fetching lesson:', error);
      toast({
        title: "Error",
        description: "Failed to load lesson",
        variant: "destructive",
      });
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignmentSubmitted = () => {
    toast({
      title: "Success!",
      description: "Your assignment has been submitted for review.",
    });
  };

  if (loading) {
    return (
      <LMSLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </LMSLayout>
    );
  }

  if (!lesson) {
    return (
      <LMSLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Lesson not found</p>
          <Button onClick={() => navigate(-1)} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </LMSLayout>
    );
  }

  return (
    <LMSLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{lesson.title}</h1>
            <p className="text-muted-foreground mt-1">Lesson {lesson.order_index}</p>
          </div>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Course
          </Button>
        </div>
        <LessonContentViewer 
          lesson={lesson} 
          onSubmitAssignment={handleAssignmentSubmitted}
        />
      </div>
    </LMSLayout>
  );
}
