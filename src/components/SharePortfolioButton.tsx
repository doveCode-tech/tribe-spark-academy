import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Share2, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface SharePortfolioButtonProps {
  studentId: string;
}

export function SharePortfolioButton({ studentId }: SharePortfolioButtonProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  
  const baseOrigin = window.location.origin.includes('localhost') 
    ? window.location.origin 
    : 'https://stemtribe.org';
  const portfolioUrl = `${baseOrigin}/portfolio/student/${studentId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(portfolioUrl);
      setCopied(true);
      toast({
        title: "Link Copied!",
        description: "Portfolio link copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Please copy the link manually",
        variant: "destructive",
      });
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "My Learning Portfolio",
          text: "Check out my projects and achievements!",
          url: portfolioUrl,
        });
      } catch (error) {
        console.log('Share cancelled');
      }
    } else {
      handleCopy();
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Share2 className="w-4 h-4" />
          Share Portfolio
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share Your Portfolio</DialogTitle>
          <DialogDescription>
            Share your learning journey with others
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input value={portfolioUrl} readOnly />
            <Button onClick={handleCopy} size="icon" variant="outline">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <Button onClick={handleShare} className="w-full">
            <Share2 className="w-4 h-4 mr-2" />
            Share Link
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}