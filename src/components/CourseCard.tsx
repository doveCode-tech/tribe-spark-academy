import { Clock, Users, Star, Play, BookOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface CourseCardProps {
  course: {
    id: string;
    title: string;
    description: string;
    category: string;
  };
  enrollment?: {
    id: string;
    progress_percentage: number;
    status: string;
  };
  onEnroll?: () => void;
  onContinue?: () => void;
  isEnrolled?: boolean;
  customEnrollButton?: React.ReactNode;
}

const getCourseGradient = (category: string) => {
  const gradients: { [key: string]: string } = {
    'Python': 'bg-gradient-course-python',
    'Web Design': 'bg-gradient-course-web',
    'Artificial Intelligence': 'bg-gradient-course-ai',
    'Scratch': 'bg-gradient-course-scratch',
    'Roblox': 'bg-gradient-to-br from-red-400 to-orange-400',
    'Animation': 'bg-gradient-to-br from-purple-400 to-pink-400',
    'Graphics Design': 'bg-gradient-to-br from-blue-400 to-cyan-400',
    'Robotics': 'bg-gradient-to-br from-gray-400 to-blue-500',
    'Mobile Apps': 'bg-gradient-to-br from-green-400 to-blue-500',
    'Web Builders': 'bg-gradient-to-br from-indigo-400 to-purple-500',
  };
  return gradients[category] || 'bg-gradient-primary';
};

const getCourseEmoji = (category: string) => {
  const emojis: { [key: string]: string } = {
    'Python': '🐍',
    'Web Design': '🌐',
    'Artificial Intelligence': '🤖',
    'Scratch': '🎮',
    'Roblox': '🎲',
    'Animation': '🎬',
    'Graphics Design': '🎨',
    'Robotics': '⚙️',
    'Mobile Apps': '📱',
    'Web Builders': '🛠️',
  };
  return emojis[category] || '📚';
};

export function CourseCard({ course, enrollment, onEnroll, onContinue, isEnrolled, customEnrollButton }: CourseCardProps) {
  const progress = enrollment?.progress_percentage || 0;
  const emoji = getCourseEmoji(course.category);
  const gradient = getCourseGradient(course.category);

  return (
    <Card className="group hover:shadow-elevated transition-all duration-300 hover:-translate-y-1 bg-card border-2 hover:border-primary/30">
      <div className={`h-32 ${gradient} rounded-t-lg relative overflow-hidden`}>
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="absolute top-4 left-4">
          <div className="text-4xl">{emoji}</div>
        </div>
        <div className="absolute top-4 right-4">
          <Badge variant="secondary" className="bg-white/90 text-foreground font-semibold">
            {course.category}
          </Badge>
        </div>
        {isEnrolled && (
          <div className="absolute bottom-4 left-4 right-4">
            <div className="bg-white/90 rounded-lg p-2">
              <div className="flex justify-between text-sm font-medium mb-1">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </div>
        )}
      </div>
      
      <CardContent className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
              {course.title}
            </h3>
            <p className="text-muted-foreground text-sm mt-2 line-clamp-2">
              {course.description}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <div className="flex items-center space-x-1">
                <BookOpen className="w-4 h-4" />
                <span>10+ Lessons</span>
              </div>
              <div className="flex items-center space-x-1">
                <Clock className="w-4 h-4" />
                <span>Beginner</span>
              </div>
            </div>
          </div>

          <div className="pt-2">
            {isEnrolled ? (
              <Button 
                className="w-full bg-gradient-primary hover:opacity-90 text-white font-semibold"
                onClick={onContinue}
              >
                <Play className="w-4 h-4 mr-2" />
                {progress === 0 ? 'Start Learning' : 'Continue Learning'}
              </Button>
            ) : customEnrollButton ? (
              <div className="w-full">
                {customEnrollButton}
              </div>
            ) : (
              <Button 
                variant="outline" 
                className="w-full border-2 hover:bg-primary hover:text-primary-foreground font-semibold"
                onClick={onEnroll}
              >
                <BookOpen className="w-4 h-4 mr-2" />
                Enroll Now
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}