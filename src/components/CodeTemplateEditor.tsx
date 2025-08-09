import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings } from "lucide-react";

interface CodeTemplateEditorProps {
  courseId: string;
  category: string;
  onSaved?: () => void;
}

const defaultSnippets: Record<string, string> = {
  python: `# Python Starter\nprint("Hello, world!")`,
  html: `<!DOCTYPE html>\n<html>\n  <head>\n    <meta charset=\"utf-8\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />\n    <title>Web Starter</title>\n  </head>\n  <body>\n    <h1>Hello, world!</h1>\n    <script src=\"./script.js\"></script>\n  </body>\n</html>`,
  css: `/* CSS Starter */\nbody {\n  font-family: system-ui, sans-serif;\n}`,
  javascript: `// JavaScript Starter\nconsole.log('Hello, world!')`,
};

function languagesForCategory(category: string): string[] {
  const c = (category || '').toLowerCase();
  if (c.includes('python')) return ['python'];
  if (c.includes('web')) return ['html', 'css', 'javascript'];
  // Fallback
  return ['python'];
}

export function CodeTemplateEditor({ courseId, category, onSaved }: CodeTemplateEditorProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const langs = useMemo(() => languagesForCategory(category), [category]);
  const [activeLang, setActiveLang] = useState<string>(langs[0]);
  const [templates, setTemplates] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setActiveLang(langs[0]);
  }, [langs]);

  const loadTemplates = async () => {
    const { data, error } = await supabase
      .from('code_templates')
      .select('language, template')
      .eq('course_id', courseId);
    if (error) {
      toast({ title: 'Error', description: 'Failed to load code templates', variant: 'destructive' });
      return;
    }
    const map: Record<string, string> = {};
    langs.forEach((l) => (map[l] = defaultSnippets[l] || ''));
    (data || []).forEach((row) => {
      map[(row as any).language] = (row as any).template || '';
    });
    setTemplates(map);
  };

  useEffect(() => {
    if (open) {
      loadTemplates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSave = async () => {
    setSaving(true);
    const payload = Object.entries(templates).map(([language, template]) => ({
      course_id: courseId,
      language,
      template,
    }));
    const { error } = await supabase
      .from('code_templates')
      .upsert(payload, { onConflict: 'course_id,language' });
    setSaving(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Saved', description: 'Code templates updated successfully.' });
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="w-4 h-4 mr-1" /> Code Templates
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit Code Templates</DialogTitle>
        </DialogHeader>

        <Tabs value={activeLang} onValueChange={setActiveLang}>
          <TabsList>
            {langs.map((l) => (
              <TabsTrigger key={l} value={l} className="capitalize">{l}</TabsTrigger>
            ))}
          </TabsList>
          {langs.map((l) => (
            <TabsContent key={l} value={l} className="mt-4">
              <Textarea
                className="min-h-[240px] font-mono text-sm"
                value={templates[l] ?? ''}
                onChange={(e) => setTemplates((prev) => ({ ...prev, [l]: e.target.value }))}
                placeholder={defaultSnippets[l]}
              />
            </TabsContent>
          ))}
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
          <Button onClick={handleSave} disabled={saving}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
