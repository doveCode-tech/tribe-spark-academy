import { Lock, CheckCircle2, Play, BookOpen, Clock, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface SequentialLessonLockProps {
  isUnlocked: boolean;
  isCompleted: boolean;
  lessonNumber: number;
}

export function SequentialLessonLock({ 
  isUnlocked, 
  isCompleted, 
  lessonNumber 
}: SequentialLessonLockProps) {
  if (isCompleted) {
    return (
      <Badge variant="default" className="gap-1 bg-success">
        <CheckCircle2 className="w-3 h-3" />
        Completed
      </Badge>
    );
  }

  if (!isUnlocked) {
    return (
      <Badge variant="secondary" className="gap-1">
        <Lock className="w-3 h-3" />
        Locked
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="gap-1">
      Available
    </Badge>
  );
}

export function LessonCard({ 
  lesson, 
  isUnlocked, 
  isCompleted, 
  onStart 
}: { 
  lesson: any; 
  isUnlocked: boolean; 
  isCompleted: boolean; 
  onStart: () => void;
}) {
  const navigate = useNavigate();
  
  const handleViewLesson = () => {
    navigate(`/lesson/${lesson.id}`);
  };

  return (
    <Card className={!isUnlocked ? 'opacity-60' : ''}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-semibold truncate">{lesson.title}</h3>
              <SequentialLessonLock 
                isUnlocked={isUnlocked}
                isCompleted={isCompleted}
                lessonNumber={lesson.order_index}
              />
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {lesson.description}
            </p>
            {lesson.duration_minutes && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>{lesson.duration_minutes} minutes</span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {isUnlocked && !isCompleted && (
              <Button
                onClick={handleViewLesson}
                size="sm"
                variant="outline"
              >
                <BookOpen className="w-4 h-4 mr-2" />
                View Content
              </Button>
            )}
            <Button
              onClick={onStart}
              disabled={!isUnlocked || isCompleted}
              size="sm"
            >
              {isCompleted ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Completed
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  {isUnlocked ? 'Mark Complete' : 'Locked'}
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}