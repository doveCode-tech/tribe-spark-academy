import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Lock, 
  CheckCircle2, 
  Video, 
  BookOpen, 
  FileText, 
  Trophy, 
  Play, 
  ExternalLink,
  ChevronRight,
  Clock,
  HelpCircle
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface CourseLesson {
  id: string;
  course_id: string;
  title: string;
  description: string;
  content?: string;
  duration_minutes: number;
  order_index: number;
  video_urls?: string[] | null;
  youtube_urls?: string[] | null;
  exercise_video_urls?: string[] | null;
  exercise_youtube_urls?: string[] | null;
  exercises?: any;
  assignment_required?: boolean;
  quiz_required?: boolean;
  is_end_of_course?: boolean;
  completed?: boolean;
}

interface CourseAccordionLessonsProps {
  courseId: string;
  lessons: CourseLesson[];
  canEdit?: boolean;
  onStartLesson: (lessonId: string) => void;
}

export function CourseAccordionLessons({
  courseId,
  lessons,
  canEdit = false,
  onStartLesson,
}: CourseAccordionLessonsProps) {
  const navigate = useNavigate();
  const [activeVideoModal, setActiveVideoModal] = useState<{ title: string; url: string; isYoutube?: boolean } | null>(null);

  // Default the first unlocked item to open
  const firstUnlocked = lessons.find((_, i) => i === 0 || lessons[i - 1]?.completed);
  const defaultOpen = firstUnlocked ? firstUnlocked.id : (lessons[0]?.id || "");

  const handleOpenVideo = (title: string, url: string, isYoutube = false) => {
    setActiveVideoModal({ title, url, isYoutube });
  };

  const getEmbedUrl = (url: string) => {
    if (url.includes("youtu.be/")) {
      const id = url.split("youtu.be/")[1]?.split("?")[0];
      return `https://www.youtube.com/embed/${id}`;
    }
    if (url.includes("watch?v=")) {
      const id = url.split("watch?v=")[1]?.split("&")[0];
      return `https://www.youtube.com/embed/${id}`;
    }
    return url;
  };

  return (
    <div className="space-y-4">
      {/* Video Modal Player */}
      <Dialog open={!!activeVideoModal} onOpenChange={(open) => !open && setActiveVideoModal(null)}>
        <DialogContent className="sm:max-w-3xl p-0 overflow-hidden bg-black text-white">
          <DialogHeader className="p-4 bg-slate-900">
            <DialogTitle className="text-white text-base truncate">
              {activeVideoModal?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="aspect-video w-full bg-black flex items-center justify-center">
            {activeVideoModal?.isYoutube ? (
              <iframe
                src={getEmbedUrl(activeVideoModal.url)}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video
                src={activeVideoModal?.url}
                controls
                autoPlay
                className="w-full h-full"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Accordion Component */}
      <Accordion type="single" collapsible defaultValue={defaultOpen} className="space-y-3">
        {lessons.map((lesson, index) => {
          const isFirstLesson = index === 0;
          const previousCompleted = index > 0 ? lessons[index - 1].completed : true;
          // Staff can view everything; students unlock sequentially
          const isUnlocked = canEdit || isFirstLesson || previousCompleted;
          const isCompleted = lesson.completed || false;

          const hasUsefulVideos =
            (lesson.video_urls && lesson.video_urls.length > 0) ||
            (lesson.youtube_urls && lesson.youtube_urls.length > 0);

          const exercisesList: any[] = Array.isArray(lesson.exercises)
            ? lesson.exercises
            : [];

          const hasExercises = exercisesList.length > 0;
          const hasExerciseVideos =
            (lesson.exercise_video_urls && lesson.exercise_video_urls.length > 0) ||
            (lesson.exercise_youtube_urls && lesson.exercise_youtube_urls.length > 0);

          return (
            <AccordionItem
              key={lesson.id}
              value={lesson.id}
              disabled={!isUnlocked}
              className={`border rounded-xl px-4 py-1 transition-all shadow-sm ${
                !isUnlocked 
                  ? "opacity-60 bg-muted/30 border-dashed" 
                  : isCompleted
                  ? "bg-card border-green-500/20 hover:border-primary/40"
                  : "bg-card hover:border-primary/50"
              }`}
            >
              {/* Accordion Header */}
              <AccordionTrigger className="hover:no-underline py-3.5 group">
                <div className="flex items-center gap-3 text-left w-full pr-4">
                  {/* Status / Lock Icon */}
                  <div className="shrink-0">
                    {isCompleted ? (
                      <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-950/50 text-green-600 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                    ) : !isUnlocked ? (
                      <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center">
                        <Lock className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                        {lesson.order_index || index + 1}
                      </div>
                    )}
                  </div>

                  {/* Title & Short Description */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-base text-foreground group-hover:text-primary transition-colors">
                        {lesson.title}
                      </span>
                      {lesson.is_end_of_course && (
                        <Badge className="bg-amber-500/15 text-amber-600 hover:bg-amber-500/20 border-0 text-[11px]">
                          <Trophy className="w-3 h-3 mr-1" />
                          Final Project
                        </Badge>
                      )}
                    </div>
                    {lesson.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {lesson.description}
                      </p>
                    )}
                  </div>

                  {/* Badges / Duration */}
                  <div className="hidden sm:flex items-center gap-2 shrink-0">
                    {lesson.duration_minutes && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1 bg-muted px-2.5 py-1 rounded-full">
                        <Clock className="w-3.5 h-3.5" />
                        {lesson.duration_minutes}m
                      </span>
                    )}
                    {isCompleted ? (
                      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200 text-xs">
                        Completed
                      </Badge>
                    ) : isUnlocked ? (
                      <Badge variant="secondary" className="text-xs font-normal">
                        Ready
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground font-normal">
                        Locked
                      </Badge>
                    )}
                  </div>
                </div>
              </AccordionTrigger>

              {/* Accordion Content */}
              <AccordionContent className="pt-2 pb-4 border-t border-border/60 mt-1">
                <div className="space-y-3 pt-2">
                  {/* Detailed Description / Content preview */}
                  {lesson.content && (
                    <div className="bg-muted/40 rounded-lg p-3 text-sm text-muted-foreground whitespace-pre-wrap">
                      {lesson.content}
                    </div>
                  )}

                  {/* Section 1: Useful Videos (from reference image) */}
                  {hasUsefulVideos && (
                    <div className="rounded-lg border border-border/70 p-3 bg-muted/10 space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Video className="w-4 h-4 text-blue-500" />
                        Useful Videos
                      </h4>
                      <div className="space-y-1.5 pl-1">
                        {/* Direct Video URLs */}
                        {lesson.video_urls?.map((url, vIdx) => (
                          <div
                            key={`vid-${vIdx}`}
                            className="flex items-center justify-between p-2 rounded-md hover:bg-muted/60 transition-colors bg-card border border-border/40"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                                <Play className="w-3.5 h-3.5 fill-current" />
                              </div>
                              <span className="text-sm font-medium truncate">
                                Lesson {lesson.order_index} Video #{vIdx + 1}
                              </span>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs text-blue-600 hover:text-blue-700 h-8 gap-1"
                              onClick={() => handleOpenVideo(`Lesson ${lesson.order_index} Video #${vIdx + 1}`, url, false)}
                            >
                              Watch Video
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}

                        {/* YouTube Tutorial URLs */}
                        {lesson.youtube_urls?.map((url, yIdx) => (
                          <div
                            key={`yt-${yIdx}`}
                            className="flex items-center justify-between p-2 rounded-md hover:bg-muted/60 transition-colors bg-card border border-border/40"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-6 h-6 rounded-full bg-red-500/10 text-red-600 flex items-center justify-center shrink-0">
                                <Play className="w-3.5 h-3.5 fill-current" />
                              </div>
                              <span className="text-sm font-medium truncate">
                                Lesson {lesson.order_index} YouTube Tutorial #{yIdx + 1}
                              </span>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs text-red-600 hover:text-red-700 h-8 gap-1"
                              onClick={() => handleOpenVideo(`Lesson ${lesson.order_index} YouTube Tutorial #${yIdx + 1}`, url, true)}
                            >
                              Watch on YouTube
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Section 2: Exercises & Exercise Videos */}
                  {(hasExercises || hasExerciseVideos) && (
                    <div className="rounded-lg border border-border/70 p-3 bg-muted/10 space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4 text-emerald-500" />
                        Exercises & Tasks
                      </h4>

                      {/* Exercise Videos (if admin uploaded dedicated exercise videos) */}
                      {lesson.exercise_video_urls?.map((url, evIdx) => (
                        <div
                          key={`ex-vid-${evIdx}`}
                          className="flex items-center justify-between p-2 rounded-md bg-card border border-border/40 hover:bg-muted/60 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                              <Video className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-sm font-medium truncate">
                              Exercise Walkthrough Video #{evIdx + 1}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs text-emerald-600 hover:text-emerald-700 h-8 gap-1"
                            onClick={() => handleOpenVideo(`Exercise Walkthrough Video #${evIdx + 1}`, url, false)}
                          >
                            Watch Video
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}

                      {/* Exercise YouTube Tutorials */}
                      {lesson.exercise_youtube_urls?.map((url, eyIdx) => (
                        <div
                          key={`ex-yt-${eyIdx}`}
                          className="flex items-center justify-between p-2 rounded-md bg-card border border-border/40 hover:bg-muted/60 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-red-500/10 text-red-600 flex items-center justify-center shrink-0">
                              <Play className="w-3.5 h-3.5 fill-current" />
                            </div>
                            <span className="text-sm font-medium truncate">
                              Exercise YouTube Guide #{eyIdx + 1}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs text-red-600 hover:text-red-700 h-8 gap-1"
                            onClick={() => handleOpenVideo(`Exercise YouTube Guide #${eyIdx + 1}`, url, true)}
                          >
                            Watch Guide
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}

                      {/* Exercise List */}
                      {exercisesList.map((exercise: any, exIdx: number) => (
                        <div
                          key={`ex-${exIdx}`}
                          className="flex items-center justify-between p-2.5 rounded-md bg-card border border-border/40"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 font-bold text-xs">
                              {exIdx + 1}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {exercise.title || `Exercise ${exIdx + 1}`}
                              </p>
                              {exercise.description && (
                                <p className="text-xs text-muted-foreground line-clamp-1">
                                  {exercise.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {exercise.type || "Practice"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Section 3: Assignment & Quiz Requirements */}
                  {(lesson.assignment_required || lesson.quiz_required) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {lesson.assignment_required && (
                        <div className="flex items-center justify-between p-2.5 rounded-lg border border-purple-500/20 bg-purple-500/5">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-purple-600" />
                            <span className="text-xs font-semibold text-purple-900 dark:text-purple-200">
                              Assignment Required
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-purple-500/30 text-purple-700 dark:text-purple-300"
                            onClick={() => navigate(`/lesson/${lesson.id}`)}
                          >
                            Submit
                          </Button>
                        </div>
                      )}

                      {lesson.quiz_required && (
                        <div className="flex items-center justify-between p-2.5 rounded-lg border border-blue-500/20 bg-blue-500/5">
                          <div className="flex items-center gap-2">
                            <HelpCircle className="w-4 h-4 text-blue-600" />
                            <span className="text-xs font-semibold text-blue-900 dark:text-blue-200">
                              Quiz Required
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-blue-500/30 text-blue-700 dark:text-blue-300"
                            onClick={() => navigate(`/lesson/${lesson.id}`)}
                          >
                            Take Quiz
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Bottom Actions Bar */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/40">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/lesson/${lesson.id}`)}
                      className="text-xs gap-1.5"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      View Full Content
                    </Button>

                    {!isCompleted ? (
                      <Button
                        size="sm"
                        onClick={() => onStartLesson(lesson.id)}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5" />
                        Mark Complete
                      </Button>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                        <CheckCircle2 className="w-4 h-4" />
                        Lesson Completed
                      </div>
                    )}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
