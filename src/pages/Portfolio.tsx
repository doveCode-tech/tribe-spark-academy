import { LMSLayout } from "@/components/LMSLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ExternalLink, Github, Eye, Calendar, Code, Cpu, Palette } from "lucide-react";

const projects = [
  {
    id: 1,
    title: "Python Snake Game",
    description: "A classic Snake game built with Python and Pygame. Features include score tracking, speed increases, and collision detection.",
    course: "Python Fundamentals",
    courseIcon: Code,
    submittedDate: "2024-01-20",
    technologies: ["Python", "Pygame"],
    githubUrl: "https://github.com/student/snake-game",
    liveUrl: "https://replit.com/@student/snake-game",
    screenshot: "/placeholder.svg",
    grade: "A+",
    feedback: "Excellent implementation with clean code structure!"
  },
  {
    id: 2,
    title: "Scratch Animation Story",
    description: "An interactive storytelling animation featuring a cat exploring different worlds with sound effects and user interactions.",
    course: "Scratch Programming",
    courseIcon: Palette,
    submittedDate: "2024-01-25",
    technologies: ["Scratch"],
    liveUrl: "https://scratch.mit.edu/projects/12345/",
    screenshot: "/placeholder.svg",
    grade: "A",
    feedback: "Creative storytelling with smooth animations!"
  },
  {
    id: 3,
    title: "LED Arduino Controller",
    description: "Arduino project that controls RGB LEDs using sensor inputs. Features multiple lighting patterns and sound reactive modes.",
    course: "Arduino Robotics",
    courseIcon: Cpu,
    submittedDate: "2024-01-28",
    technologies: ["Arduino", "C++", "Electronics"],
    githubUrl: "https://github.com/student/led-controller",
    screenshot: "/placeholder.svg",
    grade: "A+",
    feedback: "Impressive understanding of electronics and programming!"
  }
];

const skills = [
  { name: "Python", level: 85 },
  { name: "Scratch", level: 95 },
  { name: "Arduino", level: 70 },
  { name: "HTML/CSS", level: 60 },
  { name: "Problem Solving", level: 90 },
  { name: "Creative Thinking", level: 88 }
];

const certificates = [
  { name: "Python Fundamentals", issueDate: "2024-01-20", verificationId: "PF-2024-001" },
  { name: "Scratch Programming", issueDate: "2024-01-25", verificationId: "SP-2024-002" }
];

const Portfolio = () => {
  return (
    <LMSLayout>
      <div className="space-y-6">
        {/* Profile Header */}
        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <Avatar className="w-24 h-24">
                <AvatarImage src="/placeholder.svg" alt="Student" />
                <AvatarFallback className="text-2xl">AJ</AvatarFallback>
              </Avatar>
              
              <div className="flex-1">
                <h1 className="text-3xl font-bold mb-2">Alex Johnson</h1>
                <p className="text-muted-foreground mb-4">
                  Passionate young coder exploring the exciting world of programming, robotics, and creative technology.
                  I love building interactive projects and solving challenging problems!
                </p>
                
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Joined January 2024
                  </div>
                  <div>
                    🏆 {certificates.length} Certificates Earned
                  </div>
                  <div>
                    📚 {projects.length} Projects Completed
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Share Portfolio
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Projects */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>My Projects</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {projects.map((project) => {
                  const CourseIcon = project.courseIcon;
                  
                  return (
                    <div key={project.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start gap-4">
                        <img 
                          src={project.screenshot} 
                          alt={project.title}
                          className="w-20 h-20 rounded-lg object-cover bg-muted"
                        />
                        
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="font-semibold text-lg">{project.title}</h3>
                            <Badge variant="outline" className="shrink-0">
                              {project.grade}
                            </Badge>
                          </div>
                          
                          <p className="text-muted-foreground text-sm mb-3">
                            {project.description}
                          </p>
                          
                          <div className="flex items-center gap-2 mb-3">
                            <CourseIcon className="w-4 h-4" />
                            <span className="text-sm font-medium">{project.course}</span>
                            <span className="text-muted-foreground text-sm">
                              • {new Date(project.submittedDate).toLocaleDateString()}
                            </span>
                          </div>
                          
                          <div className="flex flex-wrap gap-2 mb-3">
                            {project.technologies.map((tech, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {tech}
                              </Badge>
                            ))}
                          </div>
                          
                          <div className="flex gap-2">
                            {project.liveUrl && (
                              <Button variant="outline" size="sm">
                                <Eye className="w-4 h-4 mr-1" />
                                View Project
                              </Button>
                            )}
                            {project.githubUrl && (
                              <Button variant="outline" size="sm">
                                <Github className="w-4 h-4 mr-1" />
                                Code
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Skills */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Skills</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {skills.map((skill, index) => (
                  <div key={index}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{skill.name}</span>
                      <span className="text-muted-foreground">{skill.level}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-gradient-primary h-2 rounded-full transition-all duration-500"
                        style={{ width: `${skill.level}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Certificates */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Certificates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {certificates.map((cert, index) => (
                  <div key={index} className="p-3 border rounded-lg">
                    <h4 className="font-medium text-sm">{cert.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      Issued: {new Date(cert.issueDate).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ID: {cert.verificationId}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </LMSLayout>
  );
};

export default Portfolio;