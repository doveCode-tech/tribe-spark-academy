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
  ChevronRight,
  ChevronLeft,
  Clock,
  HelpCircle,
  Code2,
  X
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ActivityCodeEditor, EditorType } from "./ActivityCodeEditor";

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
  grade?: number | null;
  feedback?: string | null;
  submission_status?: string | null;
  submission?: any;
}

interface CourseAccordionLessonsProps {
  courseId: string;
  lessons: CourseLesson[];
  canEdit?: boolean;
  onStartLesson: (lessonId: string) => void;
}

export interface HelpfulVideoItem {
  id: string;
  title: string;
  url: string;
  isYoutube: boolean;
  category: "Lesson Overview" | "YouTube Tutorial" | "Exercise Walkthrough";
}

export function CourseAccordionLessons({
  courseId,
  lessons,
  canEdit = false,
  onStartLesson,
}: CourseAccordionLessonsProps) {
  const navigate = useNavigate();

  // Modals state
  const [activeHelpfulVideosModal, setActiveHelpfulVideosModal] = useState<{
    lesson: CourseLesson;
    videos: HelpfulVideoItem[];
  } | null>(null);
  const [selectedVideoIdx, setSelectedVideoIdx] = useState<number>(0);
  const [activeActivityModal, setActiveActivityModal] = useState<{ exercise: any; lesson: CourseLesson } | null>(null);

  const inferEditorType = (exercise: any, lessonTitle: string): EditorType => {
    if (exercise.editor_type && exercise.editor_type !== "none") return exercise.editor_type;
    const str = `${exercise.title || ""} ${exercise.description || ""} ${lessonTitle || ""}`.toLowerCase();
    if (str.includes("python")) return "monaco_python";
    if (str.includes("scratch")) return "scratch";
    if (str.includes("roblox") || str.includes("app")) return "external";
    if (str.includes("javascript") || str.includes("js")) return "monaco_js";
    if (str.includes("html") || str.includes("web") || str.includes("css") || str.includes("design")) return "monaco_html";
    return "monaco_html";
  };

  // Default the first unlocked item to open
  const firstUnlocked = lessons.find((_, i) => i === 0 || lessons[i - 1]?.completed);
  const defaultOpen = firstUnlocked ? firstUnlocked.id : (lessons[0]?.id || "");
  const [activeAccordion, setActiveAccordion] = useState<string>(defaultOpen);

  const getEmbedUrl = (url: string) => {
    if (!url) return "";
    if (url.includes("youtu.be/")) {
      const id = url.split("youtu.be/")[1]?.split("?")[0];
      return `https://www.youtube.com/embed/${id}?autoplay=1`;
    }
    if (url.includes("watch?v=")) {
      const id = url.split("watch?v=")[1]?.split("&")[0];
      return `https://www.youtube.com/embed/${id}?autoplay=1`;
    }
    if (url.includes("shorts/")) {
      const id = url.split("shorts/")[1]?.split("?")[0];
      return `https://www.youtube.com/embed/${id}?autoplay=1`;
    }
    return url;
  };

  // Collect all helpful videos for a lesson
  const getLessonVideos = (lesson: CourseLesson): HelpfulVideoItem[] => {
    const videos: HelpfulVideoItem[] = [];

    if (Array.isArray(lesson.video_urls)) {
      lesson.video_urls.forEach((url, i) => {
        if (url && typeof url === "string" && url.trim()) {
          videos.push({
            id: `vid-${i}`,
            title: `Lesson ${lesson.order_index || 1} Overview Video #${i + 1}`,
            url: url.trim(),
            isYoutube: url.includes("youtu.be") || url.includes("youtube.com"),
            category: "Lesson Overview",
          });
        }
      });
    }

    if (Array.isArray(lesson.youtube_urls)) {
      lesson.youtube_urls.forEach((url, i) => {
        if (url && typeof url === "string" && url.trim()) {
          videos.push({
            id: `yt-${i}`,
            title: `Lesson ${lesson.order_index || 1} YouTube Tutorial #${i + 1}`,
            url: url.trim(),
            isYoutube: true,
            category: "YouTube Tutorial",
          });
        }
      });
    }

    if (Array.isArray(lesson.exercise_video_urls)) {
      lesson.exercise_video_urls.forEach((url, i) => {
        if (url && typeof url === "string" && url.trim()) {
          videos.push({
            id: `ex-vid-${i}`,
            title: `Exercise Walkthrough Video #${i + 1}`,
            url: url.trim(),
            isYoutube: url.includes("youtu.be") || url.includes("youtube.com"),
            category: "Exercise Walkthrough",
          });
        }
      });
    }

    if (Array.isArray(lesson.exercise_youtube_urls)) {
      lesson.exercise_youtube_urls.forEach((url, i) => {
        if (url && typeof url === "string" && url.trim()) {
          videos.push({
            id: `ex-yt-${i}`,
            title: `Exercise YouTube Guide #${i + 1}`,
            url: url.trim(),
            isYoutube: true,
            category: "Exercise Walkthrough",
          });
        }
      });
    }

    return videos;
  };

  // Get requirement title of previous lesson for sequential locking message
  const getPreviousRequirementName = (lessonIndex: number): string => {
    if (lessonIndex <= 0) return "";
    const prev = lessons[lessonIndex - 1];
    const prevExercises = Array.isArray(prev.exercises) ? prev.exercises : [];
    
    // Check for graded project or assignment in prev lesson
    const gradedProj = prevExercises.find(
      (ex: any) => ex.is_assignment || ex.type === "project" || (ex.title && ex.title.toLowerCase().includes("project"))
    );
    if (gradedProj) {
      const rawTitle = gradedProj.title || "Graded Project";
      if (rawTitle.toLowerCase().startsWith("lesson")) {
        return rawTitle;
      }
      return `Lesson ${prev.order_index || lessonIndex} Graded Project - ${rawTitle}`;
    }
    return `Lesson ${prev.order_index || lessonIndex} - ${prev.title}`;
  };

  return (
    <div className="space-y-4">
      {/* ── Helpful Videos Modal Dialog ─────────────────────────────────── */}
      <Dialog 
        open={!!activeHelpfulVideosModal} 
        onOpenChange={(open) => {
          if (!open) {
            setActiveHelpfulVideosModal(null);
            setSelectedVideoIdx(0);
          }
        }}
      >
        <DialogContent className="sm:max-w-4xl w-[95vw] p-0 overflow-hidden bg-slate-950 text-white border-slate-800">
          <DialogHeader className="p-4 bg-slate-900 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm">
                <Video className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1 text-left">
                <DialogTitle className="text-base text-white font-bold truncate">
                  Lesson {activeHelpfulVideosModal?.lesson.order_index || 1} Useful Videos
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400 truncate">
                  {activeHelpfulVideosModal?.lesson.title} • {activeHelpfulVideosModal?.videos.length} {activeHelpfulVideosModal?.videos.length === 1 ? 'Video' : 'Videos'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {activeHelpfulVideosModal && activeHelpfulVideosModal.videos.length > 0 && (
            <div className="flex flex-col">
              {/* Main Player Display */}
              <div className="aspect-video w-full bg-black flex items-center justify-center">
                {activeHelpfulVideosModal.videos[selectedVideoIdx]?.isYoutube ? (
                  <iframe
                    key={activeHelpfulVideosModal.videos[selectedVideoIdx]?.url}
                    src={getEmbedUrl(activeHelpfulVideosModal.videos[selectedVideoIdx]?.url)}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video
                    key={activeHelpfulVideosModal.videos[selectedVideoIdx]?.url}
                    src={activeHelpfulVideosModal.videos[selectedVideoIdx]?.url}
                    controls
                    autoPlay
                    className="w-full h-full"
                  />
                )}
              </div>

              {/* Current Playing Bar & Navigation */}
              <div className="p-3 bg-slate-900 flex items-center justify-between border-t border-slate-800">
                <div className="min-w-0 pr-2">
                  <span className="text-xs font-semibold text-white flex items-center gap-1.5 truncate">
                    <Play className="w-3.5 h-3.5 text-blue-400 fill-current" />
                    {activeHelpfulVideosModal.videos[selectedVideoIdx]?.title}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {activeHelpfulVideosModal.videos[selectedVideoIdx]?.category}
                  </span>
                </div>

                {activeHelpfulVideosModal.videos.length > 1 && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={selectedVideoIdx === 0}
                      onClick={() => setSelectedVideoIdx((prev) => Math.max(0, prev - 1))}
                      className="h-7 text-xs bg-slate-800 border-slate-700 text-slate-200 hover:text-white hover:bg-slate-700 gap-1 px-2.5"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      Prev
                    </Button>
                    <span className="text-xs text-slate-400 font-mono">
                      {selectedVideoIdx + 1} / {activeHelpfulVideosModal.videos.length}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={selectedVideoIdx === activeHelpfulVideosModal.videos.length - 1}
                      onClick={() => setSelectedVideoIdx((prev) => Math.min(activeHelpfulVideosModal.videos.length - 1, prev + 1))}
                      className="h-7 text-xs bg-slate-800 border-slate-700 text-slate-200 hover:text-white hover:bg-slate-700 gap-1 px-2.5"
                    >
                      Next
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Playlist items if multiple videos */}
              {activeHelpfulVideosModal.videos.length > 1 && (
                <div className="p-3 bg-slate-950/80 border-t border-slate-800/80 max-h-48 overflow-y-auto">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    All Helpful Videos in This Lesson:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {activeHelpfulVideosModal.videos.map((vid, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedVideoIdx(idx)}
                        className={`flex items-center gap-2.5 p-2 rounded-lg text-left transition-all border text-xs ${
                          selectedVideoIdx === idx
                            ? "bg-blue-600/25 border-blue-500 text-white font-semibold shadow"
                            : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:text-white"
                        }`}
                      >
                        <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${
                          selectedVideoIdx === idx ? "bg-blue-500 text-white" : "bg-slate-800 text-slate-400"
                        }`}>
                          <Play className="w-3 h-3 fill-current" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs">{vid.title}</p>
                          <span className="text-[10px] text-slate-400">{vid.category}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Activity Code Editor & Blueprint Modal - Fit to screen view without scrolling */}
      <Dialog open={!!activeActivityModal} onOpenChange={(open) => !open && setActiveActivityModal(null)}>
        <DialogContent className="sm:max-w-[95vw] w-[95vw] max-h-[96vh] h-[96vh] flex flex-col p-4 sm:p-5 overflow-hidden">
          <DialogHeader className="pb-2 border-b shrink-0">
            <div className="flex items-center gap-2">
              <Code2 className="w-5 h-5 text-primary" />
              <DialogTitle className="text-lg">
                {activeActivityModal?.exercise?.title || "Lesson Activity"}
              </DialogTitle>
              <Badge variant="outline" className="text-xs">
                {activeActivityModal?.exercise?.type || "Activity"}
              </Badge>
            </div>
          </DialogHeader>
          {activeActivityModal && (
            <div className="pt-2 flex-1 min-h-0 overflow-hidden">
              <ActivityCodeEditor
                exercise={{
                  ...activeActivityModal.exercise,
                  editor_type: inferEditorType(activeActivityModal.exercise, activeActivityModal.lesson.title),
                }}
                lessonId={activeActivityModal.lesson.id}
                courseId={courseId}
                isAssignment={activeActivityModal.exercise.is_assignment}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Lessons Accordion ────────────────────────────────────────────── */}
      <Accordion
        type="single"
        collapsible
        value={activeAccordion}
        onValueChange={(val) => setActiveAccordion(val || "")}
        className="space-y-3"
      >
        {lessons.map((lesson, index) => {
          const isFirstLesson = index === 0;
          const previousCompleted = index > 0 ? Boolean(lessons[index - 1].completed) : true;
          // Staff can access everything; students unlock sequentially
          const isUnlocked = canEdit || isFirstLesson || previousCompleted;
          const isCompleted = lesson.completed || false;
          const isSubmitted = lesson.submission_status === "submitted";
          const prevLessonTitle = index > 0 ? (lessons[index - 1].title || `Lesson ${index}`) : "";

          const helpfulVideos = getLessonVideos(lesson);
          const exercisesList: any[] = Array.isArray(lesson.exercises) ? lesson.exercises : [];

          // Build clean linear activities list (similar to reference image 2)
          interface ActivityItemRow {
            id: string;
            kind: "video" | "exercise" | "project" | "game" | "quiz" | "assignment";
            title: string;
            subtitle?: string;
            badgeBg: string;
            onClick: () => void;
          }

          const activityRows: ActivityItemRow[] = [];

          // 1. Useful Videos Row (First item)
          if (helpfulVideos.length > 0) {
            activityRows.push({
              id: `videos-${lesson.id}`,
              kind: "video",
              title: `Lesson ${lesson.order_index || index + 1} Useful Videos`,
              subtitle: `${helpfulVideos.length} ${helpfulVideos.length === 1 ? 'Video' : 'Videos'} • Click to watch`,
              badgeBg: "bg-[#1890ff]",
              onClick: () => {
                if (!isUnlocked && !canEdit) return;
                setSelectedVideoIdx(0);
                setActiveHelpfulVideosModal({ lesson, videos: helpfulVideos });
              },
            });
          }

          // 2. Exercises & Graded Projects & Games
          exercisesList.forEach((exercise: any, exIdx: number) => {
            const isProject = exercise.is_assignment || exercise.type === "project" || (exercise.title && exercise.title.toLowerCase().includes("graded project"));
            const isGame = exercise.type === "game" || (exercise.title && exercise.title.toLowerCase().startsWith("game"));

            let itemTitle = exercise.title || `Exercise ${exIdx + 1}`;
            let badgeBg = "bg-[#1890ff]";

            if (isGame) {
              itemTitle = itemTitle.toLowerCase().startsWith("game:") ? itemTitle : `Game: ${itemTitle}`;
              badgeBg = "bg-[#1890ff]";
            } else if (isProject) {
              itemTitle = itemTitle.toLowerCase().startsWith("lesson") ? itemTitle : `Lesson ${lesson.order_index || index + 1} Graded Project - ${itemTitle}`;
              badgeBg = "bg-[#e83e8c]"; // Pink icon box matching reference Image 2
            } else {
              itemTitle = itemTitle.toLowerCase().startsWith("lesson") ? itemTitle : `Lesson ${lesson.order_index || index + 1} Exercise - ${itemTitle}`;
              badgeBg = "bg-[#1890ff]"; // Blue icon box matching reference Image 2
            }

            activityRows.push({
              id: `ex-${exercise.id || exIdx}`,
              kind: isProject ? "project" : isGame ? "game" : "exercise",
              title: itemTitle,
              subtitle: exercise.description || undefined,
              badgeBg,
              onClick: () => {
                if (!isUnlocked && !canEdit) return;
                setActiveActivityModal({ exercise, lesson });
              },
            });
          });

          // 3. Assignment submission fallback if required & not covered in exercises
          const hasProjectExercise = exercisesList.some(
            (ex: any) => ex.is_assignment || (ex.title && ex.title.toLowerCase().includes("graded project"))
          );
          if (lesson.assignment_required && !hasProjectExercise) {
            activityRows.push({
              id: `assignment-${lesson.id}`,
              kind: "assignment",
              title: `Lesson ${lesson.order_index || index + 1} Graded Project - Final Submission`,
              subtitle: "Submit project code for evaluation",
              badgeBg: "bg-[#e83e8c]",
              onClick: () => {
                if (!isUnlocked && !canEdit) return;
                navigate(`/lesson/${lesson.id}`);
              },
            });
          }

          // 4. Quiz Row (if quiz required)
          if (lesson.quiz_required) {
            activityRows.push({
              id: `quiz-${lesson.id}`,
              kind: "quiz",
              title: `Lesson ${lesson.order_index || index + 1} Quiz`,
              subtitle: "Test your understanding of this lesson",
              badgeBg: "bg-[#1890ff]",
              onClick: () => {
                if (!isUnlocked && !canEdit) return;
                navigate(`/lesson/${lesson.id}`);
              },
            });
          }

          return (
            <AccordionItem
              key={lesson.id}
              value={lesson.id}
              className="border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-1 transition-all shadow-sm bg-card hover:border-primary/40"
            >
              {/* Accordion Trigger — clean title with lock icon if locked */}
              <AccordionTrigger className="hover:no-underline py-3.5 group">
                <div className="flex items-center gap-2 text-left w-full pr-4">
                  <span className="font-semibold text-base text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5 flex-wrap">
                    Lesson {lesson.order_index || index + 1} - {lesson.title}
                    {!isUnlocked && (
                      <Lock className="w-4 h-4 text-muted-foreground ml-1 shrink-0 inline" />
                    )}
                  </span>

                  <div className="ml-auto flex items-center gap-2 shrink-0">
                    {lesson.duration_minutes && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1 bg-muted px-2.5 py-0.5 rounded-full hidden sm:flex">
                        <Clock className="w-3 h-3" />
                        {lesson.duration_minutes}m
                      </span>
                    )}
                    {isCompleted ? (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 text-xs font-medium">
                        Graded {lesson.grade !== null && lesson.grade !== undefined ? `${lesson.grade}%` : "Completed"}
                      </Badge>
                    ) : isSubmitted ? (
                      <Badge variant="outline" className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800 text-xs font-medium animate-pulse">
                        Pending Tutor Grade
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
                  {/* Detailed Description / Content preview if available */}
                  {lesson.description && (
                    <p className="text-xs text-muted-foreground mb-2">
                      {lesson.description}
                    </p>
                  )}

                  {/* Sequential Restriction Banner */}
                  {!isUnlocked && prevLessonTitle && (
                    <div className="rounded-lg border border-amber-200/70 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/25 p-3 mb-3">
                      <p className="text-xs text-amber-800 dark:text-amber-300 flex items-center gap-1.5 font-medium">
                        <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>
                          Not available unless: The project for{" "}
                          <strong className="text-foreground font-semibold">{prevLessonTitle}</strong> has been evaluated and graded by your instructor.
                        </span>
                      </p>
                    </div>
                  )}

                  {/* Clean List of Activities */}
                  <div className={!isUnlocked && !canEdit ? "opacity-60 pointer-events-none select-none space-y-2.5" : "space-y-2.5"}>
                    {activityRows.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground text-xs border border-dashed rounded-lg bg-muted/20">
                        No activities or videos added to this lesson yet.
                      </div>
                    ) : (
                      activityRows.map((row) => (
                        <div
                          key={row.id}
                          onClick={row.onClick}
                          className="w-full flex items-center justify-between p-3 sm:p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-sm rounded-lg cursor-pointer transition-all group"
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            {/* Blue or Pink square icon badge */}
                            <div className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 shadow-sm text-white ${row.badgeBg} group-hover:scale-105 transition-transform`}>
                              <FileText className="w-5 h-5" />
                            </div>

                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                                {row.title}
                              </p>
                              {row.subtitle && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                                  {row.subtitle}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Bottom Actions Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-3 border-t border-border/40 mt-3 gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/lesson/${lesson.id}`)}
                      className="text-xs gap-1.5 text-muted-foreground hover:text-foreground w-fit"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      View Full Notes
                    </Button>

                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {/* Instructor / Admin Shortcut to grade submissions */}
                      {canEdit && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/courses/${courseId}/lessons/${lesson.id}/grading`)}
                          className="text-xs border-purple-400/40 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 gap-1.5 shadow-xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
                          Grade Submissions
                        </Button>
                      )}

                      {/* Student Progress Actions: strictly NO manual 'Mark Complete' button */}
                      {isCompleted ? (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-full">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          Lesson Graded {lesson.grade !== null && lesson.grade !== undefined ? `(${lesson.grade}%)` : ""}
                        </div>
                      ) : isSubmitted ? (
                        <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300 font-medium bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3 py-1.5 rounded-full">
                          <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                          Project Submitted — Pending Tutor Grading
                        </div>
                      ) : isUnlocked ? (
                        <Button
                          size="sm"
                          onClick={() => onStartLesson(lesson.id)}
                          className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5 shadow-xs"
                        >
                          <Play className="w-3.5 h-3.5" />
                          Start Lesson & Project
                        </Button>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                          <Lock className="w-3.5 h-3.5" />
                          Locked until previous lesson graded
                        </div>
                      )}
                    </div>
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
