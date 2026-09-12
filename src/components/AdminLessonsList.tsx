import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  ChevronDown, 
  ChevronUp, 
  Edit, 
  Trash2, 
  Plus, 
  GripVertical, 
  Eye, 
  EyeOff, 
  Lock, 
  Unlock, 
  FileText,
  Video,
  BookOpen,
  CheckCircle2
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { LessonActivityDialog, LessonData } from "@/components/LessonActivityDialog";

interface Lesson {
  id: string;
  title: string;
  description: string;
  content: string;
  duration_minutes: number;
  order_index: number;
  video_urls: string[] | null;
  youtube_urls: string[] | null;
  exercises: any;
  content_type: string;
  assignment_required: boolean;
  quiz_required: boolean;
  is_end_of_course: boolean;
  assignment_data: any;
  quiz_data: any;
  is_visible?: boolean;
  is_locked?: boolean;
}

interface AdminLessonsListProps {
  courseId: string;
  courseTitle: string;
  category: string;
  isExpanded: boolean;
  onToggle: () => void;
}

export function AdminLessonsList({ courseId, courseTitle, category, isExpanded, onToggle }: AdminLessonsListProps) {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [submissionsDialogOpen, setSubmissionsDialogOpen] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (isExpanded) {
      fetchLessons();
    }
  }, [isExpanded, courseId]);

  const fetchLessons = async () => {
    setLoading(true);
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

  const fetchSubmissions = async (lessonId: string) => {
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
          student:users!projects_student_id_fkey(name, email, first_name, last_name)
        `)
        .eq('course_id', courseId)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      setSubmissions(data || []);
      setSubmissionsDialogOpen(true);
    } catch (error) {
      console.error('Error fetching submissions:', error);
      toast({
        title: "Error",
        description: "Failed to load submissions.",
        variant: "destructive",
      });
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
        title: "Lessons Created",
        description: `Created ${courseContent.length} lessons for ${category}.`,
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
    return Array.from({ length: 10 }, (_, i) => ({
      title: `Lesson ${i + 1}: ${i === 0 ? `Introduction to ${courseCategory}` : i === 9 ? 'Final Project' : `${courseCategory} Concepts ${i + 1}`}`,
      description: `Continue learning ${courseCategory}`,
      content: `Build your ${courseCategory} skills.`,
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
  };

  const saveLesson = async (lessonData: Partial<LessonData>) => {
    try {
      if (editingLesson) {
        const updatePayload: Record<string, any> = {
          title: lessonData.title,
          description: lessonData.description,
          content: lessonData.content,
          duration_minutes: lessonData.duration_minutes,
          video_urls: lessonData.video_urls ?? [],
          youtube_urls: lessonData.youtube_urls ?? [],
          exercises: lessonData.exercises ?? [],
          assignment_required: lessonData.assignment_required ?? false,
          quiz_required: lessonData.quiz_required ?? false,
          is_end_of_course: lessonData.is_end_of_course ?? false,
        };
        // Remove undefined keys
        Object.keys(updatePayload).forEach(k => updatePayload[k] === undefined && delete updatePayload[k]);

        const { error } = await supabase
          .from('lessons')
          .update(updatePayload)
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
          video_urls: lessonData.video_urls ?? [],
          youtube_urls: lessonData.youtube_urls ?? [],
          exercises: lessonData.exercises ?? [],
          assignment_required: lessonData.assignment_required ?? false,
          quiz_required: lessonData.quiz_required ?? false,
          is_end_of_course: lessonData.is_end_of_course ?? false,
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
      toast({ title: "Success", description: "Lesson deleted." });
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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;
    
    const oldIndex = lessons.findIndex((lesson) => lesson.id === active.id);
    const newIndex = lessons.findIndex((lesson) => lesson.id === over.id);
    
    const reorderedLessons = arrayMove(lessons, oldIndex, newIndex);
    const updatedLessons = reorderedLessons.map((lesson, index) => ({
      ...lesson,
      order_index: index + 1,
    }));
    setLessons(updatedLessons);
    
    try {
      const updates = updatedLessons.map((lesson) => 
        supabase
          .from('lessons')
          .update({ order_index: lesson.order_index })
          .eq('id', lesson.id)
      );
      
      await Promise.all(updates);
      toast({ title: "Lessons Reordered", description: "Order saved." });
    } catch (error) {
      console.error('Error reordering lessons:', error);
      toast({ title: "Error", description: "Failed to save order.", variant: "destructive" });
      fetchLessons();
    }
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <BookOpen className="w-4 h-4" />
          Lessons ({lessons.length || '...'})
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-4">
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Lessons for {courseTitle}</CardTitle>
              <div className="flex gap-2">
                {lessons.length === 0 && (
                  <Button onClick={generateCourseLessons} variant="outline" size="sm">
                    <Plus className="w-4 h-4 mr-1" />
                    Generate Lessons
                  </Button>
                )}
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => setEditingLesson(null)} size="sm">
                      <Plus className="w-4 h-4 mr-1" />
                      Add Lesson
                    </Button>
                  </DialogTrigger>
                  <LessonActivityDialog 
                    lesson={editingLesson}
                    courseId={courseId}
                    onSave={saveLesson}
                    onCancel={() => {
                      setDialogOpen(false);
                      setEditingLesson(null);
                    }}
                  />
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-4 text-muted-foreground">Loading lessons...</div>
            ) : lessons.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No lessons yet. Generate or add lessons above.</p>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={lessons.map(l => l.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {lessons.map((lesson) => (
                      <SortableLessonRow
                        key={lesson.id}
                        lesson={lesson}
                        onEdit={() => {
                          setEditingLesson(lesson);
                          setDialogOpen(true);
                        }}
                        onDelete={() => deleteLesson(lesson.id)}
                        onViewSubmissions={() => {
                          setSelectedLesson(lesson);
                          fetchSubmissions(lesson.id);
                        }}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </CardContent>
        </Card>

        {/* Submissions Dialog */}
        <Dialog open={submissionsDialogOpen} onOpenChange={setSubmissionsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Student Submissions</DialogTitle>
              <DialogDescription>
                Submissions for {selectedLesson?.title}
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-96 overflow-y-auto space-y-3">
              {submissions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No submissions yet.</p>
              ) : (
                submissions.map((sub) => (
                  <div key={sub.id} className="p-3 border rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{sub.student?.first_name} {sub.student?.last_name || sub.student?.name}</p>
                        <p className="text-sm text-muted-foreground">{sub.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Submitted: {new Date(sub.submitted_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        {sub.grade !== null ? (
                          <Badge variant="default">{sub.grade}%</Badge>
                        ) : (
                          <Badge variant="outline">Pending</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </CollapsibleContent>
    </Collapsible>
  );
}

function SortableLessonRow({ 
  lesson, 
  onEdit, 
  onDelete,
  onViewSubmissions
}: { 
  lesson: Lesson; 
  onEdit: () => void; 
  onDelete: () => void;
  onViewSubmissions: () => void;
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
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`flex items-center justify-between p-3 border rounded-lg bg-background ${isDragging ? 'ring-2 ring-primary' : ''}`}
    >
      <div className="flex items-center gap-3">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded touch-none"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </button>
        <Badge variant="outline" className="w-8 justify-center">{lesson.order_index}</Badge>
        <div>
          <p className="font-medium text-sm">{lesson.title}</p>
          <div className="flex gap-2 mt-1">
            {lesson.quiz_required && <Badge variant="secondary" className="text-xs">Quiz</Badge>}
            {lesson.assignment_required && <Badge variant="secondary" className="text-xs">Assignment</Badge>}
            {lesson.is_end_of_course && <Badge variant="default" className="text-xs">Final</Badge>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={onViewSubmissions} title="View Submissions">
          <FileText className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onEdit}>
          <Edit className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function LessonEditDialog({ 
  lesson, 
  onSave, 
  onCancel 
}: { 
  lesson: Lesson | null; 
  onSave: (data: Partial<Lesson>) => void; 
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(lesson?.title || '');
  const [description, setDescription] = useState(lesson?.description || '');
  const [content, setContent] = useState(lesson?.content || '');
  const [duration, setDuration] = useState(lesson?.duration_minutes || 30);
  const [assignmentRequired, setAssignmentRequired] = useState(lesson?.assignment_required || false);
  const [quizRequired, setQuizRequired] = useState(lesson?.quiz_required || false);
  const [isEndOfCourse, setIsEndOfCourse] = useState(lesson?.is_end_of_course || false);

  useEffect(() => {
    setTitle(lesson?.title || '');
    setDescription(lesson?.description || '');
    setContent(lesson?.content || '');
    setDuration(lesson?.duration_minutes || 30);
    setAssignmentRequired(lesson?.assignment_required || false);
    setQuizRequired(lesson?.quiz_required || false);
    setIsEndOfCourse(lesson?.is_end_of_course || false);
  }, [lesson]);

  const handleSubmit = () => {
    onSave({
      title,
      description,
      content,
      duration_minutes: duration,
      assignment_required: assignmentRequired,
      quiz_required: quizRequired,
      is_end_of_course: isEndOfCourse,
    });
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{lesson ? 'Edit Lesson' : 'Add New Lesson'}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Lesson title" />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description" />
        </div>
        <div>
          <Label>Content</Label>
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Lesson content" rows={4} />
        </div>
        <div>
          <Label>Duration (minutes)</Label>
          <Input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
        </div>
        <div className="flex gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Switch checked={assignmentRequired} onCheckedChange={setAssignmentRequired} />
            <Label>Assignment Required</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={quizRequired} onCheckedChange={setQuizRequired} />
            <Label>Quiz Required</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isEndOfCourse} onCheckedChange={setIsEndOfCourse} />
            <Label>End of Course</Label>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSubmit}>Save Lesson</Button>
      </DialogFooter>
    </DialogContent>
  );
}
