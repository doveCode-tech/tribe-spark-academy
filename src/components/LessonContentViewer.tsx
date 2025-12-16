import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Video, BookOpen, FileText, Upload, CheckCircle, ClipboardList } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface LessonContentViewerProps {
  lesson: {
    id: string;
    title: string;
    description: string;
    content: string;
    video_urls: string[] | null;
    youtube_urls: string[] | null;
    instructions: string | null;
    exercises: any;
    course_id: string;
  };
  onSubmitAssignment?: () => void;
}

export function LessonContentViewer({ lesson, onSubmitAssignment }: LessonContentViewerProps) {
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [assignmentDescription, setAssignmentDescription] = useState("");
  const [assignmentLink, setAssignmentLink] = useState("");
  const [assignmentFile, setAssignmentFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmitAssignment = async () => {
    if (!assignmentTitle.trim()) {
      toast({
        title: "Error",
        description: "Please provide an assignment title",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      let filePath = null;

      // Upload file if provided
      if (assignmentFile) {
        const fileExt = assignmentFile.name.split('.').pop();
        const fileName = `${lesson.course_id}/${Date.now()}-${assignmentFile.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from('project-submissions')
          .upload(fileName, assignmentFile);

        if (uploadError) throw uploadError;
        filePath = fileName;
      }

      // Insert project submission
      const { error: insertError } = await supabase
        .from('projects')
        .insert({
          course_id: lesson.course_id,
          student_id: userProfile?.auth_user_id,
          title: assignmentTitle,
          description: assignmentDescription,
          link: assignmentLink,
          file_path: filePath,
          review_status: 'submitted'
        });

      if (insertError) throw insertError;

      toast({
        title: "Success!",
        description: "Assignment submitted successfully. Your tutor will review it soon.",
      });

      // Reset form
      setAssignmentTitle("");
      setAssignmentDescription("");
      setAssignmentLink("");
      setAssignmentFile(null);
      
      onSubmitAssignment?.();
    } catch (error: any) {
      console.error('Error submitting assignment:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit assignment",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{lesson.title}</CardTitle>
        <CardDescription>{lesson.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="video" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="video">
              <Video className="w-4 h-4 mr-2" />
              Videos
            </TabsTrigger>
            <TabsTrigger value="instructions">
              <ClipboardList className="w-4 h-4 mr-2" />
              Instructions
            </TabsTrigger>
            <TabsTrigger value="exercises">
              <BookOpen className="w-4 h-4 mr-2" />
              Exercises
            </TabsTrigger>
            <TabsTrigger value="assignment">
              <FileText className="w-4 h-4 mr-2" />
              Assignment
            </TabsTrigger>
          </TabsList>

          <TabsContent value="video" className="space-y-4">
            {/* Combined video_urls and youtube_urls */}
            {((lesson.video_urls && lesson.video_urls.length > 0) || (lesson.youtube_urls && lesson.youtube_urls.length > 0)) ? (
              <div className="space-y-4">
                {/* Uploaded videos */}
                {lesson.video_urls && lesson.video_urls.map((url, index) => (
                  <div key={`video-${index}`} className="space-y-2">
                    <h4 className="font-medium">Video {index + 1}</h4>
                    <div className="aspect-video w-full rounded-lg overflow-hidden bg-muted">
                      <video
                        src={url}
                        className="w-full h-full"
                        controls
                      />
                    </div>
                  </div>
                ))}
                {/* YouTube videos */}
                {lesson.youtube_urls && lesson.youtube_urls.map((url, index) => (
                  <div key={`youtube-${index}`} className="space-y-2">
                    <h4 className="font-medium">YouTube Tutorial {index + 1}</h4>
                    <div className="aspect-video w-full rounded-lg overflow-hidden bg-muted">
                      <iframe
                        src={url.replace('youtu.be/', 'youtube.com/embed/').replace('watch?v=', 'embed/')}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </div>
                ))}
                {lesson.content && (
                  <div className="prose prose-sm max-w-none">
                    <p>{lesson.content}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Video className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No videos available for this lesson</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="instructions" className="space-y-4">
            {lesson.instructions ? (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center">
                      <ClipboardList className="w-5 h-5 mr-2" />
                      Lesson Instructions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                      {lesson.instructions}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <ClipboardList className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No instructions available for this lesson</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="exercises" className="space-y-4">
            {lesson.exercises && Array.isArray(lesson.exercises) && lesson.exercises.length > 0 ? (
              <div className="space-y-4">
                {lesson.exercises.map((exercise: any, index: number) => (
                  <Card key={index}>
                    <CardHeader>
                      <CardTitle className="text-lg">{exercise.title || `Exercise ${index + 1}`}</CardTitle>
                      <CardDescription>{exercise.description || exercise.type}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {exercise.prompt && <p className="text-sm">{exercise.prompt}</p>}
                      {exercise.question && (
                        <div className="space-y-2">
                          <p className="font-medium">{exercise.question}</p>
                          {exercise.options && (
                            <ul className="list-disc list-inside space-y-1">
                              {exercise.options.map((option: string, i: number) => (
                                <li key={i} className="text-sm">{option}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No exercises available for this lesson</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="assignment" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Assignment Title *</Label>
                <Input
                  id="title"
                  value={assignmentTitle}
                  onChange={(e) => setAssignmentTitle(e.target.value)}
                  placeholder="Enter assignment title"
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={assignmentDescription}
                  onChange={(e) => setAssignmentDescription(e.target.value)}
                  placeholder="Describe what you've learned or built"
                  rows={4}
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="link">Project Link (Optional)</Label>
                <Input
                  id="link"
                  type="url"
                  value={assignmentLink}
                  onChange={(e) => setAssignmentLink(e.target.value)}
                  placeholder="https://... (GitHub, Scratch, Roblox, etc.)"
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="file">Upload File (Optional)</Label>
                <Input
                  id="file"
                  type="file"
                  onChange={(e) => setAssignmentFile(e.target.files?.[0] || null)}
                  disabled={submitting}
                />
                {assignmentFile && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {assignmentFile.name}
                  </p>
                )}
              </div>

              <Button
                onClick={handleSubmitAssignment}
                disabled={submitting || !assignmentTitle.trim()}
                className="w-full"
              >
                {submitting ? (
                  <>Submitting...</>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Submit Assignment
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
