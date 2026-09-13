import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LMSLayout } from '@/components/LMSLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { LessonContentViewer } from '@/components/LessonContentViewer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function LessonDetail() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [lesson, setLesson] = useState<any>(null);
  const [allLessons, setAllLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (lessonId && userProfile) {
      fetchLesson();
    }
  }, [lessonId, userProfile]);

  useEffect(() => {
    if (lesson?.course_id) {
      fetchCourseLessons(lesson.course_id);
    }
  }, [lesson?.course_id]);

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

  const fetchCourseLessons = async (courseId: string) => {
    try {
      const { data } = await supabase
        .from('lessons')
        .select('id, title, order_index')
        .eq('course_id', courseId)
        .order('order_index', { ascending: true });
      if (data) setAllLessons(data);
    } catch (err) {
      console.error("Error fetching course lessons:", err);
    }
  };

  const handleAssignmentSubmitted = () => {
    toast({
      title: "Success!",
      description: "Your assignment has been submitted for review.",
    });
  };

  const currentIndex = allLessons.findIndex((l) => l.id === lesson?.id);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex >= 0 && currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

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

        {/* Bottom Lesson Navigation Bar */}
        {allLessons.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border rounded-xl bg-card shadow-sm mt-6">
            <Button
              variant="outline"
              disabled={!prevLesson}
              onClick={() => prevLesson && navigate(`/lesson/${prevLesson.id}`)}
              className="w-full sm:w-auto flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous Lesson</span>
            </Button>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
              <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Jump to:</span>
              <Select
                value={lesson.id}
                onValueChange={(id) => navigate(`/lesson/${id}`)}
              >
                <SelectTrigger className="w-[240px]">
                  <SelectValue placeholder="Select lesson..." />
                </SelectTrigger>
                <SelectContent>
                  {allLessons.map((l, i) => (
                    <SelectItem key={l.id} value={l.id}>
                      Lesson {i + 1}: {l.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="default"
              disabled={!nextLesson}
              onClick={() => nextLesson && navigate(`/lesson/${nextLesson.id}`)}
              className="w-full sm:w-auto flex items-center gap-2"
            >
              <span>Next Lesson</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </LMSLayout>
  );
}
