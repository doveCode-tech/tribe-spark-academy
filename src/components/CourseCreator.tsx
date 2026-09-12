import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Video, Youtube, Upload, Link as LinkIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface CourseFormData {
  title: string;
  description: string;
  category: string;
}

interface CourseCreatorProps {
  onCourseCreated?: () => void;
}

export function CourseCreator({ onCourseCreated }: CourseCreatorProps) {
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Create Course");
  
  const [courseData, setCourseData] = useState<CourseFormData>({
    title: '',
    description: '',
    category: '',
  });

  // Optional first lesson fields
  const [lessonTitle, setLessonTitle] = useState<string>('');
  const [lessonInstructions, setLessonInstructions] = useState<string>('');
  const [videoOption, setVideoOption] = useState<"none" | "link" | "upload">("none");
  const [videoLink, setVideoLink] = useState<string>('');
  const [videoFile, setVideoFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseData.title.trim()) {
      toast({ title: "Title required", description: "Please enter a course title.", variant: "destructive" });
      return;
    }

    setLoading(true);
    setStatusMessage("Creating course...");

    try {
      // 1. Insert course
      const { data: course, error } = await supabase
        .from('courses')
        .insert([{ 
          title: courseData.title.trim(), 
          description: courseData.description?.trim() || '', 
          category: courseData.category || 'General STEM',
          created_by: userProfile?.auth_user_id
        }])
        .select()
        .single();

      if (error) throw error;

      // 2. Optionally create first lesson with video link or upload
      if (course && (lessonTitle.trim() || lessonInstructions.trim() || videoFile || videoLink.trim())) {
        let directVideoUrl: string | null = null;
        let isYoutube = false;
        let youtubeUrls: string[] = [];
        let videoUrls: string[] = [];

        // Handle Video URL Link (YouTube or Direct MP4)
        if (videoOption === "link" && videoLink.trim()) {
          const url = videoLink.trim();
          if (url.includes("youtube.com") || url.includes("youtu.be")) {
            isYoutube = true;
            youtubeUrls = [url];
          } else {
            directVideoUrl = url;
            videoUrls = [url];
          }
        }

        // Handle Video File Upload from Computer
        if (videoOption === "upload" && videoFile) {
          setStatusMessage("Uploading video...");
          
          // Safety check on file size: warn if > 80MB
          if (videoFile.size > 80 * 1024 * 1024) {
            toast({
              title: "Large video file",
              description: `This file is ${(videoFile.size / (1024 * 1024)).toFixed(1)}MB. Uploading might take a while.`,
            });
          }

          const safeName = videoFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          const path = `${course.id}/${Date.now()}-${safeName}`;

          // Upload with a 60-second timeout guard to prevent infinite hanging
          const uploadPromise = supabase.storage
            .from('lesson-videos')
            .upload(path, videoFile, { upsert: false });

          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Video upload timed out. Please check your connection or use a YouTube link.")), 60000)
          );

          const { error: upErr } = (await Promise.race([uploadPromise, timeoutPromise])) as any;

          if (upErr) {
            console.error("Video storage upload failed:", upErr);
            toast({
              title: "Video upload warning",
              description: upErr.message || "Failed to upload video file, but creating course anyway.",
              variant: "destructive",
            });
          } else {
            const { data: pub } = supabase.storage.from('lesson-videos').getPublicUrl(path);
            directVideoUrl = pub.publicUrl;
            videoUrls = [pub.publicUrl];
          }
        }

        setStatusMessage("Adding initial lesson...");

        const { error: lessonErr } = await supabase.from('lessons').insert({
          course_id: course.id,
          title: lessonTitle.trim() || 'Lesson 1: Introduction',
          description: lessonInstructions.trim() || null,
          content: lessonInstructions.trim() || null,
          video_url: directVideoUrl,
          video_urls: videoUrls,
          youtube_urls: youtubeUrls,
          order_index: 1,
        });

        if (lessonErr) {
          console.warn("Could not insert initial lesson:", lessonErr);
        }
      }

      toast({ title: 'Course Created 🎉', description: 'Course created successfully with its curriculum!' });

      setCourseData({ title: '', description: '', category: '' });
      setLessonTitle('');
      setLessonInstructions('');
      setVideoFile(null);
      setVideoLink('');
      setVideoOption('none');
      setOpen(false);
      onCourseCreated?.();
    } catch (error: any) {
      console.error('Error creating course:', error);
      toast({ title: 'Error Creating Course', description: error.message || 'Failed to create course. Please try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
      setStatusMessage("Create Course");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5 shadow-sm">
          <Plus className="w-4 h-4" />
          Add Course
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[540px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Course</DialogTitle>
          <DialogDescription>
            Create a new course with optional lessons, videos, and content for students.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Course Title *</Label>
            <Input
              id="title"
              value={courseData.title}
              onChange={(e) => setCourseData({ ...courseData, title: e.target.value })}
              placeholder="e.g., Robotics & Arduino Adventures"
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
                <SelectItem value="Roblox">Roblox Game Development</SelectItem>
                <SelectItem value="App Development">App Development</SelectItem>
                <SelectItem value="Graphic Design">Graphic Design</SelectItem>
                <SelectItem value="Data Science">Data Science</SelectItem>
                <SelectItem value="AI/ML">AI / Machine Learning</SelectItem>
                <SelectItem value="Other">Other STEM Track</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Course Description</Label>
            <Textarea
              id="description"
              value={courseData.description}
              onChange={(e) => setCourseData({ ...courseData, description: e.target.value })}
              placeholder="Describe what students will learn in this course..."
              rows={3}
              disabled={loading}
            />
          </div>

          {/* Optional First Lesson & Video Section */}
          <div className="pt-3 border-t space-y-3.5 bg-muted/20 p-3.5 rounded-xl border">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm flex items-center gap-1.5 text-foreground">
                <Video className="w-4 h-4 text-primary" />
                Add First Lesson (Optional)
              </h4>
              <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded">
                Can be skipped
              </span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lessonTitle" className="text-xs">Lesson Title</Label>
              <Input 
                id="lessonTitle" 
                value={lessonTitle} 
                onChange={(e) => setLessonTitle(e.target.value)} 
                placeholder="e.g., Lesson 1: Getting Started" 
                disabled={loading}
                className="h-9 text-sm" 
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lessonInstructions" className="text-xs">Lesson Overview / Instructions</Label>
              <Textarea 
                id="lessonInstructions" 
                value={lessonInstructions} 
                onChange={(e) => setLessonInstructions(e.target.value)} 
                placeholder="Write instructions or goals for this lesson..." 
                rows={2} 
                disabled={loading}
                className="text-xs" 
              />
            </div>

            {/* Video Option Selector */}
            <div className="space-y-2 pt-1 border-t">
              <Label className="text-xs font-semibold">Lesson Video (Optional)</Label>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <Button
                  type="button"
                  variant={videoOption === "none" ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setVideoOption("none")}
                  className="h-8 text-xs"
                >
                  No Video
                </Button>
                <Button
                  type="button"
                  variant={videoOption === "link" ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setVideoOption("link")}
                  className="h-8 text-xs gap-1"
                >
                  <LinkIcon className="w-3 h-3" />
                  Video URL
                </Button>
                <Button
                  type="button"
                  variant={videoOption === "upload" ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setVideoOption("upload")}
                  className="h-8 text-xs gap-1"
                >
                  <Upload className="w-3 h-3" />
                  Upload MP4
                </Button>
              </div>

              {videoOption === "link" && (
                <div className="space-y-1 pt-1">
                  <Input
                    type="url"
                    placeholder="https://youtube.com/watch?v=... or direct MP4 link"
                    value={videoLink}
                    onChange={(e) => setVideoLink(e.target.value)}
                    disabled={loading}
                    className="h-9 text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    YouTube tutorials and walkthrough links work seamlessly.
                  </p>
                </div>
              )}

              {videoOption === "upload" && (
                <div className="space-y-1 pt-1">
                  <Input 
                    id="video" 
                    type="file" 
                    accept="video/*" 
                    onChange={(e) => setVideoFile(e.target.files?.[0] || null)} 
                    disabled={loading}
                    className="text-xs h-9 cursor-pointer" 
                  />
                  {videoFile && (
                    <p className="text-[11px] text-primary font-medium">
                      Selected: {videoFile.name} ({(videoFile.size / (1024 * 1024)).toFixed(1)} MB)
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="font-semibold">
              {loading ? statusMessage : 'Create Course'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}