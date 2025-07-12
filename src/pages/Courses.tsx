import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Clock, Users, Star, ChevronRight, Filter, Search } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { LMSLayout } from "@/components/LMSLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export default function Courses() {
  const [enrolledCourses, setEnrolledCourses] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchEnrolledCourses();
    }
  }, [user]);

  const fetchEnrolledCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('enrollments')
        .select(`
          id,
          status,
          progress_percentage,
          enrolled_at,
          courses (
            id,
            title,
            description,
            category
          )
        `)
        .eq('student_id', user?.id)
        .eq('status', 'active');

      if (error) throw error;

      setEnrolledCourses(data || []);
    } catch (error: any) {
      console.error('Error fetching enrolled courses:', error);
      toast({
        title: "Error",
        description: "Failed to load your courses.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredCourses = enrolledCourses.filter(enrollment =>
    enrollment.courses?.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    enrollment.courses?.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    enrollment.courses?.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCourseClick = (courseId: string) => {
    navigate(`/courses/${courseId}`);
  };

  if (loading) {
    return (
      <LMSLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading your courses...</p>
          </div>
        </div>
      </LMSLayout>
    );
  }

  return (
    <LMSLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">My Courses</h1>
            <p className="text-muted-foreground">Continue your learning journey</p>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input 
                placeholder="Search courses..." 
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline" size="icon">
              <Filter className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* My Courses */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              <BookOpen className="w-5 h-5 mr-2 text-primary" />
              My Courses
            </CardTitle>
            <CardDescription>
              {filteredCourses.length} course{filteredCourses.length !== 1 ? 's' : ''} {searchTerm ? 'found' : 'enrolled'}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredCourses.length > 0 ? (
              filteredCourses.map((enrollment) => (
                <div
                  key={enrollment.id}
                  className="border rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleCourseClick(enrollment.courses.id)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">{enrollment.courses.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {enrollment.courses.description}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {enrollment.courses.category}
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Progress</span>
                        <span>{enrollment.progress_percentage || 0}%</span>
                      </div>
                      <Progress value={enrollment.progress_percentage || 0} className="h-2" />
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        Status: {enrollment.status}
                      </span>
                      <Button size="sm">
                        Continue Learning
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="text-lg font-semibold mb-2">
                  {searchTerm ? 'No courses found' : 'No courses enrolled'}
                </h3>
                <p className="text-muted-foreground">
                  {searchTerm 
                    ? 'Try adjusting your search terms' 
                    : 'Contact your tutor or admin to get enrolled in courses'
                  }
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </LMSLayout>
  );
}