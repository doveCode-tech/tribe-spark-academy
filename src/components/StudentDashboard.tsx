import { BookOpen, Trophy, Clock, MessageCircle, BarChart3, Star } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const mockCourses = [
  {
    id: 1,
    title: "Python for Beginners",
    progress: 75,
    totalLessons: 20,
    completedLessons: 15,
    nextLesson: "Functions and Parameters",
    instructor: "Ms. Sarah Chen"
  },
  {
    id: 2,
    title: "Robotics Fundamentals",
    progress: 40,
    totalLessons: 15,
    completedLessons: 6,
    nextLesson: "Servo Motors",
    instructor: "Mr. David Tech"
  },
  {
    id: 3,
    title: "Web Development Basics",
    progress: 90,
    totalLessons: 12,
    completedLessons: 11,
    nextLesson: "Final Project",
    instructor: "Ms. Lisa Code"
  }
];

const mockAchievements = [
  { name: "First Steps", description: "Completed your first lesson", earned: true },
  { name: "Python Master", description: "Complete Python course", earned: false },
  { name: "Week Warrior", description: "7 days streak", earned: true },
  { name: "Project Pioneer", description: "Submit 5 projects", earned: true }
];

const mockAIRecommendations = [
  "Based on your Python progress, try the 'Data Structures' course next",
  "You're excelling in robotics! Consider the 'Advanced Sensors' module",
  "Your web development skills are strong - ready for JavaScript?"
];

export function StudentDashboard() {
  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-hero rounded-xl p-6 text-white shadow-elevated">
        <h1 className="text-3xl font-bold mb-2">Welcome back, Alex! 🚀</h1>
        <p className="text-white/90 mb-4">Ready to continue your coding journey?</p>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Trophy className="w-5 h-5" />
            <span className="font-semibold">Level 7</span>
          </div>
          <div className="flex items-center space-x-2">
            <Star className="w-5 h-5" />
            <span className="font-semibold">2,340 XP</span>
          </div>
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5" />
            <span className="font-semibold">12 Certificates</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Button className="h-16 bg-gradient-primary hover:opacity-90 transition-opacity">
          <MessageCircle className="w-5 h-5 mr-2" />
          Ask AI Assistant
        </Button>
        <Button variant="outline" className="h-16">
          <BookOpen className="w-5 h-5 mr-2" />
          View Portfolio
        </Button>
        <Button variant="outline" className="h-16">
          <Trophy className="w-5 h-5 mr-2" />
          Achievements
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* My Courses */}
        <div className="lg:col-span-2">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center">
                <BookOpen className="w-5 h-5 mr-2 text-primary" />
                My Courses
              </CardTitle>
              <CardDescription>Continue where you left off</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {mockCourses.map((course) => (
                <div key={course.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">{course.title}</h3>
                      <p className="text-muted-foreground text-sm">with {course.instructor}</p>
                    </div>
                    <Badge variant="secondary">{course.progress}%</Badge>
                  </div>
                  
                  <Progress value={course.progress} className="mb-3" />
                  
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-muted-foreground">
                      {course.completedLessons}/{course.totalLessons} lessons • Next: {course.nextLesson}
                    </div>
                    <Button size="sm" className="ml-auto">
                      Continue
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Achievements and AI Recommendations */}
        <div className="space-y-6">
          {/* Recent Achievements */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Trophy className="w-5 h-5 mr-2 text-warning" />
                Achievements
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {mockAchievements.map((achievement, index) => (
                <div key={index} className={`flex items-center space-x-3 p-2 rounded-lg ${
                  achievement.earned ? 'bg-success/10' : 'bg-muted/50'
                }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    achievement.earned ? 'bg-success text-success-foreground' : 'bg-muted'
                  }`}>
                    <Trophy className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{achievement.name}</p>
                    <p className="text-xs text-muted-foreground">{achievement.description}</p>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full mt-3">
                View All Achievements
              </Button>
            </CardContent>
          </Card>

          {/* AI Recommendations */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center">
                <MessageCircle className="w-5 h-5 mr-2 text-secondary" />
                AI Recommendations
              </CardTitle>
              <CardDescription>Personalized suggestions for you</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {mockAIRecommendations.map((recommendation, index) => (
                <div key={index} className="p-3 bg-secondary/10 rounded-lg border-l-4 border-secondary">
                  <p className="text-sm">{recommendation}</p>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full mt-3">
                <MessageCircle className="w-4 h-4 mr-2" />
                Chat with AI
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}