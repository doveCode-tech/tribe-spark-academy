import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Video, FileText, Code, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface CourseFormData {
  title: string;
  description: string;
  category: string;
}

interface LessonFormData {
  title: string;
  description: string;
  content: string;
  video_url: string;
  order_index: number;
}

interface CourseCreatorProps {
  onCourseCreated?: () => void;
}

export function CourseCreator({ onCourseCreated }: CourseCreatorProps) {
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [courseData, setCourseData] = useState<CourseFormData>({
    title: '',
    description: '',
    category: '',
  });
  const [lessonTitle, setLessonTitle] = useState<string>('');
  const [lessonInstructions, setLessonInstructions] = useState<string>('');
  const [videoFile, setVideoFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: course, error } = await supabase
        .from('courses')
        .insert([{ 
          title: courseData.title, 
          description: courseData.description, 
          category: courseData.category,
          created_by: userProfile?.auth_user_id
        }])
        .select()
        .single();

      if (error) throw error;

      // Optionally create first lesson with uploaded video
      if (course && (lessonTitle || lessonInstructions || videoFile)) {
        let video_url: string | undefined;
        if (videoFile) {
          const path = `${course.id}/${Date.now()}-${videoFile.name}`;
          const { error: upErr } = await supabase.storage.from('lesson-videos').upload(path, videoFile, { upsert: false });
          if (upErr) throw upErr;
          const { data: pub } = supabase.storage.from('lesson-videos').getPublicUrl(path);
          video_url = pub.publicUrl;
        }
        const { error: lessonErr } = await supabase.from('lessons').insert({
          course_id: course.id,
          title: lessonTitle || 'Lesson 1',
          description: lessonInstructions || null,
          content: lessonInstructions || null,
          video_url: video_url || null,
          order_index: 1,
        });
        if (lessonErr) throw lessonErr;
      }

      toast({ title: 'Success', description: 'Course created successfully!' });

      setCourseData({ title: '', description: '', category: '' });
      setLessonTitle('');
      setLessonInstructions('');
      setVideoFile(null);
      setOpen(false);
      onCourseCreated?.();
    } catch (error: any) {
      console.error('Error creating course:', error);
      toast({ title: 'Error', description: error.message || 'Failed to create course', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Course
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Course</DialogTitle>
          <DialogDescription>
            Create a new course with lessons and content for students to learn.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Course Title</Label>
            <Input
              id="title"
              value={courseData.title}
              onChange={(e) => setCourseData({ ...courseData, title: e.target.value })}
              placeholder="e.g., Advanced Python Programming"
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select 
              value={courseData.category} 
              onValueChange={(value) => setCourseData({ ...courseData, category: value })}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Python">Python</SelectItem>
                <SelectItem value="JavaScript">JavaScript</SelectItem>
                <SelectItem value="Scratch">Scratch</SelectItem>
                <SelectItem value="Robotics">Robotics</SelectItem>
                <SelectItem value="Web Development">Web Development</SelectItem>
                <SelectItem value="Data Science">Data Science</SelectItem>
                <SelectItem value="AI/ML">AI/ML</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={courseData.description}
              onChange={(e) => setCourseData({ ...courseData, description: e.target.value })}
              placeholder="Describe what students will learn in this course..."
              rows={3}
              required
              disabled={loading}
            />
          </div>

          {/* Optional first lesson */}
          <div className="pt-2 border-t space-y-3">
            <h4 className="font-medium">Add First Lesson (optional) 🎥</h4>
            <div className="space-y-2">
              <Label htmlFor="lessonTitle">Lesson Title</Label>
              <Input id="lessonTitle" value={lessonTitle} onChange={(e)=>setLessonTitle(e.target.value)} placeholder="e.g., Getting Started" disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lessonInstructions">Lesson Instructions</Label>
              <Textarea id="lessonInstructions" value={lessonInstructions} onChange={(e)=>setLessonInstructions(e.target.value)} placeholder="Write friendly instructions for kids..." rows={4} disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="video">Upload Lesson Video</Label>
              <Input id="video" type="file" accept="video/*" onChange={(e)=>setVideoFile(e.target.files?.[0] || null)} disabled={loading} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Course'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}