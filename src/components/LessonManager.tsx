// Lesson Manager Component
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Plus, Video, BookOpen, Gamepad2, Trash2, Edit, Upload, X, AlertCircle, CheckCircle2, Trophy, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
  assignment_required: boolean;
  quiz_required: boolean;
  is_end_of_course: boolean;
  assignment_data: any;
  quiz_data: any;
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

  const generateCourseLessons = async () => {
    const courseContent = getCourseContent(category);
    
    try {
      const lessonsToInsert = courseContent.map((lesson, index) => ({
        course_id: courseId,
        title: lesson.title,
        description: lesson.description,
        content: lesson.content,
        duration_minutes: lesson.duration_minutes,
        order_index: index + 1,
        video_urls: [],
        exercises: lesson.exercises,
        content_type: 'lesson',
        assignment_required: lesson.assignment_required || false,
        quiz_required: lesson.quiz_required || false,
        is_end_of_course: lesson.is_end_of_course || false,
        assignment_data: lesson.assignment_data || null,
        quiz_data: lesson.quiz_data || null,
      }));

      const { error } = await supabase
        .from('lessons')
        .insert(lessonsToInsert);

      if (error) throw error;

      toast({
        title: "Course Lessons Created",
        description: `Created ${courseContent.length} lessons for ${category}. You can now edit and add videos.`,
      });

      fetchLessons();
    } catch (error) {
      console.error('Error creating lessons:', error);
      toast({
        title: "Error",
        description: "Failed to create lessons.",
        variant: "destructive",
      });
    }
  };

  const getCourseContent = (courseCategory: string) => {
    const cat = courseCategory?.toLowerCase() || '';
    
    if (cat.includes('python')) return getPythonLessons();
    if (cat.includes('scratch')) return getScratchLessons();
    if (cat.includes('graphic') || cat.includes('design')) return getGraphicsDesignLessons();
    if (cat.includes('robot')) return getRoboticsLessons();
    if (cat.includes('web') || cat.includes('html')) return getWebDevLessons();
    if (cat.includes('javascript') || cat.includes('js')) return getJavaScriptLessons();
    
    return getGenericLessons(courseCategory);
  };

  const getPythonLessons = () => [
    {
      title: "Lesson 1: Introduction to Python",
      description: "Learn what Python is and why it's one of the most popular programming languages",
      content: "Welcome to Python! Python is a powerful, easy-to-learn programming language used by professionals worldwide.",
      duration_minutes: 45,
      exercises: [
        { type: "video", title: "Lesson 1 Useful Video - What is Python?" },
        { type: "interactive", title: "Lesson 1 Exercise - Python Interactive Example" },
        { type: "practice", title: "Lesson 1 Exercise - Python Mathematical Operations" },
      ],
      assignment_required: true,
      assignment_data: { title: "Lesson 1 Assignment: Python Strings", description: "Create a program using print statements" },
      quiz_required: true,
      quiz_data: { title: "Lesson 1 Quiz" },
    },
    ...Array.from({ length: 9 }, (_, i) => ({
      title: `Lesson ${i + 2}: Python Concepts ${i + 2}`,
      description: `Continue learning Python with new concepts`,
      content: `Build on your Python knowledge with practical exercises.`,
      duration_minutes: 45 + (i * 5),
      exercises: [
        { type: "video", title: `Lesson ${i + 2} Useful Video` },
        { type: "interactive", title: `Lesson ${i + 2} Exercise - Interactive Example` },
        { type: "practice", title: `Lesson ${i + 2} Exercise - Hands-on Practice` },
      ],
      assignment_required: true,
      assignment_data: { title: `Lesson ${i + 2} Assignment`, description: `Complete the Python assignment` },
      quiz_required: true,
      quiz_data: { title: `Lesson ${i + 2} Quiz` },
      is_end_of_course: i === 8,
    })),
  ];

  const getScratchLessons = () => Array.from({ length: 10 }, (_, i) => ({
    title: `Lesson ${i + 1}: ${i === 0 ? 'Introduction to Scratch' : i === 9 ? 'Final Project' : `Scratch Concepts ${i + 1}`}`,
    description: `Learn Scratch programming through fun activities`,
    content: `Discover visual programming with Scratch.`,
    duration_minutes: i === 9 ? 90 : 40 + (i * 5),
    exercises: [
      { type: "video", title: `Lesson ${i + 1} Useful Video` },
      { type: "interactive", title: `Lesson ${i + 1} Exercise - Interactive Example` },
      { type: "practice", title: `Lesson ${i + 1} Exercise - Hands-on Practice` },
    ],
    assignment_required: true,
    assignment_data: { title: `Lesson ${i + 1} Assignment` },
    quiz_required: true,
    quiz_data: { title: `Lesson ${i + 1} Quiz` },
    is_end_of_course: i === 9,
  }));

  const getGraphicsDesignLessons = () => Array.from({ length: 10 }, (_, i) => ({
    title: `Lesson ${i + 1}: ${i === 0 ? 'Introduction to Graphics Design' : i === 9 ? 'Final Project' : `Design Concepts ${i + 1}`}`,
    description: `Master visual design principles`,
    content: `Learn to create stunning graphics.`,
    duration_minutes: i === 9 ? 90 : 45 + (i * 5),
    exercises: [
      { type: "video", title: `Lesson ${i + 1} Useful Video` },
      { type: "interactive", title: `Lesson ${i + 1} Exercise - Interactive Example` },
      { type: "practice", title: `Lesson ${i + 1} Exercise - Hands-on Practice` },
    ],
    assignment_required: true,
    assignment_data: { title: `Lesson ${i + 1} Assignment` },
    quiz_required: true,
    quiz_data: { title: `Lesson ${i + 1} Quiz` },
    is_end_of_course: i === 9,
  }));

  const getRoboticsLessons = () => getGenericLessons("Robotics");
  const getWebDevLessons = () => getGenericLessons("Web Development");
  const getJavaScriptLessons = () => getGenericLessons("JavaScript");

  const getGenericLessons = (courseName: string) => Array.from({ length: 10 }, (_, i) => ({
    title: `Lesson ${i + 1}: ${i === 0 ? `Introduction to ${courseName}` : i === 9 ? `Final Project` : `${courseName} Concepts ${i + 1}`}`,
    description: `Continue learning ${courseName}`,
    content: `Build your ${courseName} skills.`,
    duration_minutes: i === 9 ? 90 : 45 + (i * 5),
    exercises: [
      { type: "video", title: `Lesson ${i + 1} Useful Video` },
      { type: "interactive", title: `Lesson ${i + 1} Exercise` },
      { type: "practice", title: `Lesson ${i + 1} Practice` },
    ],
    assignment_required: true,
    assignment_data: { title: `Lesson ${i + 1} Assignment` },
    quiz_required: true,
    quiz_data: { title: `Lesson ${i + 1} Quiz` },
    is_end_of_course: i === 9,
  }));

  const saveLesson = async (lessonData: Partial<Lesson>) => {
    try {
      if (editingLesson) {
        const { error } = await supabase
          .from('lessons')
          .update(lessonData)
          .eq('id', editingLesson.id);

        if (error) throw error;
        toast({ title: "Success", description: "Lesson updated successfully." });
      } else {
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;
    
    const oldIndex = lessons.findIndex((lesson) => lesson.id === active.id);
    const newIndex = lessons.findIndex((lesson) => lesson.id === over.id);
    
    const reorderedLessons = arrayMove(lessons, oldIndex, newIndex);
    
    // Update local state immediately for smooth UX
    const updatedLessons = reorderedLessons.map((lesson, index) => ({
      ...lesson,
      order_index: index + 1,
    }));
    setLessons(updatedLessons);
    
    // Update database
    try {
      const updates = updatedLessons.map((lesson) => 
        supabase
          .from('lessons')
          .update({ order_index: lesson.order_index })
          .eq('id', lesson.id)
      );
      
      await Promise.all(updates);
      
      toast({
        title: "Lessons Reordered",
        description: "Lesson order has been updated successfully.",
      });
    } catch (error) {
      console.error('Error reordering lessons:', error);
      toast({
        title: "Error",
        description: "Failed to save lesson order.",
        variant: "destructive",
      });
      fetchLessons(); // Revert to original order
    }
  };

  if (loading) {
    return <div className="text-center py-4">Loading lessons...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Course Lessons</h3>
          {canEdit && lessons.length > 1 && (
            <p className="text-sm text-muted-foreground mt-1">
              Drag lessons to reorder them
            </p>
          )}
        </div>
        {canEdit && (
          <div className="flex gap-2">
            {lessons.length === 0 && (
              <Button onClick={generateCourseLessons} variant="outline">
                <BookOpen className="w-4 h-4 mr-2" />
                Generate Course Lessons
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
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext 
            items={lessons.map(l => l.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="grid gap-4">
              {lessons.map((lesson) => (
                <SortableLessonCard
                  key={lesson.id}
                  lesson={lesson}
                  canEdit={canEdit}
                  onEdit={() => {
                    setEditingLesson(lesson);
                    setDialogOpen(true);
                  }}
                  onDelete={() => deleteLesson(lesson.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

// Sortable Lesson Card Component
function SortableLessonCard({ 
  lesson, 
  canEdit, 
  onEdit, 
  onDelete 
}: { 
  lesson: Lesson; 
  canEdit: boolean; 
  onEdit: () => void; 
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lesson.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style} className={isDragging ? "ring-2 ring-primary" : ""}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {canEdit && (
              <button
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded touch-none"
                aria-label="Drag to reorder"
              >
                <GripVertical className="w-5 h-5 text-muted-foreground" />
              </button>
            )}
            <div>
              <CardTitle className="flex items-center gap-2">
                <Badge variant="outline">{lesson.order_index}</Badge>
                {lesson.title}
              </CardTitle>
              <CardDescription>{lesson.description}</CardDescription>
            </div>
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={onEdit}>
                <Edit className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={onDelete}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>⏱️ {lesson.duration_minutes} min</span>
            <span>🎥 {lesson.video_urls?.length || 0} videos</span>
            <span>📝 {lesson.exercises?.length || 0} exercises</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {lesson.assignment_required && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Assignment Required
              </Badge>
            )}
            {lesson.quiz_required && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Quiz Required
              </Badge>
            )}
            {lesson.is_end_of_course && (
              <Badge variant="default" className="flex items-center gap-1">
                <Trophy className="w-3 h-3" />
                End-of-Course
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LessonEditDialog({ lesson, onSave, onCancel }: {
  lesson: Lesson | null;
  onSave: (data: Partial<Lesson>) => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [uploadedVideos, setUploadedVideos] = useState<string[]>(lesson?.video_urls || []);
  const [formData, setFormData] = useState({
    title: lesson?.title || '',
    description: lesson?.description || '',
    content: lesson?.content || '',
    duration_minutes: lesson?.duration_minutes || 30,
    video_urls: lesson?.video_urls?.join('\n') || '',
    assignment_required: lesson?.assignment_required || false,
    quiz_required: lesson?.quiz_required || false,
    is_end_of_course: lesson?.is_end_of_course || false,
    assignment_data: lesson?.assignment_data || null,
    quiz_data: lesson?.quiz_data || null,
  });

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('lesson-videos')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('lesson-videos')
          .getPublicUrl(filePath);

        return publicUrl;
      });

      const urls = await Promise.all(uploadPromises);
      setUploadedVideos([...uploadedVideos, ...urls]);
      
      toast({
        title: "Success",
        description: `Uploaded ${files.length} video(s) successfully.`,
      });
    } catch (error: any) {
      console.error('Error uploading videos:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload videos.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const removeVideo = (index: number) => {
    const newVideos = uploadedVideos.filter((_, i) => i !== index);
    setUploadedVideos(newVideos);
  };

  const handleSave = () => {
    // Combine uploaded videos and manually entered URLs
    const manualUrls = formData.video_urls.split('\n').filter(url => url.trim());
    const allVideoUrls = [...uploadedVideos, ...manualUrls];

    onSave({
      title: formData.title,
      description: formData.description,
      content: formData.content,
      duration_minutes: formData.duration_minutes,
      video_urls: allVideoUrls,
      assignment_required: formData.assignment_required,
      quiz_required: formData.quiz_required,
      is_end_of_course: formData.is_end_of_course,
      assignment_data: formData.assignment_data,
      quiz_data: formData.quiz_data,
    });
  };

  return (
    <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{lesson ? 'Edit Lesson' : 'Create New Lesson'}</DialogTitle>
        <DialogDescription>
          {lesson ? 'Update lesson details and content.' : 'Add a new lesson to the course.'}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Basic Information</h3>
          
          <div>
            <Label htmlFor="title">Lesson Title *</Label>
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
        </div>

        <Separator />

        {/* Video Management */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Videos</h3>
          
          {/* Uploaded Videos Display */}
          {uploadedVideos.length > 0 && (
            <div className="space-y-2">
              <Label>Uploaded Videos</Label>
              {uploadedVideos.map((url, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                  <span className="text-sm truncate flex-1">{url}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeVideo(index)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Video Upload */}
          <div>
            <Label htmlFor="video-upload">Upload Videos</Label>
            <div className="flex items-center gap-2">
              <Input
                id="video-upload"
                type="file"
                accept="video/*"
                multiple
                onChange={handleVideoUpload}
                disabled={uploading}
              />
              {uploading && <span className="text-sm text-muted-foreground">Uploading...</span>}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Upload video files from your computer (MP4, MOV, etc.)
            </p>
          </div>

          {/* Video URLs */}
          <div>
            <Label htmlFor="videos">Or Add Video URLs (one per line)</Label>
            <Textarea
              id="videos"
              value={formData.video_urls}
              onChange={(e) => setFormData({ ...formData, video_urls: e.target.value })}
              placeholder="https://youtube.com/watch?v=...&#10;https://vimeo.com/..."
              rows={3}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Add YouTube, Vimeo, or direct video links
            </p>
          </div>
        </div>

        <Separator />

        {/* Completion Requirements */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Completion Requirements</h3>
          
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Enable these toggles to enforce completion rules. Students must satisfy all enabled requirements before marking the lesson as complete.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <Label htmlFor="assignment-required" className="cursor-pointer">
                  Assignment Required
                </Label>
                <p className="text-xs text-muted-foreground">
                  Students must complete and submit an assignment
                </p>
              </div>
              <Switch
                id="assignment-required"
                checked={formData.assignment_required}
                onCheckedChange={(checked) => setFormData({ ...formData, assignment_required: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <Label htmlFor="quiz-required" className="cursor-pointer">
                  Quiz Required
                </Label>
                <p className="text-xs text-muted-foreground">
                  Students must pass a quiz to complete this lesson
                </p>
              </div>
              <Switch
                id="quiz-required"
                checked={formData.quiz_required}
                onCheckedChange={(checked) => setFormData({ ...formData, quiz_required: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg bg-accent/50">
              <div className="space-y-1">
                <Label htmlFor="end-of-course" className="cursor-pointer flex items-center gap-2">
                  <Trophy className="w-4 h-4" />
                  End-of-Course Lesson
                </Label>
                <p className="text-xs text-muted-foreground">
                  Mark as final lesson with project/quiz/presentation activities
                </p>
              </div>
              <Switch
                id="end-of-course"
                checked={formData.is_end_of_course}
                onCheckedChange={(checked) => setFormData({ ...formData, is_end_of_course: checked })}
              />
            </div>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!formData.title.trim() || uploading}>
          {uploading ? 'Uploading...' : lesson ? 'Update Lesson' : 'Create Lesson'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}