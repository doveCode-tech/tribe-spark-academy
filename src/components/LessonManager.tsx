import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Video, BookOpen, Gamepad2, Trash2, Edit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Lesson {
  id: string;
  title: string;
  description: string;
  content: string;
  duration_minutes: number;
  order_index: number;
  video_urls: string[] | null;
  exercises: any;
  content_type: string;
}

interface LessonManagerProps {
  courseId: string;
  category: string;
}

export function LessonManager({ courseId, category }: LessonManagerProps) {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const canEdit = userProfile?.role === 'admin' || userProfile?.role === 'tutor' || userProfile?.role === 'ultimate_tutor';

  useEffect(() => {
    fetchLessons();

    // Real-time updates for lesson changes
    const lessonsChannel = supabase
      .channel('lessons-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lessons',
          filter: `course_id=eq.${courseId}`
        },
        () => fetchLessons()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(lessonsChannel);
    };
  }, [courseId]);

  const fetchLessons = async () => {
    try {
      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('course_id', courseId)
        .order('order_index');

      if (error) throw error;
      setLessons((data || []) as Lesson[]);
    } catch (error) {
      console.error('Error fetching lessons:', error);
      toast({
        title: "Error",
        description: "Failed to load lessons.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateDemoLessons = async () => {
    const demoLessons = [
      {
        title: `Introduction to ${category}`,
        description: `Learn the basics and fundamentals of ${category}`,
        content: `Welcome to your ${category} journey! In this lesson, you'll discover the exciting world of ${category} and what makes it special.`,
        duration_minutes: 30,
        exercises: [
          { type: "quiz", question: `What is ${category}?`, options: ["A programming language", "A learning tool", "A game", "All of the above"], correct: 3 },
          { type: "activity", prompt: `Think of three ways you could use ${category} in real life.` }
        ]
      },
      {
        title: "Getting Started",
        description: "Set up your environment and create your first project",
        content: "Time to get hands-on! We'll set up everything you need and create your very first project.",
        duration_minutes: 45,
        exercises: [
          { type: "practical", prompt: "Create a simple 'Hello World' project" },
          { type: "reflection", prompt: "What did you learn from creating your first project?" }
        ]
      },
      {
        title: "Basic Concepts",
        description: "Learn the fundamental concepts and terminology",
        content: "Every expert was once a beginner. Let's learn the key concepts that will be your foundation.",
        duration_minutes: 40,
        exercises: [
          { type: "matching", prompt: "Match the terms with their definitions" },
          { type: "quiz", question: "Which concept is most important?", options: ["Practice", "Theory", "Both equally", "Neither"], correct: 2 }
        ]
      },
      {
        title: "Hands-On Practice",
        description: "Apply what you've learned with practical exercises",
        content: "Practice makes perfect! Let's apply everything you've learned so far with some fun exercises.",
        duration_minutes: 50,
        exercises: [
          { type: "project", prompt: "Build a simple interactive project" },
          { type: "challenge", prompt: "Add a creative twist to your project" }
        ]
      },
      {
        title: "Advanced Techniques",
        description: "Explore more complex features and capabilities",
        content: "Ready to level up? Let's explore some advanced techniques that will make your projects even more amazing!",
        duration_minutes: 60,
        exercises: [
          { type: "advanced_project", prompt: "Create a project using advanced techniques" },
          { type: "peer_review", prompt: "Share your project and get feedback" }
        ]
      }
    ];

    try {
      const lessonsToInsert = demoLessons.map((lesson, index) => ({
        course_id: courseId,
        title: lesson.title,
        description: lesson.description,
        content: lesson.content,
        duration_minutes: lesson.duration_minutes,
        order_index: index + 1,
        video_urls: [],
        exercises: lesson.exercises,
        content_type: 'lesson'
      }));

      const { error } = await supabase
        .from('lessons')
        .insert(lessonsToInsert);

      if (error) throw error;

      toast({
        title: "Demo Lessons Created",
        description: `Created ${demoLessons.length} demo lessons. You can now edit and add videos.`,
      });

      fetchLessons();
    } catch (error) {
      console.error('Error creating demo lessons:', error);
      toast({
        title: "Error",
        description: "Failed to create demo lessons.",
        variant: "destructive",
      });
    }
  };

  const saveLesson = async (lessonData: Partial<Lesson>) => {
    try {
      if (editingLesson) {
        // Update existing lesson
        const { error } = await supabase
          .from('lessons')
          .update(lessonData)
          .eq('id', editingLesson.id);

        if (error) throw error;
        toast({ title: "Success", description: "Lesson updated successfully." });
      } else {
        // Create new lesson
        const insertData = {
          title: lessonData.title || '',
          description: lessonData.description || '',
          content: lessonData.content || '',
          duration_minutes: lessonData.duration_minutes || 30,
          course_id: courseId,
          order_index: lessons.length + 1,
          video_urls: lessonData.video_urls || [],
          exercises: lessonData.exercises || [],
          content_type: 'lesson'
        };
        
        const { error } = await supabase
          .from('lessons')
          .insert(insertData);

        if (error) throw error;
        toast({ title: "Success", description: "Lesson created successfully." });
      }

      setDialogOpen(false);
      setEditingLesson(null);
      fetchLessons();
    } catch (error) {
      console.error('Error saving lesson:', error);
      toast({
        title: "Error",
        description: "Failed to save lesson.",
        variant: "destructive",
      });
    }
  };

  const deleteLesson = async (lessonId: string) => {
    try {
      const { error } = await supabase
        .from('lessons')
        .delete()
        .eq('id', lessonId);

      if (error) throw error;

      toast({ title: "Success", description: "Lesson deleted successfully." });
      fetchLessons();
    } catch (error) {
      console.error('Error deleting lesson:', error);
      toast({
        title: "Error",
        description: "Failed to delete lesson.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="text-center py-4">Loading lessons...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Course Lessons</h3>
        {canEdit && (
          <div className="flex gap-2">
            {lessons.length === 0 && (
              <Button onClick={generateDemoLessons} variant="outline">
                <BookOpen className="w-4 h-4 mr-2" />
                Generate Demo Lessons
              </Button>
            )}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingLesson(null)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Lesson
                </Button>
              </DialogTrigger>
              <LessonEditDialog 
                lesson={editingLesson}
                onSave={saveLesson}
                onCancel={() => {
                  setDialogOpen(false);
                  setEditingLesson(null);
                }}
              />
            </Dialog>
          </div>
        )}
      </div>

      {lessons.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No lessons created yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {lessons.map((lesson) => (
            <Card key={lesson.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Badge variant="outline">{lesson.order_index}</Badge>
                      {lesson.title}
                    </CardTitle>
                    <CardDescription>{lesson.description}</CardDescription>
                  </div>
                  {canEdit && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingLesson(lesson);
                          setDialogOpen(true);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteLesson(lesson.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>⏱️ {lesson.duration_minutes} min</span>
                  <span>🎥 {lesson.video_urls?.length || 0} videos</span>
                  <span>📝 {lesson.exercises?.length || 0} exercises</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function LessonEditDialog({ lesson, onSave, onCancel }: {
  lesson: Lesson | null;
  onSave: (data: Partial<Lesson>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    title: lesson?.title || '',
    description: lesson?.description || '',
    content: lesson?.content || '',
    duration_minutes: lesson?.duration_minutes || 30,
    video_urls: lesson?.video_urls?.join('\n') || '',
  });

  const handleSave = () => {
    onSave({
      title: formData.title,
      description: formData.description,
      content: formData.content,
      duration_minutes: formData.duration_minutes,
      video_urls: formData.video_urls.split('\n').filter(url => url.trim()),
    });
  };

  return (
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{lesson ? 'Edit Lesson' : 'Create New Lesson'}</DialogTitle>
        <DialogDescription>
          {lesson ? 'Update lesson details and content.' : 'Add a new lesson to the course.'}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div>
          <Label htmlFor="title">Lesson Title</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Enter lesson title"
          />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Brief lesson description"
          />
        </div>

        <div>
          <Label htmlFor="content">Lesson Content</Label>
          <Textarea
            id="content"
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            placeholder="Detailed lesson content and instructions"
            rows={4}
          />
        </div>

        <div>
          <Label htmlFor="duration">Duration (minutes)</Label>
          <Input
            id="duration"
            type="number"
            value={formData.duration_minutes}
            onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 30 })}
            min={1}
            max={180}
          />
        </div>

        <div>
          <Label htmlFor="videos">Video URLs (one per line)</Label>
          <Textarea
            id="videos"
            value={formData.video_urls}
            onChange={(e) => setFormData({ ...formData, video_urls: e.target.value })}
            placeholder="https://youtube.com/watch?v=...&#10;https://vimeo.com/..."
            rows={3}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Add YouTube, Vimeo, or direct video links. Leave blank to upload later.
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!formData.title.trim()}>
          {lesson ? 'Update Lesson' : 'Create Lesson'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}