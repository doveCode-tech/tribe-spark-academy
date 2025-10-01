import { Lock, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
  return (
    <div 
      className={cn(
        "p-4 border rounded-lg transition-all",
        isUnlocked ? "cursor-pointer hover:shadow-md hover:border-primary" : "opacity-60 cursor-not-allowed",
        isCompleted && "bg-success/5 border-success/20"
      )}
      onClick={isUnlocked ? onStart : undefined}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold">{lesson.title}</h3>
            <SequentialLessonLock 
              isUnlocked={isUnlocked} 
              isCompleted={isCompleted} 
              lessonNumber={lesson.order_index} 
            />
          </div>
          <p className="text-sm text-muted-foreground">{lesson.description}</p>
          {!isUnlocked && !isCompleted && (
            <p className="text-xs text-warning mt-2">
              Complete previous lesson to unlock
            </p>
          )}
        </div>
      </div>
    </div>
  );
}