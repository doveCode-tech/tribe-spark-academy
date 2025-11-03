import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Award, Plus, Trash2, Edit } from "lucide-react";

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  criteria: any;
}

interface Course {
  id: string;
  title: string;
}

export function BadgeManagement() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBadge, setEditingBadge] = useState<Badge | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    icon: "Award",
    color: "#FFD700",
    badgeType: "milestone",
    courseId: "",
    lessonInterval: "2",
  });

  useEffect(() => {
    loadBadges();
    loadCourses();
  }, []);

  const loadBadges = async () => {
    const { data, error } = await supabase
      .from("badges")
      .select("*")
      .order("name");

    if (error) {
      toast({ title: "Error loading badges", variant: "destructive" });
    } else {
      setBadges(data || []);
    }
    setLoading(false);
  };

  const loadCourses = async () => {
    const { data } = await supabase.from("courses").select("id, title").order("title");
    setCourses(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const criteria: any = { type: formData.badgeType };
    if (formData.badgeType === "milestone" && formData.courseId) {
      criteria.course_id = formData.courseId;
      criteria.lesson_interval = parseInt(formData.lessonInterval);
    } else if (formData.badgeType === "course_completion" && formData.courseId) {
      criteria.course_id = formData.courseId;
    }

    const badgeData = {
      name: formData.name,
      description: formData.description,
      icon: formData.icon,
      color: formData.color,
      criteria,
    };

    if (editingBadge) {
      const { error } = await supabase
        .from("badges")
        .update(badgeData)
        .eq("id", editingBadge.id);

      if (error) {
        toast({ title: "Error updating badge", variant: "destructive" });
      } else {
        toast({ title: "Badge updated successfully" });
        resetForm();
        loadBadges();
      }
    } else {
      const { error } = await supabase.from("badges").insert(badgeData);

      if (error) {
        toast({ title: "Error creating badge", variant: "destructive" });
      } else {
        toast({ title: "Badge created successfully" });
        resetForm();
        loadBadges();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this badge?")) return;

    const { error } = await supabase.from("badges").delete().eq("id", id);

    if (error) {
      toast({ title: "Error deleting badge", variant: "destructive" });
    } else {
      toast({ title: "Badge deleted successfully" });
      loadBadges();
    }
  };

  const handleEdit = (badge: Badge) => {
    setEditingBadge(badge);
    setFormData({
      name: badge.name,
      description: badge.description || "",
      icon: badge.icon || "Award",
      color: badge.color || "#FFD700",
      badgeType: badge.criteria?.type || "milestone",
      courseId: badge.criteria?.course_id || "",
      lessonInterval: badge.criteria?.lesson_interval?.toString() || "2",
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      icon: "Award",
      color: "#FFD700",
      badgeType: "milestone",
      courseId: "",
      lessonInterval: "2",
    });
    setEditingBadge(null);
    setDialogOpen(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Badge Management</CardTitle>
            <CardDescription>
              Create and manage milestone badges for courses
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Create Badge
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingBadge ? "Edit Badge" : "Create New Badge"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Badge Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Python Hero, JavaScript Master"
                    required
                  />
                </div>

                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="What this badge represents"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Icon Name</Label>
                    <Input
                      value={formData.icon}
                      onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                      placeholder="Award, Trophy, Star, etc."
                    />
                  </div>
                  <div>
                    <Label>Color</Label>
                    <Input
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <Label>Badge Type</Label>
                  <Select
                    value={formData.badgeType}
                    onValueChange={(value) => setFormData({ ...formData, badgeType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="milestone">Milestone Badge</SelectItem>
                      <SelectItem value="course_completion">Course Completion</SelectItem>
                      <SelectItem value="manual">Manual Award Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(formData.badgeType === "milestone" || formData.badgeType === "course_completion") && (
                  <div>
                    <Label>Course</Label>
                    <Select
                      value={formData.courseId}
                      onValueChange={(value) => setFormData({ ...formData, courseId: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a course" />
                      </SelectTrigger>
                      <SelectContent>
                        {courses.map((course) => (
                          <SelectItem key={course.id} value={course.id}>
                            {course.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {formData.badgeType === "milestone" && (
                  <div>
                    <Label>Lesson Interval</Label>
                    <Input
                      type="number"
                      min="1"
                      value={formData.lessonInterval}
                      onChange={(e) => setFormData({ ...formData, lessonInterval: e.target.value })}
                      placeholder="Award every X lessons (e.g., 2, 3, 4)"
                      required
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Badge will be awarded every {formData.lessonInterval} lessons completed
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">
                    {editingBadge ? "Update Badge" : "Create Badge"}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p>Loading badges...</p>
        ) : badges.length === 0 ? (
          <p className="text-muted-foreground">No badges created yet</p>
        ) : (
          <div className="space-y-2">
            {badges.map((badge) => {
              const courseName = courses.find((c) => c.id === badge.criteria?.course_id)?.title;
              return (
                <div
                  key={badge.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: badge.color + "20" }}
                    >
                      <Award className="w-6 h-6" style={{ color: badge.color }} />
                    </div>
                    <div>
                      <h3 className="font-semibold">{badge.name}</h3>
                      <p className="text-sm text-muted-foreground">{badge.description}</p>
                      <div className="flex gap-2 mt-1">
                        <span className="text-xs px-2 py-1 bg-secondary rounded">
                          {badge.criteria?.type === "milestone"
                            ? `Every ${badge.criteria.lesson_interval} lessons`
                            : badge.criteria?.type === "course_completion"
                            ? "Course Completion"
                            : "Manual Award"}
                        </span>
                        {courseName && (
                          <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                            {courseName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(badge)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(badge.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
