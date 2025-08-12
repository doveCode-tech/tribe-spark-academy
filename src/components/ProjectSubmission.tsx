import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Props { courseId: string; }

export function ProjectSubmission({ courseId }: Props) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [link, setLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let file_path: string | null = null;
      if (file) {
        const path = `${courseId}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from('project-submissions').upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        file_path = path;
      }
      const { error } = await supabase.from('projects').insert({
        course_id: courseId,
        title: title || 'Project submission',
        description: description || null,
        link: link || null,
        file_path,
      });
      if (error) throw error;
      toast({ title: '🚀 Project Submitted!', description: 'Your awesome work has been sent to your tutor!' });
      setTitle(""); setDescription(""); setLink(""); setFile(null);
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Error', description: e.message || 'Failed to submit project', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>Submit Your Project 🎯</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Input placeholder="Project title" value={title} onChange={(e)=>setTitle(e.target.value)} disabled={loading} />
          </div>
          <div>
            <Textarea placeholder="Describe your project (optional)" value={description} onChange={(e)=>setDescription(e.target.value)} rows={3} disabled={loading} />
          </div>
          <div>
            <Input placeholder="Link to your project (optional)" value={link} onChange={(e)=>setLink(e.target.value)} disabled={loading} />
          </div>
          <div>
            <Input type="file" onChange={(e)=>setFile(e.target.files?.[0] || null)} disabled={loading} />
            <p className="text-xs text-muted-foreground mt-1">You can upload a file or just share a link — either works! ✨</p>
          </div>
          <div>
            <Button type="submit" disabled={loading}>{loading ? 'Submitting...' : 'Submit Project'}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
