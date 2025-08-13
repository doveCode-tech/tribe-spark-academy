import { useState } from "react";
import { LMSLayout } from "@/components/LMSLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function CreateTutor() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subjects: '',
    bio: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await supabase.functions.invoke('create-tutor', {
        body: {
          name: formData.name,
          email: formData.email,
          subjects: formData.subjects,
          bio: formData.bio,
        }
      });

      if (response.error) throw response.error;

      toast({
        title: "🎓 Tutor Created!",
        description: `${formData.name} has been invited to join as a tutor!`,
      });

      setFormData({ name: '', email: '', subjects: '', bio: '' });
    } catch (error: any) {
      console.error('Error creating tutor:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create tutor",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <LMSLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">🎓 Create a New Tutor</h1>
          <p className="text-muted-foreground">Here, you can add amazing tutors who will guide our young coders!</p>
        </div>

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Steps to Create a Tutor:</CardTitle>
            <CardDescription>
              1. Enter the tutor's name and email address. 📧<br/>
              2. Assign their teaching subjects or courses. 📚<br/>
              3. Save and send them a welcome email with login details. ✨<br/><br/>
              <strong>Note:</strong> Only Admins can add tutors. Make sure the email is correct so the tutor can get started right away!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Tutor's Full Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Sarah Johnson"
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="sarah@example.com"
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subjects">Teaching Subjects</Label>
                <Input
                  id="subjects"
                  value={formData.subjects}
                  onChange={(e) => setFormData({ ...formData, subjects: e.target.value })}
                  placeholder="e.g., Python, Scratch, Robotics"
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Brief Bio (optional)</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="Tell us about this tutor's experience and expertise..."
                  rows={3}
                  disabled={loading}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? 'Creating Tutor...' : '🚀 Create Tutor & Send Invite'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </LMSLayout>
  );
}