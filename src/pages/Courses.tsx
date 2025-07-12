import { LMSLayout } from "@/components/LMSLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, Users, Star, Play, BookOpen, Code, Cpu, Palette } from "lucide-react";

const mockCourses = [
  {
    id: 1,
    title: "Python Programming Fundamentals",
    description: "Learn the basics of Python programming with hands-on projects and real-world examples.",
    instructor: "Ms. Sarah Chen",
    level: "Beginner",
    duration: "6 weeks",
    students: 234,
    rating: 4.8,
    progress: 75,
    enrolled: true,
    category: "Programming",
    icon: Code,
    thumbnail: "gradient-primary"
  },
  {
    id: 2,
    title: "Robotics Engineering Basics",
    description: "Build and program robots using Arduino and sensors. Perfect introduction to robotics.",
    instructor: "Mr. David Tech",
    level: "Beginner",
    duration: "8 weeks",
    students: 189,
    rating: 4.9,
    progress: 40,
    enrolled: true,
    category: "Robotics",
    icon: Cpu,
    thumbnail: "gradient-secondary"
  },
  {
    id: 3,
    title: "Web Development with HTML & CSS",
    description: "Create beautiful, responsive websites from scratch using modern web technologies.",
    instructor: "Ms. Lisa Code",
    level: "Beginner",
    duration: "4 weeks",
    students: 156,
    rating: 4.7,
    progress: 90,
    enrolled: true,
    category: "Web Development",
    icon: BookOpen,
    thumbnail: "gradient-success"
  },
  {
    id: 4,
    title: "Creative Coding with p5.js",
    description: "Combine art and programming to create interactive digital art and animations.",
    instructor: "Mr. Alex Creative",
    level: "Intermediate",
    duration: "5 weeks",
    students: 98,
    rating: 4.6,
    progress: 0,
    enrolled: false,
    category: "Creative Tech",
    icon: Palette,
    thumbnail: "gradient-primary"
  },
  {
    id: 5,
    title: "JavaScript Game Development",
    description: "Build your own browser games using JavaScript and modern game development techniques.",
    instructor: "Ms. Game Dev",
    level: "Intermediate",
    duration: "7 weeks",
    students: 145,
    rating: 4.8,
    progress: 0,
    enrolled: false,
    category: "Programming",
    icon: Code,
    thumbnail: "gradient-secondary"
  }
];

const CourseCard = ({ course }: { course: typeof mockCourses[0] }) => {
  const IconComponent = course.icon;
  
  return (
    <Card className="shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1">
      <CardHeader className="p-0">
        <div className={`h-40 bg-${course.thumbnail} rounded-t-lg flex items-center justify-center relative overflow-hidden`}>
          <IconComponent className="w-16 h-16 text-white opacity-90" />
          <div className="absolute inset-0 bg-gradient-to-br from-black/20 to-transparent" />
          {course.enrolled && (
            <Badge className="absolute top-3 right-3 bg-success text-success-foreground">
              Enrolled
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-2">
          <Badge variant="outline" className="text-xs">
            {course.category}
          </Badge>
          <div className="flex items-center space-x-1">
            <Star className="w-4 h-4 fill-warning text-warning" />
            <span className="text-sm font-medium">{course.rating}</span>
          </div>
        </div>
        
        <CardTitle className="mb-2 line-clamp-2">{course.title}</CardTitle>
        <CardDescription className="mb-4 line-clamp-3">{course.description}</CardDescription>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>by {course.instructor}</span>
            <Badge variant="secondary" className="text-xs">
              {course.level}
            </Badge>
          </div>
          
          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            <div className="flex items-center space-x-1">
              <Clock className="w-4 h-4" />
              <span>{course.duration}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Users className="w-4 h-4" />
              <span>{course.students} students</span>
            </div>
          </div>
          
          {course.enrolled && course.progress > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{course.progress}%</span>
              </div>
              <Progress value={course.progress} />
            </div>
          )}
          
          <div className="pt-2">
            {course.enrolled ? (
              <Button className="w-full" size="sm">
                <Play className="w-4 h-4 mr-2" />
                {course.progress > 0 ? 'Continue Learning' : 'Start Course'}
              </Button>
            ) : (
              <Button variant="outline" className="w-full" size="sm">
                View Details
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default function Courses() {
  const enrolledCourses = mockCourses.filter(course => course.enrolled);
  const availableCourses = mockCourses.filter(course => !course.enrolled);

  return (
    <LMSLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">My Courses</h1>
          <p className="text-muted-foreground">Continue your learning journey</p>
        </div>

        {/* Enrolled Courses */}
        {enrolledCourses.length > 0 && (
          <section>
            <h2 className="text-2xl font-semibold mb-4 flex items-center">
              <BookOpen className="w-6 h-6 mr-2 text-primary" />
              Currently Enrolled
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {enrolledCourses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          </section>
        )}

        {/* Available Courses */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 flex items-center">
            <Star className="w-6 h-6 mr-2 text-warning" />
            Recommended Courses
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableCourses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        </section>
      </div>
    </LMSLayout>
  );
}