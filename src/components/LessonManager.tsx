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
import { Plus, Video, BookOpen, Gamepad2, Trash2, Edit, Upload, X, AlertCircle, CheckCircle2, Trophy, GripVertical, Youtube, FileText, HardDrive, Code2, ExternalLink, Sparkles, Bug } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { LessonActivityDialog, LessonData } from "@/components/LessonActivityDialog";

interface Lesson {
  id: string;
  title: string;
  description: string;
  content: string;
  instructions: string;
  duration_minutes: number;
  order_index: number;
  video_urls: string[] | null;
  youtube_urls: string[] | null;
  exercise_video_urls?: string[] | null;
  exercise_youtube_urls?: string[] | null;
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
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState(category || 'web');
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [generating, setGenerating] = useState(false);

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
      // Map data with defaults for new fields
      const mappedLessons = (data || []).map(lesson => ({
        ...lesson,
        instructions: lesson.instructions || '',
        youtube_urls: lesson.youtube_urls || [],
      })) as Lesson[];
      setLessons(mappedLessons);
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

  const handleGenerateSubmit = async () => {
    setGenerating(true);
    try {
      if (replaceExisting && lessons.length > 0) {
        await supabase.from('lessons').delete().eq('course_id', courseId);
      }

      const startingIndex = replaceExisting ? 0 : lessons.length;
      const courseContent = getCourseContent(selectedTrack);

      const lessonsToInsert = courseContent.map((lesson, index) => ({
        course_id: courseId,
        title: lesson.title,
        description: lesson.description,
        content: lesson.content,
        duration_minutes: lesson.duration_minutes,
        order_index: startingIndex + index + 1,
        video_urls: [],
        exercises: lesson.exercises,
        content_type: 'lesson',
        assignment_required: lesson.assignment_required || false,
        quiz_required: lesson.quiz_required || false,
        is_end_of_course: lesson.is_end_of_course || false,
        assignment_data: lesson.assignment_data || null,
        quiz_data: lesson.quiz_data || null,
      }));

      const { error } = await supabase.from('lessons').insert(lessonsToInsert);
      if (error) throw error;

      toast({
        title: "Curriculum Generated 🎉",
        description: `Created ${courseContent.length} structured lessons with interactive coding activities.`,
      });

      setGenerateDialogOpen(false);
      fetchLessons();
    } catch (error: any) {
      console.error('Error creating lessons:', error);
      toast({
        title: "Generation Error",
        description: error.message || "Failed to create lessons.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const getCourseContent = (courseCategory: string) => {
    const cat = (courseCategory || selectedTrack || '').toLowerCase();
    
    if (cat.includes('python')) return getPythonLessons();
    if (cat.includes('scratch')) return getScratchLessons();
    if (cat.includes('graphic') || cat.includes('design')) return getGraphicsDesignLessons();
    if (cat.includes('roblox') || cat.includes('game')) return getRobloxLessons();
    if (cat.includes('app') || cat.includes('mobile')) return getAppDevLessons();
    if (cat.includes('robot')) return getRoboticsLessons();
    if (cat.includes('javascript') || cat.includes('js')) return getJavaScriptLessons();
    
    return getWebDevLessons();
  };

  const getWebDevLessons = () => Array.from({ length: 10 }, (_, i) => ({
    title: `Lesson ${i + 1}: ${
      i === 0 ? "Introduction to Web Design & HTML" :
      i === 1 ? "HTML Tags, Headings & Text Formatting" :
      i === 2 ? "Styling with CSS Colors & Fonts" :
      i === 3 ? "CSS Box Model & Layouts" :
      i === 4 ? "Building Interactive Buttons & Links" :
      i === 5 ? "Flexbox & Responsive Design" :
      i === 6 ? "HTML Forms & User Inputs" :
      i === 7 ? "CSS Animations & Transitions" :
      i === 8 ? "JavaScript DOM Manipulation" :
      "Final Project: Portfolio Website"
    }`,
    description: `Master modern web development concepts with hands-on projects.`,
    content: `In this lesson, you will build and style real web pages using HTML, CSS, and JavaScript.`,
    duration_minutes: 45,
    exercises: [
      {
        title: `Lesson ${i + 1} Video Walkthrough`,
        type: "video",
        description: "Watch the guided concept walkthrough.",
      },
      {
        title: `Lesson ${i + 1} Interactive Coding`,
        type: "interactive",
        editor_type: "monaco_html",
        project_mode: "starter",
        is_assignment: false,
        instructions: `1. Follow the HTML structure.\n2. Add custom tags and CSS styling.\n3. Test the live preview by clicking Run.`,
        starter_code: `<!DOCTYPE html>\n<html>\n<head>\n  <title>Lesson ${i + 1}</title>\n  <style>\n    body { font-family: sans-serif; padding: 20px; }\n    h1 { color: #2563eb; }\n  </style>\n</head>\n<body>\n  <h1>Lesson ${i + 1} Web Project</h1>\n  <p>Customize this page and check the preview!</p>\n</body>\n</html>`,
      },
      {
        title: `Lesson ${i + 1} Debug Challenge`,
        type: "practice",
        editor_type: "monaco_html",
        project_mode: "debug",
        is_assignment: true,
        instructions: `1. Find and fix the syntax errors in the HTML/CSS below.\n2. Ensure all tags are properly closed.\n3. Click Submit once fixed!`,
        starter_code: `<!DOCTYPE html>\n<html>\n<head>\n  <!-- BUG: Missing closing title tag and unclosed p tag below -->\n  <title>Debug Challenge ${i + 1}\n</head>\n<body>\n  <h1>Fix the Bugs in Lesson ${i + 1}</h1>\n  <p>Can you find the missing tags?\n</body>\n</html>`,
      },
    ],
    assignment_required: true,
    quiz_required: true,
    is_end_of_course: i === 9,
  }));

  const getPythonLessons = () => Array.from({ length: 10 }, (_, i) => ({
    title: `Lesson ${i + 1}: ${
      i === 0 ? "Introduction to Python & Print Statements" :
      i === 1 ? "Variables, Numbers & Data Types" :
      i === 2 ? "User Inputs & String Manipulation" :
      i === 3 ? "Conditionals & If-Else Logic" :
      i === 4 ? "Loops: While and For Loops" :
      i === 5 ? "Lists, Arrays & Collections" :
      i === 6 ? "Functions & Modular Code" :
      i === 7 ? "Dictionaries & Key-Value Pairs" :
      i === 8 ? "Error Handling & Debugging" :
      "Final Project: Python Adventure Game"
    }`,
    description: `Learn Python from fundamentals to writing your own programs and games.`,
    content: `Explore Python concepts with interactive code challenges and exercises.`,
    duration_minutes: 45,
    exercises: [
      {
        title: `Lesson ${i + 1} Concept Video`,
        type: "video",
        description: "Watch the explanation of this lesson's Python concepts.",
      },
      {
        title: `Lesson ${i + 1} Interactive Exercise`,
        type: "interactive",
        editor_type: "monaco_python",
        project_mode: "starter",
        is_assignment: false,
        instructions: `Write a Python program implementing the concepts from this lesson. Click Run to verify output.`,
        starter_code: `# Python Lesson ${i + 1}\nprint("Welcome to Lesson ${i + 1}!")\n`,
      },
      {
        title: `Lesson ${i + 1} Debug & Logic Challenge`,
        type: "practice",
        editor_type: "monaco_python",
        project_mode: "debug",
        is_assignment: true,
        instructions: `Find the syntax or logic error in this Python script and fix it!`,
        starter_code: `# Debug Challenge: Fix the bug below\nscore = 10\nif score = 10:\n    print("Score is perfect")\n`,
      },
    ],
    assignment_required: true,
    quiz_required: true,
    is_end_of_course: i === 9,
  }));

  const getScratchLessons = () => Array.from({ length: 10 }, (_, i) => ({
    title: `Lesson ${i + 1}: ${
      i === 0 ? "Introduction to Scratch & Sprite Motion" :
      i === 1 ? "Costumes, Sounds & Looks" :
      i === 2 ? "Events, Keypresses & User Control" :
      i === 3 ? "Loops & Animation Sequences" :
      i === 4 ? "Variables & Scoring Systems" :
      i === 5 ? "Sensing & Collision Detection" :
      i === 6 ? "Broadcasts & Messages Between Sprites" :
      i === 7 ? "Clones & Particle Effects" :
      i === 8 ? "Soundtracks & Game Mechanics" :
      "Final Project: Complete Scratch Arcade Game"
    }`,
    description: `Build colorful animations, interactive stories, and arcade games with Scratch.`,
    content: `Visual drag-and-drop block coding with live testing and sprite manipulation.`,
    duration_minutes: 45,
    exercises: [
      {
        title: `Lesson ${i + 1} Tutorial Video`,
        type: "video",
      },
      {
        title: `Lesson ${i + 1} Scratch Creative Activity`,
        type: "interactive",
        editor_type: "scratch",
        is_assignment: false,
        instructions: `Open the Scratch workspace, create a new sprite, and use motion blocks to animate it.`,
      },
      {
        title: `Lesson ${i + 1} Graded Scratch Project`,
        type: "practice",
        editor_type: "scratch",
        is_assignment: true,
        instructions: `Build the assigned project in Scratch and click Submit when finished!`,
      },
    ],
    assignment_required: true,
    quiz_required: true,
    is_end_of_course: i === 9,
  }));

  const getRobloxLessons = () => Array.from({ length: 10 }, (_, i) => ({
    title: `Lesson ${i + 1}: ${
      i === 0 ? "Introduction to Roblox Studio & Workspace" :
      i === 1 ? "Parts, Materials & Anchoring" :
      i === 2 ? "Introduction to Lua Scripting" :
      i === 3 ? "Part Touched Events & Kill Blocks" :
      i === 4 ? "Leaderboards & Player Stats" :
      i === 5 ? "Spawning Items & Power-ups" :
      i === 6 ? "GUI Design & Screen Displays" :
      i === 7 ? "Sound Effects & Particle Emitters" :
      i === 8 ? "Multiplayer Game Testing" :
      "Final Project: Publish Your Obby Game"
    }`,
    description: `Design 3D worlds and script games using Roblox Studio and Lua.`,
    content: `Step-by-step game design guides with live testing and project submission.`,
    duration_minutes: 60,
    exercises: [
      {
        title: `Lesson ${i + 1} Roblox Studio Walkthrough`,
        type: "video",
      },
      {
        title: `Lesson ${i + 1} Lua Scripting Task`,
        type: "practice",
        editor_type: "external",
        external_url: "https://create.roblox.com",
        is_assignment: true,
        instructions: `Open Roblox Studio, complete the scripting challenge, and paste your game or model link below.`,
      },
    ],
    assignment_required: true,
    quiz_required: true,
    is_end_of_course: i === 9,
  }));

  const getAppDevLessons = () => Array.from({ length: 10 }, (_, i) => ({
    title: `Lesson ${i + 1}: ${
      i === 0 ? "Introduction to Mobile Apps & UI Design" :
      i === 1 ? "Buttons, Labels & Screen Layouts" :
      i === 2 ? "User Inputs & Text-to-Speech" :
      i === 3 ? "Variables & App State" :
      i === 4 ? "Camera & Media Integration" :
      i === 5 ? "Sensors: Accelerometer & Location" :
      i === 6 ? "Local Databases & Storing Data" :
      i === 7 ? "Web APIs & Online Services" :
      i === 8 ? "App Testing on Real Devices" :
      "Final Project: Publish Your Mobile App"
    }`,
    description: `Create mobile apps that run on phones and tablets.`,
    content: `Build real apps with UI elements, sensors, and databases.`,
    duration_minutes: 50,
    exercises: [
      {
        title: `Lesson ${i + 1} App Architecture Video`,
        type: "video",
      },
      {
        title: `Lesson ${i + 1} App Builder Project`,
        type: "practice",
        editor_type: "external",
        external_url: "https://appinventor.mit.edu",
        is_assignment: true,
        instructions: `Design the app screen and block logic, then submit your app link or export file.`,
      },
    ],
    assignment_required: true,
    quiz_required: true,
    is_end_of_course: i === 9,
  }));

  const getJavaScriptLessons = () => Array.from({ length: 10 }, (_, i) => ({
    title: `Lesson ${i + 1}: JavaScript Fundamentals ${i + 1}`,
    description: `Learn modern interactive JavaScript programming.`,
    content: `Explore JS variables, functions, events, and DOM manipulation.`,
    duration_minutes: 45,
    exercises: [
      { title: `Lesson ${i + 1} Video Guide`, type: "video" },
      {
        title: `Lesson ${i + 1} JS Coding Task`,
        type: "interactive",
        editor_type: "monaco_js",
        project_mode: "starter",
        is_assignment: false,
        instructions: `Write JavaScript code and check the console output with Run.`,
        starter_code: `// Lesson ${i + 1} JavaScript\nconsole.log("Running Lesson ${i + 1}");\n`,
      },
      {
        title: `Lesson ${i + 1} Debug Challenge`,
        type: "practice",
        editor_type: "monaco_js",
        project_mode: "debug",
        is_assignment: true,
        instructions: `Identify and resolve the JavaScript error.`,
        starter_code: `function test() {\n  // BUG: missing closing brace\n  console.log("Testing");\n`,
      },
    ],
    assignment_required: true,
    quiz_required: true,
    is_end_of_course: i === 9,
  }));

  const getGraphicsDesignLessons = () => Array.from({ length: 10 }, (_, i) => ({
    title: `Lesson ${i + 1}: Graphics & Design Concepts ${i + 1}`,
    description: `Master color theory, typography, layouts, and vector graphics.`,
    content: `Creative design projects with step-by-step guidance.`,
    duration_minutes: 45,
    exercises: [
      { title: `Lesson ${i + 1} Design Video`, type: "video" },
      {
        title: `Lesson ${i + 1} Creative Design Submission`,
        type: "practice",
        editor_type: "external",
        is_assignment: true,
        instructions: `Create your graphic design and submit the share link or exported image.`,
      },
    ],
    assignment_required: true,
    quiz_required: true,
    is_end_of_course: i === 9,
  }));

  const getRoboticsLessons = () => Array.from({ length: 10 }, (_, i) => ({
    title: `Lesson ${i + 1}: Robotics & Circuit Engineering ${i + 1}`,
    description: `Explore sensors, microcontrollers, circuits, and robotics logic.`,
    content: `Hands-on robotics simulations and coding projects.`,
    duration_minutes: 50,
    exercises: [
      { title: `Lesson ${i + 1} Robotics Video`, type: "video" },
      {
        title: `Lesson ${i + 1} Circuit Simulator Task`,
        type: "practice",
        editor_type: "external",
        external_url: "https://www.tinkercad.com/circuits",
        is_assignment: true,
        instructions: `Assemble the simulated circuit and submit your project link.`,
      },
    ],
    assignment_required: true,
    quiz_required: true,
    is_end_of_course: i === 9,
  }));

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
          <div className="flex gap-2 items-center flex-wrap">
            <Button 
              onClick={() => setGenerateDialogOpen(true)} 
              variant="outline" 
              className="gap-1.5 border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              Generate Lessons
            </Button>

            {/* Curriculum Generator Selection Modal */}
            <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    Generate Course Curriculum
                  </DialogTitle>
                  <DialogDescription>
                    Select a curriculum blueprint. This will generate structured lessons complete with starter projects, debug challenges, and exercise tasks.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Course Blueprint Track</Label>
                    <Select value={selectedTrack} onValueChange={setSelectedTrack}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select course track..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="web">Web Design &amp; Development (HTML/CSS/JS)</SelectItem>
                        <SelectItem value="javascript">JavaScript &amp; Interactive Coding</SelectItem>
                        <SelectItem value="python">Python Programming &amp; Logic</SelectItem>
                        <SelectItem value="scratch">Scratch Visual Game Creation</SelectItem>
                        <SelectItem value="roblox">Roblox Studio &amp; Lua Game Dev</SelectItem>
                        <SelectItem value="app">Mobile App Development (App Inventor)</SelectItem>
                        <SelectItem value="graphic">Graphic Design &amp; Digital Media</SelectItem>
                        <SelectItem value="robot">Robotics &amp; STEM Engineering</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {lessons.length > 0 && (
                    <div className="flex items-center justify-between p-3 border rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border-amber-200">
                      <div className="space-y-0.5">
                        <Label htmlFor="replace-toggle" className="text-xs font-semibold cursor-pointer">
                          Replace existing {lessons.length} lessons
                        </Label>
                        <p className="text-[11px] text-muted-foreground">
                          If off, new lessons will be added after existing ones.
                        </p>
                      </div>
                      <Switch
                        id="replace-toggle"
                        checked={replaceExisting}
                        onCheckedChange={setReplaceExisting}
                      />
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setGenerateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleGenerateSubmit} disabled={generating} className="bg-primary gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    {generating ? "Generating..." : "Generate Lessons"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingLesson(null)}>
                  <Plus className="w-4 h-4 mr-2" />
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
  const [youtubeUrls, setYoutubeUrls] = useState<string[]>(lesson?.youtube_urls || []);
  const [newYoutubeUrl, setNewYoutubeUrl] = useState('');
  const [exerciseVideos, setExerciseVideos] = useState<string[]>(lesson?.exercise_video_urls || []);
  const [exerciseYoutubeUrls, setExerciseYoutubeUrls] = useState<string[]>(lesson?.exercise_youtube_urls || []);
  const [newExerciseYoutubeUrl, setNewExerciseYoutubeUrl] = useState('');
  const [uploadingExercise, setUploadingExercise] = useState(false);
  const [formData, setFormData] = useState({
    title: lesson?.title || '',
    description: lesson?.description || '',
    content: lesson?.content || '',
    instructions: lesson?.instructions || '',
    duration_minutes: lesson?.duration_minutes || 30,
    assignment_required: lesson?.assignment_required || false,
    quiz_required: lesson?.quiz_required || false,
    is_end_of_course: lesson?.is_end_of_course || false,
    assignment_data: lesson?.assignment_data || null,
    quiz_data: lesson?.quiz_data || null,
  });

  // Exercises config
  const [exercises, setExercises] = useState<any[]>(
    Array.isArray(lesson?.exercises) ? lesson.exercises : []
  );

  const updateExercise = (index: number, key: string, value: any) => {
    setExercises(prev => prev.map((ex, i) => i === index ? { ...ex, [key]: value } : ex));
  };

  const addExercise = () => {
    setExercises(prev => [...prev, { title: `Exercise ${prev.length + 1}`, type: "practice", editor_type: "none", is_assignment: false }]);
  };

  const removeExercise = (index: number) => {
    setExercises(prev => prev.filter((_, i) => i !== index));
  };

  const handleExerciseVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingExercise(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `exercise-${Math.random()}.${fileExt}`;
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
      setExerciseVideos([...exerciseVideos, ...urls]);
      
      toast({
        title: "Success",
        description: `Uploaded ${files.length} exercise video(s).`,
      });
    } catch (error: any) {
      console.error('Error uploading exercise videos:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload exercise videos.",
        variant: "destructive",
      });
    } finally {
      setUploadingExercise(false);
    }
  };

  const addExerciseYoutubeUrl = () => {
    const url = newExerciseYoutubeUrl.trim();
    if (url && (url.includes('youtube.com') || url.includes('youtu.be'))) {
      setExerciseYoutubeUrls([...exerciseYoutubeUrls, url]);
      setNewExerciseYoutubeUrl('');
    } else if (url) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid YouTube URL.",
        variant: "destructive",
      });
    }
  };

  const removeExerciseVideo = (index: number) => {
    setExerciseVideos(exerciseVideos.filter((_, i) => i !== index));
  };

  const removeExerciseYoutubeUrl = (index: number) => {
    setExerciseYoutubeUrls(exerciseYoutubeUrls.filter((_, i) => i !== index));
  };

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

  const addYoutubeUrl = () => {
    const url = newYoutubeUrl.trim();
    if (url && (url.includes('youtube.com') || url.includes('youtu.be'))) {
      setYoutubeUrls([...youtubeUrls, url]);
      setNewYoutubeUrl('');
    } else if (url) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid YouTube URL.",
        variant: "destructive",
      });
    }
  };

  const removeYoutubeUrl = (index: number) => {
    setYoutubeUrls(youtubeUrls.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onSave({
      title: formData.title,
      description: formData.description,
      content: formData.content,
      instructions: formData.instructions,
      duration_minutes: formData.duration_minutes,
      video_urls: uploadedVideos,
      youtube_urls: youtubeUrls,
      exercise_video_urls: exerciseVideos,
      exercise_youtube_urls: exerciseYoutubeUrls,
      exercises: exercises,
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

        {/* Instructions Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Instructions
          </h3>
          <div>
            <Label htmlFor="instructions">Lesson Instructions</Label>
            <Textarea
              id="instructions"
              value={formData.instructions}
              onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
              placeholder="Step-by-step instructions for students to follow during this lesson..."
              rows={5}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Provide clear instructions for students to complete this lesson
            </p>
          </div>
        </div>

        <Separator />

        {/* Device Video Upload Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <HardDrive className="w-4 h-4" />
            Upload Training Videos from Device
          </h3>
          
          {/* Uploaded Videos Display */}
          {uploadedVideos.length > 0 && (
            <div className="space-y-2">
              <Label>Uploaded Videos ({uploadedVideos.length})</Label>
              {uploadedVideos.map((url, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Video className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm truncate">{url.split('/').pop()}</span>
                  </div>
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

          {/* Video Upload Input */}
          <div className="border-2 border-dashed rounded-lg p-4">
            <Label htmlFor="video-upload" className="cursor-pointer">
              <div className="flex flex-col items-center gap-2 text-center">
                <Upload className="w-8 h-8 text-muted-foreground" />
                <span className="text-sm font-medium">Click to upload videos</span>
                <span className="text-xs text-muted-foreground">MP4, MOV, WebM (Max 500MB)</span>
              </div>
            </Label>
            <Input
              id="video-upload"
              type="file"
              accept="video/*"
              multiple
              onChange={handleVideoUpload}
              disabled={uploading}
              className="hidden"
            />
            {uploading && (
              <div className="mt-2 text-center text-sm text-muted-foreground">
                Uploading...
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* YouTube Links Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Youtube className="w-4 h-4 text-red-500" />
            YouTube Tutorial Links
          </h3>
          
          {/* Added YouTube URLs Display */}
          {youtubeUrls.length > 0 && (
            <div className="space-y-2">
              <Label>Added YouTube Videos ({youtubeUrls.length})</Label>
              {youtubeUrls.map((url, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Youtube className="w-4 h-4 text-red-500 shrink-0" />
                    <span className="text-sm truncate">{url}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeYoutubeUrl(index)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Add YouTube URL Input */}
          <div className="flex gap-2">
            <Input
              value={newYoutubeUrl}
              onChange={(e) => setNewYoutubeUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addYoutubeUrl())}
            />
            <Button type="button" onClick={addYoutubeUrl} variant="outline">
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Add YouTube tutorial links for students to watch
          </p>
        </div>

        <Separator />

        {/* Exercise Videos & Guides (For exercises) */}
        <div className="space-y-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
            <Video className="w-4 h-4 text-emerald-600" />
            Exercise Videos & Walkthroughs
          </h3>
          <p className="text-xs text-muted-foreground">
            Upload or link demonstration videos specifically for students to complete this lesson's exercises.
          </p>

          {/* Exercise Uploaded Videos Display */}
          {exerciseVideos.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Exercise Video Uploads ({exerciseVideos.length})</Label>
              {exerciseVideos.map((url, index) => (
                <div key={index} className="flex items-center justify-between p-2.5 bg-background rounded-lg border">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Video className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-sm truncate">{url.split('/').pop()}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeExerciseVideo(index)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Video Upload input for Exercises */}
          <div className="border-2 border-dashed border-emerald-500/30 rounded-lg p-3 bg-background/50 text-center">
            <Label htmlFor="exercise-video-upload" className="cursor-pointer block">
              <div className="flex flex-col items-center gap-1.5">
                <Upload className="w-6 h-6 text-emerald-600" />
                <span className="text-xs font-medium">Upload Exercise Video from Device</span>
                <span className="text-[11px] text-muted-foreground">MP4, MOV, WebM</span>
              </div>
            </Label>
            <Input
              id="exercise-video-upload"
              type="file"
              accept="video/*"
              multiple
              onChange={handleExerciseVideoUpload}
              disabled={uploadingExercise}
              className="hidden"
            />
            {uploadingExercise && (
              <div className="mt-1 text-xs text-emerald-600 font-medium">
                Uploading exercise video...
              </div>
            )}
          </div>

          {/* Exercise YouTube Guide Links */}
          {exerciseYoutubeUrls.length > 0 && (
            <div className="space-y-1.5 mt-2">
              <Label className="text-xs font-semibold">Exercise YouTube Guides ({exerciseYoutubeUrls.length})</Label>
              {exerciseYoutubeUrls.map((url, index) => (
                <div key={index} className="flex items-center justify-between p-2.5 bg-background rounded-lg border">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Youtube className="w-4 h-4 text-red-500 shrink-0" />
                    <span className="text-xs truncate">{url}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeExerciseYoutubeUrl(index)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Input
              value={newExerciseYoutubeUrl}
              onChange={(e) => setNewExerciseYoutubeUrl(e.target.value)}
              placeholder="Exercise YouTube Guide URL..."
              className="text-xs h-9"
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addExerciseYoutubeUrl())}
            />
            <Button type="button" onClick={addExerciseYoutubeUrl} variant="outline" size="sm">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add
            </Button>
          </div>
        </div>

        <Separator />

        {/* Exercises Configuration */}
        <div className="space-y-4 rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-blue-800 dark:text-blue-300">
              <Code2 className="w-4 h-4" />
              Exercises &amp; Activities
            </h3>
            <Button type="button" size="sm" variant="outline" onClick={addExercise} className="h-7 text-xs">
              <Plus className="w-3 h-3 mr-1" />
              Add Exercise
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Configure the editor type for each exercise. Students will see a code editor, Scratch, or an external tool link based on this setting.
          </p>

          {exercises.length === 0 && (
            <p className="text-xs text-center text-muted-foreground py-3">No exercises yet. Click "Add Exercise" to add one.</p>
          )}

          <div className="space-y-3">
            {exercises.map((ex: any, index: number) => (
              <div key={index} className="rounded-lg border bg-background p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={ex.title || ""}
                    onChange={e => updateExercise(index, "title", e.target.value)}
                    placeholder="Exercise title"
                    className="h-8 text-sm flex-1"
                  />
                  <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500 hover:text-red-600" onClick={() => removeExercise(index)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Editor / IDE</Label>
                    <Select value={ex.editor_type || "none"} onValueChange={v => updateExercise(index, "editor_type", v)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None (text/link only)</SelectItem>
                        <SelectItem value="monaco_html">HTML/CSS Editor</SelectItem>
                        <SelectItem value="monaco_js">JavaScript Editor</SelectItem>
                        <SelectItem value="monaco_python">Python Editor</SelectItem>
                        <SelectItem value="monaco_css">CSS Editor</SelectItem>
                        <SelectItem value="scratch">Scratch Embed</SelectItem>
                        <SelectItem value="external">External Tool (Roblox, App Dev)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Project Type</Label>
                    <Select value={ex.project_mode || "standard"} onValueChange={v => updateExercise(index, "project_mode", v)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Blank Project</SelectItem>
                        <SelectItem value="starter">Base / Starter Template</SelectItem>
                        <SelectItem value="debug">Debug Project (Fix the Bug)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Submission Rule</Label>
                    <div className="flex items-center gap-2 h-8">
                      <Switch
                        id={`is-assignment-${index}`}
                        checked={!!ex.is_assignment}
                        onCheckedChange={v => updateExercise(index, "is_assignment", v)}
                      />
                      <Label htmlFor={`is-assignment-${index}`} className="text-xs cursor-pointer">
                        {ex.is_assignment ? "Assignment (Submit to Tutor)" : "Exercise (Save only)"}
                      </Label>
                    </div>
                  </div>
                </div>

                {ex.editor_type === "external" && (
                  <div className="space-y-1">
                    <Label className="text-xs flex items-center gap-1"><ExternalLink className="w-3 h-3" />External Editor URL</Label>
                    <Input
                      value={ex.external_url || ""}
                      onChange={e => updateExercise(index, "external_url", e.target.value)}
                      placeholder="https://create.roblox.com/... or https://appinventor.mit.edu/..."
                      className="h-8 text-xs"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-xs">Instructions (shown in editor side panel)</Label>
                  <Textarea
                    value={ex.instructions || ""}
                    onChange={e => updateExercise(index, "instructions", e.target.value)}
                    placeholder="Step-by-step instructions shown beside the code editor..."
                    rows={2}
                    className="text-xs"
                  />
                </div>

                {(ex.editor_type?.startsWith("monaco_")) && (
                  <div className="space-y-1">
                    <Label className="text-xs flex items-center gap-1">
                      {ex.project_mode === "debug" ? (
                        <>
                          <Bug className="w-3 h-3 text-red-500" />
                          <span className="text-red-600 font-semibold">Buggy Code to Debug (starter code with errors to fix)</span>
                        </>
                      ) : (
                        <span>Base Project / Starter Code (pre-filled template for students)</span>
                      )}
                    </Label>
                    <Textarea
                      value={ex.starter_code || ""}
                      onChange={e => updateExercise(index, "starter_code", e.target.value)}
                      placeholder={ex.project_mode === "debug" ? "Write code with intentional bugs for the student to solve..." : "Pre-filled starter template code..."}
                      rows={3}
                      className="text-xs font-mono"
                    />
                  </div>
                )}
              </div>
            ))}
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